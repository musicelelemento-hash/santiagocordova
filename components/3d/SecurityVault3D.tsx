import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';
import { hapticAudio } from '../../services/hapticAudioService';

interface SecurityVault3DProps {
    theme?: 'light' | 'dark';
    isAuthenticating?: boolean;
    className?: string;
}

const PARTICLE_COUNT = 180;

function buildVaultParticles(): Float32Array {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const radius = 2.4 + Math.random() * 2.2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = radius * Math.cos(phi) * 0.7;
        pos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
}

// ─── 3D RIG COMPONENT ────────────────────────────────────────────────────────
const VaultRig: React.FC<{
    isAuthenticating?: boolean;
    mousePos: { x: number; y: number };
}> = ({ isAuthenticating, mousePos }) => {
    const groupRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const ring1Ref = useRef<THREE.Mesh>(null);
    const ring2Ref = useRef<THREE.Mesh>(null);
    const ring3Ref = useRef<THREE.Mesh>(null);
    const particlesRef = useRef<THREE.Points>(null);

    // Geometries
    const coreGeo = useMemo(() => new THREE.OctahedronGeometry(1.25, 0), []);
    const coreWireGeo = useMemo(() => new THREE.WireframeGeometry(coreGeo), [coreGeo]);
    const particlePositions = useMemo(buildVaultParticles, []);

    // Smooth LERP mouse tracking
    const currentRot = useRef({ x: 0, y: 0 });

    useFrame((state, delta) => {
        const time = state.clock.getElapsedTime();
        const spinSpeed = isAuthenticating ? 3.5 : 1.0;

        // Mouse Parallax with LERP
        currentRot.current.x += (mousePos.y * 0.4 - currentRot.current.x) * delta * 3;
        currentRot.current.y += (mousePos.x * 0.5 - currentRot.current.y) * delta * 3;

        if (groupRef.current) {
            groupRef.current.rotation.x = currentRot.current.x + Math.sin(time * 0.5) * 0.08;
            groupRef.current.rotation.y = currentRot.current.y + time * 0.15 * spinSpeed;
        }

        if (coreRef.current) {
            coreRef.current.rotation.y = -time * 0.4 * spinSpeed;
            coreRef.current.rotation.z = Math.sin(time * 0.8) * 0.15;
            const pulse = 1 + Math.sin(time * 2.5) * 0.05 + (isAuthenticating ? 0.15 : 0);
            coreRef.current.scale.setScalar(pulse);
        }

        if (ring1Ref.current) {
            ring1Ref.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.7) * 0.2;
            ring1Ref.current.rotation.y = time * 0.35 * spinSpeed;
        }

        if (ring2Ref.current) {
            ring2Ref.current.rotation.y = Math.PI / 3 + time * 0.25 * spinSpeed;
            ring2Ref.current.rotation.z = Math.cos(time * 0.6) * 0.25;
        }

        if (ring3Ref.current) {
            ring3Ref.current.rotation.x = -Math.PI / 4 + time * 0.18 * spinSpeed;
            ring3Ref.current.rotation.z = -time * 0.3 * spinSpeed;
        }

        if (particlesRef.current) {
            particlesRef.current.rotation.y = time * 0.06 * spinSpeed;
            particlesRef.current.rotation.x = Math.sin(time * 0.2) * 0.08;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Ambient & Directional Lighting */}
            <ambientLight color={0x0b1728} intensity={0.8} />
            <directionalLight position={[5, 6, 6]} color={0xffffff} intensity={2.0} />
            <pointLight position={[-3, -2, 3]} color={0x00a896} intensity={22} distance={15} />
            <pointLight position={[3, 3, -3]} color={0xc9a96e} intensity={25} distance={15} />
            <pointLight position={[0, 0, 0]} color={isAuthenticating ? 0x10b981 : 0x00a896} intensity={isAuthenticating ? 35 : 15} distance={8} />

            {/* Central Cryptographic Obsidian Core */}
            <mesh ref={coreRef} geometry={coreGeo}>
                <meshPhysicalMaterial
                    color={0x050f1a}
                    emissive={isAuthenticating ? 0x00a896 : 0x021626}
                    emissiveIntensity={isAuthenticating ? 0.8 : 0.25}
                    metalness={0.85}
                    roughness={0.12}
                    clearcoat={1.0}
                    clearcoatRoughness={0.06}
                    reflectivity={0.95}
                    flatShading
                />
            </mesh>

            {/* Glowing Emerald Wireframe Skeleton */}
            <lineSegments geometry={coreWireGeo}>
                <lineBasicMaterial color={isAuthenticating ? 0x34d399 : 0x00a896} transparent opacity={0.7} />
            </lineSegments>

            {/* Orbital Ring 1: Primary Liquid Gold Ring */}
            <mesh ref={ring1Ref}>
                <torusGeometry args={[2.0, 0.018, 16, 180]} />
                <meshStandardMaterial
                    color={0xc9a96e}
                    metalness={1.0}
                    roughness={0.2}
                    emissive={0x4a3612}
                    emissiveIntensity={0.6}
                />
            </mesh>

            {/* Orbital Ring 2: Quantum Emerald Gyro Ring */}
            <mesh ref={ring2Ref}>
                <torusGeometry args={[2.45, 0.014, 16, 180]} />
                <meshStandardMaterial
                    color={0x00a896}
                    metalness={0.9}
                    roughness={0.25}
                    emissive={0x003d36}
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Orbital Ring 3: Outer Cryptographic Gold Coordinate Ring */}
            <mesh ref={ring3Ref}>
                <torusGeometry args={[2.85, 0.01, 16, 180]} />
                <meshStandardMaterial
                    color={0xd4af37}
                    metalness={1.0}
                    roughness={0.3}
                    emissive={0x3a2c0c}
                    emissiveIntensity={0.4}
                />
            </mesh>

            {/* Floating Holographic Dust Constellation */}
            <points ref={particlesRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    color={isAuthenticating ? 0x6ee7b7 : 0xa7f3d0}
                    size={0.035}
                    transparent
                    opacity={0.65}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </group>
    );
};

// ─── MAIN EXPORTED CANVAS ────────────────────────────────────────────────────
export const SecurityVault3D: React.FC<SecurityVault3DProps> = ({
    isAuthenticating = false,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isVisible, setIsVisible] = useState(true);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Track mouse movement inside container or window
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = -(e.clientY / window.innerHeight) * 2 + 1;
            setMousePos({ x: nx, y: ny });
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // IntersectionObserver to freeze WebGL when offscreen
    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        }, { threshold: 0.1 });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full min-h-[360px] pointer-events-none select-none ${className}`}
            style={{ touchAction: 'none' }}
        >
            <Canvas
                frameloop={isVisible && !prefersReducedMotion ? 'always' : 'never'}
                dpr={isMobile ? 1 : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)}
                camera={{ position: [0, 0, 5.8], fov: 42 }}
                gl={{
                    alpha: true,
                    antialias: !isMobile,
                    powerPreference: 'high-performance',
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.35,
                }}
            >
                <VaultRig isAuthenticating={isAuthenticating} mousePos={mousePos} />
            </Canvas>

            {/* Subtle luxury overlay labels */}
            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-[10px] font-mono text-slate-500/80 pointer-events-none">
                <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    SRI SECURE ENGINE 2026
                </span>
                <span className="text-[#c9a96e] font-bold">256-BIT CRYPTO VAULT</span>
            </div>
        </div>
    );
};
export default SecurityVault3D;
