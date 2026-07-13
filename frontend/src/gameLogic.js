import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;
const BLADE_LENGTH = 5;
const OBSTACLE_HALF_SIZE = 0.5;
const BLADE_PADDING = 0.08;

export const INITIAL_LIVES = 3;
export const GAME_RESULT_DURATION_MS = 5_000;

export function createPlayerLives(playerIds, livesPerPlayer = INITIAL_LIVES) {
  return Object.fromEntries(playerIds.map(playerId => [playerId, livesPerPlayer]));
}

export function loseLife(lives, playerId) {
  return {
    ...lives,
    [playerId]: Math.max(0, (lives[playerId] ?? INITIAL_LIVES) - 1),
  };
}

export function isPlayerOutOfLives(lives, playerId) {
  return (lives[playerId] ?? INITIAL_LIVES) <= 0;
}

export function getGameStateAfterMiss(lives, playerId) {
  return isPlayerOutOfLives(lives, playerId) ? 'finished' : 'playing';
}

export function incrementScore(scores, playerId, points = 10) {
  return {
    ...scores,
    [playerId]: (scores[playerId] ?? 0) + points,
  };
}

export function getSwordEuler(orientation = {}, target = new THREE.Euler()) {
  const { alpha = 0, beta = 0, gamma = 0 } = orientation;
  return target.set(
    beta * DEG_TO_RAD,
    alpha * DEG_TO_RAD,
    -gamma * DEG_TO_RAD,
    'YXZ'
  );
}

export function getSwordSegment(swordX, orientation = {}) {
  const base = new THREE.Vector3(swordX, 0, 0);
  const tip = new THREE.Vector3(0, 0, -BLADE_LENGTH)
    .applyEuler(getSwordEuler(orientation))
    .add(base);

  return { base, tip };
}

function segmentIntersectsBox(start, end, center, halfExtents) {
  const direction = end.clone().sub(start);
  let tMin = 0;
  let tMax = 1;

  for (const axis of ['x', 'y', 'z']) {
    const min = center[axis] - halfExtents[axis];
    const max = center[axis] + halfExtents[axis];
    const axisDirection = direction[axis];

    if (Math.abs(axisDirection) < Number.EPSILON) {
      if (start[axis] < min || start[axis] > max) return false;
      continue;
    }

    let near = (min - start[axis]) / axisDirection;
    let far = (max - start[axis]) / axisDirection;
    if (near > far) [near, far] = [far, near];

    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return false;
  }

  return true;
}

export function swordHitsObstacle({ swordX, orientation, obstacle }) {
  const { base, tip } = getSwordSegment(swordX, orientation);
  const previousZ = obstacle.previousZ ?? obstacle.z;
  const minZ = Math.min(previousZ, obstacle.z);
  const maxZ = Math.max(previousZ, obstacle.z);
  const obstacleCenter = new THREE.Vector3(
    obstacle.x,
    obstacle.y ?? 0,
    (minZ + maxZ) / 2
  );
  const paddedHalfSize = OBSTACLE_HALF_SIZE + BLADE_PADDING;
  const sweptHalfExtents = new THREE.Vector3(
    paddedHalfSize,
    paddedHalfSize,
    (maxZ - minZ) / 2 + paddedHalfSize
  );

  return segmentIntersectsBox(
    base,
    tip,
    obstacleCenter,
    sweptHalfExtents
  );
}
