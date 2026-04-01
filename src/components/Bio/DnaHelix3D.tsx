"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type BasePair = {
  index: number;
  a: [number, number, number];
  b: [number, number, number];
  mid: [number, number, number];
  length: number;
  quaternion: [number, number, number, number];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function qualityToRgb(phredScore: number) {
  const normalized = clamp((phredScore - 8) / 32, 0, 1);
  const hue = Math.round(normalized * 120);
  return `hsl(${hue} 84% 48%)`;
}

function compressQuality(values: number[], targetLength: number) {
  if (values.length === 0) {
    return Array.from({ length: targetLength }).map(() => 28);
  }
  if (values.length === targetLength) {
    return values;
  }

  const bucketSize = Math.max(1, Math.ceil(values.length / targetLength));
  const compressed: number[] = [];

  for (let start = 0; start < values.length; start += bucketSize) {
    const chunk = values.slice(start, start + bucketSize);
    const chunkAvg = chunk.reduce((sum, value) => sum + value, 0) / chunk.length;
    compressed.push(chunkAvg);
  }

  if (compressed.length > targetLength) {
    return compressed.slice(0, targetLength);
  }

  while (compressed.length < targetLength) {
    compressed.push(compressed[compressed.length - 1] ?? 28);
  }

  return compressed;
}

function mixColor(baseColor: string, isDark: boolean, ratio: number) {
  const white = new THREE.Color(isDark ? "#f8fafc" : "#ffffff");
  const original = new THREE.Color(baseColor);
  const mixed = original.lerp(white, clamp(ratio, 0, 1));
  return `#${mixed.getHexString()}`;
}

function HelixScene({
  qualityScore,
  perBaseQuality,
  isDark,
}: {
  qualityScore: number;
  perBaseQuality: number[];
  isDark: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rungColor = isDark ? "#cbd5e1" : "#334155";
  const steps = 84;

  const basePairs = useMemo<BasePair[]>(() => {
    const pairs: BasePair[] = [];
    const radius = 1.15;
    const verticalStep = 0.08;
    const yOffset = (steps * verticalStep) / 2;
    const up = new THREE.Vector3(0, 1, 0);

    for (let index = 0; index < steps; index += 1) {
      const angle = index * 0.38;
      const y = index * verticalStep - yOffset;
      const ax = radius * Math.cos(angle);
      const az = radius * Math.sin(angle);
      const bx = radius * Math.cos(angle + Math.PI);
      const bz = radius * Math.sin(angle + Math.PI);

      const pointA = new THREE.Vector3(ax, y, az);
      const pointB = new THREE.Vector3(bx, y, bz);
      const mid = pointA.clone().add(pointB).multiplyScalar(0.5);
      const direction = pointB.clone().sub(pointA);
      const length = direction.length();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());

      pairs.push({
        index,
        a: [pointA.x, pointA.y, pointA.z],
        b: [pointB.x, pointB.y, pointB.z],
        mid: [mid.x, mid.y, mid.z],
        length,
        quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      });
    }

    return pairs;
  }, [steps]);

  const perNodeColors = useMemo(() => {
    const compressed = compressQuality(perBaseQuality, steps);
    return compressed.map((score) => {
      const baseColor = qualityToRgb(score);
      return {
        primary: baseColor,
        secondary: mixColor(baseColor, isDark, 0.22),
      };
    });
  }, [isDark, perBaseQuality, steps]);

  const glowIntensity = clamp(qualityScore / 100, 0.15, 1) * (isDark ? 0.13 : 0.08);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    groupRef.current.rotation.y = elapsed * 0.24 + state.pointer.x * 0.28;
    groupRef.current.rotation.x = state.pointer.y * 0.2;
  });

  return (
    <group ref={groupRef}>
      {basePairs.map((pair) => {
        const colors = perNodeColors[pair.index] ?? {
          primary: qualityToRgb(28),
          secondary: qualityToRgb(24),
        };

        return (
          <group key={pair.index}>
            <mesh position={pair.a}>
              <sphereGeometry args={[0.062, 18, 18]} />
              <meshStandardMaterial
                color={colors.primary}
                roughness={0.35}
                metalness={0.18}
                emissive={colors.primary}
                emissiveIntensity={glowIntensity}
              />
            </mesh>
            <mesh position={pair.b}>
              <sphereGeometry args={[0.062, 18, 18]} />
              <meshStandardMaterial
                color={colors.secondary}
                roughness={0.35}
                metalness={0.18}
                emissive={colors.secondary}
                emissiveIntensity={glowIntensity * 0.82}
              />
            </mesh>
            <mesh position={pair.mid} quaternion={pair.quaternion}>
              <cylinderGeometry args={[0.013, 0.013, pair.length, 8]} />
              <meshStandardMaterial
                color={rungColor}
                roughness={0.5}
                metalness={0.2}
                opacity={0.74}
                transparent
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function DnaHelix3D({
  qualityScore,
  perBaseQuality,
  isDark,
}: {
  qualityScore: number;
  perBaseQuality: number[];
  isDark: boolean;
}) {
  return (
    <div className="h-[420px] w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.8], fov: 46 }}
        style={{
          borderRadius: "0.9rem",
          background: isDark
            ? "radial-gradient(circle at 50% 35%, #0b1220, #020617 72%)"
            : "radial-gradient(circle at 50% 35%, #f8fafc, #e2e8f0 78%)",
        }}
      >
        <ambientLight intensity={isDark ? 0.72 : 0.95} />
        <pointLight position={[5, 4, 6]} intensity={isDark ? 1.05 : 0.8} />
        <directionalLight position={[-4, 3, -2]} intensity={isDark ? 0.42 : 0.35} />
        <HelixScene qualityScore={qualityScore} perBaseQuality={perBaseQuality} isDark={isDark} />
      </Canvas>
    </div>
  );
}
