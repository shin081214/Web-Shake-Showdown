import * as THREE from 'three';

export function getImpactAnimation(progress) {
  const p = Math.min(1, Math.max(0, progress));
  const easeOut = 1 - Math.pow(1 - p, 3);
  const magentaProgress = Math.min(1, Math.max(0, (p - 0.06) / 0.94));
  const magentaEaseOut = 1 - Math.pow(1 - magentaProgress, 3);

  return {
    flashScale: p < 0.14 ? 0.95 * (1 - p / 0.14) : 0,
    cyanRingScale: 0.25 + easeOut * 2.65,
    magentaRingScale: magentaProgress > 0 ? 0.2 + magentaEaseOut * 2.25 : 0,
    ringOpacity: Math.pow(1 - p, 1.55),
    rayOpacity: Math.max(0, 1 - p / 0.32),
    rayDistance: 0.35 + easeOut * 1.7,
    rayLength: 0.8 + (1 - p) * 1.3,
    shardScale: 0.15 + (1 - p) * 0.27,
    shakeStrength: Math.max(0, 1 - p / 0.22),
  };
}

export function createHitEffectPool({
  burstCount = 4,
  particlesPerBurst = 16,
  duration = 0.8,
  random = Math.random,
} = {}) {
  const particles = Array.from(
    { length: burstCount * particlesPerBurst },
    () => ({
      active: false,
      age: duration,
      scale: 0,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      color: new THREE.Color('#ffffff'),
    })
  );
  const bursts = Array.from({ length: burstCount }, () => ({
    active: false,
    age: duration,
    progress: 1,
    position: new THREE.Vector3(),
    color: new THREE.Color('#ffffff'),
  }));
  let nextBurst = 0;

  const spawn = ({ x, y, z, color }) => {
    const burst = bursts[nextBurst];
    burst.active = true;
    burst.age = 0;
    burst.progress = 0;
    burst.position.set(x, y, z);
    burst.color.set(color);
    const burstBrightest = Math.max(burst.color.r, burst.color.g, burst.color.b, 0.001);
    burst.color.multiplyScalar(4 / burstBrightest);

    const firstParticle = nextBurst * particlesPerBurst;

    for (let index = 0; index < particlesPerBurst; index += 1) {
      const particle = particles[firstParticle + index];
      particle.active = true;
      particle.age = 0;
      particle.scale = 1;
      particle.position.set(x, y, z);
      const angle = (index / particlesPerBurst) * Math.PI * 2
        + (random() - 0.5) * 0.25;
      particle.velocity.set(
        Math.cos(angle),
        Math.sin(angle),
        (random() - 0.5) * 0.35
      );
      particle.velocity.normalize().multiplyScalar(6 + random() * 5);
      // Every fourth shard is a white-hot core. Other shards preserve the
      // obstacle color but are normalized into HDR range so Bloom always sees them.
      particle.color.set(index % 4 === 0 ? '#ffffff' : color);
      const brightestChannel = Math.max(
        particle.color.r,
        particle.color.g,
        particle.color.b,
        0.001
      );
      particle.color.multiplyScalar(3 / brightestChannel);
    }

    nextBurst = (nextBurst + 1) % burstCount;
  };

  const update = (delta) => {
    for (const burst of bursts) {
      if (!burst.active) continue;
      burst.age += delta;
      burst.progress = Math.min(1, burst.age / duration);
      if (burst.age >= duration) burst.active = false;
    }

    for (const particle of particles) {
      if (!particle.active) continue;

      particle.age += delta;
      if (particle.age >= duration) {
        particle.active = false;
        particle.scale = 0;
        continue;
      }

      particle.position.addScaledVector(particle.velocity, delta);
      particle.velocity.y -= 5 * delta;
      particle.scale = 1 - particle.age / duration;
    }
  };

  return { particles, bursts, spawn, update };
}
