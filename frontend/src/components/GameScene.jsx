import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Scanline,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import Sword from './Sword';

// Short-lived particle burst spawned when a player lands a hit.
const HitBurst = ({ position, color, onDone }) => {
  const groupRef = useRef();
  const life = useRef(0);
  const duration = 0.6;

  // Pre-compute random velocity vectors once per burst.
  const particles = useMemo(() => {
    return Array.from({ length: 14 }, () => ({
      dir: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize(),
      speed: 4 + Math.random() * 6,
    }));
  }, []);

  useFrame((state, delta) => {
    life.current += delta;
    const t = life.current / duration;
    if (!groupRef.current) return;

    groupRef.current.children.forEach((mesh, i) => {
      const p = particles[i];
      mesh.position.addScaledVector(p.dir, p.speed * delta);
      const s = Math.max(0, 1 - t);
      mesh.scale.setScalar(s);
      mesh.material.opacity = s;
    });

    if (life.current >= duration) onDone();
  });

  return (
    <group ref={groupRef} position={position}>
      {particles.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={4}
            transparent
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Component to handle obstacles logic
const ObstaclesManager = ({ players, playerOrientations, onHit, onBurst }) => {
  const [obstacles, setObstacles] = useState([]);
  const obstaclesRef = useRef([]);
  const timeRef = useRef(0);

  const spawnRate = 0.8; // Faster spawns
  const speed = 25; // Faster units per second for synthwave speed

  useFrame((state, delta) => {
    timeRef.current += delta;

    let next = obstaclesRef.current;

    // Spawn new obstacle
    if (timeRef.current > spawnRate) {
      timeRef.current = 0;

      const x = (Math.random() - 0.5) * 8; // Random lane
      const z = -60; // Start far away

      const playerArray = Object.values(players);
      const color = playerArray.length > 0
        ? playerArray[Math.floor(Math.random() * playerArray.length)].color
        : '#00f3ff'; // Default neon cyan

      next = [...next, { id: Math.random(), x, y: 0, z, color, hit: false }];
    }

    // Move obstacles and check collisions. State is driven from a ref instead of a
    // setState updater so this stays free of side effects: under StrictMode the
    // updater runs twice, which previously double-counted every hit.
    const hitPlayerIds = [];
    const pArray = Object.values(players);
    next = next.map(obs => {
      let updatedObs = { ...obs, z: obs.z + speed * delta };

      // Simple collision zone check
      if (!updatedObs.hit && updatedObs.z > -2 && updatedObs.z < 1) {
        // Check against all players
        for (let i = 0; i < pArray.length; i++) {
          const p = pArray[i];
          const xPos = pArray.length === 1 ? 0 : (i === 0 ? -2 : 2);

          // Check if obstacle is near this player's X position
          if (Math.abs(updatedObs.x - xPos) < 1.2) {
            const ori = playerOrientations.current[p.id];
            // alpha arrives already wrapped to -180..180 from the controller.
            // If the player is swinging their phone aggressively (angle > 30 degrees)
            if (ori && (Math.abs(ori.beta) > 30 || Math.abs(ori.gamma) > 30 || Math.abs(ori.alpha) > 40)) {
              updatedObs.hit = true;
              hitPlayerIds.push(p.id);
              onBurst({ x: updatedObs.x, y: updatedObs.y, z: updatedObs.z, color: updatedObs.color });
              break;
            }
          }
        }
      }
      return updatedObs;
    }).filter(obs => !obs.hit && obs.z < 10);

    obstaclesRef.current = next;
    setObstacles(next);

    if (onHit) {
      for (const id of hitPlayerIds) onHit(id);
    }
  });

  return (
    <group>
      {obstacles.map(obs => (
        <mesh key={obs.id} position={[obs.x, obs.y, obs.z]} rotation={[obs.z * 0.1, obs.z * 0.1, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={obs.color}
            emissive={obs.color}
            emissiveIntensity={2.5}
            wireframe={true}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Glowing synthwave sun sitting on the horizon.
const SynthwaveSun = () => {
  return (
    <mesh position={[0, 6, -70]}>
      <circleGeometry args={[18, 64]} />
      <meshBasicMaterial color="#ff2d95" toneMapped={false} />
    </mesh>
  );
};

// Animated Synthwave Grid Ground
const MovingGrid = ({ color, y }) => {
  const gridRef = useRef();

  useFrame((state, delta) => {
    // move the grid towards the camera to simulate forward motion
    if (gridRef.current) {
      gridRef.current.position.z = (gridRef.current.position.z + 25 * delta) % 10;
    }
  });

  return (
    <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[200, 200, 60, 60]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.35} toneMapped={false} />
    </mesh>
  );
};

const GameScene = ({ players, playerOrientations, onHit }) => {
  const playersArray = Object.values(players);
  const [bursts, setBursts] = useState([]);

  const addBurst = (b) => {
    setBursts(prev => [...prev, { ...b, id: Math.random() }]);
  };
  const removeBurst = (id) => {
    setBursts(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="canvas-container">
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a0018']} />
        {/* Synthwave foggy atmosphere */}
        <fog attach="fog" args={['#1a0033', 12, 65]} />

        <ambientLight intensity={0.25} />
        <directionalLight position={[0, 10, -10]} intensity={1.8} color="#00f3ff" />
        <pointLight position={[0, 2, 5]} intensity={2.5} color="#ff007f" />
        <pointLight position={[0, 8, -60]} intensity={4} color="#ff2d95" distance={120} />

        <Stars radius={120} depth={60} count={5000} factor={5} saturation={1} fade speed={1.5} />

        <SynthwaveSun />

        {/* Floor grid plus a faint mirrored ceiling grid for a tunnel feel */}
        <MovingGrid color="#ff007f" y={-2} />
        <MovingGrid color="#00f3ff" y={8} />

        <ObstaclesManager
          players={players}
          playerOrientations={playerOrientations}
          onHit={onHit}
          onBurst={addBurst}
        />

        {bursts.map(b => (
          <HitBurst
            key={b.id}
            position={[b.x, b.y, b.z]}
            color={b.color}
            onDone={() => removeBurst(b.id)}
          />
        ))}

        {playersArray.map((player, index) => (
          <Sword
            key={player.id}
            player={player}
            index={index}
            totalPlayers={playersArray.length}
            playerOrientations={playerOrientations}
          />
        ))}

        {/* Post-Processing stack for the neon synthwave look */}
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.8} mipmapBlur intensity={2.4} radius={0.85} />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={[0.0009, 0.0012]}
          />
          <Scanline blendFunction={BlendFunction.OVERLAY} density={1.3} opacity={0.12} />
          <Vignette eskil={false} offset={0.25} darkness={0.9} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default GameScene;
