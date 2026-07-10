import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import GameScene from '../components/GameScene';
import { initAudio } from '../audio';

// Use relative path to leverage Vite's proxy
const BACKEND_URL = '/';

const HostView = () => {
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, gameover
  const [debugData, setDebugData] = useState({});
  const socketRef = useRef(null);
  // Use a ref for high-frequency orientation data to avoid re-rendering HostView 60 times a second
  const playerOrientations = useRef({});

  useEffect(() => {
    // Connect to backend
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('create_room');
    });

    socket.on('room_created', (id) => {
      setRoomId(id);
    });

    socket.on('player_joined', ({ playerId, color }) => {
      setPlayers(prev => ({
        ...prev,
        [playerId]: { id: playerId, color, score: 0 }
      }));
      // Initialize orientation in ref
      playerOrientations.current[playerId] = { alpha: 0, beta: 0, gamma: 0 };
    });

    socket.on('player_left', ({ playerId }) => {
      setPlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[playerId];
        return newPlayers;
      });
      delete playerOrientations.current[playerId];
    });

    socket.on('player_orientation', ({ playerId, data }) => {
      // Mutate ref directly for high-speed updates without React re-renders
      if (playerOrientations.current[playerId]) {
        playerOrientations.current[playerId] = data;
      }
      
      // Throttled UI update to verify reception on screen (about 3 times a second)
      if (Math.random() < 0.1) {
        setDebugData(prev => ({ ...prev, [playerId]: data }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const startGame = () => {
    initAudio();
    setGameState('playing');
  };

  const handleHit = (playerId) => {
    playHit();
    setPlayers(prev => {
      if (!prev[playerId]) return prev;
      return {
        ...prev,
        [playerId]: { ...prev[playerId], score: prev[playerId].score + 10 }
      };
    });
  };

  const joinUrl = `${window.location.protocol}//${window.location.host}/join?roomId=${roomId}`;

  return (
    <div className="app-container">
      {gameState === 'waiting' && (
        <div className="glass-panel">
          <h1 className="title">Web-Shake Showdown</h1>
          <p className="subtitle">Scan to join with your smartphone</p>
          
          {roomId ? (
            <>
              <div className="qr-container">
                <QRCodeSVG value={joinUrl} size={256} />
              </div>
              <div className="room-id">{roomId}</div>
              
              <div className="players-list">
                <h3>Players Connected: {Object.keys(players).length}</h3>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {Object.values(players).map(p => (
                    <div key={p.id} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}></div>
                  ))}
                </div>
              </div>

              <button 
                className="btn" 
                onClick={startGame}
                disabled={Object.keys(players).length === 0}
                style={{ opacity: Object.keys(players).length === 0 ? 0.5 : 1 }}
              >
                Start Game
              </button>
            </>
          ) : (
            <p>Creating room...</p>
          )}
        </div>
      )}

      {gameState === 'playing' && (
        <>
          <div className="overlay">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              {Object.values(players).map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="score-display" style={{ color: p.color }}>
                    P{Object.keys(players).indexOf(p.id) + 1}: {p.score}
                  </div>
                  {debugData[p.id] && (
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '5px' }}>
                      α: {debugData[p.id].alpha?.toFixed(0)}°<br/>
                      β: {debugData[p.id].beta?.toFixed(0)}°<br/>
                      γ: {debugData[p.id].gamma?.toFixed(0)}°
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Could add a timer or combo counter here */}
          </div>
          <GameScene players={players} playerOrientations={playerOrientations} onHit={handleHit} />
        </>
      )}
    </div>
  );
};

export default HostView;
