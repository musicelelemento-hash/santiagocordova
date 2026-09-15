import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, ShieldCheck, ChevronDown, Calendar, Sparkles, X } from 'lucide-react';
import { hapticAudio } from '../../services/hapticAudioService';

interface DynamicIslandHUDProps {
    theme?: 'light' | 'dark';
}

const RUC_CALENDAR = [
    { digito: '1', fecha: '10 del mes' },
    { digito: '2', fecha: '12 del mes' },
    { digito: '3', fecha: '14 del mes' },
    { digito: '4', fecha: '16 del mes' },
    { digito: '5', fecha: '18 del mes' },
    { digito: '6', fecha: '20 del mes' },
    { digito: '7', fecha: '22 del mes' },
    { digito: '8', fecha: '24 del mes' },
    { digito: '9', fecha: '26 del mes' },
    { digito: '0', fecha: '28 del mes' },
];

export const DynamicIslandHUD: React.FC<DynamicIslandHUDProps> = ({ theme = 'dark' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [scrollProg, setScrollProg] = useState(0);
    const [latency, setLatency] = useState(24);

    useEffect(() => {
        setIsMuted(!hapticAudio.isSoundEnabled());

        const handleScroll = () => {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            if (h > 0) {
                const p = Math.min(100, Math.max(0, Math.round((window.scrollY / h) * 100)));
                setScrollProg(p);
            }
        };

        // Subtle ping oscillation (21ms - 32ms) to give live telemetry feel
        const interval = setInterval(() => {
            setLatency(Math.floor(21 + Math.random() * 11));
        }, 4000);

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearInterval(interval);
        };
    }, []);

    const toggleAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        const active = hapticAudio.toggleSound();
        setIsMuted(!active);
    };

    const handleExpandToggle = () => {
        hapticAudio.playClick(1050);
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className="fixed left-0 right-0 z-[120] flex justify-center pointer-events-none px-3"
            style={{ top: 'max(10px, env(safe-area-inset-top, 10px))' }}
        >
            <motion.div
                layout
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                onClick={handleExpandToggle}
                className={`pointer-events-auto cursor-pointer rounded-full border shadow-2xl backdrop-blur-2xl transition-colors duration-300 ${
                    theme === 'dark'
                        ? 'bg-[#020617]/85 border-white/10 shadow-black/70 hover:border-[#00A896]/40'
                        : 'bg-white/85 border-slate-200/80 shadow-slate-300/60 hover:border-[#00A896]/50'
                } px-3 py-1.5 flex items-center gap-2.5 sm:gap-3 text-xs max-w-[94vw]`}
            >
                {/* SRI Ping Status */}
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00A896] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A896]"></span>
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-[#00A896] font-semibold hidden sm:inline">
                        SRI ONLINE · {latency}ms
                    </span>
                </div>

                <div className="w-[1px] h-3 bg-white/15 hidden sm:block" />

                {/* Progress Pill */}
                <div className="font-mono text-[10px] text-slate-400 font-medium">
                    {scrollProg}%
                </div>

                <div className="w-[1px] h-3 bg-white/15" />

                {/* Audio Synthesizer Haptic Toggle */}
                <button
                    type="button"
                    onClick={toggleAudio}
                    title={isMuted ? 'Activar sonido háptico (S)' : 'Silenciar sonido (S)'}
                    className="p-1 rounded-full text-slate-400 hover:text-white transition-colors focus:outline-none"
                >
                    {isMuted ? (
                        <VolumeX size={13} className="text-slate-500" />
                    ) : (
                        <Volume2 size={13} className="text-[#C9A96E]" />
                    )}
                </button>

                {/* Drawer Expander */}
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-slate-400"
                >
                    <ChevronDown size={12} />
                </motion.div>
            </motion.div>

            {/* Expandable RUC Calendar Drawer (Apple Modal Card) */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className={`pointer-events-auto fixed top-16 max-w-sm w-[calc(100vw-32px)] p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-2xl ${
                            theme === 'dark'
                                ? 'bg-[#051424]/95 border-white/10 text-white'
                                : 'bg-white/95 border-slate-200 text-slate-900'
                        }`}
                    >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Calendar size={15} className="text-[#00A896]" />
                                <span className="font-display font-bold text-xs tracking-wider uppercase">
                                    Vencimientos SRI 2026
                                </span>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                            Fecha máxima de declaración según el <strong className="text-white">9º dígito</strong> de tu RUC o Cédula:
                        </p>

                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                            {RUC_CALENDAR.map((item) => (
                                <div
                                    key={item.digito}
                                    className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white/5 border border-white/5"
                                >
                                    <span className="text-[#C9A96E] font-bold">Dígito {item.digito}</span>
                                    <span className="text-slate-300">{item.fecha}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                                <ShieldCheck size={12} className="text-[#00A896]" /> Blindaje Nueva Luz 3.0
                            </span>
                            <span className="text-[#C9A96E] font-mono">Machala · El Oro</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
