const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitUntilReady(child) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server startup timed out')), 5000);
    const onData = (chunk) => {
      if (!chunk.toString().includes('Server listening')) return;
      clearTimeout(timeout);
      child.stderr.off('data', onErrorData);
      resolve();
    };
    const onErrorData = (chunk) => {
      clearTimeout(timeout);
      reject(new Error(chunk.toString()));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onErrorData);
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`server exited before startup with code ${code}`));
    });
  });
}

test('the deployed server exposes health and frontend routes on one origin', async (t) => {
  const distPath = await mkdtemp(path.join(os.tmpdir(), 'web-shake-server-dist-'));
  await writeFile(path.join(distPath, 'index.html'), '<main>deployed frontend</main>');
  t.after(() => rm(distPath, { recursive: true, force: true }));

  const port = await reservePort();
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      FRONTEND_DIST_PATH: distPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => {
    if (!child.killed) child.kill('SIGTERM');
  });
  await waitUntilReady(child);

  const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
  const joinResponse = await fetch(`http://127.0.0.1:${port}/join?roomId=ABCD`);

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });
  assert.equal(joinResponse.status, 200);
  assert.equal(await joinResponse.text(), '<main>deployed frontend</main>');
});
