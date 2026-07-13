import test from 'node:test';
import assert from 'node:assert/strict';
import { HIT_VIBRATION_PATTERN, vibrateOnHit } from '../src/hitHaptics.js';

test('a destroyed obstacle triggers a sharp double-pulse vibration', () => {
  const calls = [];

  const didVibrate = vibrateOnHit(pattern => {
    calls.push(pattern);
    return true;
  });

  assert.equal(didVibrate, true);
  assert.deepEqual(calls, [HIT_VIBRATION_PATTERN]);
  assert.deepEqual(HIT_VIBRATION_PATTERN, [35, 20, 70]);
});

test('unsupported or rejected vibration never interrupts the controller', () => {
  assert.equal(vibrateOnHit(null), false);
  assert.equal(vibrateOnHit(() => { throw new Error('not allowed'); }), false);
});
