import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendEntry = path.resolve(__dirname, '../../backend/index.js');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function waitForOutput(process, text, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`서버 준비 시간 초과: ${text}`)), timeoutMs);
    const onData = chunk => {
      if (!chunk.toString().includes(text)) return;
      clearTimeout(timer);
      process.stdout.off('data', onData);
      resolve();
    };
    process.stdout.on('data', onData);
  });
}

function once(socket, event, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`소켓 이벤트 시간 초과: ${event}`));
    }, timeoutMs);
    const onEvent = payload => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

test('휴대폰 위치 맞춤 시작과 완료를 컴퓨터 화면에 전달한다', async t => {
  const port = await getFreePort();
  const backend = spawn(process.execPath, [backendEntry], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sockets = [];

  t.after(() => {
    for (const socket of sockets) socket.disconnect();
    backend.kill('SIGTERM');
  });

  await waitForOutput(backend, `0.0.0.0:${port}`);

  const url = `http://127.0.0.1:${port}`;
  const host = io(url, { transports: ['websocket'], autoConnect: false, reconnection: false });
  const controller = io(url, { transports: ['websocket'], autoConnect: false, reconnection: false });
  sockets.push(host, controller);

  const hostConnected = once(host, 'connect');
  host.connect();
  await hostConnected;
  const roomCreated = once(host, 'room_created');
  host.emit('create_room');
  const roomId = await roomCreated;

  const controllerConnected = once(controller, 'connect');
  controller.connect();
  await controllerConnected;
  const playerJoined = once(host, 'player_joined');
  controller.emit('join_room', { roomId });
  const player = await playerJoined;

  const alignmentStarted = once(host, 'player_calibration_started');
  controller.emit('calibration_started', { roomId });
  assert.deepEqual(await alignmentStarted, { playerId: player.playerId });

  const alignmentCompleted = once(host, 'player_calibration_completed');
  controller.emit('calibration_completed', { roomId });
  assert.deepEqual(await alignmentCompleted, { playerId: player.playerId });
});
