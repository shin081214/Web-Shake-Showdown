import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getSwordEuler } from '../gameLogic';

const Sword = ({ player, index, totalPlayers, playerOrientations }) => {
  const swordRef = useRef();

  useFrame(() => {
    if (!swordRef.current) return;

    // Reuse the complete sword group's Euler object so the blade, guard, grip,
    // and pommel follow the same low-latency phone pose without allocations.
    const orientation = playerOrientations.current[player.id];
    if (!orientation) return;
    getSwordEuler(orientation, swordRef.current.rotation);
  });

  // If 1 player: center (0). If 2 players: left (-2) and right (2).
  const xPos = totalPlayers === 1 ? 0 : (index === 0 ? -2 : 2);

  return (
    <group ref={swordRef} position={[xPos, 0, 0]}>
      {/* Blade: its base remains at the group's pivot, matching collision logic. */}
      <mesh position={[0, 0, -2.5]}>
        <boxGeometry args={[0.16, 0.06, 5]} />
        <meshStandardMaterial
          color={player.color}
          emissive={player.color}
          emissiveIntensity={5}
          roughness={0.1}
          metalness={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Bright cross guard makes hilt rotation easy to read. */}
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[1.05, 0.13, 0.16]} />
        <meshStandardMaterial
          color="#f7f7ff"
          emissive={player.color}
          emissiveIntensity={2.8}
          metalness={0.85}
          roughness={0.18}
          toneMapped={false}
        />
      </mesh>

      {/* Grip extends behind the blade pivot, so it visibly swings with the blade. */}
      <mesh position={[0, 0, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.92, 8]} />
        <meshStandardMaterial color="#17121f" metalness={0.65} roughness={0.35} />
      </mesh>

      {[0.25, 0.48, 0.71, 0.91].map(z => (
        <mesh key={z} position={[0, 0, z]}>
          <torusGeometry args={[0.18, 0.035, 8, 16]} />
          <meshStandardMaterial
            color={player.color}
            emissive={player.color}
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Faceted neon pommel finishes the handle silhouette. */}
      <mesh position={[0, 0, 1.13]}>
        <octahedronGeometry args={[0.25, 0]} />
        <meshStandardMaterial
          color={player.color}
          emissive={player.color}
          emissiveIntensity={3.5}
          metalness={0.8}
          roughness={0.15}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export default Sword;
