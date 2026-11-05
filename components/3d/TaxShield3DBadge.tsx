import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';
import { hapticAudio } from '../../services/hapticAudioService';
import { ShieldCheck, Sparkles, Check, AlertCircle } from 'lucide-react';

interface TaxShield3DBadgeProps {
    complianceScore: number; // 0 to 100
    isAlDia: boolean;
    clientRegime?: string;
    className?: string;
}

// ─── 3D SHIELD MESH WITH GOLD EMBOSSING ─────────────────────────────────────
const BadgeMesh: React.FC<{
    isAlDia: boolean;
    isHovered: boolean;
    userRotation: { x: number; y: number };
}> = ({ isAlDia, isHovered, userRotation }) => {
    const groupRef = useRef<THREE.Group>(null);
    const shieldRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    // Procedural Octahedral Shield Core
    const shieldGeometry = useMemo(() => new THREE.OctahedronGeometry(1.2, 0), []);
    const wireGeometry = useMemo(() => new THREE.WireframeGeometry(shieldGeometry), [shieldGeometry]);

    useFrame((state, delta) => {
        const time = state.clock.getElapsedTime();
        const baseColor = isAlDia ? 0x00a896 : 0xd97706;

        if (groupRef.current) {
            // Apply drag/tilt rotation + idle gentle breathing
            groupRef.current.rotation.x = userRotation.x + Math.sin(time * 0.8) * 0.08;
            groupRef.current.rotation.y = userRotation.y + time * 0.25;
        }

        if (shieldRef.current) {
            const scalePulse = 1 + Math.sin(time * 2.5) * 0.04 + (isHovered ? 0.08 : 0);
            shieldRef.current.scale.setScalar(scalePulse);
        }

        if (ringRef.current) {
            ringRef.current.rotation.z = time * 0.4;
            ringRef.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * 0.2;
        }
    });

    return (
        <group ref={groupRef}>
            <ambientLight color={0x061423} intensity={0.9} />
            <directionalLight position={[4, 5, 4]} color={0xffffff} intensity={2.0} />
            <pointLight position={[-2, -2, 2]} color={isAlDia ? 0x00a896 : 0xf59e0b} intensity={20} distance={10} />
            <pointLight position={[2, 2, -2]} color={0xc9a96e} intensity={25} distance={10} />

            {/* Faceted Shield Body */}
            <mesh ref={shieldRef} geometry={shieldGeometry}>
                <meshPhysicalMaterial
                    color={0x051321}
                    emissive={isAlDia ? 0x00a896 : 0xb45309}
                    emissiveIntensity={isAlDia ? 0.45 : 0.35}
                    metalness={0.9}
                    roughness={0.12}
                    clearcoat={1.0}
                    clearcoatRoughness={0.05}
                    reflectivity={0.95}
                    flatShading
                />
            </mesh>

            {/* Glowing Edge Wireframe */}
            <lineSegments geometry={wireGeometry}>
                <lineBasicMaterial color={isAlDia ? 0x34d399 : 0xfbbf24} transparent opacity={0.85} />
            </lineSegments>

            {/* Liquid Gold Concentric Ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[1.75, 0.025, 16, 120]} />
                <meshStandardMaterial
                    color={0xc9a96e}
                    metalness={1.0}
                    roughness={0.2}
                    emissive={0x3a2c10}
                    emissiveIntensity={0.6}
                />
            </mesh>
        </group>
    );
};

// ─── MAIN 3D BADGE CONTAINER ────────────────────────────────────────────────
export const TaxShield3DBadge: React.FC<TaxShield3DBadgeProps> = ({
    complianceScore,
    isAlDia,
    clientRegime = 'Régimen SRI',
    className = ''
}) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isHovered, setIsHovered] = useState(false);
    const [userRotation, setUserRotation] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const prevPointer = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        prevPointer.current = { x: e.clientX, y: e.clientY };
        hapticAudio.playClick(1000);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - prevPointer.current.x;
        const dy = e.clientY - prevPointer.current.y;
        prevPointer.current = { x: e.clientX, y: e.clientY };

        setUserRotation(prev => ({
            x: Math.max(-0.8, Math.min(0.8, prev.x + dy * 0.01)),
            y: prev.y + dx * 0.01
        }));
    };

    const handlePointerUp = () => {
        isDragging.current = false;
    };

    return (
        <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`relative rounded-[2.5rem] bg-gradient-to-br from-[#051424] via-[#0b1326] to-[#020b14] border border-white/10 p-6 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing font-mono select-none ${className}`}
        >
            {/* Background Ambient Lighting */}
            <div
                className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[70px] pointer-events-none transition-all duration-700 ${
                    isAlDia ? 'bg-[#00A896]/20' : 'bg-amber-500/20'
                }`}
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                {/* 3D WebGL Shield Viewport */}
                <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
                    <Canvas
                        frameloop={!prefersReducedMotion ? 'always' : 'never'}
                        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 1.5) : 1}
                        camera={{ position: [0, 0, 4.2], fov: 42 }}
                        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
                    >
                        <BadgeMesh isAlDia={isAlDia} isHovered={isHovered} userRotation={userRotation} />
                    </Canvas>

                    <div className="absolute -bottom-1 left-0 right-0 flex justify-center pointer-events-none">
                        <span className="text-[8px] font-bold text-slate-500 tracking-widest uppercase">
                            GIRA EN 3D
                        </span>
                    </div>
                </div>

                {/* Details and Compliance Data */}
                <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <Sparkles size={11} className={isAlDia ? 'text-[#00A896]' : 'text-amber-400'} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#C9A96E]">
                            Inmunidad Fiscal 3D
                        </span>
                    </div>

                    <h3 className="text-xl font-display font-black text-white tracking-tight">
                        {isAlDia ? 'Blindaje Activo al 100%' : 'Pendientes por Regularizar'}
                    </h3>

                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        {isAlDia
                            ? 'Tu contabilidad está blindada y en regla ante el SRI. Cero riesgo de multas o clausuras.'
                            : 'Tienes declaraciones en curso o pendientes de presentación para el período actual.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <div className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">
                            {clientRegime}
                        </div>
                        <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5">
                            <ShieldCheck size={12} />
                            Firma XAdES-BES
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default TaxShield3DBadge;
