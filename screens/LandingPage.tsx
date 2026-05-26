
import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import { PublicUser } from '../types';

interface LandingPageProps {
    onAdminAccess: () => void;
    onNavigateToServices: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
}

// --- ELITE: Magnetic Button Component ---
const MagneticButton = ({ children, className = "", onClick, href, target, rel }: { children: React.ReactNode, className?: string, onClick?: () => void, href?: string, target?: string, rel?: string }) => {
    const btnRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!btnRef.current) return;
        const { clientX, clientY } = e;
        const { left, top, width, height } = btnRef.current.getBoundingClientRect();
        const x = clientX - (left + width / 2);
        const y = clientY - (top + height / 2);
        setPosition({ x: x * 0.3, y: y * 0.3 });
    };

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 });
    };

    const content = (
        <div 
            ref={btnRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            className={`transition-transform duration-300 ease-out ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );

    if (href) {
        return <a href={href} target={target} rel={rel} className="block">{content}</a>;
    }

    return content;
};

const CustomCursor = () => {
    const cursorRef = React.useRef<HTMLDivElement>(null);
    const dotRef = React.useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = React.useState(false);

    React.useEffect(() => {
        const moveCursor = (e: MouseEvent) => {
            if (cursorRef.current && dotRef.current) {
                cursorRef.current.style.left = `${e.clientX}px`;
                cursorRef.current.style.top = `${e.clientY}px`;
                dotRef.current.style.left = `${e.clientX}px`;
                dotRef.current.style.top = `${e.clientY}px`;
            }
            document.documentElement.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`);
            document.documentElement.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);
        };

        const handleOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, .interactive-card, .touch-scale')) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        window.addEventListener('mousemove', moveCursor);
        window.addEventListener('mouseover', handleOver);
        return () => {
            window.removeEventListener('mousemove', moveCursor);
            window.removeEventListener('mouseover', handleOver);
        };
    }, []);

    return (
        <>
            <div ref={cursorRef} className={`custom-cursor hidden md:block ${isHovering ? 'cursor-hovering' : ''}`} />
            <div ref={dotRef} className="custom-cursor-dot hidden md:block" />
        </>
    );
};

const TacticalGrid = () => (
    <div className="fixed inset-0 tactical-grid pointer-events-none z-[1] opacity-40" />
);

const AuroraBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-[10px] opacity-50">
            <div className="bg-aurora absolute inset-0 blur-[100px] animate-slow-pan" />
            <div className="aurora-blob bg-[#00A896]/20 top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full animate-float" />
            <div className="aurora-blob bg-[#028090]/20 bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full animate-float-delayed" />
            <div className="aurora-blob bg-blue-500/10 top-[20%] right-[10%] w-[40%] h-[40%] rounded-full animate-float" style={{ animationDelay: '-4s' }} />
        </div>
    </div>
);

// Hook para animar números (Counter)
const useCounter = (end: number, duration: number = 2000) => {
    const [count, setCount] = useState(0);
    const countRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        if (countRef.current) observer.observe(countRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        let startTime: number;
        let animationFrame: number;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
                animationFrame = requestAnimationFrame(step);
            }
        };
        animationFrame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration, isVisible]);

    return { count, ref: countRef };
};

const AnimatedStat = ({ end, label, prefix = "", suffix = "", className = "" }: { end: number, label: string, prefix?: string, suffix?: string, className?: string }) => {
    const { count, ref } = useCounter(end);
    return (
        <div ref={ref} className={`group cursor-default ${className}`}>
            <div className="text-5xl md:text-8xl font-editorial text-white tracking-tighter mb-4 group-hover:text-shimmer-elite transition-all duration-700">
                {prefix}{count.toLocaleString()}{suffix}
            </div>
            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] opacity-80">{label}</div>
        </div>
    );
};

const AuthorityTicker = () => {
    const authorities = [
        "CORPORACIÓN EL ROSADO", "GRUPO FAVORITA", "SRI ECUADOR", "SUPERCIAS", "MINISTERIO DE TRABAJO", "IESS", "BANCO CENTRAL"
    ];
    return (
        <div className="py-24 bg-[#020617] border-y border-white/5 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 mb-12 flex items-center gap-6">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em] whitespace-nowrap">Autoridad e Integridad Industrial</span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <div className="flex mask-fade-edges whitespace-nowrap animate-marquee">
                {[...authorities, ...authorities].map((name, i) => (
                    <div key={i} className="mx-16 flex items-center gap-6 group opacity-20 hover:opacity-100 transition-opacity duration-700">
                        <div className="w-2 h-2 bg-[#00A896] rounded-full shadow-[0_0_10px_#00A896]" />
                        <span className="text-3xl md:text-6xl font-editorial text-white tracking-tighter">
                            {name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- ELITE: Spotlight Card Component ---
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);
    const [rotate, setRotate] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPosition({ x, y });
        setOpacity(1);

        // 3D Tilt Effect
        const rotateX = ((y - rect.height / 2) / rect.height) * -10;
        const rotateY = ((x - rect.width / 2) / rect.width) * 10;
        setRotate({ x: rotateX, y: rotateY });
    };

    const handleMouseLeave = () => {
        setOpacity(0);
        setRotate({ x: 0, y: 0 });
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setOpacity(1)}
            onMouseLeave={handleMouseLeave}
            whileTap={{ scale: 0.98 }}
            style={{
                transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
                transition: 'transform 0.1s ease-out',
            }}
            className={`relative bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden group/card glass-premium-2 ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255, 255, 255, 0.1), transparent 40%)`,
                }}
            />
            <div className="relative z-10" style={{ transform: 'translateZ(20px)' }}>
                {children}
            </div>
        </motion.div>
    );
};


// --- ELITE: Reveal on Scroll Component ---
const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) ${isVisible ? 'opacity-100 translate-y-0 blur-0 scale-100' : 'opacity-0 translate-y-8 blur-md scale-[0.98]'} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices, currentUser }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showBiometric, setShowBiometric] = useState(false);
    const { scrollY } = useScroll();
    const phoneNumber = "593978980722";

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
            const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
            setScrollProgress((window.scrollY / totalScroll) * 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleProtectedAccess = () => {
        setShowBiometric(true);
        setTimeout(() => {
            setShowBiometric(false);
            onAdminAccess();
        }, 3000);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
    };

    return (
        <div className="bg-[#020617] min-h-screen text-slate-200 selection:bg-[#00A896]/30 selection:text-white font-sans overflow-x-hidden">
            {/* --- ULTRA PREMIUM: Global Overlays --- */}
            <AnimatePresence>
                {showBiometric && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-dot-matrix opacity-20" />
                        <div className="relative w-80 h-80 border-2 border-white/10 rounded-3xl p-12 glass-premium-2 overflow-hidden group">
                            <div className="biometric-scanner" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <LucideIcons.Fingerprint size={120} className="text-[#00A896] animate-pulse opacity-50" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#00A896]/20 to-transparent" />
                        </div>
                        <div className="mt-12 text-center">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.5em] mb-4 animate-pulse">Iniciando Escaneo Biométrico</div>
                            <div className="text-white font-editorial text-4xl tracking-tighter">ACCESO PRIVADO ZENITH</div>
                        </div>
                        {/* Fake system logs */}
                        <div className="absolute bottom-10 left-10 text-[8px] font-mono text-[#00A896]/40 uppercase leading-relaxed text-hud">
                            TOKEN_AUTENTICACION: 0x82...3F <br />
                            ENCLAVE_SEGURO: ACTIVO <br />
                            PROTOCOLO: ZENITH_V2.4 <br />
                            ESTADO: VERIFICANDO_IDENTIDAD
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CustomCursor />
            <TacticalGrid />
            <div className="fixed inset-0 bg-noise-animated opacity-[0.03] pointer-events-none z-[60]" />
            <div className="fixed inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40 pointer-events-none z-[2]" />

            {/* --- ELITE NAV: Floating Glass Island (Desktop) --- */}
            <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-6 px-4 pointer-events-none">
                {/* Progress Bar */}
                <div className="w-full max-w-6xl h-[2px] bg-white/5 mb-4 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[#00A896] to-teal-200 transition-all duration-150"
                        style={{ width: `${scrollProgress}%` }}
                    />
                </div>

                <nav className={`pointer-events-auto transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) flex items-center justify-between px-2 pr-3 py-2 rounded-full border border-white/10 shadow-2xl backdrop-blur-3xl 
                    ${scrolled ? 'nav-island-active w-full max-w-5xl scale-95 border-holographic' : 'bg-white/5 w-full max-w-6xl'}`}>

                    {/* Logo Area */}
                    <div
                        className="flex items-center gap-3 cursor-pointer pl-2 group"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                        <div className={`transition-all duration-700 w-10 h-10 bg-gradient-to-br from-[#00A896] to-[#005F56] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,168,150,0.4)] ${scrolled ? 'rotate-[360deg] scale-90' : ''}`}>
                            <Logo className="w-6 h-6 text-white" />
                        </div>
                        <div className={`hidden sm:flex flex-col transition-all duration-700 ${scrolled ? 'opacity-80 scale-95 origin-left' : ''}`}>
                            <span className="text-sm font-display font-semibold tracking-tight leading-none text-white whitespace-nowrap">SANTIAGO CORDOVA</span>
                            <span className="text-[11px] font-medium text-[#00A896] tracking-[0.2em] uppercase glow-text">Asesoría Fiscal de Élite</span>
                        </div>
                    </div>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5 backdrop-blur-md">
                        {['Inicio', 'Servicios', 'Recursos', 'Contacto'].map((item, idx) => (
                            <button
                                key={item}
                                onClick={() => scrollToSection(item === 'Inicio' ? 'top' : item.toLowerCase())}
                                className="px-5 py-2 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-500 hover:shadow-[0_0_20px_rgba(0,168,150,0.2)] relative overflow-hidden group"
                            >
                                <span className="relative z-10">{item}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-[#00A896]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onAdminAccess}
                            className="hidden md:block text-xs font-medium text-slate-400 hover:text-white transition-colors uppercase tracking-wider px-3 hover:scale-105"
                        >
                            Acceso
                        </button>
                        <MagneticButton onClick={onNavigateToServices}>
                            <div className="group relative px-6 py-2.5 bg-white text-[#0B2149] rounded-full text-xs font-semibold uppercase tracking-wider overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[#00A896]/40 transition-all duration-500">
                                <span className="relative z-10 group-hover:text-white transition-colors duration-500">Contratar</span>
                                <div className="absolute inset-0 bg-[#00A896] transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
                            </div>
                        </MagneticButton>
                    </div>
                </nav>
            </div>
            {/* --- MOBILE HUD MENU: Fullscreen Overlay --- */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(30px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        className="fixed inset-0 z-[100] hud-blur-overlay flex flex-col items-center justify-center p-8 md:hidden"
                    >
                        {/* Background Grid for HUD */}
                        <div className="absolute inset-0 tactical-grid opacity-20 pointer-events-none" />
                        
                        <div className="w-full max-w-sm relative">
                            {/* Decorative HUD corners */}
                            <div className="absolute -top-10 -left-10 w-20 h-20 border-t-2 border-l-2 border-[#00A896]/50 rounded-tl-3xl" />
                            <div className="absolute -bottom-10 -right-10 w-20 h-20 border-b-2 border-r-2 border-[#00A896]/50 rounded-br-3xl" />

                            <div className="flex flex-col gap-8 text-center">
                                {['INICIO', 'SERVICIOS', 'RECURSOS', 'CONTACTO'].map((item, i) => (
                                    <motion.button
                                        key={item}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: i * 0.1 }}
                                        onClick={() => scrollToSection(item === 'INICIO' ? 'top' : item.toLowerCase())}
                                        className="text-4xl font-editorial tracking-tighter text-white hover:text-[#00A896] transition-colors"
                                    >
                                        {item}
                                    </motion.button>
                                ))}
                            </div>

                            <motion.button
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                onClick={() => setMobileMenuOpen(false)}
                                className="mt-20 w-16 h-16 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto text-white"
                            >
                                <LucideIcons.X size={32} />
                            </motion.button>
                        </div>

                        {/* Terminal Style Metadata */}
                        <div className="absolute bottom-12 left-0 right-0 text-center px-12">
                            <div className="hud-line mb-4 opacity-30" />
                            <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-[0.4em]">
                                <span>STATUS: COMMAND_ACTIVE</span>
                                <span>VER: 2.4.0_STITCH</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- MOBILE DOCK: Dynamic Island Style --- */}
            <div className={`md:hidden fixed bottom-6 left-5 right-5 z-50 transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) ${scrolled ? 'translate-y-2 scale-95 opacity-[0.98]' : 'translate-y-0 opacity-100'}`}>
                <div className="mobile-island-dock border-holographic relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                    <button 
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                        className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform"
                    >
                        <div className="relative">
                            <LucideIcons.Home size={20} className={scrolled ? 'text-[#00A896] drop-shadow-[0_0_8px_rgba(0,168,150,0.5)]' : ''} />
                            {/* Mobile Progress Ring */}
                            <svg className="absolute -inset-1 w-7 h-7 -rotate-90 pointer-events-none opacity-40">
                                <circle
                                    cx="14" cy="14" r="12"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    fill="transparent"
                                    className="text-white/5"
                                />
                                <circle
                                    cx="14" cy="14" r="12"
                                    stroke="#00A896"
                                    strokeWidth="1.5"
                                    fill="transparent"
                                    strokeDasharray={75.4}
                                    strokeDashoffset={75.4 - (75.4 * scrollProgress) / 100}
                                    className="progress-ring-circle"
                                />
                            </svg>
                        </div>
                        <span className="text-[10px] font-semibold mt-2 uppercase tracking-tighter">Inicio</span>
                    </button>

                    <button 
                        onClick={onNavigateToServices} 
                        className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform"
                    >
                        <LucideIcons.Grid size={20} />
                        <span className="text-[10px] font-semibold mt-1 uppercase tracking-tighter">Servicios</span>
                    </button>

                    {/* Elite Floating Action Button (Integrated) */}
                    <div className="relative -mt-12 mb-2">
                        <div className="absolute inset-0 bg-[#00A896] rounded-full blur-xl opacity-40 animate-pulse" />
                        <a
                            href={`https://wa.me/${phoneNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative flex items-center justify-center w-14 h-14 bg-[#00A896] rounded-full text-white shadow-[0_8px_32px_rgba(0,168,150,0.4)] border-4 border-[#020617] transform active:scale-90 transition-all duration-300"
                        >
                            <LucideIcons.MessageCircle size={26} />
                        </a>
                    </div>

                    <button 
                        onClick={() => setMobileMenuOpen(true)} 
                        className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform"
                    >
                        <LucideIcons.Menu size={20} />
                        <span className="text-[10px] font-semibold mt-1 uppercase tracking-tighter">Menú</span>
                    </button>

                    <button 
                        onClick={onAdminAccess} 
                        className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform"
                    >
                        <LucideIcons.ShieldCheck size={20} />
                        <span className="text-[10px] font-semibold mt-1 uppercase tracking-tighter">Admin</span>
                    </button>
                </div>
            </div>


            {/* --- HERO SECTION: Aurora & Noise --- */}
            <header id="top" className="relative min-h-[90vh] md:min-h-screen flex items-center justify-center overflow-hidden bg-[#020617]">
                <AuroraBackground />

                {/* Parallax Floating Elements */}
                <motion.div 
                    style={{ y: useTransform(scrollY, [0, 1000], [0, -300]) }}
                    className="absolute top-1/4 -left-20 w-96 h-96 bg-[#00A896]/10 rounded-full blur-[120px] pointer-events-none" 
                />
                <motion.div 
                    style={{ y: useTransform(scrollY, [0, 1000], [0, 200]) }}
                    className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" 
                />
                
                {/* Secondary Aurora Effects */}
                <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-sky-400/10 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px] animate-float"></div>

                {/* Mobile Elite: Floating Particles (Professional) */}
                <div className="md:hidden absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-ping"></div>
                    <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-[#00A896] rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                </div>

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] md:opacity-5 pointer-events-none"></div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 text-center mt-20 md:mt-0">
                    <Reveal delay={100}>
                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-[#00A896]/30 bg-[#00A896]/5 backdrop-blur-md mb-10 group cursor-default">
                            <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_10px_#00A896]" />
                            <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em]">Protocolo Zenith v2.4 Activo</span>
                        </div>
                    </Reveal>
                    <h1 className="text-5xl sm:text-7xl md:text-[8.5rem] font-editorial tracking-tighter leading-[0.8] mb-12">
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 drop-shadow-2xl block text-reveal text-reveal-active">ING. SANTIAGO</span>
                        <span className="relative inline-block mt-4">
                            <span className="absolute -inset-4 blur-[100px] bg-[#00A896]/40 animate-pulse"></span>
                            <span className="relative liquid-gold-text text-reveal text-reveal-active [transition-delay:500ms]">CÓRDOVA</span>
                        </span>
                    </h1>

                    <Reveal delay={200}>
                        <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed text-balance">
                            Soluciones tributarias de precisión y consultoría fiscal de élite para líderes y empresas que exigen <span className="text-white font-medium border-b border-[#00A896]">rendimiento absoluto</span> y blindaje patrimonial.
                        </p>
                    </Reveal>

                    <Reveal delay={300}>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                            <MagneticButton onClick={onNavigateToServices}>
                                <div className="group relative w-64 h-16 bg-white text-[#020617] rounded-full font-semibold text-sm uppercase tracking-widest overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                                    <div className="absolute inset-0 flex items-center justify-center group-hover:-translate-y-full transition-transform duration-300">
                                        Explorar Soluciones
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-[#00A896] text-white">
                                        <LucideIcons.ArrowRight size={24} />
                                    </div>
                                </div>
                            </MagneticButton>

                            <MagneticButton href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer">
                                <div className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors group px-6 py-4 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10">
                                    <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                        <LucideIcons.Phone size={20} />
                                    </div>
                                    <span className="text-xs font-medium uppercase tracking-widest">Agendar Cita</span>
                                </div>
                            </MagneticButton>
                        </div>
                    </Reveal>
                </div>

                {/* Scrolling Marquee Bottom */}
                <div className="absolute bottom-0 w-full py-6 border-t border-white/5 bg-[#020617]/50 backdrop-blur-sm overflow-hidden pointer-events-none">
                    <div className="flex whitespace-nowrap animate-marquee">
                        {[...Array(10)].map((_, i) => (
                            <span key={i} className="mx-8 text-4xl font-editorial text-white/5 uppercase tracking-tighter">
                                Auditoría • Estrategia • Cumplimiento •
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            <AuthorityTicker />

            <div className="section-connector-line" />

            {/* --- BENTO GRID SERVICES --- */}
            <section id="servicios" className="py-40 relative bg-[#020617] overflow-hidden">
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-8">
                            <div className="max-w-2xl">
                                <h2 className="text-4xl md:text-7xl font-editorial tracking-tighter mb-6">
                                    SOLUCIONES DE <br />
                                    <span className="text-shimmer-elite">ALTO IMPACTO</span>
                                </h2>
                                <p className="text-slate-400 text-lg md:text-xl font-light">
                                    Nuestra suite de servicios está diseñada para la <span className="text-white font-medium">máxima eficiencia operativa</span> y blindaje fiscal.
                                </p>
                            </div>
                            <div className="hidden md:block">
                                <div className="text-right">
                                    <span className="text-5xl font-editorial text-white/10 block leading-none">2026</span>
                                    <span className="text-[10px] font-bold text-[#00A896] tracking-[0.3em] uppercase">Ecosistema Fiscal</span>
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <SpotlightCard className="md:col-span-2 interactive-card">
                            <div className="flex flex-col h-full justify-between p-10 min-h-[450px]">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-900/50 flex items-center justify-center mb-10 shadow-lg shadow-[#00A896]/20">
                                    <LucideIcons.BarChart3 className="text-white" size={32} />
                                </div>
                                <div>
                                    <h3 className="text-3xl md:text-5xl font-editorial tracking-tight mb-4">OPTIMIZACIÓN FISCAL MATRIX</h3>
                                    <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
                                        Analizamos cada variable de su estructura financiera para identificar fugas de capital y maximizar sus deducciones legales mediante algoritmos de precisión.
                                    </p>
                                </div>
                                <div className="mt-8 flex items-center gap-4 text-[#00A896] font-bold text-xs uppercase tracking-widest group/link cursor-pointer">
                                    <span onClick={onNavigateToServices}>Ver Detalles del Sistema</span>
                                    <LucideIcons.ArrowUpRight size={16} className="group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                                </div>
                            </div>
                        </SpotlightCard>

                        <SpotlightCard className="interactive-card">
                            <div className="flex flex-col h-full p-10 min-h-[450px]">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-10 group-hover:border-[#00A896]/50 transition-colors">
                                    <LucideIcons.ShieldCheck className="text-[#00A896]" size={32} />
                                </div>
                                <h3 className="text-3xl font-editorial tracking-tight mb-4 uppercase">Blindaje Jurídico</h3>
                                <p className="text-slate-400 leading-relaxed mb-10">
                                    Defensa técnica especializada ante entes de control, garantizando la integridad de su patrimonio frente a auditorías externas.
                                </p>
                                <div className="mt-auto pt-6 border-t border-white/5">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        <span>Estado</span>
                                        <span className="text-[#00A896]">Activo</span>
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>

                        <SpotlightCard className="interactive-card">
                            <div className="flex flex-col h-full p-10 min-h-[400px]">
                                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                                    <LucideIcons.Zap className="text-yellow-400" size={28} />
                                </div>
                                <h3 className="text-3xl font-editorial tracking-tight mb-4 uppercase">Gestión Turbo</h3>
                                <p className="text-slate-400 leading-relaxed text-lg">
                                    Automatización de declaraciones y reportes mensuales con nuestra tecnología propietaria de integración directa.
                                </p>
                            </div>
                        </SpotlightCard>

                        <SpotlightCard className="md:col-span-2 interactive-card overflow-hidden">
                            <div className="flex flex-col md:flex-row h-full">
                                <div className="flex-1 p-10 flex flex-col justify-center">
                                    <h3 className="text-3xl md:text-5xl font-editorial tracking-tight mb-4 uppercase">Consultoría Estratégica</h3>
                                    <p className="text-slate-400 text-xl font-light leading-relaxed mb-10">
                                        Sesiones ejecutivas para el diseño de rutas críticas de crecimiento y expansión internacional bajo marcos fiscales eficientes.
                                    </p>
                                    <MagneticButton onClick={onNavigateToServices}>
                                        <div className="inline-flex px-10 py-4 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#00A896] hover:text-white transition-colors">
                                            Solicitar Auditoría
                                        </div>
                                    </MagneticButton>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-white/5 to-transparent p-10 flex items-center justify-center border-l border-white/5 relative">
                                    <div className="absolute inset-0 tactical-grid opacity-20" />
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-[#00A896]/20 blur-3xl rounded-full" />
                                        <LucideIcons.Globe className="text-white/20 relative z-10 animate-pulse-slow" size={160} />
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>
                    </div>
                </div>
            </section>

            <div className="section-connector-line h-20" />

            {/* --- TELEMETRY DASHBOARD --- */}
            <section className="py-40 bg-[#020617] relative overflow-hidden">
                <div className="absolute inset-0 bg-dot-matrix opacity-20" />
                
                {/* Tactical Radar Effect for Mobile */}
                <div className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-[#00A896]/10 rounded-full animate-ping pointer-events-none" />
                <div className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-[#00A896]/5 rounded-full animate-pulse pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1 border border-white/10 bg-white/5 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl glass-premium-2">
                        {[
                            { label: "Clientes Activos", end: 500, suffix: "+", icon: <LucideIcons.Users size={20} /> },
                            { label: "Ahorro Fiscal", end: 1200000, prefix: "$", icon: <LucideIcons.TrendingUp size={20} /> },
                            { label: "Años de Trayectoria", end: 10, suffix: "+", icon: <LucideIcons.Award size={20} /> },
                            { label: "Efectividad Operativa", end: 100, suffix: "%", icon: <LucideIcons.Activity size={20} /> }
                        ].map((stat, i) => (
                            <Reveal key={i} delay={i * 100}>
                                <div className="p-12 border-white/10 hover:bg-white/[0.03] transition-colors group relative">
                                    <div className="absolute top-8 right-8 text-[#00A896] opacity-30 group-hover:opacity-100 transition-opacity">
                                        {stat.icon}
                                    </div>
                                    <AnimatedStat {...stat} />
                                    <div className="mt-8 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} 
                                            whileInView={{ width: '100%' }} 
                                            transition={{ duration: 2, ease: "easeOut", delay: i * 0.2 }}
                                            className="h-full bg-gradient-to-r from-[#00A896] to-sky-400" 
                                        />
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <div className="section-connector-line h-40 bg-gradient-to-b from-[#00A896] via-white/20 to-transparent" />

            {/* --- WIKI SECTION: Glass Accordion --- */}
            <section id="recursos" className="py-40 relative overflow-hidden bg-[#020617]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-[#00A896]/10 rounded-full blur-[200px] pointer-events-none" />
                
                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-24">
                            <h2 className="text-4xl md:text-7xl font-editorial tracking-tighter mb-6">
                                BASE DE <br />
                                <span className="text-shimmer-elite">CONOCIMIENTO</span>
                            </h2>
                            <p className="text-slate-400 text-lg md:text-xl font-light tracking-wide">
                                Desmitificando la complejidad fiscal con precisión quirúrgica.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid gap-6">
                        {[
                            { title: "¿Cuánto debo retener en 2026?", category: "Retenciones", content: "Las tablas de retención se han actualizado para el ejercicio fiscal 2026. Los servicios profesionales ahora están sujetos a una retención del 10% en la fuente. Nuestra plataforma automatiza este cálculo en tiempo real." },
                            { title: "RIMPE: Diferenciación de Regímenes", category: "Régimen", content: "La segmentación entre Negocio Popular y Emprendedor es crítica para la emisión de comprobantes. El límite de $20,000 anuales define el uso de Notas de Venta frente a Facturas electrónicas con desglose de IVA." },
                            { title: "Devolución de IVA: Tercera Edad y Discapacidad", category: "Beneficios", content: "Gestionamos el proceso de recuperación de IVA de forma integral. Los beneficiarios pueden recuperar hasta el tope mensual establecido por ley mediante trámites 100% digitales con acreditación directa." }
                        ].map((item, i) => (
                            <Reveal key={i} delay={i * 100}>
                                <div className="group relative bg-white/5 hover:bg-white/[0.08] border border-white/10 rounded-3xl p-8 transition-all cursor-pointer interactive-card glass-premium-2 overflow-hidden">
                                    {/* Archive Scan Effect */}
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-[#00A896]/50 opacity-0 group-hover:opacity-100 group-hover:animate-scan pointer-events-none" />
                                    
                                    <div className="flex justify-between items-center relative z-10">
                                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                                            <span className="text-[10px] font-bold text-[#00A896] bg-[#00A896]/10 px-3 py-1.5 rounded-full uppercase tracking-[0.2em] w-fit">
                                                {item.category}
                                            </span>
                                            <h3 className="text-xl md:text-2xl font-editorial text-white group-hover:text-shimmer-elite transition-colors">
                                                {item.title}
                                            </h3>
                                        </div>
                                        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                            <LucideIcons.ChevronDown className="text-slate-500 group-hover:text-white transition-transform group-hover:rotate-180" size={20} />
                                        </div>
                                    </div>
                                    <div className="mt-6 text-slate-400 text-lg font-light leading-relaxed max-h-0 overflow-hidden group-hover:max-h-40 transition-all duration-700 ease-in-out">
                                        <p className="pt-6 border-t border-white/5">{item.content}</p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- CTA: Holographic Portal --- */}
            <section id="contacto" className="py-40 px-6 bg-[#020617] relative overflow-hidden">
                <div className="absolute inset-0 tactical-grid opacity-20" />
                
                <Reveal>
                    <div className="max-w-6xl mx-auto relative group/cta">
                        {/* Interactive Aura around CTA */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#00A896] via-sky-500 to-purple-600 rounded-[4rem] blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000 animate-slow-pan" />
                        
                        <div className="relative bg-black/40 border border-white/10 rounded-[4rem] p-16 md:p-32 text-center overflow-hidden glass-premium-2 shadow-2xl">
                            {/* Inner Scanning Line */}
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-scan" />

                            <h2 className="text-5xl md:text-9xl font-editorial tracking-tighter mb-12 text-white leading-none">
                                ESCALE SU <br />
                                <span className="text-shimmer-elite">VISIÓN.</span>
                            </h2>
                            <p className="text-slate-400 text-xl md:text-2xl font-light mb-16 max-w-2xl mx-auto text-balance">
                                Arquitectura financiera diseñada para la libertad. Inicie su transformación hoy mismo con asesoría de élite.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-8 items-center">
                                <MagneticButton href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noreferrer">
                                    <div className="group relative px-12 py-6 bg-white text-black rounded-full font-bold text-xs uppercase tracking-[0.3em] overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[#00A896]/50 transition-all duration-700">
                                        <div className="absolute inset-0 bg-[#00A896] transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out" />
                                        <span className="relative z-10 group-hover:text-white flex items-center gap-4">
                                            <LucideIcons.MessageCircle size={22} /> Hablar con un Experto
                                        </span>
                                    </div>
                                </MagneticButton>

                                <div className="group/loc flex items-center gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] px-10 py-6 border border-white/5 rounded-full bg-white/5 backdrop-blur-md hover:border-[#00A896]/50 hover:text-white transition-all duration-500 cursor-default">
                                    <LucideIcons.MapPin size={20} className="text-[#00A896] group-hover/loc:scale-125 transition-transform" /> 
                                    Pasaje, El Oro
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* --- FOOTER: Studio Aesthetic --- */}
            <footer className="border-t border-white/5 py-24 bg-[#020617] relative">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-16 md:gap-8 mb-20">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-4 mb-8">
                            <Logo className="w-10 h-10 text-white" />
                            <span className="font-editorial text-2xl tracking-tighter uppercase text-white">SANTIAGO CORDOVA</span>
                        </div>
                        <p className="text-slate-500 text-lg font-light leading-relaxed max-w-sm">
                            Redefiniendo el estándar de la contabilidad moderna mediante tecnología y estrategia de élite.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-white text-[10px] font-bold uppercase tracking-[0.4em] mb-8">Navegación</h4>
                        <ul className="space-y-4">
                            {['Inicio', 'Servicios', 'Wiki', 'Contacto'].map(item => (
                                <li key={item}>
                                    <button onClick={() => scrollToSection(item.toLowerCase())} className="text-slate-500 hover:text-[#00A896] transition-colors text-sm font-light">
                                        {item}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white text-[10px] font-bold uppercase tracking-[0.4em] mb-8">Ecosistema</h4>
                        <ul className="space-y-4">
                            <li><button onClick={handleProtectedAccess} className="text-slate-500 hover:text-white transition-colors text-sm font-light">Acceso Ejecutivo</button></li>
                            <li><a href="#" className="text-slate-500 hover:text-white transition-colors text-sm font-light">Portal de Pagos</a></li>
                            <li><a href="#" className="text-slate-500 hover:text-white transition-colors text-sm font-light">Documentación API</a></li>
                        </ul>
                    </div>
                </div>
                
                <div className="max-w-7xl mx-auto px-6 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-slate-600 text-[10px] font-bold tracking-[0.3em] uppercase">
                        © 2026. <span className="text-[#00A896]">SANTIAGO CÓRDOVA</span> • TODOS LOS DERECHOS RESERVADOS
                    </div>
                    <div className="flex gap-8">
                        <div className="text-slate-600 text-[10px] font-bold tracking-[0.3em] uppercase">
                            DISEÑADO POR <span className="text-white">SUPRA MUSIC INC.</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
