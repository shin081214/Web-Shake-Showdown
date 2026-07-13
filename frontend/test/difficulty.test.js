import test from 'node:test';
import assert from 'node:assert/strict';
import { getDifficulty, MAX_DIFFICULTY_LEVEL } from '../src/difficulty.js';

test('difficulty starts at the current fair speed and spawn interval', () => {
  const difficulty = getDifficulty(0, 0);

  assert.equal(difficulty.level, 1);
  assert.equal(difficulty.speed, 20);
  assert.equal(difficulty.spawnRate, 1);
  assert.equal(difficulty.isRush, false);
});

test('both score and survival time raise the difficulty level', () => {
  assert.equal(getDifficulty(0, 150).level, 2);
  assert.equal(getDifficulty(25, 0).level, 2);
  assert.ok(getDifficulty(50, 300).level > getDifficulty(25, 150).level);
});

test('rush windows temporarily make obstacles faster and more frequent', () => {
  const calm = getDifficulty(6.9, 0);
  const rush = getDifficulty(7.2, 0);

  assert.equal(calm.level, rush.level);
  assert.equal(calm.isRush, false);
  assert.equal(rush.isRush, true);
  assert.ok(rush.speed > calm.speed);
  assert.ok(rush.spawnRate < calm.spawnRate);
});

test('difficulty is capped so long games remain physically playable', () => {
  const difficulty = getDifficulty(10_000, 100_000);

  assert.equal(difficulty.level, MAX_DIFFICULTY_LEVEL);
  assert.ok(difficulty.speed <= 31);
  assert.ok(difficulty.spawnRate >= 0.65);
});
