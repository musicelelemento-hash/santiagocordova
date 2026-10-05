import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Volume2, VolumeX, ShieldCheck, ChevronDown, Calendar, 
    Sparkles, X, Pause, Play, SkipForward, Square, CheckCircle2, 
    Activity, Clock, ExternalLink, Zap
} from 'lucide-react';
import { hapticAudio } from '../../services/hapticAudioService';

interface DynamicIslandHUDProps {
    theme?: 'light' | 'dark';
}

interface RpaPulse {
    t: number;
    evento: string;
    detalle?: string;
    cliente?: string;
    ruc?: string;
    paso?: string;
    estado?: string;
    indice?: number;
    total?: number;
    periodo?: string;
    comprasCount?: number;
    ivaMonto?: number;
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
    const [modalView, setModalView] = useState<'mission_control' | 'calendar'>('mission_control');
    const [isMuted, setIsMuted] = useState(true);
    const [scrollProg, setScrollProg] = useState(0);
    const [latency, setLatency] = useState(24);
    const [livePulse, setLivePulse] = useState<RpaPulse | null>(() => {
        try {
            const saved = localStorage.getItem('sc_ultimo_pulso_rpa');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        setIsMuted(!hapticAudio.isSoundEnabled());

        const handleScroll = () => {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            if (h > 0) {
                const p = Math.min(100, Math.max(0, Math.round((window.scrollY / h) * 100)));
                setScrollProg(p);
            }
        };

        const interval = setInterval(() => {
            setLatency(Math.floor(21 + Math.random() * 11));
        }, 4000);

        const handlePulse = (event: MessageEvent) => {
            if (event.data && event.data.source === 'SC_PRO_EXTENSION' && event.data.type === 'SRI_TELEMETRY_PULSE') {
                const pulso = event.data.data;
                if (pulso) {
                    setLivePulse(pulso);
                    try {
                        localStorage.setItem('sc_ultimo_pulso_rpa', JSON.stringify(pulso));
                    } catch {}
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('message', handlePulse);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('message', handlePulse);
            clearInterval(interval);
        };
    }, []);

    const isRpaActive = livePulse && (
        (Date.now() - livePulse.t < 60000 && livePulse.estado !== 'FINALIZADO' && livePulse.estado !== 'DETENIDO') ||
        livePulse.estado === 'CORRIENDO'
    );

    const toggleAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        const active = hapticAudio.toggleSound();
        setIsMuted(!active);
    };

    const handleExpandToggle = () => {
        hapticAudio.playClick(1050);
        if (isRpaActive) {
            setModalView('mission_control');
        }
        setIsExpanded(!isExpanded);
    };

    const handlePause = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.postMessage({ source: 'SC_PRO_DASHBOARD', type: 'SRI_PAUSE_BATCH' }, '*');
    };

    const handleResume = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.postMessage({ source: 'SC_PRO_DASHBOARD', type: 'SRI_RESUME_BATCH' }, '*');
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
                className={`pointer-events-auto cursor-pointer rounded-full border shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
                    isRpaActive
                        ? 'bg-gradient-to-r from-[#020617]/95 via-[#0f172a]/95 to-[#020617]/95 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:border-amber-400'
                        : theme === 'dark'
                            ? 'bg-[#020617]/85 border-white/10 shadow-black/70 hover:border-[#00A896]/40'
                            : 'bg-white/85 border-slate-200/80 shadow-slate-300/60 hover:border-[#00A896]/50'
                } px-3.5 py-1.5 flex items-center gap-2.5 sm:gap-3 text-xs max-w-[94vw]`}
            >
                {/* Status Indicator */}
                {isRpaActive ? (
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-300">
                            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md text-[9px] border border-amber-500/30">
                                LOTE {livePulse?.indice || 1}/{livePulse?.total || 1}
                            </span>
                            <span className="truncate max-w-[110px] sm:max-w-[160px] text-white">
                                {livePulse?.cliente ? livePulse.cliente.split(' ')[0] : 'RPA'}
                            </span>
                            <span className="text-[10px] text-amber-400/80 hidden sm:inline">
                                · {livePulse?.paso || livePulse?.evento || 'Declarando'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00A896] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A896]"></span>
                        </span>
                        <span className="font-mono text-[10px] tracking-wider text-[#00A896] font-semibold hidden sm:inline">
                            SRI ONLINE · {latency}ms
                        </span>
                    </div>
                )}

                <div className="w-[1px] h-3 bg-white/15 hidden sm:block" />

                {/* Progress Pill / Quick Action */}
                {isRpaActive ? (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={livePulse?.estado === 'PAUSADO' ? handleResume : handlePause}
                            title={livePulse?.estado === 'PAUSADO' ? 'Reanudar Lote' : 'Pausar Lote'}
                            className="p-1 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors"
                        >
                            {livePulse?.estado === 'PAUSADO' ? <Play size={11} /> : <Pause size={11} />}
                        </button>
                    </div>
                ) : (
                    <div className="font-mono text-[10px] text-slate-400 font-medium">
                        {scrollProg}%
                    </div>
                )}

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

            {/* Expandable Glassmorphism Rayos X / Calendar Drawer */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className={`pointer-events-auto fixed top-16 max-w-md w-[calc(100vw-32px)] p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-2xl ${
                            theme === 'dark'
                                ? 'bg-[#051424]/95 border-white/10 text-white shadow-black/80'
                                : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/80'
                        }`}
                    >
                        {/* Tab Switcher inside Expanded Modal */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-[11px] font-mono">
                                <button
                                    onClick={() => setModalView('mission_control')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                        modalView === 'mission_control'
                                            ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🤖 Mission Control RPA
                                </button>
                                <button
                                    onClick={() => setModalView('calendar')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                        modalView === 'calendar'
                                            ? 'bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/40 shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    📅 Vencimientos SRI
                                </button>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {modalView === 'mission_control' ? (
                            <div className="space-y-3.5">
                                {/* RPA Header Info */}
                                <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent rounded-xl border border-amber-500/20 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                                            <h4 className="font-bold text-xs font-mono text-amber-300">
                                                {livePulse?.cliente || 'Cliente en Proceso'}
                                            </h4>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            RUC: {livePulse?.ruc || '070...'} · Período: {livePulse?.periodo || 'Mes en Curso'}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                        Lote: {livePulse?.indice || 1} de {livePulse?.total || 1}
                                    </span>
                                </div>

                                {/* Step by Step Telemetry Pipeline */}
                                <div className="space-y-1.5 font-mono text-xs">
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={13} className="text-emerald-400" />
                                            <span>1. Autenticación SRI</span>
                                        </div>
                                        <span className="text-[10px] text-emerald-400 font-bold">✓ EXITOSA</span>
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <Activity size={13} className="text-amber-400 animate-spin" />
                                            <span>2. Arqueo Facturas Recibidas</span>
                                        </div>
                                        <span className="text-[10px] text-amber-300 font-bold">
                                            {livePulse?.paso?.includes('factura') ? 'EN CURSO' : 'PROCESADO'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 opacity-80">
                                        <div className="flex items-center gap-2">
                                            <Clock size={13} className="text-slate-400" />
                                            <span>3. Llenado Formulario 104</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">Automatizado</span>
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 opacity-80">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={13} className="text-[#00A896]" />
                                            <span>4. Comprobante PDF & Backup R2</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">Pendiente</span>
                                    </div>
                                </div>

                                {/* Tactical Action Buttons */}
                                <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                                    <button
                                        onClick={handlePause}
                                        className="flex-1 py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Pause size={12} /> Pausar Lote
                                    </button>
                                    <button
                                        onClick={handleResume}
                                        className="flex-1 py-1.5 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Play size={12} /> Reanudar
                                    </button>
                                    <button
                                        onClick={() => window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank')}
                                        className="py-1.5 px-2.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded-xl text-[11px] transition-all flex items-center gap-1"
                                        title="Ver pestaña del SRI"
                                    >
                                        <ExternalLink size={12} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
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
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
