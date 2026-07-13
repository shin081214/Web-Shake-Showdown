const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { mountProductionFrontend } = require('../productionFrontend');

async function startApp(t, distPath) {
  const app = express();
  mountProductionFrontend(app, { distPath });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function createDist(t) {
  const distPath = await mkdtemp(path.join(os.tmpdir(), 'web-shake-dist-'));
  await mkdir(path.join(distPath, 'assets'));
  await writeFile(path.join(distPath, 'index.html'), '<main>Web-Shake Showdown</main>');
  await writeFile(path.join(distPath, 'assets', 'app.js'), 'console.log("ready")');
  t.after(() => rm(distPath, { recursive: true, force: true }));
  return distPath;
}

test('health endpoint reports that the service is ready', async (t) => {
  const baseUrl = await startApp(t);

  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('built frontend assets are served from the configured dist directory', async (t) => {
  const distPath = await createDist(t);
  const baseUrl = await startApp(t, distPath);

  const response = await fetch(`${baseUrl}/assets/app.js`);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'console.log("ready")');
  assert.match(response.headers.get('content-type'), /javascript/);
});

test('client-side routes fall back to the frontend entry point', async (t) => {
  const distPath = await createDist(t);
  const baseUrl = await startApp(t, distPath);

  const response = await fetch(`${baseUrl}/join?roomId=ABCD`);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<main>Web-Shake Showdown</main>');
  assert.match(response.headers.get('content-type'), /text\/html/);
});
