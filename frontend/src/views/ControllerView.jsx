import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Smartphone } from 'lucide-react';
import AlignmentGuide from '../components/AlignmentGuide';
import { createOrientationPublisher } from '../orientationTransport';
import { createScreenWakeLock } from '../screenWakeLock';
import { vibrateOnHit } from '../hitHaptics';

const BACKEND_URL = '/';

const ControllerView = () => {
  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('roomId');

  const [roomId, setRoomId] = useState(roomIdFromUrl || '');
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [alignmentStage, setAlignmentStage] = useState('idle'); // idle, aligning, ready
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [color, setColor] = useState('#fff');
  const [errorMsg, setErrorMsg] = useState('');
  const [eventCount, setEventCount] = useState(0); // Debug counter

  const roomIdRef = useRef(roomId);
  const socketRef = useRef(null);
  const publishOrientationRef = useRef(null);
  const wakeLockRef = useRef(null);
  const lastUiUpdateTime = useRef(0);
  const eventCountRef = useRef(0);
  const rawOrientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const offsetRef = useRef({ alpha: 0, beta: 0, gamma: 0 });

  if (!publishOrientationRef.current) publishOrientationRef.current = createOrientationPublisher();
  if (!wakeLockRef.current) wakeLockRef.current = createScreenWakeLock();

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

    eventCountRef.current += 1;

    // Keep diagnostic React renders infrequent. Sensor input still travels at up
    // to 60fps below, without making the controller UI compete for the main thread.
    const now = performance.now();
    if (now - lastUiUpdateTime.current >= 100) {
      lastUiUpdateTime.current = now;
      setOrientation(data);
      setEventCount(eventCountRef.current);
    }

    // Volatile transport drops stale frames instead of letting old movement queue up.
    publishOrientationRef.current(socketRef.current, roomIdRef.current, data);
  }, []);

  const completeCalibration = () => {
    offsetRef.current = { ...rawOrientationRef.current };
    setAlignmentStage('ready');
    socketRef.current?.emit('calibration_completed', { roomId: roomIdRef.current });
  };

  const beginCalibration = () => {
    setAlignmentStage('aligning');
    socketRef.current?.emit('calibration_started', { roomId: roomIdRef.current });
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      void wakeLockRef.current?.stop();
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  const connectAndRequestPermission = async () => {
    // Must begin from this tap on iOS. The lock is reacquired automatically when
    // the page becomes visible again after an app switch.
    void wakeLockRef.current.start();

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
          setErrorMsg('동작 센서 권한이 필요합니다. 권한을 허용해주세요.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('동작 센서를 사용할 수 없습니다. 보안 연결로 다시 접속해주세요.');
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
      setErrorMsg('방 코드를 입력해주세요.');
      return;
    }

    setStatus('connecting');
    // Tear down any previous socket so reconnects don't leave orphaned connections.
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    socketRef.current = io(BACKEND_URL, { transports: ['websocket'] });
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join_room', { roomId });
    });

    socket.on('joined', (data) => {
      setStatus('connected');
      setColor(data.color);
      setAlignmentStage('aligning');
      socket.emit('calibration_started', { roomId: data.roomId });
    });

    socket.on('hit_feedback', () => {
      vibrateOnHit();
    });

    socket.on('room_error', (msg) => {
      setStatus('error');
      setErrorMsg(msg);
      void wakeLockRef.current.stop();
      socket.disconnect();
    });

    socket.on('game_ended', () => {
      roomIdRef.current = '';
      setRoomId('');
      setStatus('disconnected');
      setAlignmentStage('idle');
      setErrorMsg('게임이 종료되었습니다. 화면의 새 QR 코드를 스캔하세요.');
      window.removeEventListener('deviceorientation', handleOrientation);
      void wakeLockRef.current.stop();
      socket.disconnect();
    });

    socket.on('host_disconnected', () => {
      setStatus('disconnected');
      setErrorMsg('컴퓨터 연결이 끊어져 게임이 종료되었습니다.');
      void wakeLockRef.current.stop();
      socket.disconnect();
    });
  };

  return (
    <div className="controller-ui" style={{ backgroundColor: status === 'connected' ? color : 'var(--bg-color)' }}>
      {status !== 'connected' ? (
        <div className="glass-panel" style={{ width: '90%', maxWidth: '400px' }}>
          <Smartphone size={64} color="var(--primary)" />
          <h2 className="title" style={{ fontSize: '2rem' }}>휴대폰 컨트롤러</h2>

          <input
            type="text"
            aria-label="방 코드"
            placeholder="방 코드"
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

          {errorMsg && <p style={{ color: '#ff5a78', textAlign: 'center' }}>{errorMsg}</p>}

          <button
            className="btn"
            onClick={connectAndRequestPermission}
            disabled={status === 'connecting'}
            style={{ width: '100%', opacity: status === 'connecting' ? 0.55 : 1 }}
          >
            {status === 'connecting' ? '연결하는 중...' : '연결하고 시작하기'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(2.8rem, 15vw, 4rem)', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.8)' }}>
            휘두르세요!
          </h1>
          <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 700, color: '#fff' }}>
            연결 완료
          </p>

          <div className="sensor-data" style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.52)', padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.55)' }}>
            좌우: {orientation.alpha?.toFixed(1)}°<br/>
            앞뒤: {orientation.beta?.toFixed(1)}°<br/>
            기울기: {orientation.gamma?.toFixed(1)}°<br/>
            <span style={{ fontSize: '0.8rem', opacity: 0.65 }}>센서 감지: {eventCount}회</span>
          </div>

          <button
            style={{
              marginTop: '3rem',
              padding: '1rem 3rem',
              fontSize: '1.2rem',
              fontWeight: 800,
              color: '#000',
              backgroundColor: '#fff',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 0 20px rgba(255,255,255,0.5)',
              cursor: 'pointer'
            }}
            onClick={beginCalibration}
          >
            휴대폰 위치 다시 맞추기
          </button>
          <p style={{ marginTop: '1rem', fontSize: '0.95rem', fontWeight: 700, opacity: 0.88, textAlign: 'center' }}>
            위치 맞춤 완료 · 이제 휴대폰을 검처럼 움직이세요
          </p>
        </div>
      )}

      {status === 'connected' && alignmentStage === 'aligning' && (
        <AlignmentGuide
          mode="controller"
          color={color}
          onConfirm={completeCalibration}
        />
      )}
    </div>
  );
};

export default ControllerView;
