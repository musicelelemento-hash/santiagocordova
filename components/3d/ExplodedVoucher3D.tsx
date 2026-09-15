import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Layers, ShieldCheck, FileKey, Database, CheckCircle2, Sliders } from 'lucide-react';
import { hapticAudio } from '../../services/hapticAudioService';

interface ExplodedVoucher3DProps {
    theme?: 'light' | 'dark';
}

export const ExplodedVoucher3D: React.FC<ExplodedVoucher3DProps> = ({ theme = 'dark' }) => {
    const [separation, setSeparation] = useState(48);
    const [mouseTilt, setMouseTilt] = useState({ x: 18, y: -14 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        setMouseTilt({
            x: 20 - ny * 25,
            y: -15 + nx * 30,
        });
    };

    const handleMouseLeave = () => {
        setMouseTilt({ x: 18, y: -14 });
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setSeparation(val);
        if (val % 8 === 0) {
            hapticAudio.playClick(1000 + val * 5);
        }
    };

    const sepFactor = separation / 100;

    return (
        <div className="w-full max-w-5xl mx-auto py-12 px-4">
            <div className="text-center mb-8 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-widest uppercase bg-[#00A896]/10 text-[#00A896] border border-[#00A896]/20">
                    <Layers size={13} /> Desglose Criptográfico 3D
                </div>
                <h3 className={`text-2xl md:text-3xl font-display font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    ANATOMÍA DE UN COMPROBANTE <span className="text-[#C9A96E]">INMUNIZADO</span>
                </h3>
                <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto">
                    Cada factura y declaración pasa por 4 capas de verificación. Desliza para separar y analizar la estructura interna en 3D.
                </p>
            </div>

            {/* Interactive Separation Slider Controls */}
            <div className="max-w-md mx-auto mb-10 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center gap-4">
                <Sliders size={16} className="text-[#C9A96E] flex-shrink-0" />
                <div className="flex-1">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span>CAPA COMPACTA</span>
                        <span className="text-[#00A896] font-bold">EXPANSIÓN 3D: {separation}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={separation}
                        onChange={handleSliderChange}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#00A896]"
                    />
                </div>
            </div>

            {/* 3D Perspective Stage */}
            <div
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative h-[480px] w-full flex items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#051424]/80 to-[#020617]/90 shadow-2xl"
                style={{ perspective: '1100px' }}
            >
                {/* Visual Depth Background Grid */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: `radial-gradient(circle at 50% 50%, #00A896 1px, transparent 1px)`,
                        backgroundSize: '32px 32px',
                    }}
                />

                <motion.div
                    animate={{
                        rotateX: mouseTilt.x,
                        rotateY: mouseTilt.y,
                    }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="relative w-[300px] sm:w-[360px] h-[240px]"
                >
                    {/* LAYER 1: RIDE FÍSICO */}
                    <div
                        className="absolute inset-0 rounded-xl border border-white/20 bg-slate-900/85 p-4 shadow-xl backdrop-blur-md flex flex-col justify-between transition-transform duration-200"
                        style={{
                            transform: `translate3d(0, ${-sepFactor * 130}px, ${sepFactor * 90}px)`,
                        }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="font-mono text-[9px] text-[#C9A96E] font-bold block">CAPA 01 · RIDE LEGAL</span>
                                <span className="font-display text-xs font-bold text-white">Factura Electrónica SRI</span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                AUTORIZADO
                            </span>
                        </div>
                        <div className="space-y-1 font-mono text-[9px] text-slate-400">
                            <div>RUC: 070XXXXXXXX001</div>
                            <div className="truncate">CLAVE: 1509202601070...49D</div>
                            <div className="text-white font-bold text-[11px] pt-1">TOTAL: $1,450.00 USD</div>
                        </div>
                    </div>

                    {/* LAYER 2: FIRMA DIGITAL XAdES-BES */}
                    <div
                        className="absolute inset-0 rounded-xl border border-[#00A896]/40 bg-[#00A896]/15 p-4 shadow-xl backdrop-blur-md flex flex-col justify-between transition-transform duration-200"
                        style={{
                            transform: `translate3d(0, ${-sepFactor * 40}px, ${sepFactor * 30}px)`,
                        }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="font-mono text-[9px] text-[#00A896] font-bold block">CAPA 02 · CRIPTOGRAFÍA</span>
                                <span className="font-display text-xs font-bold text-white">Firma .P12 XAdES-BES</span>
                            </div>
                            <FileKey size={14} className="text-[#00A896]" />
                        </div>
                        <div className="font-mono text-[9px] text-emerald-300/80 space-y-0.5">
                            <div>DIGEST: SHA-256 (Validado)</div>
                            <div>CERT: SECURITY DATA / BANCO CENTRAL</div>
                            <div>ESTADO: NO REPUDIO TOTAL</div>
                        </div>
                    </div>

                    {/* LAYER 3: CASILLEROS SRI FORMULARIO 104 */}
                    <div
                        className="absolute inset-0 rounded-xl border border-[#2B6AFF]/40 bg-[#2B6AFF]/15 p-4 shadow-xl backdrop-blur-md flex flex-col justify-between transition-transform duration-200"
                        style={{
                            transform: `translate3d(0, ${sepFactor * 50}px, ${-sepFactor * 30}px)`,
                        }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="font-mono text-[9px] text-sky-400 font-bold block">CAPA 03 · CASILLEROS TRIBUTARIOS</span>
                                <span className="font-display text-xs font-bold text-white">Asignación Directa SRI</span>
                            </div>
                            <ShieldCheck size={14} className="text-sky-400" />
                        </div>
                        <div className="grid grid-cols-3 gap-1 font-mono text-[8px] text-sky-200">
                            <div className="bg-sky-950/40 p-1 rounded border border-sky-500/20 text-center">
                                <span className="block text-slate-400">CAS. 411</span>
                                <span className="font-bold">$1,450</span>
                            </div>
                            <div className="bg-sky-950/40 p-1 rounded border border-sky-500/20 text-center">
                                <span className="block text-slate-400">CAS. 421</span>
                                <span className="font-bold">$217.50</span>
                            </div>
                            <div className="bg-sky-950/40 p-1 rounded border border-sky-500/20 text-center">
                                <span className="block text-slate-400">CAS. 615</span>
                                <span className="font-bold">CR. TRIB</span>
                            </div>
                        </div>
                    </div>

                    {/* LAYER 4: CLOUDFLARE R2 & POSTGRESQL */}
                    <div
                        className="absolute inset-0 rounded-xl border border-[#C9A96E]/40 bg-[#C9A96E]/15 p-4 shadow-xl backdrop-blur-md flex flex-col justify-between transition-transform duration-200"
                        style={{
                            transform: `translate3d(0, ${sepFactor * 140}px, ${-sepFactor * 90}px)`,
                        }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="font-mono text-[9px] text-[#C9A96E] font-bold block">CAPA 04 · PERSISTENCIA</span>
                                <span className="font-display text-xs font-bold text-white">Bóveda Inmutable R2</span>
                            </div>
                            <Database size={14} className="text-[#C9A96E]" />
                        </div>
                        <div className="font-mono text-[9px] text-amber-200/90 space-y-0.5">
                            <div>BUCKET: santiago-vouchers-2026</div>
                            <div>ENCRIPTACIÓN: AES-GCM 256</div>
                            <div>HISTÓRICO: 7 AÑOS GARANTIZADOS</div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
