import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';

/**
 * "El Sistema" hero object — obsidian icosahedron with a teal edge outline,
 * three gold rings and a particle dust halo, reacting to scroll position.
 *
 * Ported 1:1 (geometry, materials, lights, animation formulas) from the
 * Claude Design prototype's vanilla-three.js custom element
 * (`project/crystal3d.js` in the design export bundle), which dynamically
 * imported three@0.166.0 from a CDN inside a `<crystal-3d>` custom element.
 * Here it is rebuilt as an idiomatic `@react-three/fiber` component using
 * this repo's already-installed `three@^0.185.1` + `@react-three/fiber`
 * (matching the conventions of `components/3d/TaxShieldHero3D.tsx` etc.)
 * instead of a runtime CDN import — no network dependency, and it folds
 * into the existing `vendor-three` build chunk (see vite.config.ts).
 *
 * Three's default color management (`ColorManagement.enabled`,
 * `outputColorSpace: SRGBColorSpace`) has been on by default since well
 * before r166, so no color-space adjustments were needed between the
 * prototype's three@0.166 and this repo's three@0.185.
 *
 * Performance: the prototype's raw rAF loop measured its own
 * `getBoundingClientRect()` every frame and fully stopped scheduling frames
 * ~1s after leaving the viewport, waking on scroll. The React port keeps
 * the same rect-based progress read (cheapest reliable signal — no need to
 * thread a shared `--p` value in) but replaces the manual
 * schedule/cancel/wake dance with `@react-three/fiber`'s `frameloop` prop:
 * an `IntersectionObserver` on the wrapping div flips `frameloop` between
 * `"always"` and `"never"` (with the same ~1s grace delay), which stops the
 * render loop (and its GPU cost) just as completely.
 */

const RING_CONFIG: Array<[radius: number, tube: number]> = [
  [2.5, 0.014],
  [3.05, 0.01],
  [3.55, 0.008],
];
const PARTICLE_COUNT = 700;

function buildParticlePositions(): Float32Array {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 3.2 + Math.random() * 2.6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.45;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  return pos;
}

const CrystalRig: React.FC<{ containerRef: React.RefObject<HTMLDivElement> }> = ({ containerRef }) => {
  const rootRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const ringRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const dustRef = useRef<THREE.Points>(null);
  const progressRef = useRef(0);

  const crystalGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.55, 0), []);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(crystalGeometry), [crystalGeometry]);
  const particlePositions = useMemo(buildParticlePositions, []);

  useFrame((state) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const target = Math.min(
      1,
      Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height))
    );
    progressRef.current += (target - progressRef.current) * 0.08;
    const p = progressRef.current;
    const t = state.clock.getElapsedTime();

    if (rootRef.current) {
      rootRef.current.rotation.y = t * 0.22 + p * Math.PI * 1.4;
      rootRef.current.rotation.x = Math.sin(t * 0.3) * 0.12 + p * 0.35;
    }
    if (crystalRef.current) {
      crystalRef.current.rotation.y = -t * 0.35;
      crystalRef.current.scale.setScalar(0.92 + p * 0.22);
    }
    ringRefs.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.z = t * (0.12 + i * 0.06) + p * 0.9;
    });
    if (dustRef.current) dustRef.current.rotation.y = -t * 0.08;
  });

  return (
    <>
      <ambientLight color={0x2b6aff} intensity={0.5} />
      <directionalLight color={0xffffff} intensity={2.2} position={[4, 5, 5]} />
      <pointLight color={0x00a896} intensity={26} distance={14} position={[-3.4, -1.6, 2.6]} />
      <pointLight color={0xc9a96e} intensity={18} distance={14} position={[3.2, 2.4, -2.4]} />

      <group ref={rootRef}>
        <mesh ref={crystalRef} geometry={crystalGeometry}>
          <meshPhysicalMaterial
            color={0x061423}
            metalness={0.35}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.05}
            reflectivity={0.9}
            flatShading
          />
        </mesh>
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial color={0x00a896} transparent opacity={0.85} />
        </lineSegments>

        {RING_CONFIG.map(([radius, tube], i) => (
          <mesh
            key={radius}
            ref={ringRefs[i]}
            rotation={[Math.PI / 2 + (i - 1) * 0.28, i * 0.22, 0]}
          >
            <torusGeometry args={[radius, tube, 12, 220]} />
            <meshStandardMaterial
              color={0xc9a96e}
              metalness={1}
              roughness={0.22}
              emissive={0x3a2c12}
              emissiveIntensity={0.6}
            />
          </mesh>
        ))}

        <points ref={dustRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color={0x8fd8cf} size={0.022} transparent opacity={0.55} />
        </points>
      </group>
    </>
  );
};

export const Crystal3D: React.FC<{ className?: string }> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(true);
  const offTimer = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) return;
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (offTimer.current) {
            window.clearTimeout(offTimer.current);
            offTimer.current = null;
          }
          setActive(true);
        } else if (!offTimer.current) {
          offTimer.current = window.setTimeout(() => setActive(false), 1000);
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (offTimer.current) window.clearTimeout(offTimer.current);
    };
  }, [reduced]);

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <Canvas
        camera={{ fov: 38, position: [0, 0, 6.2], near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        frameloop={reduced || !active ? 'never' : 'always'}
      >
        <CrystalRig containerRef={containerRef} />
      </Canvas>
    </div>
  );
};
