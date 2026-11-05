import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';
import { hapticAudio } from '../../services/hapticAudioService';
import { Activity, ShieldCheck, Zap, Database, Cpu, X } from 'lucide-react';

interface TelemetryOrb3DProps {
    rpaPulseActive?: boolean;
    clientCount?: number;
    className?: string;
}

// ─── PROCEDURAL 3D TELEMETRY CORE ───────────────────────────────────────────
const OrbCore: React.FC<{
    isHovered: boolean;
    rpaPulseActive: boolean;
}> = ({ isHovered, rpaPulseActive }) => {
    const groupRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const ring2Ref = useRef<THREE.Mesh>(null);

    // Geometries
    const coreGeometry = useMemo(() => new THREE.DodecahedronGeometry(1.0, 0), []);
    const wireGeometry = useMemo(() => new THREE.WireframeGeometry(coreGeometry), [coreGeometry]);

    useFrame((state, delta) => {
        const time = state.clock.getElapsedTime();
        const baseSpeed = rpaPulseActive ? 2.4 : isHovered ? 1.8 : 0.8;

        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.4 * baseSpeed;
            groupRef.current.rotation.x = Math.sin(time * 0.5) * 0.15;
        }

        if (coreRef.current) {
            coreRef.current.rotation.y = -time * 0.6 * baseSpeed;
            const pulse = 1 + Math.sin(time * 3) * 0.05 + (isHovered ? 0.08 : 0);
            coreRef.current.scale.setScalar(pulse);
        }

        if (ringRef.current) {
            ringRef.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.8) * 0.2;
            ringRef.current.rotation.y += delta * 0.8 * baseSpeed;
        }

        if (ring2Ref.current) {
            ring2Ref.current.rotation.y = Math.PI / 4 + Math.cos(time * 0.6) * 0.3;
            ring2Ref.current.rotation.z += delta * 0.5 * baseSpeed;
        }
    });

    return (
        <group ref={groupRef}>
            <ambientLight color={0x061423} intensity={0.9} />
            <directionalLight position={[3, 4, 3]} color={0xffffff} intensity={1.8} />
            <pointLight position={[-2, -2, 2]} color={0x00a896} intensity={18} distance={10} />
            <pointLight position={[2, 2, -2]} color={0xc9a96e} intensity={22} distance={10} />

            {/* Dodecahedron Crystal Core */}
            <mesh ref={coreRef} geometry={coreGeometry}>
                <meshPhysicalMaterial
                    color={0x040d17}
                    emissive={rpaPulseActive ? 0x00a896 : 0x03182b}
                    emissiveIntensity={rpaPulseActive ? 0.75 : 0.25}
                    metalness={0.9}
                    roughness={0.15}
                    clearcoat={1.0}
                    clearcoatRoughness={0.08}
                    reflectivity={0.95}
                    flatShading
                />
            </mesh>

            {/* Edge Wireframe in Emerald */}
            <lineSegments geometry={wireGeometry}>
                <lineBasicMaterial color={rpaPulseActive ? 0x34d399 : 0x00a896} transparent opacity={0.8} />
            </lineSegments>

            {/* Liquid Gold Ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[1.5, 0.02, 12, 120]} />
                <meshStandardMaterial
                    color={0xc9a96e}
                    metalness={1.0}
                    roughness={0.2}
                    emissive={0x3a2c10}
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Emerald Gyro Ring */}
            <mesh ref={ring2Ref}>
                <torusGeometry args={[1.8, 0.015, 12, 120]} />
                <meshStandardMaterial
                    color={0x00a896}
                    metalness={0.8}
                    roughness={0.25}
                    emissive={0x003d36}
                    emissiveIntensity={0.4}
                />
            </mesh>
        </group>
    );
};

// ─── MAIN TELEMETRY ORB EXPORT ───────────────────────────────────────────────
export const TelemetryOrb3D: React.FC<TelemetryOrb3DProps> = ({
    rpaPulseActive = false,
    clientCount = 0,
    className = ''
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const prefersReducedMotion = usePrefersReducedMotion();

    const handleClick = () => {
        hapticAudio.playTone(880, 'sine', 0.15);
        setIsModalOpen(true);
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        hapticAudio.playClick(1200);
    };

    return (
        <>
            <div
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative group cursor-pointer flex items-center justify-center ${className}`}
                title="Haga clic para ver la Telemetría Cuántica 3D del Sistema SRI"
            >
                {/* Outer Glow Ring on Hover */}
                <div
                    className={`absolute inset-0 rounded-full transition-all duration-500 blur-xl ${
                        isHovered
                            ? 'bg-gradient-to-r from-[#00A896]/40 to-[#C9A96E]/40 scale-125 opacity-100'
                            : 'bg-[#00A896]/15 scale-100 opacity-60'
                    }`}
                />

                {/* WebGL 3D Canvas Container */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden shadow-2xl transition-transform duration-300 group-hover:scale-105 active:scale-95">
                    <Canvas
                        frameloop={!prefersReducedMotion ? 'always' : 'never'}
                        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 1.5) : 1}
                        camera={{ position: [0, 0, 3.8], fov: 45 }}
                        gl={{
                            alpha: true,
                            antialias: true,
                            powerPreference: 'high-performance',
                        }}
                    >
                        <OrbCore isHovered={isHovered} rpaPulseActive={rpaPulseActive} />
                    </Canvas>

                    {/* Micro telemetry badge at bottom of orb */}
                    <div className="absolute bottom-1.5 left-0 right-0 flex justify-center pointer-events-none">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 border border-white/10 text-[8px] font-mono font-bold text-[#C9A96E] tracking-widest uppercase backdrop-blur-sm">
                            3D CORE
                        </span>
                    </div>
                </div>
            </div>

            {/* Telemetry Detail Modal (Opened on Click) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-[#051424] border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl overflow-hidden font-mono">
                        {/* Background Light Art */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00A896]/15 rounded-full blur-[80px] pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#C9A96E]/15 rounded-full blur-[80px] pointer-events-none" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between relative z-10 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-2xl">
                                    <Activity className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white font-display">Telemetría de Red Cuántica 3D</h3>
                                    <p className="text-xs text-slate-400">Motor SRI 2026 • SantiagoCordova.com</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Clientes Sincronizados</span>
                                <span className="text-2xl font-black text-white font-mono">{clientCount}</span>
                                <span className="text-[9px] text-[#00A896] block mt-1">● Memoria Local + Cloud</span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">RPA Bridge State</span>
                                <span className="text-2xl font-black text-emerald-400 font-mono">ACTIVO</span>
                                <span className="text-[9px] text-emerald-300 block mt-1">● PostMessage Port 3000</span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Motor WebGL / Three.js</span>
                                <span className="text-sm font-bold text-[#C9A96E] font-mono">60 FPS Hardware</span>
                                <span className="text-[9px] text-slate-400 block mt-1">PBR ACES Filmic Shaders</span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Cifrado de Credenciales</span>
                                <span className="text-sm font-bold text-sky-400 font-mono">AES-256 Vault</span>
                                <span className="text-[9px] text-sky-300 block mt-1">Bóveda Criptográfica SRI</span>
                            </div>
                        </div>

                        <div className="relative z-10 flex justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00A896] to-teal-600 text-white font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#00A896]/20 cursor-pointer"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
export default TelemetryOrb3D;
