
import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowRight, Phone, TrendingUp, Star, Laptop, ShieldCheck, 
    MessageCircle, ChevronDown, BookOpen, 
    DollarSign, Trophy, MapPin, Menu, X, Check, Zap, Globe, Award,
    Home, Grid
} from 'lucide-react';
import { Logo } from '../components/Logo';
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
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 tracking-tighter mb-2 group-hover:from-[#00A896] group-hover:to-teal-200 transition-all duration-500">
                {prefix}{count}{suffix}
            </div>
            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.3em]">{label}</div>
        </div>
    );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices, currentUser }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const phoneNumber = "593978980722"; 

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
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
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
                <nav className={`pointer-events-auto transition-all duration-500 ease-out flex items-center justify-between px-2 pr-3 py-2 rounded-full border border-white/10 shadow-2xl backdrop-blur-xl ${scrolled ? 'bg-[#0B2149]/80 w-full max-w-5xl scale-95' : 'bg-white/5 w-full max-w-6xl'}`}>
                    
                    {/* Logo Area */}
                    <div className="flex items-center gap-3 cursor-pointer pl-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00A896] to-[#005F56] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,168,150,0.4)]">
                            <Logo className="w-6 h-6 text-white" />
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <span className="text-sm font-display font-black tracking-tight leading-none text-white">SANTIAGO CORDOVA</span>
                            <span className="text-[9px] font-bold text-[#00A896] tracking-[0.2em] uppercase glow-text">Elite Tax Services</span>
                        </div>
                    </div>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5">
                        {['Inicio', 'Servicios', 'Recursos', 'Contacto'].map((item) => (
                            <button 
                                key={item}
                                onClick={() => scrollToSection(item === 'Inicio' ? 'top' : item.toLowerCase())}
                                className="px-5 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={onAdminAccess}
                            className="hidden md:block text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider px-3"
                        >
                            Acceso
                        </button>
                        <button 
                            onClick={onNavigateToServices}
                            className="group relative px-6 py-2.5 bg-white text-[#0B2149] rounded-full text-xs font-black uppercase tracking-wider overflow-hidden hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                        >
                            <span className="relative z-10 group-hover:text-[#00A896] transition-colors">Contratar</span>
                            <div className="absolute inset-0 bg-[#0B2149] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left ease-out duration-300"></div>
                        </button>
                    </div>
                </nav>
            </div>

            {/* --- MOBILE BOTTOM DOCK (Thumb-Driven) --- */}
            <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-fade-in-up">
                <div className="bg-[#0B2149]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex justify-between items-center px-4">
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-colors">
                        <Home size={20} />
                        <span className="text-[9px] font-bold mt-1">Inicio</span>
                    </button>
                    <button onClick={onNavigateToServices} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-colors">
                        <Grid size={20} />
                        <span className="text-[9px] font-bold mt-1">Servicios</span>
                    </button>
                    {/* Floating Action Button within Dock */}
                    <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-12 h-12 bg-[#00A896] rounded-full text-white shadow-[0_0_20px_rgba(0,168,150,0.5)] -mt-8 border-4 border-[#020617]">
                        <MessageCircle size={24} />
                    </a>
                    <button onClick={() => scrollToSection('recursos')} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-colors">
                        <BookOpen size={20} />
                        <span className="text-[9px] font-bold mt-1">Wiki</span>
                    </button>
                    <button onClick={onAdminAccess} className="flex flex-col items-center p-2 text-slate-400 hover:text-white transition-colors">
                        <ShieldCheck size={20} />
                        <span className="text-[9px] font-bold mt-1">Admin</span>
                    </button>
                </div>
            </div>

            {/* --- HERO SECTION: Aurora & Noise --- */}
            <header id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#020617] bg-noise">
                {/* Aurora Effects (Intensified) */}
                <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-[#00A896]/20 rounded-full blur-[130px] animate-pulse-slow" style={{animationDelay: '1s'}}></div>
                <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-purple-600/15 rounded-full blur-[100px] animate-float"></div>
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 text-center mt-20 md:mt-0">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-fade-in-down hover:bg-white/10 transition-colors cursor-default shadow-[0_0_30px_rgba(0,168,150,0.1)]">
                        <span className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_10px_#00A896]"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Normativa 2026 Actualizada</span>
                    </div>
                    
                    <h1 className="text-5xl sm:text-7xl md:text-9xl font-display font-black tracking-tighter leading-[0.9] mb-8">
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-sm">FINANZAS</span>
                        <br/>
                        <span className="relative inline-block">
                            <span className="absolute -inset-1 blur-3xl bg-[#00A896]/20"></span>
                            <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#00A896] via-emerald-400 to-teal-200">SIN LÍMITES</span>
                        </span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
                        Ingeniería tributaria de élite para empresas en crecimiento. Transformamos sus obligaciones fiscales en <strong className="text-white font-bold border-b border-[#00A896]">ventajas competitivas</strong>.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                        <button onClick={onNavigateToServices} className="group relative w-64 h-16 bg-white text-[#020617] rounded-full font-black text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                            <div className="absolute inset-0 flex items-center justify-center group-hover:-translate-y-full transition-transform duration-300">
                                Explorar Soluciones
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-[#00A896] text-white">
                                <ArrowRight size={24}/>
                            </div>
                        </button>
                        
                        <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors group px-6 py-4 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10">
                            <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                <Phone size={20}/>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest">Agendar Cita</span>
                        </a>
                    </div>
                </div>

                {/* Scrolling Marquee Bottom */}
                <div className="absolute bottom-0 w-full py-6 border-t border-white/5 bg-[#020617]/50 backdrop-blur-sm overflow-hidden pointer-events-none">
                    <div className="flex whitespace-nowrap animate-marquee">
                        {[...Array(10)].map((_, i) => (
                            <span key={i} className="mx-8 text-4xl font-display font-black text-white/5 uppercase">
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
                            <h2 className="text-4xl md:text-6xl font-display font-black mb-4">Ecosistema <br/><span className="text-[#00A896]">de Servicios.</span></h2>
                            <p className="text-slate-400 max-w-md">Soluciones modulares diseñadas para escalar con su negocio, desde el emprendimiento hasta la consolidación.</p>
                        </div>
                        <button onClick={onNavigateToServices} className="flex items-center gap-2 text-[#00A896] font-bold uppercase text-xs tracking-widest hover:text-white transition-colors group">
                            Ver catálogo completo <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[800px]">
                        
                        {/* Card 1: Large Vertical */}
                        <div className="md:col-span-1 md:row-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between hover:bg-white/10 transition-all duration-500 group cursor-pointer hover:border-[#00A896]/30 hover:shadow-[0_0_50px_rgba(0,168,150,0.1)] relative overflow-hidden" onClick={onNavigateToServices}>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#00A896]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="relative z-10">
                                <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                    <TrendingUp size={32}/>
                                </div>
                                <h3 className="text-3xl font-bold mb-4">Gestión RIMPE</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Optimización fiscal para Negocios Populares y Emprendedores. Análisis de categorización y proyección de impuesto a la renta anual.
                                </p>
                            </div>
                            <div className="mt-8 relative h-48 bg-gradient-to-t from-blue-900/50 to-transparent rounded-2xl overflow-hidden border border-white/5 group-hover:border-white/20 transition-colors">
                                {/* Abstract Chart */}
                                <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-around px-4 pb-4">
                                    <div className="w-4 h-16 bg-blue-500/50 rounded-t-sm animate-pulse"></div>
                                    <div className="w-4 h-24 bg-blue-500/70 rounded-t-sm animate-pulse" style={{animationDelay:'0.2s'}}></div>
                                    <div className="w-4 h-32 bg-[#00A896] rounded-t-sm animate-pulse shadow-[0_0_15px_#00A896]" style={{animationDelay:'0.4s'}}></div>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Wide Horizontal */}
                        <div className="md:col-span-2 bg-[#00A896] rounded-[2.5rem] p-8 relative overflow-hidden group cursor-pointer shadow-[0_0_50px_rgba(0,168,150,0.2)] hover:shadow-[0_0_80px_rgba(0,168,150,0.4)] transition-all duration-500" onClick={onNavigateToServices}>
                            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-700"></div>
                            <div className="relative z-10 flex flex-col md:flex-row justify-between h-full">
                                <div className="max-w-md">
                                    <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center text-white mb-6">
                                        <Laptop size={24}/>
                                    </div>
                                    <h3 className="text-4xl font-black mb-2 text-[#020617] tracking-tight">Firma Electrónica</h3>
                                    <p className="text-[#020617]/80 font-medium text-lg">Emisión inmediata y segura. Válida para facturación, Quipux y trámites legales. Entrega 100% digital.</p>
                                </div>
                                <div className="mt-6 md:mt-0 flex items-end">
                                    <div className="bg-black/20 backdrop-blur-md px-8 py-4 rounded-full text-[#020617] font-bold text-xs uppercase tracking-wider flex items-center gap-2 group-hover:bg-white group-hover:text-[#00A896] transition-all duration-300">
                                        Solicitar Ahora <ArrowRight size={14}/>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Small Square */}
                        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer flex flex-col justify-center text-center relative overflow-hidden" onClick={onNavigateToServices}>
                            <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative z-10">
                                <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 mb-4 group-hover:rotate-12 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                                    <ShieldCheck size={32}/>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Auditoría VIP</h3>
                                <p className="text-xs text-slate-400">Revisión preventiva para evitar multas.</p>
                            </div>
                        </div>

                        {/* Card 4: Small Square */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group cursor-pointer flex flex-col justify-center text-center relative overflow-hidden hover:border-orange-500/50" onClick={onNavigateToServices}>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                            <div className="relative z-10">
                                <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 mb-4 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                                    <Star size={32} fill="currentColor"/>
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-white">Suscripciones</h3>
                                <p className="text-xs text-slate-400">Planes mensuales todo incluido.</p>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- SCROLLYTELLING STATS (Animated) --- */}
            <section className="py-32 bg-[#020617] relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-wrap justify-center gap-12 md:gap-24">
                        <AnimatedStat label="Clientes Activos" end={500} suffix="+" />
                        <AnimatedStat label="Ahorro Generado" end={1200000} prefix="$" />
                        <AnimatedStat label="Años Experiencia" end={10} suffix="+" />
                        <AnimatedStat label="Efectividad" end={100} suffix="%" />
                    </div>
                </div>
            </section>

            {/* --- WIKI SECTION: Glass Accordion --- */}
            <section id="recursos" className="py-32 relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00A896] rounded-full blur-[200px] opacity-10 pointer-events-none"></div>

                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 mb-6">
                            <BookOpen size={24} className="text-[#00A896]"/>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-display font-black">Base de Conocimiento</h2>
                        <p className="text-slate-400 mt-4">Claridad en un mundo de complejidad tributaria.</p>
                    </div>

                    <div className="space-y-4">
                        {[
                            { title: "¿Cuánto debo retener en 2026?", category: "Retenciones", content: "Las tablas de retención se han actualizado. Servicios profesionales ahora gravan el 10% en la fuente. Consulte nuestra calculadora para detalles exactos." },
                            { title: "RIMPE: Negocio Popular vs Emprendedor", category: "Régimen", content: "La diferencia radica en la facturación anual. Hasta $20k es Popular (Nota de Venta), hasta $300k es Emprendedor (Factura + IVA)." },
                            { title: "Devolución de IVA Tercera Edad", category: "Beneficios", content: "Puede recuperar hasta $108 mensuales en compras de primera necesidad. El trámite es 100% digital y el depósito es automático." }
                        ].map((item, i) => (
                            <div key={i} className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-all cursor-pointer">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-bold bg-[#00A896]/20 text-[#00A896] px-2 py-1 rounded-md uppercase tracking-wider shadow-[0_0_10px_rgba(0,168,150,0.1)]">{item.category}</span>
                                        <h3 className="text-lg font-bold text-white group-hover:text-[#00A896] transition-colors">{item.title}</h3>
                                    </div>
                                    <ChevronDown className="text-slate-500 group-hover:text-white transition-transform group-hover:rotate-180"/>
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
                <div className="max-w-6xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00A896] to-blue-600 rounded-[3rem] blur-2xl opacity-40 animate-pulse-glow"></div>
                    <div className="relative bg-[#020617] border border-white/10 rounded-[3rem] p-12 md:p-24 text-center overflow-hidden">
                        {/* Glow Effects inside card */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                        
                        <h2 className="text-5xl md:text-7xl font-display font-black text-white mb-8 tracking-tight">
                            ¿Listo para el <br/> Siguiente Nivel?
                        </h2>
                        <p className="text-slate-400 text-lg mb-12 max-w-xl mx-auto">
                            Deje la contabilidad en manos expertas y enfóquese en lo que realmente importa: hacer crecer su negocio.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row justify-center gap-6">
                            <a 
                                href={`https://wa.me/${phoneNumber}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group relative px-10 py-5 bg-white text-[#020617] rounded-full font-black text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]"
                            >
                                <div className="absolute inset-0 bg-[#00A896] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left ease-out duration-300"></div>
                                <span className="relative z-10 group-hover:text-white flex items-center gap-3">
                                    <MessageCircle size={20}/> Iniciar Conversación
                                </span>
                            </a>
                            
                            <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest px-8 py-5 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default">
                                <MapPin size={16} className="text-[#00A896]"/> Pasaje, El Oro
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- FOOTER: Clean & Dark --- */}
            <footer className="border-t border-white/5 py-12 bg-[#020617]">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4 opacity-50 hover:opacity-100 transition-opacity cursor-default">
                        <Logo className="w-8 h-8 text-white"/>
                        <span className="font-display font-bold text-lg tracking-tight">SANTIAGO CORDOVA</span>
                    </div>
                    <div className="flex gap-8 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <a href="#" className="hover:text-[#00A896] transition-colors">Privacidad</a>
                        <a href="#" className="hover:text-[#00A896] transition-colors">Términos</a>
                        <button onClick={onAdminAccess} className="hover:text-white transition-colors">Admin</button>
                    </div>
                    <div className="text-slate-600 text-xs">
                        © 2026. Design by Elite AI.
                    </div>
                </div>
            </footer>
        </div>
    );
};
