export const MAX_DIFFICULTY_LEVEL = 6;

const BASE_SPEED = 20;
const BASE_SPAWN_RATE = 1;
const RUSH_CYCLE_SECONDS = 14;
const RUSH_START_SECONDS = 7;
const RUSH_END_SECONDS = 9.5;

const clampNonNegative = value => Math.max(0, Number.isFinite(value) ? value : 0);

export function getDifficulty(elapsedSeconds, totalScore) {
  const elapsed = clampNonNegative(elapsedSeconds);
  const score = clampNonNegative(totalScore);
  const progress = elapsed / 25 + score / 150;
  const level = Math.min(MAX_DIFFICULTY_LEVEL, 1 + Math.floor(progress));

  const baseSpeed = BASE_SPEED + (level - 1) * 1.5;
  const baseSpawnRate = BASE_SPAWN_RATE - (level - 1) * 0.035;
  const rushPosition = elapsed % RUSH_CYCLE_SECONDS;
  const isRush = elapsed >= RUSH_START_SECONDS
    && rushPosition >= RUSH_START_SECONDS
    && rushPosition < RUSH_END_SECONDS;

  return {
    level,
    isRush,
    speed: Number(Math.min(31, baseSpeed * (isRush ? 1.1 : 1)).toFixed(3)),
    spawnRate: Number(Math.max(0.65, baseSpawnRate * (isRush ? 0.8 : 1)).toFixed(3)),
  };
}
