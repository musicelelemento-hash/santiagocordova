import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useInView, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';

/**
 * ScrollNarrative3D — "EL SISTEMA EN 4 ESTADOS"
 * ---------------------------------------------------------------------
 * Sección fijada al scroll (pin) donde la escultura 3D muta de geometría
 * y el texto cambia por etapa: OBSIDIAN → QUANTUM → GOLD → EMERALD CORE.
 * Entrega el efecto "3D que cambia con el scroll" con narrativa premium.
 */

interface Stage {
    id: string;
    num: string;
    title: string;
    tag: string;
    text: string;
    accent: string;
    glow: string;
}

const STAGES: Stage[] = [
    {
        id: 'blinda',
        num: '01',
        title: 'BLINDAJE TOTAL',
        tag: 'CIFRADO DE DATOS',
        text: 'Tu información contable y fiscal blindada con cifrado de nivel bancario. Nadie más la toca.',
        accent: '#00A896',
        glow: 'rgba(0,168,150,0.35)',
    },
    {
        id: 'precision',
        num: '02',
        title: 'CÁLCULO PRECISO',
        tag: 'PRECISIÓN ALGORÍTMICA',
        text: 'Declaraciones calculadas con precisión algorítmica contra el SRI 2026. Cero redondeos, cero errores.',
        accent: '#38bdf8',
        glow: 'rgba(56,189,248,0.30)',
    },
    {
        id: 'optimiza',
        num: '03',
        title: 'OPTIMIZACIÓN FISCAL',
        tag: 'RIMPE · IVA · RENTA',
        text: 'RIMPE, IVA y Renta optimizados para pagar exactamente lo correcto, ni un centavo de más.',
        accent: '#C9A96E',
        glow: 'rgba(201,169,110,0.35)',
    },
    {
        id: 'crecimiento',
        num: '04',
        title: 'CRECIMIENTO SEGURO',
        tag: 'CONTABILIDAD SIN MULTAS',
        text: 'Cero multas, cero sorpresas. Tu contabilidad evoluciona con tu negocio, en cualquier rincón del Ecuador.',
        accent: '#00A896',
        glow: 'rgba(16,185,129,0.40)',
    },
];

export const ScrollNarrative3D: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'dark' }) => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const [stage, setStage] = useState(0);
    const inView = useInView(sectionRef, { margin: '-15% 0px -15% 0px' });
    const reduced = usePrefersReducedMotion();

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start start', 'end end'],
    });

    // Escucha el scroll solo mientras la sección está visible (perf)
    useMotionValueEvent(scrollYProgress, 'change', (v) => {
        setStage(Math.min(STAGES.length - 1, Math.floor(v * STAGES.length)));
    });

    const titleY = useTransform(scrollYProgress, [0, 1], [30, -30]);
    // El vídeo de fondo reacciona al scroll (escala + desplazamiento sutiles)
    const bgScale = useTransform(scrollYProgress, [0, 1], [1.15, 0.92]);
    const bgY = useTransform(scrollYProgress, [0, 1], [40, -40]);
    const current = STAGES[stage];

    return (
        <section ref={sectionRef} id="sistema" className="relative" style={{ height: '420vh' }}>
            <div className="sticky top-0 h-screen-fix w-full overflow-hidden flex items-center justify-center">
                {/* ── Fondo: cristal en video (bucle) que reacciona al scroll ── */}
                {inView && !reduced && (
                    <motion.div
                        style={{ scale: bgScale, y: bgY }}
                        className="absolute inset-0 pointer-events-none z-0"
                    >
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover opacity-70"
                            src="/media/crystal-loop.mp4"
                        />
                    </motion.div>
                )}

                {/* Vigneta + glow del stage actual */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-700"
                    style={{
                        background: `radial-gradient(ellipse 60% 60% at 50% 40%, ${current.glow}, transparent 70%)`,
                    }}
                />

                {/* Número de etapa gigante de fondo */}
                <motion.div
                    style={{ y: titleY }}
                    className={`absolute inset-0 z-[1] flex items-center justify-center pointer-events-none select-none ${
                        theme === 'dark' ? 'text-white/[0.04]' : 'text-slate-900/[0.05]'
                    }`}
                >
                    <span className="font-display font-black text-[24vw] md:text-[16vw] leading-[0.9] tracking-tighter whitespace-nowrap">
                        {current.num}
                    </span>
                </motion.div>

                {/* ── Contenido narrativo ── */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
                    <div className="max-w-2xl">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current.id}
                                initial={{ opacity: 0, y: 26 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -18 }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                className="space-y-5"
                            >
                                <div
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-xl"
                                    style={{ borderColor: `${current.accent}55`, background: `${current.accent}14` }}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full animate-pulse"
                                        style={{ background: current.accent, boxShadow: `0 0 12px ${current.accent}` }}
                                    />
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-[0.25em] font-mono"
                                        style={{ color: current.accent }}
                                    >
                                        {current.tag}
                                    </span>
                                </div>

                                <h2
                                    className={`font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] ${
                                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                                    }`}
                                >
                                    {current.title}
                                </h2>

                                <p
                                    className={`text-base md:text-lg font-light leading-relaxed max-w-xl ${
                                        theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                                    }`}
                                >
                                    {current.text}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* ── Rail de progreso por etapas ── */}
                <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3">
                    {STAGES.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3">
                            <span
                                className={`font-mono text-[9px] font-bold transition-all duration-300 ${
                                    i === stage ? 'opacity-100' : 'opacity-0'
                                }`}
                                style={{ color: s.accent }}
                            >
                                {s.num}
                            </span>
                            <button
                                onClick={() => {
                                    // Saltar a la etapa en el scroll (proporcional)
                                    const el = sectionRef.current;
                                    if (!el) return;
                                    const top = el.offsetTop + (el.offsetHeight * i) / STAGES.length;
                                    window.scrollTo({ top, behavior: 'smooth' });
                                }}
                                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                    background: i <= stage ? s.accent : theme === 'dark' ? '#334155' : '#cbd5e1',
                                    boxShadow: i === stage ? `0 0 12px ${s.glow}` : 'none',
                                    transform: i === stage ? 'scale(1.35)' : 'scale(1)',
                                }}
                                aria-label={`Etapa ${s.num} ${s.title}`}
                            />
                        </div>
                    ))}
                </div>

                {/* ── Hint de scroll ── */}
                <motion.div
                    animate={{ opacity: stage === STAGES.length - 1 ? 0 : [0.4, 1, 0.4], y: [0, 6, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400"
                >
                    Scroll para evolucionar
                </motion.div>
            </div>
        </section>
    );
};

export default ScrollNarrative3D;
