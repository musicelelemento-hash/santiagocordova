import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { ShaderBackdrop } from './ShaderBackdrop';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface CinematicIntroProps {
    theme?: 'light' | 'dark';
    phoneNumber: string;
    scrollToSection: (id: string) => void;
}

/**
 * Apertura cinematográfica: 3 escenas pineadas por scroll (problema → solución → marca)
 * con tipografía cinética (GSAP SplitText). Reemplaza la escultura 3D como protagonista
 * de la primera impresión; el 3D queda como fondo ambiental más abajo en la página.
 */
export const CinematicIntro: React.FC<CinematicIntroProps> = ({ theme = 'dark', phoneNumber, scrollToSection }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const scene1Ref = useRef<HTMLDivElement>(null);
    const scene2Ref = useRef<HTMLDivElement>(null);
    const scene3Ref = useRef<HTMLDivElement>(null);
    const h1Ref = useRef<HTMLHeadingElement>(null);
    const h2Ref = useRef<HTMLHeadingElement>(null);
    const h3Ref = useRef<HTMLHeadingElement>(null);
    const yearsRef = useRef<HTMLSpanElement>(null);
    const clientsRef = useRef<HTMLSpanElement>(null);
    const shaderProgressRef = useRef(0);

    useLayoutEffect(() => {
        if (typeof window === 'undefined' || !rootRef.current) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let split1: SplitText | undefined;
        let split2: SplitText | undefined;
        let split3: SplitText | undefined;

        const ctx = gsap.context(() => {
            if (reduceMotion) {
                gsap.set(scene1Ref.current, { opacity: 1 });
                gsap.set([scene2Ref.current, scene3Ref.current], { opacity: 0, position: 'absolute' });
                return;
            }

            split1 = new SplitText(h1Ref.current, { type: 'chars', mask: 'chars' });
            split2 = new SplitText(h2Ref.current, { type: 'chars', mask: 'chars' });
            split3 = new SplitText(h3Ref.current, { type: 'chars', mask: 'chars' });

            // La escena 1 se muestra de inmediato (evita pantalla en blanco al cargar).
            // Solo las escenas 2 y 3 parten ocultas bajo el scroll.
            gsap.set([split2.chars, split3.chars], { yPercent: 115, opacity: 0 });
            gsap.set([scene2Ref.current, scene3Ref.current], { opacity: 0 });

            const counters = { years: 0, clients: 0 };

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: rootRef.current,
                    start: 'top top',
                    end: '+=180%',
                    scrub: 1,
                    pin: true,
                    anticipatePin: 1,
                    onUpdate: (self) => { shaderProgressRef.current = self.progress; },
                },
                defaults: { ease: 'power3.out' },
            });

            tl.to(split1.chars, { yPercent: 0, opacity: 1, stagger: 0.02, duration: 0.6 })
                .from(scene1Ref.current!.querySelectorAll('.io-sub'), { opacity: 0, y: 16, duration: 0.4, stagger: 0.05 }, '-=0.25')
                .to({}, { duration: 0.65 })
                .to(scene1Ref.current, { opacity: 0, y: -50, filter: 'blur(10px)', duration: 0.5 })
                .set(scene2Ref.current, { opacity: 1 }, '<')
                .to(split2.chars, { yPercent: 0, opacity: 1, stagger: 0.02, duration: 0.6 }, '<0.1')
                .from(scene2Ref.current!.querySelectorAll('.io-sub'), { opacity: 0, y: 16, duration: 0.4, stagger: 0.05 }, '-=0.25')
                .to({}, { duration: 0.65 })
                .to(scene2Ref.current, { opacity: 0, y: -50, filter: 'blur(10px)', duration: 0.5 })
                .set(scene3Ref.current, { opacity: 1 }, '<')
                .to(split3.chars, { yPercent: 0, opacity: 1, stagger: 0.025, duration: 0.7 }, '<0.1')
                .from(scene3Ref.current!.querySelectorAll('.io-sub'), { opacity: 0, y: 16, duration: 0.4, stagger: 0.05 }, '-=0.3')
                .to(counters, {
                    years: 10,
                    clients: 500,
                    duration: 1,
                    onUpdate: () => {
                        if (yearsRef.current) yearsRef.current.textContent = Math.round(counters.years) + '+';
                        if (clientsRef.current) clientsRef.current.textContent = Math.round(counters.clients) + '+';
                    },
                }, '-=0.2')
                .to({}, { duration: 0.8 });
        }, rootRef);

        return () => {
            ctx.revert();
            split1?.revert();
            split2?.revert();
            split3?.revert();
        };
    }, []);

    return (
        <div
            id="top"
            ref={rootRef}
            className={`relative h-screen w-full overflow-hidden ${theme === 'dark' ? 'bg-[#020617]' : 'bg-[#eef2f7]'}`}
        >
            {/* Fondo generativo GLSL — muta de color con la narrativa del scroll, sin figuras 3D protagonistas */}
            <ShaderBackdrop progressRef={shaderProgressRef} />
            <div className={`absolute inset-0 tactical-grid ${theme === 'dark' ? 'opacity-40' : 'opacity-20'}`} />
            {/* En modo claro, suaviza el fondo GLSL para mantener legibilidad */}
            {theme !== 'dark' && <div className="absolute inset-0 bg-white/70" />}

            {/* Escena 1 — El Problema */}
            <div ref={scene1Ref} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="io-sub text-[11px] font-bold text-red-400/80 uppercase tracking-[0.35em] font-mono mb-5">
                    Cada mes, en Ecuador
                </span>
                <h1 ref={h1Ref} className={`font-display font-extrabold leading-[1.1] text-[clamp(2.3rem,7.5vw,6rem)] max-w-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    UN ERROR EN EL SRI CUESTA CARO
                </h1>
                <p className={`io-sub mt-6 text-base md:text-xl max-w-xl font-light ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Un casillero mal declarado. Una fecha vencida. Una notificación que nadie quiere recibir.
                </p>
            </div>

            {/* Escena 2 — La Solución */}
            <div ref={scene2Ref} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="io-sub text-[11px] font-bold text-[#00A896] uppercase tracking-[0.35em] font-mono mb-5">
                    Ingeniería tributaria de precisión
                </span>
                <h1 ref={h2Ref} className={`font-display font-extrabold leading-[1.1] text-[clamp(2.3rem,7.5vw,6rem)] max-w-5xl text-[#00A896]`}>
                    NOSOTROS BLINDAMOS TU EMPRESA
                </h1>
                <p className={`io-sub mt-6 text-base md:text-xl max-w-xl font-light ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Automatización algorítmica + revisión humana experta. Cero errores en los casilleros 615 y 617.
                </p>
            </div>

            {/* Escena 3 — La Marca (cierre de la secuencia, entra al resto de la página) */}
            <div ref={scene3Ref} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="io-sub text-[11px] font-bold text-[#C9A96E] uppercase tracking-[0.35em] font-mono mb-5">
                    Soluciones Tributarias PRO
                </span>
                <h1 ref={h3Ref} className="font-display font-extrabold leading-[1.1] text-[clamp(2.6rem,9vw,7rem)] text-[#C9A96E] max-w-5xl">
                    SANTIAGO CÓRDOVA
                </h1>
                <p className={`io-sub mt-5 text-base md:text-xl max-w-xl font-light ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Tu tranquilidad fiscal, nuestro compromiso de élite.
                </p>

                <div className="io-sub flex items-center gap-8 md:gap-14 mt-9">
                    <div className="text-center">
                        <div className={`font-mono font-extrabold text-2xl md:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}><span ref={yearsRef}>0+</span></div>
                        <div className={`text-[10px] uppercase tracking-widest font-mono mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Años</div>
                    </div>
                    <div className={`w-px h-8 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}`} />
                    <div className="text-center">
                        <div className={`font-mono font-extrabold text-2xl md:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}><span ref={clientsRef}>0+</span></div>
                        <div className={`text-[10px] uppercase tracking-widest font-mono mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Empresas</div>
                    </div>
                    <div className={`w-px h-8 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}`} />
                    <div className="text-center">
                        <div className={`font-mono font-extrabold text-2xl md:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>100%</div>
                        <div className={`text-[10px] uppercase tracking-widest font-mono mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Cero Multas</div>
                    </div>
                </div>

                <div className="io-sub flex flex-col sm:flex-row gap-4 mt-10">
                    <button
                        onClick={() => scrollToSection('simulador')}
                        className="h-14 px-8 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 bg-gradient-to-r from-[#00A896] to-[#028090] text-white shadow-xl shadow-[#00A896]/20 hover:shadow-[#00A896]/40 transition-all active:scale-95 font-mono"
                    >
                        <Sparkles size={16} />
                        <span>Simulador RIMPE 2026</span>
                        <ArrowRight size={16} />
                    </button>
                    <a
                        href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20agendar%20una%20consulta%20tributaria%20gratuita.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`h-14 px-7 rounded-2xl border flex items-center justify-center gap-3 transition-all active:scale-95 font-mono text-xs font-bold uppercase tracking-widest ${
                            theme === 'dark'
                                ? 'border-white/10 hover:border-[#00A896]/40 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10'
                                : 'border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:border-[#00A896] hover:bg-slate-50'
                        }`}
                    >
                        <MessageCircle size={16} />
                        WhatsApp VIP
                    </a>
                </div>
            </div>
        </div>
    );
};

export default CinematicIntro;
