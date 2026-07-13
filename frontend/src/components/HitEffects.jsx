import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createHitEffectPool, getImpactAnimation } from '../hitEffectPool';

const RAY_COUNT = 10;

function createGlowMaterial(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

const HitEffects = forwardRef(function HitEffects(_, ref) {
  const { camera } = useThree();
  const baseCameraPosition = useRef(camera.position.clone());
  const shardRefs = useRef([]);
  const flashRefs = useRef([]);
  const cyanRingRefs = useRef([]);
  const magentaRingRefs = useRef([]);
  const rayRefs = useRef([]);
  const pool = useMemo(() => createHitEffectPool(), []);

  const resources = useMemo(() => {
    const burstCount = pool.bursts.length;
    return {
      shardGeometry: new THREE.ConeGeometry(0.18, 1.15, 3, 1),
      flashGeometry: new THREE.OctahedronGeometry(1, 0),
      cyanRingGeometry: new THREE.RingGeometry(0.83, 1, 48),
      magentaRingGeometry: new THREE.RingGeometry(0.76, 1, 6),
      rayGeometry: new THREE.PlaneGeometry(0.08, 1.15),
      shardMaterials: [
        createGlowMaterial(new THREE.Color(2.25, 2.25, 2.25)),
        createGlowMaterial(new THREE.Color(0, 2, 2.4)),
        createGlowMaterial(new THREE.Color(2.5, 0.04, 0.85)),
      ],
      flashMaterial: createGlowMaterial(new THREE.Color(3.2, 3.2, 3.2)),
      cyanRingMaterials: Array.from(
        { length: burstCount },
        () => createGlowMaterial(new THREE.Color(0, 1.7, 2.2), 0)
      ),
      magentaRingMaterials: Array.from(
        { length: burstCount },
        () => createGlowMaterial(new THREE.Color(2.3, 0.02, 0.85), 0)
      ),
      rayMaterials: Array.from({ length: burstCount }, () => [
        createGlowMaterial(new THREE.Color(0.2, 2, 2.5), 0),
        createGlowMaterial(new THREE.Color(2.6, 0.05, 1), 0),
      ]),
    };
  }, [pool]);

  useImperativeHandle(ref, () => ({ spawn: pool.spawn }), [pool]);

  useEffect(() => () => {
    camera.position.copy(baseCameraPosition.current);
    resources.shardGeometry.dispose();
    resources.flashGeometry.dispose();
    resources.cyanRingGeometry.dispose();
    resources.magentaRingGeometry.dispose();
    resources.rayGeometry.dispose();
    resources.shardMaterials.forEach(material => material.dispose());
    resources.flashMaterial.dispose();
    resources.cyanRingMaterials.forEach(material => material.dispose());
    resources.magentaRingMaterials.forEach(material => material.dispose());
    resources.rayMaterials.flat().forEach(material => material.dispose());
  }, [camera, resources]);

  useFrame((_, delta) => {
    pool.update(delta);

    pool.particles.forEach((particle, index) => {
      const shard = shardRefs.current[index];
      if (!shard) return;
      shard.visible = particle.active;
      if (!particle.active) return;

      const animation = getImpactAnimation(1 - particle.scale);
      const directionAngle = Math.atan2(particle.velocity.y, particle.velocity.x);
      shard.position.copy(particle.position);
      shard.scale.set(
        animation.shardScale * 0.8,
        animation.shardScale * 1.65,
        animation.shardScale * 0.75
      );
      shard.rotation.set(
        particle.age * 10 + index * 0.2,
        particle.age * 13 + index * 0.35,
        directionAngle - Math.PI / 2
      );
    });

    let strongestShake = 0;
    pool.bursts.forEach((burst, burstIndex) => {
      const animation = getImpactAnimation(burst.progress);
      strongestShake = Math.max(strongestShake, burst.active ? animation.shakeStrength : 0);

      const flash = flashRefs.current[burstIndex];
      if (flash) {
        flash.visible = burst.active && animation.flashScale > 0;
        if (flash.visible) {
          flash.position.copy(burst.position);
          flash.scale.setScalar(animation.flashScale);
          flash.rotation.z += delta * 8;
        }
      }

      const cyanRing = cyanRingRefs.current[burstIndex];
      const cyanMaterial = resources.cyanRingMaterials[burstIndex];
      cyanMaterial.opacity = burst.active ? animation.ringOpacity * 0.9 : 0;
      if (cyanRing) {
        cyanRing.visible = burst.active && cyanMaterial.opacity > 0.02;
        cyanRing.position.copy(burst.position);
        cyanRing.scale.setScalar(animation.cyanRingScale);
      }

      const magentaRing = magentaRingRefs.current[burstIndex];
      const magentaMaterial = resources.magentaRingMaterials[burstIndex];
      magentaMaterial.opacity = burst.active ? animation.ringOpacity * 0.78 : 0;
      if (magentaRing) {
        magentaRing.visible = burst.active && animation.magentaRingScale > 0;
        magentaRing.position.copy(burst.position);
        magentaRing.scale.setScalar(animation.magentaRingScale);
        magentaRing.rotation.z = burst.age * 3.8 + burstIndex * 0.35;
      }

      const burstRays = rayRefs.current[burstIndex] ?? [];
      resources.rayMaterials[burstIndex].forEach(material => {
        material.opacity = burst.active ? animation.rayOpacity * 0.85 : 0;
      });
      burstRays.forEach((ray, rayIndex) => {
        if (!ray) return;
        ray.visible = burst.active && animation.rayOpacity > 0;
        if (!ray.visible) return;

        const angle = (rayIndex / RAY_COUNT) * Math.PI * 2 + burstIndex * 0.17;
        ray.position.set(
          burst.position.x + Math.cos(angle) * animation.rayDistance,
          burst.position.y + Math.sin(angle) * animation.rayDistance,
          burst.position.z + 0.05
        );
        ray.rotation.z = angle - Math.PI / 2;
        ray.scale.set(1, animation.rayLength * animation.rayOpacity, 1);
      });
    });

    if (strongestShake > 0) {
      const magnitude = 0.085 * strongestShake;
      camera.position.set(
        baseCameraPosition.current.x + (Math.random() - 0.5) * magnitude,
        baseCameraPosition.current.y + (Math.random() - 0.5) * magnitude,
        baseCameraPosition.current.z
      );
    } else {
      camera.position.copy(baseCameraPosition.current);
    }
  });

  return (
    <group>
      {pool.particles.map((_, index) => (
        <mesh
          key={`shard-${index}`}
          ref={element => { shardRefs.current[index] = element; }}
          geometry={resources.shardGeometry}
          material={resources.shardMaterials[index % resources.shardMaterials.length]}
          visible={false}
          frustumCulled={false}
          renderOrder={14}
        />
      ))}

      {pool.bursts.map((_, burstIndex) => (
        <group key={`burst-${burstIndex}`}>
          <mesh
            ref={element => { flashRefs.current[burstIndex] = element; }}
            geometry={resources.flashGeometry}
            material={resources.flashMaterial}
            visible={false}
            frustumCulled={false}
            renderOrder={11}
          />
          <mesh
            ref={element => { cyanRingRefs.current[burstIndex] = element; }}
            geometry={resources.cyanRingGeometry}
            material={resources.cyanRingMaterials[burstIndex]}
            visible={false}
            frustumCulled={false}
            renderOrder={12}
          />
          <mesh
            ref={element => { magentaRingRefs.current[burstIndex] = element; }}
            geometry={resources.magentaRingGeometry}
            material={resources.magentaRingMaterials[burstIndex]}
            visible={false}
            frustumCulled={false}
            renderOrder={13}
          />
          {Array.from({ length: RAY_COUNT }, (_, rayIndex) => (
            <mesh
              key={`ray-${rayIndex}`}
              ref={element => {
                if (!rayRefs.current[burstIndex]) rayRefs.current[burstIndex] = [];
                rayRefs.current[burstIndex][rayIndex] = element;
              }}
              geometry={resources.rayGeometry}
              material={resources.rayMaterials[burstIndex][rayIndex % 2]}
              visible={false}
              frustumCulled={false}
              renderOrder={15}
            />
          ))}
        </group>
      ))}
    </group>
  );
});

export default HitEffects;
