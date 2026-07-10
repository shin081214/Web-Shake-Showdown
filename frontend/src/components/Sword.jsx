import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const Sword = ({ player, index, totalPlayers, playerOrientations }) => {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Read orientation directly from ref to avoid React re-renders
    const orientation = playerOrientations.current[player.id];
    if (!orientation) return;

    const { alpha, beta, gamma } = orientation;

    // Convert degrees to radians
    // Convert degrees to radians directly
    const d2r = (deg) => (deg || 0) * (Math.PI / 180);

    // Create an Euler angle based on the device orientation.
    // The order 'YXZ' works well for mapping standard device orientation.
    // This maps the phone's physical movement to a 3D sword movement.
    // - beta (x-axis) is phone tilting forward/backward
    // - gamma (y-axis) is phone tilting left/right
    // - alpha (z-axis) is phone rotating around its vertical axis
    
    // Note: This mapping might need fine-tuning depending on how the player holds the phone.
    // A standard "holding a sword" pose means the phone is held vertically.
    // Let's assume holding it like a TV remote, pointing forward.
    
    // Smooth rotation using standard rotation assignment
    groupRef.current.rotation.set(
      d2r(beta),
      d2r(alpha),
      d2r(-gamma),
      'YXZ'
    );
  });

  // Calculate base position based on player index to space them out
  // If 1 player: center (0)
  // If 2 players: left (-2) and right (2)
  const xPos = totalPlayers === 1 ? 0 : (index === 0 ? -2 : 2);

  return (
    <group position={[xPos, 0, 0]}>
      {/* Base/Hilt of the sword */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      
      {/* Blade of the sword - Changed container to group and gave mesh the geometry */}
      <group ref={groupRef} position={[0, 0, 0]}>
        <mesh position={[0, 0, -2.5]}>
          <boxGeometry args={[0.15, 0.05, 5]} />
          {/* Low-poly neon emission style */}
          <meshStandardMaterial 
            color={player.color} 
            emissive={player.color}
            emissiveIntensity={5}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>
      </group>
    </group>
  );
};

export default Sword;
