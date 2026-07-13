const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoom, replaceRoom } = require('../roomManager');

test('replacing a finished room removes its controllers and creates a fresh empty room', () => {
  const rooms = new Map();
  const randomValues = [0.123456, 0.654321];
  const random = () => randomValues.shift();
  const first = createRoom(rooms, 'host-1', random);
  first.room.players['phone-1'] = { color: '#ff0055', connected: true };

  const replacement = replaceRoom(rooms, 'host-1', first.roomId, random);

  assert.ok(replacement);
  assert.notEqual(replacement.roomId, first.roomId);
  assert.deepEqual(replacement.playerIds, ['phone-1']);
  assert.equal(rooms.has(first.roomId), false);
  assert.deepEqual(rooms.get(replacement.roomId), {
    hostId: 'host-1',
    players: {},
  });
});

test('only the host that owns a room can replace it', () => {
  const rooms = new Map();
  const first = createRoom(rooms, 'host-1', () => 0.123456);

  const replacement = replaceRoom(rooms, 'controller-1', first.roomId, () => 0.654321);

  assert.equal(replacement, null);
  assert.equal(rooms.has(first.roomId), true);
});
