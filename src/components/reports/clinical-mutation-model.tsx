"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";

type Hotspot = {
  gene: string;
  intensity: number;
  index: number;
};

type ModelProps = {
  hotspots: Hotspot[];
  selectedGene: string | null;
  onSelectGene: (gene: string) => void;
};

function HelixStrands() {
  const points = useMemo(() => {
    const output: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i < 84; i += 1) {
      const t = i * 0.18;
      output.push({
        x: Math.cos(t) * 2.2,
        y: i * 0.12 - 5,
        z: Math.sin(t) * 2.2,
      });
      output.push({
        x: Math.cos(t + Math.PI) * 2.2,
        y: i * 0.12 - 5,
        z: Math.sin(t + Math.PI) * 2.2,
      });
    }
    return output;
  }, []);

  return (
    <>
      {points.map((point, idx) => (
        <mesh key={`helix-node-${idx}`} position={[point.x, point.y, point.z]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#52525b" roughness={0.45} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

function MutationHotspot({
  hotspot,
  totalHotspots,
  selected,
  onSelect,
}: {
  hotspot: Hotspot;
  totalHotspots: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<Mesh>(null);
  const normalizedIndex =
    totalHotspots > 1 ? hotspot.index / (totalHotspots - 1) : 0.5;
  const yPosition = -4.4 + normalizedIndex * 8.8;
  const angle = hotspot.index * 1.7;

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2.4 + hotspot.index) * 0.12;
    const emphasis = selected ? 1.28 : 1;
    ref.current.scale.setScalar(pulse * emphasis);
  });

  return (
    <mesh
      ref={ref}
      position={[
        Math.cos(angle) * 1.95,
        yPosition,
        Math.sin(angle) * 1.95,
      ]}
      onClick={onSelect}
    >
      <sphereGeometry args={[0.24 + hotspot.intensity * 0.08, 24, 24]} />
      <meshStandardMaterial
        color={selected ? "#f97316" : "#ef4444"}
        emissive={selected ? "#fb923c" : "#f43f5e"}
        emissiveIntensity={selected ? 1 : 0.58}
        roughness={0.25}
        metalness={0.35}
      />
    </mesh>
  );
}

export function ClinicalMutationModel({
  hotspots,
  selectedGene,
  onSelectGene,
}: ModelProps) {
  return (
    <div className="h-full w-full overflow-hidden rounded-xl border bg-gradient-to-b from-zinc-900 to-zinc-950">
      <Canvas
        className="!h-full !w-full"
        dpr={[1, 1.75]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0, 13.5], fov: 50, near: 0.1, far: 100 }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 5]} intensity={1.1} />
        <pointLight position={[-4, -3, -2]} intensity={0.45} color="#38bdf8" />
        <group scale={[0.9, 0.9, 0.9]}>
          <HelixStrands />
          {hotspots.map((hotspot) => (
            <MutationHotspot
              key={hotspot.gene}
              hotspot={hotspot}
              totalHotspots={hotspots.length}
              selected={selectedGene === hotspot.gene}
              onSelect={() => onSelectGene(hotspot.gene)}
            />
          ))}
        </group>
      </Canvas>
    </div>
  );
}
