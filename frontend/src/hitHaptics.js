export const HIT_VIBRATION_PATTERN = Object.freeze([35, 20, 70]);

export function vibrateOnHit(vibrate = (
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
    ? navigator.vibrate.bind(navigator)
    : null
)) {
  if (typeof vibrate !== 'function') return false;

  try {
    return vibrate(HIT_VIBRATION_PATTERN) !== false;
  } catch {
    return false;
  }
}
