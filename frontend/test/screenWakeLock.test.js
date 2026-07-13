import test from 'node:test';
import assert from 'node:assert/strict';
import { createScreenWakeLock } from '../src/screenWakeLock.js';

function createFakes() {
  const listeners = new Map();
  let requests = 0;
  let releases = 0;
  let releaseHandler = null;

  const documentObject = {
    visibilityState: 'visible',
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const navigatorObject = {
    wakeLock: {
      async request(type) {
        assert.equal(type, 'screen');
        requests += 1;
        return {
          addEventListener(type, handler) {
            if (type === 'release') releaseHandler = handler;
          },
          async release() { releases += 1; },
        };
      },
    },
  };

  return {
    documentObject,
    navigatorObject,
    listeners,
    simulateSystemRelease() { releaseHandler?.(); },
    counts: () => ({ requests, releases }),
  };
}

test('screen wake lock stays active while the controller is active', async () => {
  const fakes = createFakes();
  const wakeLock = createScreenWakeLock(fakes);

  await wakeLock.start();
  assert.deepEqual(fakes.counts(), { requests: 1, releases: 0 });

  await wakeLock.stop();
  assert.deepEqual(fakes.counts(), { requests: 1, releases: 1 });
});

test('screen wake lock is reacquired after returning to the controller', async () => {
  const fakes = createFakes();
  const wakeLock = createScreenWakeLock(fakes);

  await wakeLock.start();
  fakes.simulateSystemRelease();
  fakes.documentObject.visibilityState = 'visible';
  fakes.listeners.get('visibilitychange')();
  await Promise.resolve();

  assert.deepEqual(fakes.counts(), { requests: 2, releases: 0 });
  await wakeLock.stop();
});
