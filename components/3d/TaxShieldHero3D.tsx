import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { ShieldCheck, Sparkles as SparklesIcon, Zap, Lock } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';

interface TaxShieldHero3DProps {
    theme?: 'light' | 'dark';
    onActivateShield?: () => void;
}

// ─── PROCEDURAL SHIELD GEOMETRY CREATOR ────────────────────────────────────────
function createShieldShape() {
    const shape = new (THREE as any).Shape();
    // Start top-center
    shape.moveTo(0, 1.4);
    // Top-right corner
    shape.lineTo(1.1, 1.3);
    // Right curve down towards the bottom tip
    shape.bezierCurveTo(1.25, 0.5, 1.1, -0.4, 0, -1.5);
    // Left curve up from bottom tip
    shape.bezierCurveTo(-1.1, -0.4, -1.25, 0.5, -1.1, 1.3);
    // Top-left corner to top-center
    shape.lineTo(0, 1.4);
    return shape;
}

// ─── 3D SHIELD MESH & INNER CORE ───────────────────────────────────────────────
const ShieldMesh: React.FC<{ 
    theme: 'light' | 'dark'; 
    isHovered: boolean;
    isShockwaveActive: boolean;
}> = ({ theme, isHovered, isShockwaveActive }) => {
    const shieldOuterRef = useRef<THREE.Mesh>(null);
    const shieldInnerRef = useRef<THREE.Mesh>(null);
    const coreCrystalRef = useRef<THREE.Mesh>(null);
    const edgeGoldRef = useRef<THREE.LineSegments>(null);

    const shieldShape = useMemo(() => createShieldShape(), []);
    
    const extrudeSettings = useMemo(() => ({
        depth: 0.22,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.08,
        bevelThickness: 0.12,
    }), []);

    const innerExtrudeSettings = useMemo(() => ({
        depth: 0.1,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.06,
    }), []);

    useFrame((state, delta) => {
        const time = state.clock.getElapsedTime();
        
        // Inner Crystal Pulse
        if (coreCrystalRef.current) {
            coreCrystalRef.current.rotation.x = time * 0.4;
            coreCrystalRef.current.rotation.y = time * 0.7;
            const pulse = 1 + Math.sin(time * 3) * 0.08 + (isHovered ? 0.15 : 0);
            coreCrystalRef.current.scale.setScalar(pulse * 0.45);
        }

        // Slight breathing of the shield
        if (shieldOuterRef.current) {
            const hoverScale = isHovered ? 1.05 : 1.0;
            const shockScale = isShockwaveActive ? 1.15 : 1.0;
            shieldOuterRef.current.scale.lerp(new THREE.Vector3(hoverScale * shockScale, hoverScale * shockScale, hoverScale * shockScale), delta * 8);
        }
    });

    return (
        <group>
            {/* Outer Protective Translucent Shield (PBR Glassmorphism) */}
            <mesh ref={shieldOuterRef} position={[0, 0, -0.1]}>
                <extrudeGeometry args={[shieldShape, extrudeSettings]} />
                <meshPhysicalMaterial
                    color={theme === 'dark' ? '#041B2D' : '#e0f2fe'}
                    emissive={theme === 'dark' ? '#00A896' : '#0284c7'}
                    emissiveIntensity={isHovered ? 0.35 : 0.18}
                    roughness={0.12}
                    metalness={0.35}
                    transmission={0.7}
                    ior={1.52}
                    thickness={1.2}
                    transparent
                    opacity={0.92}
                    reflectivity={0.95}
                    clearcoat={1.0}
                    clearcoatRoughness={0.1}
                />
            </mesh>

            {/* Inner Gold Inset Emblem Plate */}
            <mesh ref={shieldInnerRef} position={[0, 0, 0.12]} scale={0.78}>
                <extrudeGeometry args={[shieldShape, innerExtrudeSettings]} />
                <meshStandardMaterial
                    color={theme === 'dark' ? '#C9A96E' : '#b45309'}
                    emissive="#C9A96E"
                    emissiveIntensity={isHovered ? 0.4 : 0.2}
                    metalness={0.92}
                    roughness={0.22}
                    wireframe={false}
                />
            </mesh>

            {/* Central Holographic Heart Crystal (Dodecahedron/Octahedron) */}
            <mesh ref={coreCrystalRef} position={[0, 0, 0.28]}>
                <octahedronGeometry args={[1, 0]} />
                <meshPhysicalMaterial
                    color="#00A896"
                    emissive="#00E5FF"
                    emissiveIntensity={0.8}
                    roughness={0.05}
                    metalness={0.1}
                    transmission={0.85}
                    ior={2.4}
                    transparent
                    opacity={0.95}
                />
            </mesh>
        </group>
    );
};

// ─── GYROSCOPIC ORBITAL RINGS ──────────────────────────────────────────────────
const GyroRings: React.FC<{ isHovered: boolean; theme: 'light' | 'dark' }> = ({ isHovered, theme }) => {
    const ringGoldRef = useRef<THREE.Mesh>(null);
    const ringTealRef = useRef<THREE.Mesh>(null);
    const ringOuterRef = useRef<THREE.Mesh>(null);

    useFrame((_, delta) => {
        const speedMultiplier = isHovered ? 2.2 : 1.0;
        
        if (ringGoldRef.current) {
            ringGoldRef.current.rotation.x += delta * 0.6 * speedMultiplier;
            ringGoldRef.current.rotation.y += delta * 0.4 * speedMultiplier;
        }
        if (ringTealRef.current) {
            ringTealRef.current.rotation.y -= delta * 0.7 * speedMultiplier;
            ringTealRef.current.rotation.z += delta * 0.5 * speedMultiplier;
        }
        if (ringOuterRef.current) {
            ringOuterRef.current.rotation.x -= delta * 0.3 * speedMultiplier;
            ringOuterRef.current.rotation.z -= delta * 0.4 * speedMultiplier;
        }
    });

    return (
        <group>
            {/* Inner Gold Gyro Ring */}
            <mesh ref={ringGoldRef}>
                <torusGeometry args={[2.0, 0.028, 16, 100]} />
                <meshStandardMaterial
                    color={theme === 'dark' ? '#C9A96E' : '#d97706'}
                    emissive="#C9A96E"
                    emissiveIntensity={0.6}
                    metalness={0.95}
                    roughness={0.15}
                />
            </mesh>

            {/* Middle Teal Quantum Ring */}
            <mesh ref={ringTealRef}>
                <torusGeometry args={[2.35, 0.024, 16, 100]} />
                <meshStandardMaterial
                    color={theme === 'dark' ? '#00A896' : '#0d9488'}
                    emissive="#00A896"
                    emissiveIntensity={0.7}
                    metalness={0.9}
                    roughness={0.2}
                />
            </mesh>

            {/* Outer Sapphire Orbit Ring */}
            <mesh ref={ringOuterRef}>
                <torusGeometry args={[2.7, 0.018, 16, 100]} />
                <meshStandardMaterial
                    color={theme === 'dark' ? '#2B6AFF' : '#2563eb'}
                    emissive="#2B6AFF"
                    emissiveIntensity={0.5}
                    metalness={0.85}
                    roughness={0.3}
                />
            </mesh>
        </group>
    );
};

// ─── SHOCKWAVE EXPANSION RING (On Click Pulse) ─────────────────────────────────
const ShockwaveRing: React.FC<{ active: boolean }> = ({ active }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [progress, setProgress] = useState(1);

    useEffect(() => {
        if (active) {
            setProgress(0);
        }
    }, [active]);

    useFrame((_, delta) => {
        if (progress < 1) {
            const nextProgress = Math.min(progress + delta * 1.8, 1);
            setProgress(nextProgress);
            if (meshRef.current) {
                const scale = 1 + nextProgress * 4.5;
                meshRef.current.scale.set(scale, scale, scale);
                const mat = meshRef.current.material as THREE.MeshBasicMaterial;
                if (mat) {
                    mat.opacity = Math.max(0, (1 - nextProgress) * 0.85);
                }
            }
        }
    });

    if (progress >= 1) return null;

    return (
        <mesh ref={meshRef} position={[0, 0, 0]}>
            <ringGeometry args={[0.95, 1.05, 64]} />
            <meshBasicMaterial
                color="#C9A96E"
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
};

// ─── MAIN 3D SCENE ORCHESTRATOR ────────────────────────────────────────────────
const ShieldScene: React.FC<{
    theme: 'light' | 'dark';
    isHovered: boolean;
    isShockwaveActive: boolean;
    onTriggerShockwave: () => void;
}> = ({ theme, isHovered, isShockwaveActive, onTriggerShockwave }) => {
    const mainGroupRef = useRef<THREE.Group>(null);
    const { pointer, viewport } = useThree();

    useFrame((_, delta) => {
        if (mainGroupRef.current) {
            // Smooth mouse / pointer parallax interpolation
            const targetRotX = pointer.y * 0.38;
            const targetRotY = pointer.x * 0.48;
            
            mainGroupRef.current.rotation.x = THREE.MathUtils.lerp(mainGroupRef.current.rotation.x, targetRotX, delta * 4);
            mainGroupRef.current.rotation.y = THREE.MathUtils.lerp(mainGroupRef.current.rotation.y, targetRotY, delta * 4);
            
            // Floating vertical bobbing
            mainGroupRef.current.position.y = THREE.MathUtils.lerp(
                mainGroupRef.current.position.y,
                Math.sin(Date.now() * 0.002) * 0.12,
                delta * 2
            );
        }
    });

    // Mobile adaptive scaling
    const isMobile = viewport.width < 5;
    const baseScale = isMobile ? 1.05 : 1.35;

    return (
        <Float speed={2.5} rotationIntensity={0.3} floatIntensity={0.6}>
            <group 
                ref={mainGroupRef} 
                scale={baseScale} 
                onClick={(e) => {
                    e.stopPropagation();
                    onTriggerShockwave();
                }}
            >
                {/* 3D Core Shield */}
                <ShieldMesh 
                    theme={theme} 
                    isHovered={isHovered} 
                    isShockwaveActive={isShockwaveActive} 
                />

                {/* Gyroscopic Concentric Orbit Rings */}
                <GyroRings isHovered={isHovered} theme={theme} />

                {/* Shockwave on click */}
                <ShockwaveRing active={isShockwaveActive} />

                {/* Dynamic Ambient Sparkles around Shield */}
                <Sparkles 
                    count={isMobile ? 35 : 75} 
                    scale={5.5} 
                    size={isHovered ? 4.5 : 3.0} 
                    speed={isHovered ? 1.5 : 0.6}
                    color={theme === 'dark' ? '#C9A96E' : '#00A896'}
                />
            </group>
        </Float>
    );
};

// ─── EXPORTED TAX SHIELD HERO 3D COMPONENT ─────────────────────────────────────
export const TaxShieldHero3D: React.FC<TaxShieldHero3DProps> = ({ 
    theme = 'dark',
    onActivateShield 
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isShockwaveActive, setIsShockwaveActive] = useState(false);
    const [pulseMessage, setPulseMessage] = useState<string | null>(null);

    const handleTriggerShockwave = () => {
        setIsShockwaveActive(true);
        setPulseMessage('🛡️ BLINDAJE FISCAL ACTIVO · 100% CERO MULTAS SRI');
        
        if (onActivateShield) {
            onActivateShield();
        }

        setTimeout(() => {
            setIsShockwaveActive(false);
        }, 1200);

        setTimeout(() => {
            setPulseMessage(null);
        }, 4000);
    };

    // Accesibilidad: sin escudo 3D animado si el usuario prefiere menos movimiento
    const reduced = usePrefersReducedMotion();
    if (reduced) return null;

    return (
        <div 
            className="relative w-full h-[460px] sm:h-[500px] md:h-[540px] rounded-[2.5rem] overflow-hidden select-none"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Subtle Gradient Glow in Canvas Background */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] transition-all duration-700 ${
                    isHovered 
                        ? 'bg-[#00A896]/30 scale-125' 
                        : 'bg-[#C9A96E]/15 scale-100'
                }`} />
            </div>

            {/* Three.js R3F Canvas */}
            <Canvas
                camera={{ position: [0, 0, 7.2], fov: 42 }}
                dpr={[1, 2]}
                gl={{ 
                    antialias: true, 
                    alpha: true, 
                    powerPreference: 'high-performance',
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.15
                }}
                className="cursor-grab active:cursor-grabbing z-10"
            >
                {/* Dynamic Lighting Rig */}
                <ambientLight intensity={theme === 'dark' ? 0.75 : 1.1} />
                <directionalLight position={[5, 8, 5]} intensity={1.8} color="#ffffff" />
                <pointLight position={[-6, -4, 3]} intensity={2.5} color="#00A896" distance={15} />
                <pointLight position={[6, 4, 3]} intensity={3.0} color="#C9A96E" distance={15} />
                <pointLight position={[0, -5, -2]} intensity={1.5} color="#2B6AFF" distance={10} />
                <spotLight 
                    position={[0, 10, 6]} 
                    angle={0.45} 
                    penumbra={0.9} 
                    intensity={2.2} 
                    color="#ffffff" 
                />

                {/* 3D Scene */}
                <ShieldScene 
                    theme={theme}
                    isHovered={isHovered}
                    isShockwaveActive={isShockwaveActive}
                    onTriggerShockwave={handleTriggerShockwave}
                />
            </Canvas>

            {/* HUD Overlay: Interactive Hint */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/70 border border-[#00A896]/30 backdrop-blur-md text-[10px] font-mono font-bold text-[#00A896] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#00A896] animate-ping" />
                    <span>Escudo Holográfico 3D</span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur-md text-[10px] font-mono text-slate-300">
                    <SparklesIcon size={12} className="text-[#C9A96E]" />
                    <span>Toca o arrastra para rotar</span>
                </div>
            </div>

            {/* HUD Dynamic Bottom Pulse Status */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col items-center gap-2 pointer-events-auto">
                {pulseMessage ? (
                    <div className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#00A896]/90 via-[#051424]/95 to-[#C9A96E]/90 border border-white/30 backdrop-blur-xl text-center shadow-[0_0_30px_rgba(0,168,150,0.4)] animate-in fade-in zoom-in duration-300">
                        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
                            <ShieldCheck size={16} className="text-emerald-300 animate-bounce" />
                            {pulseMessage}
                        </span>
                    </div>
                ) : (
                    <button
                        onClick={handleTriggerShockwave}
                        className="group w-full py-2.5 px-4 rounded-2xl bg-slate-900/80 hover:bg-[#00A896]/20 border border-white/10 hover:border-[#00A896]/50 backdrop-blur-xl transition-all duration-300 shadow-lg flex items-center justify-between text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[#00A896]/10 border border-[#00A896]/30 text-[#00A896] group-hover:scale-110 transition-transform">
                                <Lock size={14} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white font-display">Blindaje Tributario Activo</div>
                                <div className="text-[10px] text-slate-400 font-mono">Algoritmo de protección SRI Ecuador 2026</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#C9A96E] uppercase group-hover:translate-x-0.5 transition-transform">
                            <Zap size={12} className="text-[#C9A96E] animate-pulse" />
                            <span>Probar Blindaje</span>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};
