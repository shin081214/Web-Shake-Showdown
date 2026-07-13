const SIXTY_FPS_INTERVAL_MS = 1000 / 60;

export function createOrientationPublisher({
  now = () => performance.now(),
  minIntervalMs = SIXTY_FPS_INTERVAL_MS,
} = {}) {
  let lastSentAt = -Infinity;

  return (socket, roomId, data) => {
    const sentAt = now();
    if (!socket?.connected || sentAt - lastSentAt < minIntervalMs) return false;

    lastSentAt = sentAt;
    socket.volatile.emit('orientation', { roomId, data });
    return true;
  };
}
