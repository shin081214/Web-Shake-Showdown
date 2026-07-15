export const CALIBRATION_ALIGNING = 'aligning';
export const CALIBRATION_READY = 'ready';

export function setPlayerCalibration(calibration, playerId, status) {
  return { ...calibration, [playerId]: status };
}

export function removePlayerCalibration(calibration, playerId) {
  const next = { ...calibration };
  delete next[playerId];
  return next;
}

export function getCalibrationSummary(players, calibration) {
  const playerIds = Object.keys(players);
  const ready = playerIds.filter(playerId => calibration[playerId] === CALIBRATION_READY).length;
  const pending = playerIds.length - ready;
  const allReady = playerIds.length > 0 && pending === 0;

  return {
    total: playerIds.length,
    ready,
    pending,
    allReady,
    showGuide: playerIds.length > 0 && pending > 0,
  };
}
