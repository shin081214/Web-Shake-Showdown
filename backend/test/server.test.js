const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');

function waitForSocketEvent(socket, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`timed out waiting for Socket.IO event: ${eventName}`));
    }, timeoutMs);
    const onEvent = (...args) => {
      clearTimeout(timeout);
      resolve(args);
    };
    socket.once(eventName, onEvent);
  });
}

async function waitUntilReady(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.stderr.off('data', onErrorData);
      child.off('exit', onExit);
    };
    const onData = (chunk) => {
      const match = chunk.toString().match(/Server listening on 0\.0\.0\.0:(\d+)/);
      if (!match || Number(match[1]) === 0) return;
      cleanup();
      resolve(Number(match[1]));
    };
    const onErrorData = (chunk) => {
      stderr += chunk.toString();
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(
        `server exited before startup with code ${code}, signal ${signal}\n${stderr}`
      ));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`server startup timed out\n${stderr}`));
    }, 5000);

    child.stdout.on('data', onData);
    child.stderr.on('data', onErrorData);
    child.once('exit', onExit);
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}

test('the deployed server exposes health and frontend routes on one origin', async (t) => {
  const distPath = await mkdtemp(path.join(os.tmpdir(), 'web-shake-server-dist-'));
  await writeFile(path.join(distPath, 'index.html'), '<main>deployed frontend</main>');
  t.after(() => rm(distPath, { recursive: true, force: true }));

  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '0',
      FRONTEND_DIST_PATH: distPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => stopChild(child));
  const port = await waitUntilReady(child);

  const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
  const joinResponse = await fetch(`http://127.0.0.1:${port}/join?roomId=ABCD`);
  const baseUrl = `http://127.0.0.1:${port}`;
  const socket = io(baseUrl, {
    transports: ['websocket'],
    extraHeaders: { Origin: baseUrl },
    forceNew: true,
    reconnection: false,
  });
  t.after(() => socket.close());
  await waitForSocketEvent(socket, 'connect');
  const roomCreated = waitForSocketEvent(socket, 'room_created');
  socket.emit('create_room');
  const [roomId] = await roomCreated;
  const crossOriginSocketResponse = await fetch(
    `http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling`,
    { headers: { Origin: 'https://attacker.example' } }
  );

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });
  assert.equal(joinResponse.status, 200);
  assert.equal(await joinResponse.text(), '<main>deployed frontend</main>');
  assert.match(roomId, /^[A-Z0-9]{4}$/);
  assert.equal(crossOriginSocketResponse.status, 403);
});
