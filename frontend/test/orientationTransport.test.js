import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrientationPublisher } from '../src/orientationTransport.js';

test('orientation publisher sends fresh input at 60fps without queueing stale frames', () => {
  const events = [];
  let now = 100;
  const socket = {
    connected: true,
    volatile: {
      emit(event, payload) { events.push({ event, payload }); },
    },
  };
  const publish = createOrientationPublisher({ now: () => now });

  assert.equal(publish(socket, 'ABCD', { alpha: 1 }), true);
  now += 5;
  assert.equal(publish(socket, 'ABCD', { alpha: 2 }), false);
  now += 12;
  assert.equal(publish(socket, 'ABCD', { alpha: 3 }), true);

  assert.deepEqual(events, [
    { event: 'orientation', payload: { roomId: 'ABCD', data: { alpha: 1 } } },
    { event: 'orientation', payload: { roomId: 'ABCD', data: { alpha: 3 } } },
  ]);
});
