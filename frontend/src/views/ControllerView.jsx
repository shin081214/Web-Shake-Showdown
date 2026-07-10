import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Smartphone } from 'lucide-react';

const BACKEND_URL = '/';

const ControllerView = () => {
  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('roomId');
  
  const [roomId, setRoomId] = useState(roomIdFromUrl || '');
  const [status, setStatus] = useState('disconnected'); // disconnected, connected, error
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [color, setColor] = useState('#fff');
  const [errorMsg, setErrorMsg] = useState('');
  const [eventCount, setEventCount] = useState(0); // Debug counter
  
  const roomIdRef = useRef(roomId);
  const socketRef = useRef(null);
  const lastEmitTime = useRef(0);
  const rawOrientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const offsetRef = useRef({ alpha: 0, beta: 0, gamma: 0 });

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const handleOrientation = React.useCallback((event) => {
    rawOrientationRef.current = {
      alpha: event.alpha || 0,
      beta: event.beta || 0,
      gamma: event.gamma || 0
    };

    // Calculate calibrated data
    // We ONLY offset alpha (heading) so the phone faces the screen.
    // We leave beta (pitch) and gamma (roll) absolute, so beta=90 always means pointing UP.
    // alpha is a circular 0-360 value; subtracting the offset can produce values
    // outside that range, so wrap the result back into -180..180 to avoid a small
    // heading change near the 0/360 seam reading as a huge angle.
    const relativeAlpha =
      ((rawOrientationRef.current.alpha - offsetRef.current.alpha) % 360 + 540) % 360 - 180;
    const data = {
      alpha: relativeAlpha,
      beta: rawOrientationRef.current.beta,
      gamma: rawOrientationRef.current.gamma
    };
    
    setOrientation(data);
    setEventCount(c => c + 1); // Increment debug counter
    
    // Throttle emit to ~30fps to prevent WebSocket flooding
    const now = Date.now();
    if (now - lastEmitTime.current > 33) {
      lastEmitTime.current = now;
      if (socketRef.current) {
        socketRef.current.emit('orientation', { roomId: roomIdRef.current, data });
      }
    }
  }, []);

  const calibrate = () => {
    offsetRef.current = { ...rawOrientationRef.current };
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  const connectAndRequestPermission = async () => {
    // iOS 13+ requires explicit permission for DeviceOrientation
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          // Remove first so a repeated tap can't stack duplicate listeners.
          window.removeEventListener('deviceorientation', handleOrientation);
          window.addEventListener('deviceorientation', handleOrientation);
          connectToServer();
        } else {
          setErrorMsg('Permission denied for device orientation.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Error requesting orientation permission. Must be over HTTPS.');
      }
    } else {
      // Non iOS 13+ devices
      window.removeEventListener('deviceorientation', handleOrientation);
      window.addEventListener('deviceorientation', handleOrientation);
      connectToServer();
    }
  };

  const connectToServer = () => {
    if (!roomId) {
      setErrorMsg('Please enter a room ID');
      return;
    }

    setStatus('connecting');
    // Tear down any previous socket so reconnects don't leave orphaned connections.
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join_room', { roomId });
    });

    socket.on('joined', (data) => {
      setStatus('connected');
      setColor(data.color);
    });

    socket.on('room_error', (msg) => {
      setStatus('error');
      setErrorMsg(msg);
      socket.disconnect();
    });

    socket.on('host_disconnected', () => {
      setStatus('disconnected');
      setErrorMsg('Host disconnected. Game over.');
      socket.disconnect();
    });
  };

  return (
    <div className="controller-ui" style={{ backgroundColor: status === 'connected' ? color : 'var(--bg-color)' }}>
      {status === 'disconnected' || status === 'error' ? (
        <div className="glass-panel" style={{ width: '90%', maxWidth: '400px' }}>
          <Smartphone size={64} color="var(--primary)" />
          <h2 className="title" style={{ fontSize: '2rem' }}>Controller</h2>
          
          <input 
            type="text" 
            placeholder="Room ID" 
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            style={{ 
              padding: '1rem', 
              fontSize: '1.5rem', 
              textAlign: 'center', 
              borderRadius: '10px', 
              border: 'none',
              width: '100%',
              textTransform: 'uppercase'
            }}
          />
          
          {errorMsg && <p style={{ color: '#ff3333' }}>{errorMsg}</p>}
          
          <button className="btn" onClick={connectAndRequestPermission} style={{ width: '100%' }}>
            Connect & Play
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '4rem', fontWeight: 900, color: 'var(--primary)', textShadow: '0 0 20px var(--primary)' }}>SWING!</h1>
          <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 700, color: 'var(--secondary)', textShadow: '0 0 10px var(--secondary)' }}>CONNECTED</p>
          
          <div className="sensor-data" style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '4px', border: '1px solid var(--secondary)' }}>
            α: {orientation.alpha?.toFixed(1)}°<br/>
            β: {orientation.beta?.toFixed(1)}°<br/>
            γ: {orientation.gamma?.toFixed(1)}°<br/>
            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Events: {eventCount}</span>
          </div>

          <button
            style={{
              marginTop: '3rem',
              padding: '1rem 3rem',
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#000',
              backgroundColor: '#ffdd00',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 0 20px rgba(255,221,0,0.5)',
              cursor: 'pointer'
            }}
            onClick={calibrate}
          >
            정렬 (Calibrate)
          </button>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7, textAlign: 'center' }}>
            화면을 향해 폰을 정면으로 들고<br/>정렬 버튼을 누르세요.
          </p>
        </div>
      )}
    </div>
  );
};

export default ControllerView;
