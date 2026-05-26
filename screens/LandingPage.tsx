
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

// ─── MAGNETIC BUTTON ────────────────────────────────────────────────────────
const MagneticButton = ({ children, className = "", onClick, href, target, rel }: {
    children: React.ReactNode; className?: string; onClick?: () => void;
    href?: string; target?: string; rel?: string;
}) => {
    const btnRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!btnRef.current) return;
        const { clientX, clientY } = e;
        const { left, top, width, height } = btnRef.current.getBoundingClientRect();
        setPosition({ x: (clientX - (left + width / 2)) * 0.3, y: (clientY - (top + height / 2)) * 0.3 });
    };
    const content = (
        <div ref={btnRef} onMouseMove={handleMouseMove} onMouseLeave={() => setPosition({ x: 0, y: 0 })}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            className={`transition-transform duration-300 ease-out ${className}`} onClick={onClick}>
            {children}
        </div>
    );
    if (href) return <a href={href} target={target} rel={rel} className="block">{content}</a>;
    return content;
};

// ─── CUSTOM CURSOR ───────────────────────────────────────────────────────────
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
            setIsHovering(!!(e.target as HTMLElement).closest('button, a, .interactive-card, .touch-scale'));
        };
        window.addEventListener('mousemove', moveCursor);
        window.addEventListener('mouseover', handleOver);
        return () => { window.removeEventListener('mousemove', moveCursor); window.removeEventListener('mouseover', handleOver); };
    }, []);
    return (
        <>
            <div ref={cursorRef} className={`custom-cursor hidden md:block ${isHovering ? 'cursor-hovering' : ''}`} />
            <div ref={dotRef} className="custom-cursor-dot hidden md:block" />
        </>
    );
};

// ─── TACTICAL GRID ───────────────────────────────────────────────────────────
const TacticalGrid = () => <div className="fixed inset-0 tactical-grid pointer-events-none z-[1] opacity-40" />;

// ─── AURORA BACKGROUND ───────────────────────────────────────────────────────
const AuroraBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-[10px] opacity-60">
            <div className="aurora-blob bg-[#00A896]/25 top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full animate-float" />
            <div className="aurora-blob bg-[#028090]/20 bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full animate-float-delayed" />
            <div className="aurora-blob bg-blue-500/10 top-[20%] right-[10%] w-[40%] h-[40%] rounded-full animate-float" style={{ animationDelay: '-4s' }} />
            <div className="aurora-blob bg-purple-600/10 top-[50%] left-[30%] w-[40%] h-[40%] rounded-full animate-float-delayed" style={{ animationDelay: '-8s' }} />
        </div>
    </div>
);

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
const useCounter = (end: number, duration = 2000) => {
    const [count, setCount] = useState(0);
    const countRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } }, { threshold: 0.1 });
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
            if (progress < 1) animationFrame = requestAnimationFrame(step);
        };
        animationFrame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration, isVisible]);
    return { count, ref: countRef };
};

const AnimatedStat = ({ end, label, prefix = "", suffix = "", className = "" }: { end: number; label: string; prefix?: string; suffix?: string; className?: string }) => {
    const { count, ref } = useCounter(end);
    return (
        <div ref={ref} className={`group cursor-default ${className}`}>
            <div className="text-5xl md:text-7xl font-editorial text-white tracking-tighter mb-3 group-hover:text-shimmer-elite transition-all duration-700">
                {prefix}{count.toLocaleString()}{suffix}
            </div>
            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] opacity-80">{label}</div>
        </div>
    );
};

// ─── REVEAL ON SCROLL ────────────────────────────────────────────────────────
const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } }, { threshold: 0.05 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return (
        <div ref={ref} className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-10 blur-sm'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
            {children}
        </div>
    );
};

// ─── SPOTLIGHT CARD ──────────────────────────────────────────────────────────
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);
    const [rotate, setRotate] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPosition({ x, y });
        setOpacity(1);
        setRotate({ x: ((y - rect.height / 2) / rect.height) * -8, y: ((x - rect.width / 2) / rect.width) * 8 });
    };
    return (
        <motion.div onMouseMove={handleMouseMove} onMouseEnter={() => setOpacity(1)} onMouseLeave={() => { setOpacity(0); setRotate({ x: 0, y: 0 }); }}
            whileTap={{ scale: 0.98 }}
            style={{ transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`, transition: 'transform 0.15s ease-out' }}
            className={`relative bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden group/card glass-premium-2 ${className}`}>
            <div className="pointer-events-none absolute -inset-px transition duration-300"
                style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(0,168,150,0.12), transparent 40%)` }} />
            <div className="relative z-10 h-full">{children}</div>
        </motion.div>
    );
};

// ─── AUTHORITY TICKER ────────────────────────────────────────────────────────
const AuthorityTicker = () => {
    const items = ["SRI ECUADOR", "SUPERCIAS", "MINISTERIO DE TRABAJO", "IESS", "BANCO CENTRAL", "RIMPE 2026", "RÉGIMEN GENERAL", "IVA • RENTA • RETENCIONES"];
    return (
        <div className="py-16 bg-[#020617] border-y border-white/5 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 mb-10 flex items-center gap-6">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em] whitespace-nowrap">Regulaciones y Entidades que Dominamos</span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <div className="flex mask-fade-edges whitespace-nowrap animate-marquee">
                {[...items, ...items].map((name, i) => (
                    <div key={i} className="mx-12 flex items-center gap-5 group opacity-20 hover:opacity-100 transition-opacity duration-700">
                        <div className="w-1.5 h-1.5 bg-[#00A896] rounded-full shadow-[0_0_8px_#00A896]" />
                        <span className="text-2xl md:text-4xl font-editorial text-white tracking-tighter">{name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── TESTIMONIAL CARD ────────────────────────────────────────────────────────
const TestimonialCard = ({ quote, name, role, stars = 5, delay = 0 }: { quote: string; name: string; role: string; stars?: number; delay?: number }) => (
    <Reveal delay={delay}>
        <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 glass-premium-2 hover:border-[#00A896]/30 transition-all duration-500 interactive-card h-full flex flex-col">
            <div className="flex gap-1 mb-6">
                {Array.from({ length: stars }).map((_, i) => (
                    <LucideIcons.Star key={i} size={14} className="text-[#d4af37] fill-[#d4af37]" />
                ))}
            </div>
            <p className="text-slate-300 text-base leading-relaxed font-light flex-1 mb-8">"{quote}"</p>
            <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A896] to-teal-900 flex items-center justify-center text-white font-bold text-sm">
                    {name.charAt(0)}
                </div>
                <div>
                    <div className="text-white font-semibold text-sm">{name}</div>
                    <div className="text-[#00A896] text-xs font-medium">{role}</div>
                </div>
            </div>
        </div>
    </Reveal>
);

// ─── PROCESS STEP ────────────────────────────────────────────────────────────
const ProcessStep = ({ number, title, description, icon: Icon, delay = 0 }: { number: string; title: string; description: string; icon: React.ElementType; delay?: number }) => (
    <Reveal delay={delay}>
        <div className="relative group">
            <div className="flex gap-6 md:gap-8">
                <div className="flex-shrink-0">
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00A896]/20 to-transparent border border-[#00A896]/30 flex items-center justify-center group-hover:border-[#00A896] transition-all duration-500 group-hover:shadow-[0_0_30px_rgba(0,168,150,0.3)]">
                        <Icon size={22} className="text-[#00A896]" />
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#00A896] text-[#020617] text-[9px] font-black flex items-center justify-center">{number}</span>
                    </div>
                </div>
                <div className="pt-1">
                    <h4 className="text-white font-bold text-lg mb-2 group-hover:text-[#00A896] transition-colors">{title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed font-light">{description}</p>
                </div>
            </div>
        </div>
    </Reveal>
);

// ─── TRUST BADGE ─────────────────────────────────────────────────────────────
const TrustBadge = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
    <div className="flex items-center gap-3 px-5 py-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-md hover:border-[#00A896]/40 hover:bg-[#00A896]/5 transition-all duration-300 group">
        <Icon size={16} className="text-[#00A896] group-hover:scale-110 transition-transform" />
        <div>
            <div className="text-white text-xs font-semibold leading-none">{value}</div>
            <div className="text-slate-500 text-[9px] uppercase tracking-wider mt-0.5">{label}</div>
        </div>
    </div>
);

// ─── FAQ ITEM ─────────────────────────────────────────────────────────────────
const FaqItem = ({ question, answer, category, delay = 0 }: { question: string; answer: string; category: string; delay?: number }) => {
    const [open, setOpen] = useState(false);
    return (
        <Reveal delay={delay}>
            <div className={`group relative border rounded-3xl transition-all duration-500 cursor-pointer overflow-hidden interactive-card ${open ? 'border-[#00A896]/40 bg-[#00A896]/5' : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'}`}
                onClick={() => setOpen(o => !o)}>
                <div className="absolute top-0 left-0 w-full h-[1px] bg-[#00A896]/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="p-8 flex justify-between items-start gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
                        <span className="text-[10px] font-bold text-[#00A896] bg-[#00A896]/10 px-3 py-1.5 rounded-full uppercase tracking-[0.2em] w-fit flex-shrink-0">{category}</span>
                        <h3 className={`text-lg md:text-xl font-bold text-white transition-colors ${open ? 'text-[#00A896]' : ''}`}>{question}</h3>
                    </div>
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${open ? 'bg-[#00A896] border-[#00A896]' : 'border-white/10 bg-white/5'}`}>
                        <LucideIcons.ChevronDown size={18} className={`text-white transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                <AnimatePresence>
                    {open && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                            <div className="px-8 pb-8">
                                <div className="pt-4 border-t border-white/5">
                                    <p className="text-slate-400 text-base font-light leading-relaxed">{answer}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Reveal>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showBiometric, setShowBiometric] = useState(false);
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 800], [0, -120]);
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
        setTimeout(() => { setShowBiometric(false); onAdminAccess(); }, 3000);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
    };

    const navLinks = ['Inicio', 'Servicios', 'Sobre mí', 'Recursos', 'Contacto'];

    return (
        <div className="bg-[#020617] min-h-screen text-slate-200 selection:bg-[#00A896]/30 selection:text-white font-sans overflow-x-hidden">

            {/* ── BIOMETRIC OVERLAY ── */}
            <AnimatePresence>
                {showBiometric && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center">
                        <div className="absolute inset-0 bg-dot-matrix opacity-20" />
                        <div className="relative w-72 h-72 border-2 border-white/10 rounded-3xl p-10 glass-premium-2 overflow-hidden">
                            <div className="biometric-scanner" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <LucideIcons.Fingerprint size={100} className="text-[#00A896] animate-pulse opacity-50" />
                            </div>
                        </div>
                        <div className="mt-10 text-center">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.5em] mb-3 animate-pulse">Verificando Acceso</div>
                            <div className="text-white font-editorial text-3xl tracking-tighter">ACCESO EJECUTIVO</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CustomCursor />
            <TacticalGrid />
            <div className="fixed inset-0 bg-noise-animated opacity-[0.025] pointer-events-none z-[60]" />

            {/* ── NAV ── */}
            <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-5 px-4 pointer-events-none">
                <div className="w-full max-w-6xl h-[1.5px] bg-white/5 mb-3 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#00A896] to-teal-200 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
                </div>
                <nav className={`pointer-events-auto transition-all duration-700 flex items-center justify-between px-3 pr-3 py-2 rounded-full border shadow-2xl backdrop-blur-3xl
                    ${scrolled ? 'nav-island-active w-full max-w-5xl scale-[0.97] border-holographic bg-[#020617]/80' : 'bg-white/5 border-white/10 w-full max-w-6xl'}`}>
                    <div className="flex items-center gap-3 cursor-pointer pl-2 group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className={`transition-all duration-700 w-9 h-9 bg-gradient-to-br from-[#00A896] to-[#005F56] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,168,150,0.4)] ${scrolled ? 'rotate-[360deg] scale-90' : ''}`}>
                            <Logo className="w-5 h-5 text-white" />
                        </div>
                        <div className={`hidden sm:flex flex-col transition-all duration-500 ${scrolled ? 'opacity-80' : ''}`}>
                            <span className="text-sm font-display font-bold tracking-tight leading-none text-white">SANTIAGO CÓRDOVA</span>
                            <span className="text-[10px] font-semibold text-[#00A896] tracking-[0.18em] uppercase">Asesor Tributario · Ing.</span>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5">
                        {navLinks.map((item) => (
                            <button key={item}
                                onClick={() => scrollToSection(item === 'Inicio' ? 'top' : item.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))}
                                className="px-4 py-2 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-300 relative overflow-hidden group">
                                <span className="relative z-10">{item}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-[#00A896]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onAdminAccess} className="hidden md:block text-xs font-medium text-slate-500 hover:text-white transition-colors uppercase tracking-wider px-3">
                            Acceso
                        </button>
                        <MagneticButton onClick={onNavigateToServices}>
                            <div className="group relative px-6 py-2.5 bg-white text-[#0B2149] rounded-full text-xs font-bold uppercase tracking-wider overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-all duration-500">
                                <span className="relative z-10 group-hover:text-white transition-colors duration-500">Contratar</span>
                                <div className="absolute inset-0 bg-[#00A896] transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" />
                            </div>
                        </MagneticButton>
                    </div>
                </nav>
            </div>

            {/* ── MOBILE MENU ── */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] hud-blur-overlay flex flex-col items-center justify-center p-8 md:hidden">
                        <div className="absolute inset-0 tactical-grid opacity-20 pointer-events-none" />
                        <div className="w-full max-w-sm relative">
                            <div className="absolute -top-10 -left-10 w-20 h-20 border-t-2 border-l-2 border-[#00A896]/50 rounded-tl-3xl" />
                            <div className="absolute -bottom-10 -right-10 w-20 h-20 border-b-2 border-r-2 border-[#00A896]/50 rounded-br-3xl" />
                            <div className="flex flex-col gap-6 text-center">
                                {navLinks.map((item, i) => (
                                    <motion.button key={item} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
                                        onClick={() => { scrollToSection(item === 'Inicio' ? 'top' : item.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')); setMobileMenuOpen(false); }}
                                        className="text-4xl font-editorial tracking-tighter text-white hover:text-[#00A896] transition-colors">
                                        {item.toUpperCase()}
                                    </motion.button>
                                ))}
                            </div>
                            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={() => setMobileMenuOpen(false)}
                                className="mt-16 w-14 h-14 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mx-auto text-white">
                                <LucideIcons.X size={28} />
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MOBILE DOCK ── */}
            <div className="md:hidden fixed bottom-5 left-4 right-4 z-50">
                <div className="mobile-island-dock border-holographic relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all">
                        <LucideIcons.Home size={20} className={scrolled ? 'text-[#00A896]' : ''} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Inicio</span>
                    </button>
                    <button onClick={onNavigateToServices} className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all">
                        <LucideIcons.Grid size={20} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Servicios</span>
                    </button>
                    <div className="relative -mt-10 mb-1">
                        <div className="absolute inset-0 bg-[#00A896] rounded-full blur-xl opacity-50 animate-pulse" />
                        <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer"
                            className="relative flex items-center justify-center w-14 h-14 bg-[#00A896] rounded-full text-white shadow-[0_8px_32px_rgba(0,168,150,0.4)] border-4 border-[#020617] active:scale-90 transition-all duration-300">
                            <LucideIcons.MessageCircle size={24} />
                        </a>
                    </div>
                    <button onClick={() => setMobileMenuOpen(true)} className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all">
                        <LucideIcons.Menu size={20} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Menú</span>
                    </button>
                    <button onClick={onAdminAccess} className="touch-scale flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all">
                        <LucideIcons.ShieldCheck size={20} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Admin</span>
                    </button>
                </div>
            </div>


            {/* ════════════════════════════════════════════════════════════════
                HERO SECTION
            ════════════════════════════════════════════════════════════════ */}
            <header id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#020617]">
                <AuroraBackground />
                <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-[#00A896]/8 rounded-full blur-[150px]" />
                    <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[180px]" />
                </motion.div>

                {/* Animated grid dots */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

                {/* Floating particles */}
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="absolute pointer-events-none"
                        style={{
                            top: `${15 + i * 13}%`, left: `${10 + i * 15}%`,
                            width: i % 2 === 0 ? '2px' : '1px', height: i % 2 === 0 ? '2px' : '1px',
                            background: i % 3 === 0 ? '#00A896' : 'white',
                            borderRadius: '50%',
                            animation: `float ${4 + i}s ease-in-out ${i * 0.5}s infinite alternate`,
                            opacity: 0.4
                        }} />
                ))}

                <div className="relative z-10 max-w-7xl mx-auto px-6 text-center mt-20">
                    {/* Status badge */}
                    <Reveal delay={0}>
                        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[#00A896]/30 bg-[#00A896]/5 backdrop-blur-md mb-10 group cursor-default">
                            <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_10px_#00A896]" />
                            <span className="text-[11px] font-bold text-[#00A896] uppercase tracking-[0.35em]">Disponible • Pasaje, El Oro · Ecuador</span>
                        </div>
                    </Reveal>

                    {/* Main headline */}
                    <Reveal delay={80}>
                        <h1 className="text-[3.2rem] sm:text-[5rem] md:text-[8rem] lg:text-[10rem] font-editorial tracking-tighter leading-[0.82] mb-8">
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/30 drop-shadow-2xl block">
                                ING. SANTIAGO
                            </span>
                            <span className="relative inline-block mt-3 md:mt-5">
                                <span className="absolute -inset-4 blur-[80px] bg-[#00A896]/35 animate-pulse pointer-events-none" />
                                <span className="relative liquid-gold-text">CÓRDOVA</span>
                            </span>
                        </h1>
                    </Reveal>

                    {/* Sub-tagline */}
                    <Reveal delay={160}>
                        <p className="text-lg md:text-2xl text-slate-400 max-w-2xl mx-auto mb-4 font-light tracking-wide leading-relaxed text-balance">
                            Soluciones tributarias de precisión para líderes y empresas que exigen{' '}
                            <span className="text-white font-semibold border-b border-[#00A896]">rendimiento absoluto</span>{' '}
                            y blindaje fiscal total.
                        </p>
                    </Reveal>

                    {/* Trust badges row */}
                    <Reveal delay={220}>
                        <div className="flex flex-wrap justify-center gap-3 mb-12 mt-8">
                            <TrustBadge icon={LucideIcons.Award} label="Años de experiencia" value="10+" />
                            <TrustBadge icon={LucideIcons.Users} label="Clientes satisfechos" value="500+" />
                            <TrustBadge icon={LucideIcons.Shield} label="Cumplimiento SRI" value="100%" />
                            <TrustBadge icon={LucideIcons.MapPin} label="Ubicación" value="El Oro, Ecuador" />
                        </div>
                    </Reveal>

                    {/* CTA Buttons */}
                    <Reveal delay={280}>
                        <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
                            <MagneticButton onClick={onNavigateToServices}>
                                <div className="group relative w-64 h-14 bg-white text-[#020617] rounded-full font-bold text-xs uppercase tracking-widest overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[#00A896]/50 transition-all duration-500">
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 group-hover:-translate-y-full transition-transform duration-400">
                                        <LucideIcons.Sparkles size={16} />
                                        <span>Ver Servicios</span>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-400 bg-[#00A896] text-white">
                                        <LucideIcons.ArrowRight size={16} />
                                        <span>Comenzar Ahora</span>
                                    </div>
                                </div>
                            </MagneticButton>
                            <MagneticButton href={`https://wa.me/${phoneNumber}?text=Hola%20Ing.%20Santiago,%20me%20interesa%20agendar%20una%20consulta%20gratuita.`} target="_blank" rel="noopener noreferrer">
                                <div className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors group px-7 py-4 rounded-full hover:bg-white/5 border border-white/10 hover:border-[#00A896]/40">
                                    <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-[#00A896] group-hover:border-[#00A896] transition-all">
                                        <LucideIcons.MessageCircle size={18} />
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-widest">Consulta Gratuita</span>
                                </div>
                            </MagneticButton>
                        </div>
                    </Reveal>
                </div>

                {/* Hero bottom marquee */}
                <div className="absolute bottom-0 w-full py-5 border-t border-white/5 bg-[#020617]/60 backdrop-blur-sm overflow-hidden pointer-events-none">
                    <div className="flex whitespace-nowrap animate-marquee">
                        {[...Array(8)].map((_, i) => (
                            <span key={i} className="mx-8 text-3xl font-editorial text-white/5 uppercase tracking-tighter">
                                Contabilidad · Tributación · Asesoría · SRI · RIMPE ·
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            {/* ── AUTHORITY TICKER ── */}
            <AuthorityTicker />

            {/* ══════════════════════════════════════════════════════════════
                STATS / TELEMETRÍA
            ══════════════════════════════════════════════════════════════ */}
            <section className="py-32 bg-[#020617] relative overflow-hidden">
                <div className="absolute inset-0 bg-dot-matrix opacity-15" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1 border border-white/10 bg-white/5 backdrop-blur-3xl rounded-[3rem] overflow-hidden glass-premium-2 shadow-2xl">
                        {[
                            { label: "Clientes Activos", end: 500, suffix: "+", icon: LucideIcons.Users },
                            { label: "Ahorro Generado", end: 1200000, prefix: "$", icon: LucideIcons.TrendingUp },
                            { label: "Años de Trayectoria", end: 10, suffix: "+", icon: LucideIcons.Award },
                            { label: "Efectividad SRI", end: 100, suffix: "%", icon: LucideIcons.Activity }
                        ].map((stat, i) => (
                            <Reveal key={i} delay={i * 80}>
                                <div className="p-10 md:p-14 hover:bg-white/[0.03] transition-colors group relative border-r border-white/5 last:border-r-0">
                                    <div className="absolute top-6 right-6 text-[#00A896] opacity-20 group-hover:opacity-80 transition-opacity">
                                        <stat.icon size={20} />
                                    </div>
                                    <AnimatedStat end={stat.end} label={stat.label} prefix={stat.prefix} suffix={stat.suffix} />
                                    <div className="mt-6 w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} whileInView={{ width: '100%' }} transition={{ duration: 2, ease: "easeOut", delay: i * 0.15 }}
                                            className="h-full bg-gradient-to-r from-[#00A896] to-sky-400" />
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                BENTO GRID – SERVICIOS
            ══════════════════════════════════════════════════════════════ */}
            <section id="servicios" className="py-36 relative bg-[#020617] overflow-hidden">
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                            <div className="max-w-2xl">
                                <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Suite de Servicios</div>
                                <h2 className="text-4xl md:text-7xl font-editorial tracking-tighter mb-6">
                                    SOLUCIONES DE <br />
                                    <span className="text-shimmer-elite">ALTO IMPACTO</span>
                                </h2>
                                <p className="text-slate-400 text-lg font-light">
                                    Cada servicio está diseñado para la <span className="text-white font-medium">máxima eficiencia operativa</span> y blindaje fiscal.
                                </p>
                            </div>
                            <div className="hidden md:block text-right">
                                <span className="text-6xl font-editorial text-white/8 block leading-none">2026</span>
                                <span className="text-[10px] font-bold text-[#00A896] tracking-[0.3em] uppercase">Ecosistema Fiscal</span>
                            </div>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Feature card large */}
                        <SpotlightCard className="md:col-span-2 interactive-card">
                            <div className="flex flex-col h-full justify-between p-10 min-h-[440px]">
                                <div>
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-900/50 flex items-center justify-center mb-8 shadow-lg shadow-[#00A896]/20">
                                        <LucideIcons.BarChart3 className="text-white" size={28} />
                                    </div>
                                    <h3 className="text-3xl md:text-5xl font-editorial tracking-tight mb-4">OPTIMIZACIÓN FISCAL</h3>
                                    <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
                                        Analizamos cada variable de su estructura financiera para maximizar deducciones legales y eliminar pagos en exceso con precisión quirúrgica.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-[#00A896] font-bold text-xs uppercase tracking-widest group/link cursor-pointer" onClick={onNavigateToServices}>
                                    <span>Ver Detalles</span>
                                    <LucideIcons.ArrowUpRight size={16} className="group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                                </div>
                            </div>
                        </SpotlightCard>

                        <SpotlightCard className="interactive-card">
                            <div className="flex flex-col h-full p-10 min-h-[440px]">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                                    <LucideIcons.ShieldCheck className="text-[#00A896]" size={28} />
                                </div>
                                <h3 className="text-3xl font-editorial tracking-tight mb-4 uppercase">Blindaje Jurídico</h3>
                                <p className="text-slate-400 leading-relaxed mb-auto">
                                    Defensa técnica ante entes de control. Integridad patrimonial garantizada frente a auditorías del SRI.
                                </p>
                                <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span>Disponibilidad</span>
                                    <span className="text-[#00A896]">Inmediata</span>
                                </div>
                            </div>
                        </SpotlightCard>

                        <SpotlightCard className="interactive-card">
                            <div className="flex flex-col h-full p-10 min-h-[360px]">
                                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                                    <LucideIcons.Zap className="text-yellow-400" size={26} />
                                </div>
                                <h3 className="text-3xl font-editorial tracking-tight mb-4 uppercase">Gestión Turbo</h3>
                                <p className="text-slate-400 leading-relaxed text-base">
                                    Declaraciones automatizadas, reportes mensuales en tiempo real. Nunca más venza plazos.
                                </p>
                            </div>
                        </SpotlightCard>

                        <SpotlightCard className="md:col-span-2 interactive-card overflow-hidden">
                            <div className="flex flex-col md:flex-row h-full">
                                <div className="flex-1 p-10 flex flex-col justify-center">
                                    <h3 className="text-3xl md:text-5xl font-editorial tracking-tight mb-4 uppercase">Consultoría Estratégica</h3>
                                    <p className="text-slate-400 text-lg font-light leading-relaxed mb-8">
                                        Sesiones ejecutivas para diseñar rutas de crecimiento bajo marcos fiscales eficientes y conformes con la ley.
                                    </p>
                                    <MagneticButton onClick={onNavigateToServices}>
                                        <div className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#00A896] hover:text-white transition-colors">
                                            <LucideIcons.Calendar size={14} />
                                            Agendar Sesión
                                        </div>
                                    </MagneticButton>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-white/5 to-transparent p-10 flex items-center justify-center border-l border-white/5 relative min-h-[200px]">
                                    <div className="absolute inset-0 tactical-grid opacity-20" />
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-[#00A896]/20 blur-3xl rounded-full" />
                                        <LucideIcons.Globe className="text-white/15 relative z-10" size={140} />
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>

                        {/* Firma Electrónica */}
                        <SpotlightCard className="interactive-card">
                            <div className="flex flex-col h-full p-10 min-h-[300px] justify-between">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <LucideIcons.FileKey className="text-purple-400" size={22} />
                                    </div>
                                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full uppercase tracking-wider">Digital</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-editorial tracking-tight mb-3 uppercase">Firma Electrónica</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">Token .P12 válido para SRI, Quipux y todos los trámites legales.</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5">
                                    <span className="text-2xl font-editorial text-white">$35</span>
                                    <span className="text-slate-500 text-xs ml-2 uppercase tracking-wider">vigencia 1 año</span>
                                </div>
                            </div>
                        </SpotlightCard>

                        {/* Devolución IVA */}
                        <SpotlightCard className="interactive-card">
                            <div className="flex flex-col h-full p-10 min-h-[300px] justify-between">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <LucideIcons.DollarSign className="text-emerald-400" size={22} />
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider">Recuperación</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-editorial tracking-tight mb-3 uppercase">Devolución IVA</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">Para 3ra Edad y Discapacidad. Recupere su IVA mensual garantizado.</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5">
                                    <button onClick={onNavigateToServices} className="text-[#00A896] text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                                        Ver precio <LucideIcons.ArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </SpotlightCard>
                    </div>

                    <Reveal delay={200}>
                        <div className="mt-12 text-center">
                            <MagneticButton onClick={onNavigateToServices}>
                                <div className="inline-flex items-center gap-3 px-10 py-5 border border-white/15 text-white rounded-full text-sm font-medium hover:border-[#00A896]/50 hover:bg-[#00A896]/5 transition-all duration-500">
                                    <LucideIcons.Layers size={16} className="text-[#00A896]" />
                                    Ver todos los servicios y precios
                                    <LucideIcons.ArrowRight size={16} />
                                </div>
                            </MagneticButton>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                SOBRE MÍ – PERSONAL BRAND
            ══════════════════════════════════════════════════════════════ */}
            <section id="sobre-mi" className="py-36 relative bg-[#020617] overflow-hidden">
                <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-[#00A896]/8 rounded-full blur-[200px] -translate-y-1/2 pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        {/* Left: Profile card */}
                        <Reveal>
                            <div className="relative">
                                {/* Main profile card */}
                                <div className="relative bg-white/5 border border-white/10 rounded-[2.5rem] p-10 glass-premium-2 overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00A896]/60 to-transparent" />
                                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-[#00A896]/10 rounded-full blur-2xl" />

                                    {/* Avatar */}
                                    <div className="flex items-center gap-6 mb-10">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#00A896] to-[#005F56] flex items-center justify-center shadow-[0_0_40px_rgba(0,168,150,0.3)]">
                                                <span className="text-4xl font-editorial text-white">SC</span>
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#00A896] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,168,150,0.5)]">
                                                <LucideIcons.Check size={14} className="text-white" strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-editorial text-white tracking-tight">ING. SANTIAGO CÓRDOVA</h3>
                                            <p className="text-[#00A896] text-sm font-semibold mt-1">Asesor Tributario Certificado</p>
                                            <p className="text-slate-500 text-xs mt-1">Pasaje, El Oro · Ecuador</p>
                                        </div>
                                    </div>

                                    {/* Credentials */}
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        {[
                                            { icon: LucideIcons.GraduationCap, label: "Ingeniería en C.C.E.E." },
                                            { icon: LucideIcons.Shield, label: "Agente de Retención SRI" },
                                            { icon: LucideIcons.Clock, label: "10+ Años de Experiencia" },
                                            { icon: LucideIcons.Star, label: "Especialista RIMPE 2026" },
                                        ].map((cred, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                                <cred.icon size={14} className="text-[#00A896] flex-shrink-0" />
                                                <span className="text-xs text-slate-300 font-medium">{cred.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* WhatsApp CTA inside card */}
                                    <a href={`https://wa.me/${phoneNumber}?text=Hola%20Ing.%20Santiago,%20quiero%20una%20consulta%20gratuita.`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-3 w-full py-4 bg-[#00A896] text-white rounded-2xl font-bold text-sm hover:bg-[#009486] transition-all duration-300 shadow-[0_8px_30px_rgba(0,168,150,0.35)] hover:shadow-[0_12px_40px_rgba(0,168,150,0.5)]">
                                        <LucideIcons.MessageCircle size={18} />
                                        Agendar Consulta Gratuita
                                    </a>
                                </div>

                                {/* Floating stats */}
                                <div className="absolute -bottom-6 -right-6 bg-[#020617] border border-white/10 rounded-2xl px-6 py-4 glass-premium-2 shadow-xl hidden md:block">
                                    <div className="text-3xl font-editorial text-[#00A896]">$1.2M+</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">en ahorro para clientes</div>
                                </div>
                            </div>
                        </Reveal>

                        {/* Right: Bio + process */}
                        <Reveal delay={150}>
                            <div>
                                <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Sobre mí</div>
                                <h2 className="text-4xl md:text-6xl font-editorial tracking-tighter mb-8 leading-tight">
                                    EXPERTO EN<br />
                                    <span className="text-shimmer-elite">SOLUCIONES</span><br />
                                    TRIBUTARIAS
                                </h2>
                                <p className="text-slate-400 text-lg font-light leading-relaxed mb-6">
                                    Soy <strong className="text-white font-semibold">Santiago Córdova</strong>, Ingeniero en Ciencias Empresariales con más de una década dedicada a la asesoría fiscal y tributaria en Ecuador.
                                </p>
                                <p className="text-slate-400 text-base font-light leading-relaxed mb-10">
                                    Mi misión es simple: que usted pague solo lo que <span className="text-white font-medium border-b border-[#00A896]">la ley exige</span>, ni un centavo más. He trabajado con emprendedores, profesionales independientes y empresas del sector comercial e industrial, logrando optimizaciones fiscales de hasta el 40%.
                                </p>

                                {/* Specializations */}
                                <div className="flex flex-wrap gap-2">
                                    {["RIMPE Popular", "RIMPE Emprendedor", "Régimen General", "Devolución IVA", "Renta Personas Naturales", "Agente de Retención", "Firma Electrónica", "Contabilidad Mensual"].map(tag => (
                                        <span key={tag} className="px-4 py-2 rounded-full border border-white/10 text-xs text-slate-400 bg-white/5 hover:border-[#00A896]/50 hover:text-[#00A896] transition-all duration-300 cursor-default">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                PROCESO DE TRABAJO
            ══════════════════════════════════════════════════════════════ */}
            <section className="py-36 relative bg-[#020617] overflow-hidden">
                <div className="absolute inset-0 bg-dot-matrix opacity-10" />
                <div className="absolute right-0 top-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[180px] pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
                        <Reveal>
                            <div>
                                <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Metodología</div>
                                <h2 className="text-4xl md:text-6xl font-editorial tracking-tighter mb-8">
                                    CÓMO<br />
                                    <span className="text-shimmer-elite">TRABAJAMOS</span>
                                </h2>
                                <p className="text-slate-400 text-lg font-light leading-relaxed mb-10">
                                    Un proceso claro, transparente y orientado a resultados. Desde la consulta inicial hasta la gestión continua de su situación fiscal.
                                </p>
                                <MagneticButton onClick={onNavigateToServices}>
                                    <div className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-medium hover:border-[#00A896]/50 hover:bg-[#00A896]/10 transition-all duration-500">
                                        <LucideIcons.Play size={14} className="text-[#00A896]" />
                                        Iniciar el Proceso
                                    </div>
                                </MagneticButton>
                            </div>
                        </Reveal>

                        <div className="space-y-10">
                            <ProcessStep number="1" title="Diagnóstico Gratuito" icon={LucideIcons.Search}
                                description="Evaluamos su situación tributaria actual sin costo. Identificamos riesgos, oportunidades de ahorro y el régimen óptimo para su actividad." delay={50} />
                            <div className="w-[1px] h-8 bg-gradient-to-b from-[#00A896]/50 to-transparent ml-7" />
                            <ProcessStep number="2" title="Plan Personalizado" icon={LucideIcons.FileText}
                                description="Diseñamos una hoja de ruta fiscal a medida. Calendarios de obligaciones, estrategia de deducciones y cronograma de gestiones." delay={150} />
                            <div className="w-[1px] h-8 bg-gradient-to-b from-[#00A896]/50 to-transparent ml-7" />
                            <ProcessStep number="3" title="Ejecución Experta" icon={LucideIcons.Zap}
                                description="Tramitamos, declaramos y gestionamos todo ante el SRI. Usted recibe reportes claros y tranquilidad total." delay={250} />
                            <div className="w-[1px] h-8 bg-gradient-to-b from-[#00A896]/50 to-transparent ml-7" />
                            <ProcessStep number="4" title="Seguimiento Continuo" icon={LucideIcons.RefreshCw}
                                description="Monitoreo permanente de su cuenta en el SRI. Alertas preventivas y asesoría proactiva para que nunca sea sorprendido." delay={350} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                TESTIMONIALES
            ══════════════════════════════════════════════════════════════ */}
            <section className="py-36 relative bg-[#020617] overflow-hidden">
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00A896]/5 rounded-full blur-[200px] pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-20">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Testimonios</div>
                            <h2 className="text-4xl md:text-7xl font-editorial tracking-tighter mb-6">
                                LO QUE DICEN<br />
                                <span className="text-shimmer-elite">MIS CLIENTES</span>
                            </h2>
                            <p className="text-slate-400 text-lg font-light max-w-xl mx-auto">
                                Resultados reales de personas y empresas que confiaron su patrimonio a nuestro equipo.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <TestimonialCard delay={0}
                            quote="El Ing. Córdova me ayudó a regularizar 3 años de obligaciones pendientes con el SRI sin ninguna multa. Su conocimiento es extraordinario y la atención es personalizada."
                            name="María José L." role="Comerciante · Pasaje, El Oro" />
                        <TestimonialCard delay={100}
                            quote="Gracias a su asesoría en el régimen RIMPE, ahorro más del 30% en mis obligaciones tributarias cada año. Totalmente recomendado para cualquier emprendedor."
                            name="Carlos Ramos" role="Emprendedor · Machala, El Oro" />
                        <TestimonialCard delay={200}
                            quote="La devolución del IVA para mi madre de la tercera edad fue gestionada en tiempo récord. Proceso impecable, transparente y con resultados garantizados."
                            name="Andrea Vásquez" role="Particular · Santa Rosa, El Oro" />
                        <TestimonialCard delay={80}
                            quote="Llevamos 4 años con Santiago Córdova y es el mejor asesor tributario que he tenido. Siempre disponible, proactivo y con soluciones innovadoras."
                            name="Roberto Espinoza" role="Ingeniero Civil · Independiente" />
                        <TestimonialCard delay={180}
                            quote="Recibí mi firma electrónica el mismo día y pude comenzar a facturar inmediatamente. Un servicio rápido, profesional y completamente digital."
                            name="Diana Torres" role="Profesional Independiente" />
                        <TestimonialCard delay={280}
                            quote="La optimización de mi nómina y retenciones me generó un ahorro significativo. Su análisis financiero es detallado y altamente confiable."
                            name="Luis Morales" role="Director · PyME Comercial" />
                    </div>

                    {/* Rating summary */}
                    <Reveal delay={300}>
                        <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-8 p-8 border border-white/10 rounded-3xl bg-white/5 glass-premium-2 max-w-2xl mx-auto">
                            <div className="text-center">
                                <div className="text-6xl font-editorial text-white">5.0</div>
                                <div className="flex gap-1 justify-center mt-2">
                                    {[...Array(5)].map((_, i) => <LucideIcons.Star key={i} size={16} className="text-[#d4af37] fill-[#d4af37]" />)}
                                </div>
                                <div className="text-slate-500 text-xs mt-2 uppercase tracking-wider">Calificación promedio</div>
                            </div>
                            <div className="w-[1px] h-16 bg-white/10 hidden md:block" />
                            <div className="text-center md:text-left">
                                <div className="text-white font-semibold mb-1">Basado en +100 reseñas</div>
                                <div className="text-slate-400 text-sm font-light">Google · Facebook · Referencias directas</div>
                                <div className="text-[#00A896] text-xs mt-2 font-bold uppercase tracking-wider">✓ Verificados y auténticos</div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                RECURSOS / FAQ
            ══════════════════════════════════════════════════════════════ */}
            <section id="recursos" className="py-36 relative overflow-hidden bg-[#020617]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-[#00A896]/8 rounded-full blur-[200px] pointer-events-none" />
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-20">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Base de Conocimiento</div>
                            <h2 className="text-4xl md:text-7xl font-editorial tracking-tighter mb-6">
                                PREGUNTAS<br />
                                <span className="text-shimmer-elite">FRECUENTES</span>
                            </h2>
                            <p className="text-slate-400 text-lg font-light">Desmitificando la complejidad fiscal con precisión y claridad.</p>
                        </div>
                    </Reveal>

                    <div className="space-y-4">
                        <FaqItem delay={0} category="Régimen" question="¿Cuál es la diferencia entre RIMPE Popular y Emprendedor?"
                            answer="RIMPE Popular aplica a negocios con ingresos hasta $20,000 anuales, usando Notas de Venta y sin IVA. RIMPE Emprendedor aplica a negocios hasta $300,000 anuales, emiten facturas con IVA y tienen obligaciones semestrales. El régimen óptimo depende de su actividad y nivel de ingresos. Lo asesoramos sin costo." />
                        <FaqItem delay={80} category="Retenciones" question="¿Cuánto debo retener en la fuente en 2026?"
                            answer="Las tablas de retención 2026 establecen: servicios profesionales 10%, servicios no profesionales 2%, arrendamiento de inmuebles 8%, transferencia de bienes 1%. Nuestra plataforma automatiza estos cálculos y le ayuda a evitar sanciones por retenciones incorrectas." />
                        <FaqItem delay={160} category="Beneficios" question="¿Cómo funciona la Devolución de IVA para Tercera Edad?"
                            answer="Personas mayores de 65 años tienen derecho a recuperar el IVA pagado en compras de bienes y servicios, hasta el tope mensual establecido por ley. El trámite es 100% digital: recopilamos sus facturas, cargamos la solicitud en el portal del SRI y hacemos seguimiento hasta la acreditación directa en su cuenta." />
                        <FaqItem delay={240} category="Tecnología" question="¿Qué necesito para obtener mi Firma Electrónica?"
                            answer="Solo necesita su cédula de identidad o RUC vigente, un correo electrónico activo y 30 minutos de su tiempo para la videoconferencia de verificación de identidad. El token digital .P12 le llegará por email y lo instalamos remotamente. Proceso completamente en línea desde cualquier lugar del Ecuador." />
                        <FaqItem delay={320} category="Proceso" question="¿Cuánto tiempo tarda regularizar mis obligaciones atrasadas?"
                            answer="Depende del número de períodos pendientes, pero generalmente entre 5 y 15 días hábiles. Gestionamos las declaraciones pendientes, calculamos el valor de multas e intereses, y en muchos casos aplicamos remisiones o facilidades de pago. Contáctenos para una evaluación sin costo de su situación." />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                CTA FINAL
            ══════════════════════════════════════════════════════════════ */}
            <section id="contacto" className="py-36 px-6 bg-[#020617] relative overflow-hidden">
                <div className="absolute inset-0 tactical-grid opacity-15" />
                <Reveal>
                    <div className="max-w-6xl mx-auto relative group/cta">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#00A896] via-sky-500 to-purple-600 rounded-[4rem] blur-3xl opacity-15 group-hover/cta:opacity-35 transition-opacity duration-1000 animate-slow-pan" />
                        <div className="relative bg-black/50 border border-white/10 rounded-[4rem] p-14 md:p-28 text-center overflow-hidden glass-premium-2 shadow-2xl">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-scan" />

                            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[#00A896]/30 bg-[#00A896]/5 mb-10">
                                <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_8px_#00A896]" />
                                <span className="text-[11px] font-bold text-[#00A896] uppercase tracking-[0.35em]">Consulta gratuita sin compromiso</span>
                            </div>

                            <h2 className="text-5xl md:text-8xl lg:text-[8rem] font-editorial tracking-tighter mb-10 text-white leading-none">
                                HABLEMOS<br />
                                <span className="text-shimmer-elite">HOY MISMO.</span>
                            </h2>
                            <p className="text-slate-400 text-xl md:text-2xl font-light mb-14 max-w-2xl mx-auto text-balance">
                                Su tranquilidad fiscal comienza con una sola consulta. Sin costos ocultos. Sin compromisos. Solo resultados.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-6 items-center">
                                <MagneticButton href={`https://wa.me/${phoneNumber}?text=Hola%20Ing.%20Santiago%20C%C3%B3rdova,%20quiero%20agendar%20una%20consulta%20tributaria%20gratuita.`} target="_blank" rel="noreferrer">
                                    <div className="group relative px-12 py-6 bg-white text-black rounded-full font-bold text-xs uppercase tracking-[0.3em] overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.25)] hover:shadow-[#00A896]/50 transition-all duration-700">
                                        <div className="absolute inset-0 bg-[#00A896] transform translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                        <span className="relative z-10 group-hover:text-white flex items-center gap-3">
                                            <LucideIcons.MessageCircle size={20} /> WhatsApp Ahora
                                        </span>
                                    </div>
                                </MagneticButton>
                                <div className="flex items-center gap-3 text-slate-500 text-[11px] font-bold uppercase tracking-[0.4em] px-8 py-6 border border-white/5 rounded-full bg-white/5 backdrop-blur-md hover:border-[#00A896]/40 hover:text-white transition-all duration-500 cursor-default group">
                                    <LucideIcons.MapPin size={18} className="text-[#00A896] group-hover:scale-110 transition-transform" />
                                    Pasaje, El Oro · Ecuador
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className="mt-14 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-center gap-10 text-xs text-slate-500 uppercase tracking-widest">
                                <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-[#00A896] transition-colors">
                                    <LucideIcons.Phone size={14} className="text-[#00A896]" />+593 97 898 0722
                                </a>
                                <div className="flex items-center gap-3">
                                    <LucideIcons.Clock size={14} className="text-[#00A896]" />Lunes – Viernes · 8h00 – 18h00
                                </div>
                                <div className="flex items-center gap-3">
                                    <LucideIcons.MapPin size={14} className="text-[#00A896]" />Pasaje, Provincia de El Oro
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                FOOTER
            ══════════════════════════════════════════════════════════════ */}
            <footer className="border-t border-white/5 py-20 bg-[#020617] relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-14 mb-16">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A896] to-[#005F56] flex items-center justify-center">
                                    <Logo className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <span className="font-editorial text-xl tracking-tighter uppercase text-white block">SANTIAGO CÓRDOVA</span>
                                    <span className="text-[10px] text-[#00A896] uppercase tracking-widest">Asesoría Tributaria de Élite</span>
                                </div>
                            </div>
                            <p className="text-slate-500 text-base font-light leading-relaxed max-w-sm mb-6">
                                Redefiniendo el estándar de la asesoría contable en Ecuador con tecnología, experiencia y estrategia de élite.
                            </p>
                            <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-2 text-[#00A896] text-xs font-bold uppercase tracking-widest hover:gap-3 transition-all">
                                <LucideIcons.MessageCircle size={14} />
                                Contactar por WhatsApp
                                <LucideIcons.ArrowRight size={12} />
                            </a>
                        </div>

                        <div>
                            <h4 className="text-white text-[10px] font-bold uppercase tracking-[0.4em] mb-6">Navegación</h4>
                            <ul className="space-y-3">
                                {[
                                    { label: 'Inicio', id: 'top' },
                                    { label: 'Servicios', id: 'servicios' },
                                    { label: 'Sobre mí', id: 'sobre-mi' },
                                    { label: 'Recursos', id: 'recursos' },
                                    { label: 'Contacto', id: 'contacto' },
                                ].map(item => (
                                    <li key={item.label}>
                                        <button onClick={() => scrollToSection(item.id)} className="text-slate-500 hover:text-[#00A896] transition-colors text-sm font-light flex items-center gap-2 group">
                                            <span className="w-0 h-[1px] bg-[#00A896] group-hover:w-4 transition-all duration-300" />
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white text-[10px] font-bold uppercase tracking-[0.4em] mb-6">Servicios Clave</h4>
                            <ul className="space-y-3">
                                {['Declaraciones RIMPE', 'IVA Mensual/Semestral', 'Devolución IVA', 'Firma Electrónica', 'Renta Anual', 'Acceso Ejecutivo'].map(item => (
                                    <li key={item}>
                                        <button onClick={onNavigateToServices} className="text-slate-500 hover:text-[#00A896] transition-colors text-sm font-light flex items-center gap-2 group">
                                            <span className="w-0 h-[1px] bg-[#00A896] group-hover:w-4 transition-all duration-300" />
                                            {item}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-slate-600 text-[10px] font-bold tracking-[0.3em] uppercase">
                            © 2026 · <span className="text-[#00A896]">SANTIAGO CÓRDOVA ING.</span> · Todos los derechos reservados
                        </div>
                        <div className="flex items-center gap-6">
                            <button onClick={handleProtectedAccess} className="text-slate-600 hover:text-white text-[10px] uppercase tracking-[0.3em] transition-colors flex items-center gap-2">
                                <LucideIcons.Lock size={10} />
                                Acceso Privado
                            </button>
                            <div className="text-slate-700 text-[10px] tracking-[0.3em] uppercase">
                                Diseñado por <span className="text-slate-500">SUPRA MUSIC INC.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
