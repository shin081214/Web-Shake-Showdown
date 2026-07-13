import test from 'node:test';
import assert from 'node:assert/strict';
import { createHitEffectPool, getImpactAnimation } from '../src/hitEffectPool.js';

test('hit effects reuse a fixed particle pool and expire without allocations', () => {
  const pool = createHitEffectPool({
    burstCount: 2,
    particlesPerBurst: 3,
    duration: 0.5,
    random: () => 0.75,
  });
  const particles = pool.particles;

  pool.spawn({ x: 1, y: 2, z: 3, color: '#ff0055' });

  assert.equal(pool.particles, particles);
  assert.equal(pool.particles.length, 6);
  assert.equal(pool.particles.filter(particle => particle.active).length, 3);

  pool.update(0.6);

  assert.equal(pool.particles, particles);
  assert.equal(pool.particles.filter(particle => particle.active).length, 0);
});

test('hit particles use HDR-bright colors that remain visible against black', () => {
  const pool = createHitEffectPool({ particlesPerBurst: 4, random: () => 0.75 });

  pool.spawn({ x: 0, y: 0, z: 0, color: '#ff0055' });

  const activeColors = pool.particles
    .filter(particle => particle.active)
    .map(particle => Math.max(particle.color.r, particle.color.g, particle.color.b));
  assert.equal(activeColors.every(intensity => intensity > 1), true);
});

test('a hit keeps a pooled central flash and shockwave active long enough to see', () => {
  const pool = createHitEffectPool({ burstCount: 2, duration: 0.8 });

  pool.spawn({ x: 1, y: 2, z: 3, color: '#ff0055' });

  assert.equal(pool.bursts.length, 2);
  assert.equal(pool.bursts.filter(burst => burst.active).length, 1);
  assert.deepEqual(pool.bursts[0].position.toArray(), [1, 2, 3]);

  pool.update(0.9);
  assert.equal(pool.bursts.filter(burst => burst.active).length, 0);
});

test('glass shards spread in distinct screen-space directions even with constant randomness', () => {
  const pool = createHitEffectPool({ particlesPerBurst: 8, random: () => 0.5 });

  pool.spawn({ x: 0, y: 0, z: 0, color: '#ff0055' });

  const directions = new Set(
    pool.particles
      .filter(particle => particle.active)
      .map(particle => `${particle.velocity.x.toFixed(2)},${particle.velocity.y.toFixed(2)}`)
  );
  assert.equal(directions.size, 8);
});

test('stylized impact stages flash, double shockwaves, rays, and camera kick', () => {
  const start = getImpactAnimation(0);
  const middle = getImpactAnimation(0.5);
  const end = getImpactAnimation(1);

  assert.equal(start.flashScale > 0, true);
  assert.equal(start.rayOpacity > 0, true);
  assert.equal(start.shakeStrength > 0, true);
  assert.equal(middle.cyanRingScale > start.cyanRingScale, true);
  assert.equal(middle.magentaRingScale > 0, true);
  assert.equal(end.ringOpacity, 0);
  assert.equal(end.rayOpacity, 0);
  assert.equal(end.shakeStrength, 0);
});
