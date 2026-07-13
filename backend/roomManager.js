const generateRoomId = (random = Math.random) => {
  return random().toString(36).slice(2, 6).padEnd(4, '0').toUpperCase();
};

const createRoom = (rooms, hostId, random = Math.random) => {
  let roomId;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    roomId = generateRoomId(random);
    if (!rooms.has(roomId)) {
      const room = { hostId, players: {} };
      rooms.set(roomId, room);
      return { roomId, room };
    }
  }
  throw new Error('Unable to allocate a unique room ID');
};

const replaceRoom = (rooms, hostId, currentRoomId, random = Math.random) => {
  const normalizedRoomId = currentRoomId?.toUpperCase();
  const currentRoom = rooms.get(normalizedRoomId);
  if (!currentRoom || currentRoom.hostId !== hostId) return null;

  const playerIds = Object.keys(currentRoom.players);
  // Reserve the replacement while the old room still exists so its ID can
  // never be immediately reused for the new QR code.
  const replacement = createRoom(rooms, hostId, random);
  rooms.delete(normalizedRoomId);

  return {
    previousRoomId: normalizedRoomId,
    playerIds,
    ...replacement,
  };
};

module.exports = {
  createRoom,
  generateRoomId,
  replaceRoom,
};
