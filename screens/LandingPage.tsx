
import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { PublicUser } from '../types';

interface LandingPageProps {
    onAdminAccess: () => void;
    onNavigateToServices: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
}

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

const AnimatedStat = ({ end, label, prefix = "", suffix = "" }: { end: number, label: string, prefix?: string, suffix?: string }) => {
    const { count, ref } = useCounter(end);
    return (
        <div ref={ref} className="text-center group cursor-default">
            <div className="text-5xl md:text-7xl font-display font-semibold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 tracking-tighter mb-2 group-hover:from-[#00A896] group-hover:to-teal-200 transition-all duration-500">
                {prefix}{count}{suffix}
            </div>
            <div className="text-xs font-medium text-[#00A896] uppercase tracking-[0.3em]">{label}</div>
        </div>
    );
};

// --- ELITE: Spotlight Card Component ---
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setOpacity(1);
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setOpacity(1)}
            onMouseLeave={() => setOpacity(0)}
            className={`relative overflow-hidden ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px transition-opacity duration-500"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(0, 168, 150, 0.15), transparent 40%)`,
                }}
            />
            {children}
        </div>
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

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#020617] font-body text-white selection:bg-[#00A896] selection:text-white overflow-x-hidden pb-20 md:pb-0">

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
                            <span className="text-[11px] font-medium text-[#00A896] tracking-[0.2em] uppercase glow-text">Elite Tax Services</span>
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
                        <button
                            onClick={onNavigateToServices}
                            className="group relative px-6 py-2.5 bg-white text-[#0B2149] rounded-full text-xs font-semibold uppercase tracking-wider overflow-hidden hover:scale-105 transition-all duration-500 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[#00A896]/40"
                        >
                            <span className="relative z-10 group-hover:text-white transition-colors duration-500">Contratar</span>
                            <div className="absolute inset-0 bg-[#00A896] transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
                        </button>
                    </div>
                </nav>
            </div>

            <div className={`md:hidden fixed bottom-6 left-4 right-4 z-50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${scrolled ? 'translate-y-2 opacity-100 scale-95' : 'translate-y-0 opacity-100'}`}>
                <div className="bg-[#0B2149]/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-3 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex justify-between items-end px-6 relative overflow-hidden border-holographic">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform active:scale-90">
                        <LucideIcons.Home size={22} className={scrolled ? 'text-[#00A896]' : ''} />
                        <span className="text-[11px] font-medium mt-1 uppercase tracking-tighter">Inicio</span>
                    </button>

                    <button onClick={onNavigateToServices} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform active:scale-90">
                        <LucideIcons.Grid size={22} />
                        <span className="text-[11px] font-medium mt-1 uppercase tracking-tighter">Servicios</span>
                    </button>

                    {/* Elite Floating Action Button */}
                    <div className="relative -mt-10">
                        <div className="absolute inset-0 bg-[#00A896] rounded-full blur-xl opacity-50 animate-pulse" />
                        <a
                            href={`https://wa.me/${phoneNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative flex items-center justify-center w-16 h-16 bg-[#00A896] rounded-full text-white shadow-[0_8px_32px_rgba(0,168,150,0.4)] border-4 border-[#020617] transform hover:scale-110 active:scale-95 transition-all"
                        >
                            <LucideIcons.MessageCircle size={28} />
                        </a>
                    </div>

                    <button onClick={() => scrollToSection('recursos')} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform active:scale-90">
                        <LucideIcons.BookOpen size={22} />
                        <span className="text-[11px] font-medium mt-1 uppercase tracking-tighter">Wiki</span>
                    </button>

                    <button onClick={onAdminAccess} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-all transform active:scale-90">
                        <LucideIcons.ShieldCheck size={22} />
                        <span className="text-[11px] font-medium mt-1 uppercase tracking-tighter">Admin</span>
                    </button>
                </div>
            </div>

            {/* --- HERO SECTION: Aurora & Noise --- */}
            <header id="top" className="relative min-h-[90vh] md:min-h-screen flex items-center justify-center overflow-hidden bg-[#020617] bg-noise">
                {/* Aurora Effects (Intensified Professional) */}
                <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-sky-400/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-[#00A896]/20 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-purple-600/15 rounded-full blur-[100px] animate-float"></div>

                {/* Mobile Elite: Floating Particles (Professional) */}
                <div className="md:hidden absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-ping"></div>
                    <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-[#00A896] rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                </div>

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] md:opacity-10 pointer-events-none"></div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 text-center mt-20 md:mt-0">
                    <h1 className="text-5xl sm:text-7xl md:text-9xl font-display font-semibold tracking-tighter leading-[0.9] mb-8">
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-sm">FINANZAS</span>
                        <br />
                        <span className="relative inline-block">
                            <span className="absolute -inset-1 blur-3xl bg-[#00A896]/20"></span>
                            <span className="relative text-shimmer">SIN LÍMITES</span>
                        </span>
                    </h1>

                    <Reveal delay={200}>
                        <p className="text-base md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed px-4 md:px-0">
                            Ingeniería tributaria de élite para empresas en crecimiento. Transformamos sus obligaciones fiscales en <strong className="text-white font-medium border-b border-[#00A896]">ventajas competitivas</strong>.
                        </p>
                    </Reveal>

                    <Reveal delay={300}>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                            <button onClick={onNavigateToServices} className="group relative w-64 h-16 bg-white text-[#020617] rounded-full font-semibold text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                                <div className="absolute inset-0 flex items-center justify-center group-hover:-translate-y-full transition-transform duration-300">
                                    Explorar Soluciones
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-[#00A896] text-white">
                                    <LucideIcons.ArrowRight size={24} />
                                </div>
                            </button>

                            <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors group px-6 py-4 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10">
                                <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                    <LucideIcons.Phone size={20} />
                                </div>
                                <span className="text-xs font-medium uppercase tracking-widest">Agendar Cita</span>
                            </a>
                        </div>
                    </Reveal>
                </div>

                {/* Scrolling Marquee Bottom */}
                <div className="absolute bottom-0 w-full py-6 border-t border-white/5 bg-[#020617]/50 backdrop-blur-sm overflow-hidden pointer-events-none">
                    <div className="flex whitespace-nowrap animate-marquee">
                        {[...Array(10)].map((_, i) => (
                            <span key={i} className="mx-8 text-4xl font-display font-semibold text-white/5 uppercase">
                                Auditoría • Estrategia • Cumplimiento •
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            {/* --- BENTO GRID SERVICES --- */}
            <section id="servicios" className="py-32 relative bg-[#0B2149]">
                <div className="absolute inset-0 bg-noise opacity-50 mix-blend-overlay"></div>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                        <div>
                            <h2 className="text-4xl md:text-6xl font-display font-semibold mb-4">Ecosistema <br /><span className="text-[#00A896]">de Servicios.</span></h2>
                            <p className="text-slate-400 max-w-md">Soluciones modulares diseñadas para escalar con su negocio, desde el emprendimiento hasta la consolidación.</p>
                        </div>
                        <button onClick={onNavigateToServices} className="flex items-center gap-2 text-[#00A896] font-medium uppercase text-xs tracking-widest hover:text-white transition-colors group">
                            Ver catálogo completo <LucideIcons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[800px]">

                        {/* Card 1: Large Vertical */}
                        <Reveal className="md:col-span-1 md:row-span-2" delay={100}>
                            <SpotlightCard className="h-full bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between hover:bg-white/10 transition-all duration-500 group cursor-pointer hover:border-[#00A896]/30 hover:shadow-[0_0_50px_rgba(0,168,150,0.1)]">
                                <div onClick={onNavigateToServices} className="h-full flex flex-col justify-between">
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 bg-sky-400/20 rounded-2xl flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                            <LucideIcons.TrendingUp size={32} />
                                        </div>
                                        <h3 className="text-3xl font-medium mb-4">Gestión RIMPE</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            Optimización fiscal para Negocios Populares y Emprendedores. Análisis de categorización y proyección de impuesto a la renta anual.
                                        </p>
                                    </div>
                                    <div className="mt-8 relative h-48 bg-gradient-to-t from-blue-900/50 to-transparent rounded-2xl overflow-hidden border border-white/5 group-hover:border-white/20 transition-colors">
                                        {/* Abstract Chart */}
                                        <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-around px-4 pb-4">
                                            <div className="w-4 h-16 bg-sky-400/50 rounded-t-sm animate-pulse"></div>
                                            <div className="w-4 h-24 bg-sky-400/70 rounded-t-sm animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="w-4 h-32 bg-[#00A896] rounded-t-sm animate-pulse shadow-[0_0_15px_#00A896]" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </Reveal>

                        {/* Card 2: Wide Horizontal */}
                        <Reveal className="md:col-span-2" delay={200}>
                            <SpotlightCard className="h-full bg-[#00A896] rounded-[2.5rem] p-8 relative overflow-hidden group cursor-pointer shadow-[0_0_50px_rgba(0,168,150,0.2)] hover:shadow-[0_0_80px_rgba(0,168,150,0.4)] transition-all duration-500">
                                <div onClick={onNavigateToServices} className="relative z-10 flex flex-col md:flex-row justify-between h-full">
                                    <div className="max-w-md">
                                        <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center text-white mb-6">
                                            <LucideIcons.Laptop size={24} />
                                        </div>
                                        <h3 className="text-4xl font-semibold mb-2 text-[#020617] tracking-tight text-shimmer">Firma Electrónica</h3>
                                        <p className="text-[#020617]/80 font-medium text-lg">Emisión inmediata y segura. Válida para facturación, Quipux y trámites legales. Entrega 100% digital.</p>
                                    </div>
                                    <div className="mt-6 md:mt-0 flex items-end">
                                        <div className="bg-black/20 backdrop-blur-md px-8 py-4 rounded-full text-[#020617] font-medium text-xs uppercase tracking-wider flex items-center gap-2 group-hover:bg-white group-hover:text-[#00A896] transition-all duration-300">
                                            Solicitar Ahora <LucideIcons.ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </Reveal>

                        {/* Card 3: Small Square */}
                        <Reveal delay={300}>
                            <SpotlightCard className="h-full bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer flex flex-col justify-center text-center relative overflow-hidden">
                                <div onClick={onNavigateToServices} className="relative z-10">
                                    <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 mb-4 group-hover:rotate-12 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                                        <LucideIcons.ShieldCheck size={32} />
                                    </div>
                                    <h3 className="text-xl font-medium mb-2">Auditoría VIP</h3>
                                    <p className="text-xs text-slate-400">Revisión preventiva para evitar multas.</p>
                                </div>
                            </SpotlightCard>
                        </Reveal>

                        {/* Card 4: Small Square */}
                        <Reveal delay={400}>
                            <SpotlightCard className="h-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group cursor-pointer flex flex-col justify-center text-center relative overflow-hidden hover:border-orange-500/50">
                                <div onClick={onNavigateToServices} className="relative z-10 h-full flex flex-col justify-center">
                                    <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 mb-4 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                                        <LucideIcons.Star size={32} fill="currentColor" />
                                    </div>
                                    <h3 className="text-xl font-medium mb-2 text-white">Suscripciones</h3>
                                    <p className="text-xs text-slate-400">Planes mensuales todo incluido.</p>
                                </div>
                            </SpotlightCard>
                        </Reveal>

                    </div>
                </div>
            </section>

            {/* --- SCROLLYTELLING STATS (Animated) --- */}
            <section className="py-32 bg-[#020617] relative">
                <div className="max-w-7xl mx-auto px-6">
                    <Reveal>
                        <div className="flex flex-wrap justify-center gap-12 md:gap-24">
                            <AnimatedStat label="Clientes Activos" end={500} suffix="+" />
                            <AnimatedStat label="Ahorro Generado" end={1200000} prefix="$" />
                            <AnimatedStat label="Años Experiencia" end={10} suffix="+" />
                            <AnimatedStat label="Efectividad" end={100} suffix="%" />
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* --- WIKI SECTION: Glass Accordion --- */}
            <section id="recursos" className="py-32 relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00A896] rounded-full blur-[200px] opacity-10 pointer-events-none"></div>

                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-16">
                            <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 mb-6">
                                <LucideIcons.BookOpen size={24} className="text-[#00A896]" />
                            </div>
                            <h2 className="text-4xl md:text-5xl font-display font-semibold">Base de Conocimiento</h2>
                            <p className="text-slate-400 mt-4">Claridad en un mundo de complejidad tributaria.</p>
                        </div>
                    </Reveal>

                    <div className="space-y-4">
                        {[
                            { title: "¿Cuánto debo retener en 2026?", category: "Retenciones", content: "Las tablas de retención se han actualizado. Servicios profesionales ahora gravan el 10% en la fuente. Consulte nuestra calculadora para detalles exactos." },
                            { title: "RIMPE: Negocio Popular vs Emprendedor", category: "Régimen", content: "La diferencia radica en la facturación anual. Hasta $20k es Popular (Nota de Venta), hasta $300k es Emprendedor (Factura + IVA)." },
                            { title: "Devolución de IVA Tercera Edad", category: "Beneficios", content: "Puede recuperar hasta $108 mensuales en compras de primera necesidad. El trámite es 100% digital y el depósito es automático." }
                        ].map((item, i) => (
                            <div key={i} className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-all cursor-pointer">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-medium bg-[#00A896]/20 text-[#00A896] px-2 py-1 rounded-md uppercase tracking-wider shadow-[0_0_10px_rgba(0,168,150,0.1)]">{item.category}</span>
                                        <h3 className="text-lg font-medium text-white group-hover:text-[#00A896] transition-colors">{item.title}</h3>
                                    </div>
                                    <LucideIcons.ChevronDown className="text-slate-500 group-hover:text-white transition-transform group-hover:rotate-180" />
                                </div>
                                <div className="mt-4 text-slate-400 text-sm leading-relaxed max-h-0 overflow-hidden group-hover:max-h-32 transition-all duration-500 ease-out">
                                    <p className="pt-4 border-t border-white/5">{item.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- CTA: Holographic Portal --- */}
            <section id="contacto" className="py-32 px-6">
                <Reveal>
                    <div className="max-w-6xl mx-auto relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#00A896] to-sky-400 rounded-[3rem] blur-2xl opacity-40 animate-pulse-glow"></div>
                        <div className="relative bg-[#020617] border border-white/10 rounded-[3rem] p-12 md:p-24 text-center overflow-hidden">
                            {/* Glow Effects inside card */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>

                            <h2 className="text-5xl md:text-7xl font-display font-semibold text-white mb-8 tracking-tight">
                                ¿Listo para el <br /> Siguiente Nivel?
                            </h2>
                            <p className="text-slate-400 text-lg mb-12 max-w-xl mx-auto">
                                Deje la contabilidad en manos expertas y enfóquese en lo que realmente importa: hacer crecer su negocio.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-6">
                                <a
                                    href={`https://wa.me/${phoneNumber}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative px-10 py-5 bg-white text-[#020617] rounded-full font-semibold text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]"
                                >
                                    <div className="absolute inset-0 bg-[#00A896] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left ease-out duration-300"></div>
                                    <span className="relative z-10 group-hover:text-white flex items-center gap-3">
                                        <LucideIcons.MessageCircle size={20} /> Iniciar Conversación
                                    </span>
                                </a>

                                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-widest px-8 py-5 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default">
                                    <LucideIcons.MapPin size={16} className="text-[#00A896]" /> Pasaje, El Oro
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* --- FOOTER: Clean & Dark --- */}
            <footer className="border-t border-white/5 py-12 bg-[#020617]">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4 opacity-50 hover:opacity-100 transition-opacity cursor-default">
                        <Logo className="w-8 h-8 text-white" />
                        <span className="font-display font-medium text-lg tracking-tight uppercase text-white">SANTIAGO CORDOVA</span>
                    </div>
                    <div className="flex gap-8 text-xs font-medium text-slate-500 uppercase tracking-widest">
                        <a href="#" className="hover:text-[#00A896] transition-colors">Privacidad</a>
                        <a href="#" className="hover:text-[#00A896] transition-colors">Términos</a>
                        <button onClick={onAdminAccess} className="hover:text-white transition-colors">Admin</button>
                    </div>
                    <div className="text-slate-600 text-xs font-medium tracking-widest uppercase">
                        © 2026. Design by <span className="text-[#00A896]">Supra Music Inc.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};
