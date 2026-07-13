import React, { startTransition, useCallback, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import GameScene from '../components/GameScene';
import { playHit, startMusic, stopMusic } from '../audio';
import {
  GAME_RESULT_DURATION_MS,
  INITIAL_LIVES,
  createPlayerLives,
  getGameStateAfterMiss,
  incrementScore,
  loseLife,
} from '../gameLogic';

// Use relative path to leverage Vite's proxy
const BACKEND_URL = '/';

const HostView = () => {
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState({});
  const [scores, setScores] = useState({});
  const [lives, setLives] = useState({});
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, finished
  const [finalResults, setFinalResults] = useState([]);
  const [audioError, setAudioError] = useState(null);
  const [resultSecondsLeft, setResultSecondsLeft] = useState(
    () => Math.ceil(GAME_RESULT_DURATION_MS / 1000)
  );
  const [debugData, setDebugData] = useState({});
  const socketRef = useRef(null);
  const roomIdRef = useRef(null);
  const livesRef = useRef({});
  const scoresRef = useRef({});
  const replacingRoomRef = useRef(false);
  const finishGameRef = useRef(() => {});
  // Use a ref for high-frequency orientation data to avoid re-rendering HostView 60 times a second
  const playerOrientations = useRef({});

  useEffect(() => {
    // Connect to backend
    socketRef.current = io(BACKEND_URL, { transports: ['websocket'] });
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('create_room');
    });

    socket.on('room_created', (id) => {
      replacingRoomRef.current = false;
      roomIdRef.current = id;
      setRoomId(id);
    });

    socket.on('player_joined', ({ playerId, color }) => {
      setPlayers(prev => ({
        ...prev,
        [playerId]: { id: playerId, color }
      }));
      setScores(prev => {
        const next = { ...prev, [playerId]: 0 };
        scoresRef.current = next;
        return next;
      });
      setLives(prev => {
        const next = { ...prev, [playerId]: INITIAL_LIVES };
        livesRef.current = next;
        return next;
      });
      // Initialize orientation in ref
      playerOrientations.current[playerId] = { alpha: 0, beta: 0, gamma: 0 };
    });

    socket.on('player_left', ({ playerId }) => {
      setPlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[playerId];
        return newPlayers;
      });
      setScores(prev => {
        const next = { ...prev };
        delete next[playerId];
        scoresRef.current = next;
        return next;
      });
      setLives(prev => {
        const next = { ...prev };
        delete next[playerId];
        livesRef.current = next;
        return next;
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
      stopMusic();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'finished') return undefined;

    const startedAt = Date.now();
    setResultSecondsLeft(Math.ceil(GAME_RESULT_DURATION_MS / 1000));
    const countdown = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setResultSecondsLeft(Math.max(
        0,
        Math.ceil((GAME_RESULT_DURATION_MS - elapsed) / 1000)
      ));
    }, 250);

    const replaceRoom = window.setTimeout(() => {
      const finishedRoomId = roomIdRef.current;
      roomIdRef.current = null;
      livesRef.current = {};
      scoresRef.current = {};
      playerOrientations.current = {};
      setRoomId(null);
      setPlayers({});
      setScores({});
      setLives({});
      setDebugData({});
      setFinalResults([]);
      setGameState('waiting');
      socketRef.current?.emit('replace_room', { roomId: finishedRoomId });
    }, GAME_RESULT_DURATION_MS);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(replaceRoom);
    };
  }, [gameState]);

  const finishGame = useCallback(() => {
    if (replacingRoomRef.current) return;
    replacingRoomRef.current = true;
    stopMusic();
    setFinalResults(Object.values(players).map((player, index) => ({
      id: player.id,
      color: player.color,
      label: `P${index + 1}`,
      score: scoresRef.current[player.id] ?? 0,
    })));
    setGameState('finished');
  }, [players]);
  finishGameRef.current = finishGame;

  const startGame = () => {
    const playerIds = Object.keys(players);
    const resetLives = createPlayerLives(playerIds);
    const resetScores = Object.fromEntries(playerIds.map(playerId => [playerId, 0]));
    replacingRoomRef.current = false;
    livesRef.current = resetLives;
    scoresRef.current = resetScores;
    setLives(resetLives);
    setScores(resetScores);
    setFinalResults([]);
    setAudioError(null);
    void startMusic(() => finishGameRef.current()).catch(error => {
      console.error('Could not start Toxic:', error);
      stopMusic();
      replacingRoomRef.current = false;
      setAudioError('음악을 재생하지 못했습니다. 브라우저 오디오 권한을 확인한 뒤 다시 시작해 주세요.');
      setGameState('waiting');
    });
    setGameState('playing');
  };

  const handleHit = useCallback((playerId) => {
    playHit();
    socketRef.current?.emit('player_hit', {
      roomId: roomIdRef.current,
      playerId,
    });
    // Score UI is intentionally separate from players so a hit never invalidates
    // or reconciles the 3D game tree.
    const nextScores = incrementScore(scoresRef.current, playerId);
    scoresRef.current = nextScores;
    startTransition(() => setScores(nextScores));
  }, []);

  const handleMiss = useCallback((playerId) => {
    if (!(playerId in livesRef.current)) return;
    const nextLives = loseLife(livesRef.current, playerId);
    livesRef.current = nextLives;
    setLives(nextLives);
    const nextGameState = getGameStateAfterMiss(nextLives, playerId);
    if (nextGameState === 'finished') {
      finishGame();
      return;
    }
    setGameState(nextGameState);
  }, [finishGame]);

  const joinUrl = `${window.location.protocol}//${window.location.host}/join?roomId=${roomId}`;

  return (
    <div className="app-container">
      {gameState === 'waiting' && (
        <div className="glass-panel">
          <h1 className="title">Web-Shake Showdown</h1>
          <p className="subtitle">Scan to join with your smartphone</p>
          {audioError && (
            <p role="alert" style={{ color: '#ff5577', maxWidth: '32rem' }}>
              {audioError}
            </p>
          )}

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

      {gameState === 'finished' && (
        <div className="glass-panel" style={{ minWidth: 'min(520px, 88vw)', textAlign: 'center' }}>
          <h1 className="title" style={{ color: '#ff2d78', textShadow: '0 0 22px #ff0055' }}>
            GAME OVER
          </h1>
          <p className="subtitle" style={{ letterSpacing: '0.28rem' }}>FINAL SCORE</p>

          <div style={{ display: 'grid', gap: '18px', margin: '32px 0' }}>
            {finalResults.map(result => (
              <div
                key={result.id}
                style={{
                  padding: '18px 28px',
                  border: `1px solid ${result.color}`,
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.38)',
                  boxShadow: `0 0 18px ${result.color}55`,
                }}
              >
                <div style={{ color: result.color, fontSize: '1.2rem', fontWeight: 800 }}>
                  {result.label}
                </div>
                <div
                  style={{
                    color: result.color,
                    fontSize: '4rem',
                    fontWeight: 900,
                    lineHeight: 1.05,
                    textShadow: `0 0 18px ${result.color}`,
                  }}
                >
                  {result.score}
                </div>
              </div>
            ))}
          </div>

          <p className="subtitle" style={{ marginBottom: 0 }}>
            {resultSecondsLeft}초 후 새 QR 코드로 이동합니다
          </p>
        </div>
      )}

      {gameState === 'playing' && (
        <>
          <div className="overlay">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              {Object.values(players).map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="score-display" style={{ color: p.color }}>
                    P{Object.keys(players).indexOf(p.id) + 1}: {scores[p.id] ?? 0}
                  </div>
                  <div
                    aria-label={`${lives[p.id] ?? INITIAL_LIVES} lives remaining`}
                    style={{
                      color: '#ff2d55',
                      fontSize: '2rem',
                      letterSpacing: '0.22rem',
                      lineHeight: 1,
                      textShadow: '0 0 12px #ff0055',
                    }}
                  >
                    {Array.from({ length: INITIAL_LIVES }, (_, index) => (
                      <span
                        key={index}
                        style={{ opacity: index < (lives[p.id] ?? INITIAL_LIVES) ? 1 : 0.18 }}
                      >
                        ♥
                      </span>
                    ))}
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
          <GameScene
            players={players}
            playerOrientations={playerOrientations}
            onHit={handleHit}
            onMiss={handleMiss}
          />
        </>
      )}
    </div>
  );
};

export default HostView;
