import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import { PublicUser } from '../types';
import { useAppStore } from '../store/useAppStore';

interface LandingPageProps {
    onAdminAccess: () => void;
    onNavigateToServices: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
    theme?: 'light' | 'dark';
    toggleTheme?: () => void;
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

const AnimatedStat = ({ end, label, prefix = "", suffix = "", theme = 'dark', className = "" }: { end: number; label: string; prefix?: string; suffix?: string; theme?: 'light' | 'dark'; className?: string }) => {
    const { count, ref } = useCounter(end);
    return (
        <div ref={ref} className={`group cursor-default ${className}`}>
            <div className={`text-5xl md:text-7xl font-editorial tracking-tighter mb-3 group-hover:text-[#00A896] transition-all duration-700 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                {prefix}{count.toLocaleString()}{suffix}
            </div>
            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] opacity-80">{label}</div>
        </div>
    );
};

// ─── REVEAL ON SCROLL (Framer Motion spring-based) ──────────────────────────
const Reveal = ({ children, className = "", delay = 0, yOffset = 35 }: { children: React.ReactNode; className?: string; delay?: number; yOffset?: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: yOffset, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-8% 0px -8% 0px" }}
            transition={{ 
                type: "spring",
                stiffness: 40,
                damping: 15,
                delay: delay / 1000 
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

// ─── STAGGERED CONTAINER FOR ELITE SCROLL ────────────────────────────────────
const StaggerContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    return (
        <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10% 0px" }}
            variants={{
                hidden: { opacity: 0 },
                show: {
                    opacity: 1,
                    transition: {
                        staggerChildren: 0.12
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

const StaggerItem = ({ children, className = "", yOffset = 30 }: { children: React.ReactNode; className?: string; yOffset?: number }) => {
    return (
        <motion.div
            className={className}
            variants={{
                hidden: { opacity: 0, y: yOffset, filter: "blur(3px)" },
                show: { 
                    opacity: 1, 
                    y: 0, 
                    filter: "blur(0px)",
                    transition: {
                        type: "spring",
                        stiffness: 45,
                        damping: 14
                    }
                }
            }}
        >
            {children}
        </motion.div>
    );
};

// ─── SPOTLIGHT CARD ──────────────────────────────────────────────────────────
const SpotlightCard = ({ children, className = "", theme = 'dark' }: { children: React.ReactNode; className?: string; theme?: 'light' | 'dark' }) => {
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
            className={`relative border rounded-[2.5rem] overflow-hidden group/card transition-all duration-500
                ${theme === 'dark' 
                    ? 'bg-white/5 border-white/10 glass-premium-2' 
                    : 'bg-white border-slate-200/80 shadow-md hover:shadow-lg'
                } ${className}`}>
            <div className="pointer-events-none absolute -inset-px transition duration-300"
                style={{ 
                    opacity, 
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${theme === 'dark' ? 'rgba(0,168,150,0.12)' : 'rgba(0,168,150,0.06)'}, transparent 40%)` 
                }} />
            <div className="relative z-10 h-full">{children}</div>
        </motion.div>
    );
};

// ─── AUTHORITY TICKER ────────────────────────────────────────────────────────
const AuthorityTicker = ({ theme = 'dark' }: { theme?: 'light' | 'dark' }) => {
    const items = ["SRI ECUADOR", "SUPERCIAS", "MINISTERIO DE TRABAJO", "IESS", "BANCO CENTRAL", "RIMPE 2026", "RÉGIMEN GENERAL", "IVA • RENTA • RETENCIONES"];
    return (
        <div className={`py-16 border-y relative overflow-hidden transition-colors duration-500
            ${theme === 'dark' ? 'bg-[#020617] border-white/5' : 'bg-slate-100/60 border-slate-200/80'}`}>
            <div className="max-w-7xl mx-auto px-6 mb-10 flex items-center gap-6">
                <div className={`h-[1px] flex-1 bg-gradient-to-r ${theme === 'dark' ? 'from-transparent to-white/10' : 'from-transparent to-slate-200'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-[0.5em] whitespace-nowrap ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Regulaciones y Entidades que Dominamos</span>
                <div className={`h-[1px] flex-1 bg-gradient-to-l ${theme === 'dark' ? 'from-transparent to-white/10' : 'from-transparent to-slate-200'}`} />
            </div>
            <div className="flex mask-fade-edges whitespace-nowrap animate-marquee">
                {[...items, ...items].map((name, i) => (
                    <div key={i} className={`mx-12 flex items-center gap-5 group transition-opacity duration-700 ${theme === 'dark' ? 'opacity-20 hover:opacity-100' : 'opacity-40 hover:opacity-100'}`}>
                        <div className="w-1.5 h-1.5 bg-[#00A896] rounded-full shadow-[0_0_8px_#00A896]" />
                        <span className={`text-2xl md:text-4xl font-editorial tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── TESTIMONIAL CARD ────────────────────────────────────────────────────────
const TestimonialCard = ({ quote, name, role, stars = 5, theme = 'dark', delay = 0 }: { quote: string; name: string; role: string; stars?: number; theme?: 'light' | 'dark'; delay?: number }) => (
    <Reveal delay={delay}>
        <div className={`relative border rounded-3xl p-8 transition-all duration-500 interactive-card h-full flex flex-col
            ${theme === 'dark' 
                ? 'bg-white/5 border-white/10 glass-premium-2 hover:border-[#00A896]/30' 
                : 'bg-white border-slate-200 shadow-md hover:border-[#00A896]/40 hover:shadow-lg'
            }`}>
            <div className="flex gap-1 mb-6">
                {Array.from({ length: stars }).map((_, i) => (
                    <LucideIcons.Star key={i} size={14} className="text-[#d4af37] fill-[#d4af37]" />
                ))}
            </div>
            <p className={`text-base leading-relaxed font-light flex-1 mb-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>"{quote}"</p>
            <div className={`flex items-center gap-4 pt-6 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A896] to-teal-900 flex items-center justify-center text-white font-bold text-sm">
                    {name.charAt(0)}
                </div>
                <div>
                    <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{name}</div>
                    <div className="text-[#00A896] text-xs font-medium">{role}</div>
                </div>
            </div>
        </div>
    </Reveal>
);

// ─── PROCESS STEP ────────────────────────────────────────────────────────────
const ProcessStep = ({ number, title, description, icon: Icon, theme = 'dark', delay = 0 }: { number: string; title: string; description: string; icon: React.ElementType; theme?: 'light' | 'dark'; delay?: number }) => (
    <Reveal delay={delay}>
        <div className="relative group">
            <div className="flex gap-6 md:gap-8">
                <div className="flex-shrink-0">
                    <div className={`relative w-14 h-14 rounded-2xl border flex items-center justify-center group-hover:border-[#00A896] transition-all duration-500 group-hover:shadow-[0_0_30px_rgba(0,168,150,0.3)]
                        ${theme === 'dark'
                            ? 'bg-gradient-to-br from-[#00A896]/20 to-transparent border-[#00A896]/30'
                            : 'bg-gradient-to-br from-[#00A896]/10 to-[#00A896]/5 border-[#00A896]/20'
                        }`}>
                        <Icon size={22} className="text-[#00A896]" />
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#00A896] text-[#020617] text-[9px] font-black flex items-center justify-center">{number}</span>
                    </div>
                </div>
                <div className="pt-1">
                    <h4 className={`font-bold text-lg mb-2 group-hover:text-[#00A896] transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{title}</h4>
                    <p className={`text-sm leading-relaxed font-light ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{description}</p>
                </div>
            </div>
        </div>
    </Reveal>
);

// ─── TRUST BADGE ─────────────────────────────────────────────────────────────
const TrustBadge = ({ icon: Icon, label, value, theme = 'dark' }: { icon: React.ElementType; label: string; value: string; theme?: 'light' | 'dark' }) => (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-full border backdrop-blur-md hover:border-[#00A896]/40 hover:bg-[#00A896]/5 transition-all duration-300 group
        ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm'}`}>
        <Icon size={16} className="text-[#00A896] group-hover:scale-110 transition-transform" />
        <div>
            <div className={`text-xs font-semibold leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{value}</div>
            <div className="text-slate-500 text-[9px] uppercase tracking-wider mt-0.5">{label}</div>
        </div>
    </div>
);

// ─── FAQ ITEM ─────────────────────────────────────────────────────────────────
const FaqItem = ({ question, answer, category, theme = 'dark', delay = 0 }: { question: string; answer: string; category: string; theme?: 'light' | 'dark'; delay?: number }) => {
    const [open, setOpen] = useState(false);
    return (
        <Reveal delay={delay}>
            <div className={`group relative border rounded-3xl transition-all duration-500 cursor-pointer overflow-hidden interactive-card
                ${open 
                    ? (theme === 'dark' ? 'border-[#00A896]/40 bg-[#00A896]/5' : 'border-[#00A896]/30 bg-teal-50/30') 
                    : (theme === 'dark' ? 'border-white/10 bg-white/5 hover:bg-white/[0.08]' : 'border-slate-200 bg-white hover:bg-slate-50/50 shadow-sm')
                }`}
                onClick={() => setOpen(o => !o)}>
                <div className="absolute top-0 left-0 w-full h-[1px] bg-[#00A896]/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="p-8 flex justify-between items-start gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
                        <span className="text-[10px] font-bold text-[#00A896] bg-[#00A896]/10 px-3 py-1.5 rounded-full uppercase tracking-[0.2em] w-fit flex-shrink-0">{category}</span>
                        <h3 className={`text-lg md:text-xl font-bold transition-colors ${open ? 'text-[#00A896]' : (theme === 'dark' ? 'text-white' : 'text-slate-800')}`}>{question}</h3>
                    </div>
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${open ? 'bg-[#00A896] border-[#00A896]' : (theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}`}>
                        <LucideIcons.ChevronDown size={18} className={`transition-transform duration-300 ${open ? 'rotate-180 text-white' : (theme === 'dark' ? 'text-white' : 'text-slate-600')}`} />
                    </div>
                </div>
                <AnimatePresence>
                    {open && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                            <div className="px-8 pb-8">
                                <div className={`pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                                    <p className={`text-base font-light leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{answer}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Reveal>
    );
};

// ─── WHATSAPP WIDGET ──────────────────────────────────────────────────────────
const WhatsAppWidget = ({ phoneNumber }: { phoneNumber: string }) => {
    return (
        <div className="fixed bottom-6 right-6 z-[100] no-print">
            <a href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20una%20consulta.`} target="_blank" rel="noopener noreferrer" className="relative flex items-center justify-center w-16 h-16 bg-[#25D366] rounded-full text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 group">
                <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-75" />
                <div className="absolute inset-0 rounded-full border-2 border-white/20" />
                <svg className="w-8 h-8 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                <div className="absolute -top-12 -right-2 bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    En línea • Consulta rápida
                    <div className="absolute -bottom-1 right-5 w-2 h-2 bg-white rotate-45" />
                </div>
            </a>
        </div>
    );
};

// ─── NEWS SECTION ───────────────────────────────────────────────────────────
const NewsSection = ({ theme = 'dark', onReadNews }: { theme?: 'light' | 'dark'; onReadNews: (newsItem: any) => void }) => {
    const news = [
        { 
            title: "Nuevos Límites RIMPE 2026", 
            date: "Actualización SRI", 
            icon: LucideIcons.TrendingUp,
            impact: "Los límites del régimen RIMPE han sido ajustados para el período fiscal 2026, redefiniendo las categorías de Negocio Popular y Emprendedor. Las multas por categorización incorrecta aumentaron.",
            audience: "Microempresarios, comercios locales y profesionales independientes con facturación menor a $300,000.",
            advice: "Es fundamental revisar su facturación acumulada del 2025 para validar si califica como Negocio Popular (hasta $20,000) o si debe realizar la transición a Emprendedor, evitando sanciones automáticas del SRI."
        },
        { 
            title: "Cambios en Retenciones de IVA", 
            date: "Alerta Fiscal", 
            icon: LucideIcons.AlertTriangle,
            impact: "Nuevos porcentajes y agentes de retención obligatorios designados por el SRI para transacciones digitales y físicas. Se modifican los casilleros del formulario 104.",
            audience: "Empresas designadas como Agentes de Retención y contribuyentes especiales que contraten servicios profesionales.",
            advice: "Configure sus sistemas de facturación con los nuevos códigos de retención (ej. 1%, 2% o 10% según el tipo de servicio). La declaración tardía o incorrecta de retenciones genera intereses acumulativos."
        },
        { 
            title: "Obligaciones Marzo 2026", 
            date: "Calendario", 
            icon: LucideIcons.CalendarClock,
            impact: "Plazo improrrogable para la declaración y pago del Impuesto a la Renta de Personas Naturales del ejercicio fiscal 2025.",
            audience: "Todas las personas naturales en Régimen General y RIMPE Emprendedor que superen la fracción básica desgravada.",
            advice: "Reúna sus facturas electrónicas de gastos personales (vivienda, salud, educación, alimentación) y consolide sus ingresos. Presentar la declaración en la fecha exacta según su noveno dígito de RUC evita el recargo del 3% mensual."
        }
    ];
    return (
        <section id="noticias" className={`py-24 relative overflow-hidden border-t transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617] border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="mb-12 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-2">— Actualidad Fiscal</div>
                        <h2 className={`text-3xl md:text-5xl font-editorial tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>NOTICIAS TRIBUTARIAS</h2>
                    </div>
                    <button className="hidden md:flex items-center gap-2 text-sm text-[#00A896] hover:text-teal-600 transition-colors">
                        Ver todas <LucideIcons.ArrowRight size={16} />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {news.map((item, i) => (
                        <Reveal key={i} delay={i * 100}>
                            <div 
                                onClick={() => onReadNews(item)}
                                className={`p-8 rounded-3xl border transition-all duration-300 group cursor-pointer h-full flex flex-col
                                    ${theme === 'dark' 
                                        ? 'bg-white/5 border-white/10 hover:border-[#00A896]/40 glass-premium-2' 
                                        : 'bg-white border-slate-200 hover:border-[#00A896]/40 shadow-sm hover:shadow-md'
                                    }`}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00A896]/20 to-transparent flex items-center justify-center mb-6 text-[#00A896] group-hover:scale-110 transition-transform">
                                    <item.icon size={24} />
                                </div>
                                <div className="text-[10px] text-[#00A896] font-bold uppercase tracking-wider mb-3">{item.date}</div>
                                <h3 className={`text-xl font-bold mb-4 group-hover:text-[#00A896] transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{item.title}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-400 group-hover:text-[#00A896] transition-colors mt-auto pt-4 border-t border-white/5">
                                    Leer resumen <LucideIcons.ArrowUpRight size={14} />
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};

// ─── LEAD MAGNET BANNER ───────────────────────────────────────────────────────
const LeadMagnetBanner = ({ phoneNumber, theme = 'dark' }: { phoneNumber: string; theme?: 'light' | 'dark' }) => {
    return (
        <section className={`py-20 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#00A896]/10 to-blue-900/10 pointer-events-none" />
            <div className="max-w-5xl mx-auto px-6 relative z-10">
                <div className={`p-10 md:p-14 rounded-[3rem] border backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-10 overflow-hidden relative
                    ${theme === 'dark' 
                        ? 'border-[#00A896]/30 bg-[#020617]/80 shadow-[0_0_50px_rgba(0,168,150,0.15)]' 
                        : 'border-[#00A896]/20 bg-white shadow-xl'
                    }`}>
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#00A896] rounded-full blur-[100px] opacity-20 pointer-events-none" />
                    <div className="flex-1 text-center md:text-left relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00A896]/10 text-[#00A896] text-[10px] font-bold uppercase tracking-widest mb-6 border border-[#00A896]/20">
                            <LucideIcons.Download size={12} /> Recurso Gratuito
                        </div>
                        <h2 className={`text-3xl md:text-5xl font-editorial tracking-tighter mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>CALENDARIO TRIBUTARIO 2026</h2>
                        <p className={`text-lg font-light mb-0 max-w-xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Descarga la guía en PDF con todas las fechas de vencimiento de SRI, IESS y Supercias para este año.</p>
                    </div>
                    <div className="flex-shrink-0 relative z-10">
                        <a href={`https://wa.me/${phoneNumber}?text=Hola,%20quisiera%20descargar%20el%20Calendario%20Tributario%202026.`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#00A896] text-white rounded-full font-bold uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(0,168,150,0.4)]">
                            <LucideIcons.FileText size={20} />
                            <span>Solicitar PDF</span>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices, theme = 'dark', toggleTheme }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showBiometric, setShowBiometric] = useState(false);
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 800], [0, -120]);
    const phoneNumber = "593978980722";

    // Store prices integration
    const { serviceFees } = useAppStore();

    // New features states
    const [selectedNews, setSelectedNews] = useState<any | null>(null);
    const [selectedRucDigit, setSelectedRucDigit] = useState<number | null>(1);
    
    // Tax Simulator states
    const [calcIngresos, setCalcIngresos] = useState(15000);
    const [calcActividad, setCalcActividad] = useState<'comercial' | 'profesional' | 'discapacidad_3ra_edad'>('comercial');

    // FAQ search states
    const [faqSearch, setFaqSearch] = useState("");
    const [faqCategory, setFaqCategory] = useState("Todo");

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

    // Tax recommendation algorithm
    const getTaxRecommendation = (ingresos: number, actividad: string) => {
        const npPrice = serviceFees?.rentaNP || 50;
        const semPrice = serviceFees?.ivaSemestral || 80;
        const menPrice = (serviceFees?.ivaMensual || 20) * 5;
        const devPrice = serviceFees?.devolucionIva || 30;

        if (actividad === 'discapacidad_3ra_edad') {
            return {
                regimen: "Grupos Prioritarios (SRI)",
                planTitle: "Devolución IVA",
                price: devPrice,
                description: "Trámite de recuperación mensual del IVA para Tercera Edad y Discapacidad. Recupera hasta el tope mensual de ley."
            };
        }
        
        if (actividad === 'profesional') {
            return {
                regimen: "Régimen General (Servicios Profesionales)",
                planTitle: "Profesionales",
                price: menPrice,
                description: "Gestión contable mensual completa para profesionales autónomos, con asesoría fiscal personalizada y devolución de retenciones."
            };
        }

        if (ingresos <= 20000) {
            return {
                regimen: "RIMPE - Negocio Popular",
                planTitle: "RIMPE Popular",
                price: npPrice,
                description: "Declaración anual simplificada obligatoria para microempresarios con ingresos anuales de hasta $20,000."
            };
        } else if (ingresos <= 300000) {
            return {
                regimen: "RIMPE - Emprendedor",
                planTitle: "RIMPE Emprendedor",
                price: semPrice,
                description: "Cumplimiento y declaración semestral de IVA y renta anual para negocios que facturan entre $20,001 y $300,000."
            };
        } else {
            return {
                regimen: "Régimen General (Corporativo)",
                planTitle: "Consultoría Estratégica",
                price: 150,
                description: "Planificación fiscal corporativa avanzada, auditoría preventiva y contabilidad completa para empresas consolidadas."
            };
        }
    };

    const recommendation = getTaxRecommendation(calcIngresos, calcActividad);

    // SRI Monthly Deadline calculator
    const getRucDeadlineDate = (digit: number) => {
        if (digit === 1) return { day: 10, label: "10 de cada mes" };
        if (digit === 2) return { day: 12, label: "12 de cada mes" };
        if (digit === 3) return { day: 14, label: "14 de cada mes" };
        if (digit === 4) return { day: 16, label: "16 de cada mes" };
        if (digit === 5) return { day: 18, label: "18 de cada mes" };
        if (digit === 6) return { day: 20, label: "20 de cada mes" };
        if (digit === 7) return { day: 22, label: "22 de cada mes" };
        if (digit === 8) return { day: 24, label: "24 de cada mes" };
        if (digit === 9) return { day: 26, label: "26 de cada mes" };
        if (digit === 0) return { day: 28, label: "28 de cada mes" };
        return { day: 10, label: "10 de cada mes" };
    };

    const deadline = getRucDeadlineDate(selectedRucDigit ?? 1);

    // FAQ Array
    const faqs = [
        { 
            category: "Régimen", 
            question: "¿Cuál es la diferencia entre RIMPE Popular y Emprendedor?",
            answer: "RIMPE Popular aplica a negocios con ingresos hasta $20,000 anuales, usando Notas de Venta y sin IVA. RIMPE Emprendedor aplica a negocios hasta $300,000 anuales, emiten facturas con IVA y tienen obligaciones semestrales. El régimen óptimo depende de su actividad y nivel de ingresos. Lo asesoramos sin costo." 
        },
        { 
            category: "Retenciones", 
            question: "¿Cuánto debo retener en la fuente en 2026?",
            answer: "Las tablas de retención 2026 establecen: servicios profesionales 10%, servicios no profesionales 2%, arrendamiento de inmuebles 8%, transferencia de bienes 1%. Nuestra plataforma automatiza estos cálculos y le ayuda a evitar sanciones por retenciones incorrectas." 
        },
        { 
            category: "Beneficios", 
            question: "¿Cómo funciona la Devolución de IVA para Tercera Edad?",
            answer: "Personas mayores de 65 años tienen derecho a recuperar el IVA pagado en compras de bienes y servicios, hasta el tope mensual establecido por ley. El trámite es 100% digital: recopilamos sus facturas, cargamos la solicitud en el portal del SRI y hacemos seguimiento hasta la acreditación directa en su cuenta." 
        },
        { 
            category: "Tecnología", 
            question: "¿Qué necesito para obtener mi Firma Electrónica?",
            answer: "Solo necesita su cédula de identidad o RUC vigente, un correo electrónico activo y 30 minutos de su tiempo para la videoconferencia de verificación de identidad. El token digital .P12 le llegará por email y lo instalamos remotamente. Proceso completamente en línea desde cualquier lugar del Ecuador." 
        },
        { 
            category: "Proceso", 
            question: "¿Cuánto tiempo tarda regularizar mis obligaciones atrasadas?",
            answer: "Depende del número de períodos pendientes, pero generalmente entre 5 y 15 días hábiles. Gestionamos las declaraciones pendientes, calculamos el valor de multas e intereses, y en muchos casos aplicamos remisiones o facilidades de pago. Contáctenos para una evaluación sin costo de su situación." 
        }
    ];

    const faqCategories = ["Todo", "Régimen", "Retenciones", "Beneficios", "Tecnología", "Proceso"];

    const filteredFaqs = faqs.filter(faq => {
        const matchesCategory = faqCategory === "Todo" || faq.category === faqCategory;
        const matchesSearch = faq.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
                             faq.answer.toLowerCase().includes(faqSearch.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className={`${theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-800'} min-h-screen selection:bg-[#00A896]/30 selection:text-white font-sans overflow-x-hidden transition-colors duration-500`}>

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

            {/* ── NEWS DETAIL MODAL ── */}
            <AnimatePresence>
                {selectedNews && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }} 
                            animate={{ scale: 1, y: 0 }} 
                            exit={{ scale: 0.95, y: 20 }}
                            className={`w-full max-w-2xl border rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden shadow-2xl
                                ${theme === 'dark' ? 'bg-[#050a1b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                            <button 
                                onClick={() => setSelectedNews(null)}
                                className={`absolute top-6 right-6 w-10 h-10 rounded-full border flex items-center justify-center transition-colors
                                    ${theme === 'dark' ? 'border-white/10 hover:bg-white/5 text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                                <LucideIcons.X size={18} />
                            </button>
                            <div className="flex items-center gap-3 text-xs font-bold text-[#00A896] uppercase tracking-wider mb-6">
                                <LucideIcons.AlertCircle size={16} />
                                {selectedNews.date}
                            </div>
                            <h3 className="text-3xl font-editorial tracking-tight mb-6">{selectedNews.title}</h3>
                            
                            <div className="space-y-6 my-6 overflow-y-auto max-h-[60vh] pr-2">
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Impacto Normativo</h4>
                                    <p className={`text-base font-light leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{selectedNews.impact}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Contribuyentes Afectados</h4>
                                    <p className={`text-base font-light leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{selectedNews.audience}</p>
                                </div>
                                <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#00A896]/5 border-[#00A896]/20' : 'bg-teal-50/40 border-[#00A896]/20'}`}>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#00A896] mb-2">Consejo Profesional de Santiago Córdova</h4>
                                    <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{selectedNews.advice}</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-end">
                                <button 
                                    onClick={() => setSelectedNews(null)}
                                    className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors
                                        ${theme === 'dark' ? 'border-white/10 hover:bg-white/5 text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                                    Cerrar
                                </button>
                                <a 
                                    href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20una%20consulta%20sobre%20la%20noticia:%20${encodeURIComponent(selectedNews.title)}.`}
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="px-6 py-3 rounded-xl bg-[#00A896] hover:bg-teal-600 text-white text-xs font-bold uppercase tracking-wider text-center shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95 transition-all">
                                    Consultar por WhatsApp
                                </a>
                            </div>
                        </motion.div>
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
                <nav className={`pointer-events-auto transition-all duration-500 flex items-center justify-between px-3 pr-3 py-2 rounded-full border shadow-2xl backdrop-blur-xl
                    ${scrolled 
                        ? `w-full max-w-5xl scale-[0.98] ${theme === 'dark' ? 'bg-[#020617]/70 border-[#2B6AFF]/20 shadow-[#2B6AFF]/5 tactical-glow-primary' : 'bg-white/80 border-slate-200 shadow-md'}` 
                        : `w-full max-w-6xl ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-900/10 border-slate-900/10'}`
                    }`}>
                    <div className="flex items-center gap-3 cursor-pointer pl-2 group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className={`transition-all duration-700 w-9 h-9 bg-gradient-to-br from-[#2B6AFF] to-[#6366F1] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(43,106,255,0.4)] ${scrolled ? 'rotate-[360deg] scale-90' : ''}`}>
                            <Logo className="w-5 h-5 text-white" />
                        </div>
                        <div className={`hidden sm:flex flex-col transition-all duration-500 ${scrolled ? 'opacity-80' : ''}`}>
                            <span className={`text-sm font-display font-bold tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>SANTIAGO CÓRDOVA</span>
                            <span className="text-[10px] font-semibold text-[#00A896] tracking-[0.18em] uppercase">Asesor Tributario · El Oro</span>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5">
                        {navLinks.map((item) => (
                            <button key={item}
                                onClick={() => scrollToSection(item === 'Inicio' ? 'top' : item.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))}
                                className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 relative overflow-hidden group
                                    ${theme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                                <span className="relative z-10">{item}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-[#2B6AFF]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {toggleTheme && (
                            <button onClick={toggleTheme} className={`hidden md:flex items-center justify-center w-8 h-8 rounded-full border transition-all mr-2
                                ${theme === 'dark' 
                                    ? 'border-white/20 bg-black/20 text-slate-300 hover:text-white hover:bg-white/10' 
                                    : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-sm'
                                }`}>
                                {theme === 'dark' ? <LucideIcons.Sun size={14} /> : <LucideIcons.Moon size={14} />}
                            </button>
                        )}
                        <button onClick={onAdminAccess} className={`hidden md:block text-xs font-medium transition-colors uppercase tracking-wider px-3
                            ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                            Acceso
                        </button>
                        <MagneticButton onClick={onNavigateToServices}>
                            <div className="group relative px-6 py-2.5 bg-gradient-to-r from-[#2B6AFF] to-[#6366F1] text-white rounded-full text-xs font-bold uppercase tracking-wider overflow-hidden shadow-lg shadow-blue-500/25 transition-all duration-300 active:scale-95">
                                <span className="relative z-10 group-hover:text-white transition-colors duration-500">Contratar</span>
                                <div className="absolute inset-0 bg-blue-700 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" />
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
                <div className={`mobile-island-dock border-holographic relative overflow-hidden transition-colors duration-500
                    ${theme === 'dark' ? 'bg-[#020617]/90 border-white/10' : 'bg-white/95 border-slate-200 shadow-2xl'}`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`touch-scale flex flex-col items-center p-2 transition-all ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                        <LucideIcons.Home size={20} className={scrolled ? 'text-[#00A896]' : ''} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Inicio</span>
                    </button>
                    <button onClick={onNavigateToServices} className={`touch-scale flex flex-col items-center p-2 transition-all ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
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
                    <button onClick={() => setMobileMenuOpen(true)} className={`touch-scale flex flex-col items-center p-2 transition-all ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                        <LucideIcons.Menu size={20} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Menú</span>
                    </button>
                    <button onClick={onAdminAccess} className={`touch-scale flex flex-col items-center p-2 transition-all ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                        <LucideIcons.ShieldCheck size={20} />
                        <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter">Admin</span>
                    </button>
                </div>
            </div>


            {/* ════════════════════════════════════════════════════════════════
                HERO SECTION
            ════════════════════════════════════════════════════════════════ */}
            <header id="top" className={`relative min-h-screen flex items-center justify-center overflow-hidden transition-colors duration-500 pt-32 pb-24 md:pt-48 md:pb-32 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <AuroraBackground />
                <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-[#2B6AFF]/8 rounded-full blur-[160px]" />
                    <div className="absolute bottom-1/3 -right-20 w-[700px] h-[700px] bg-[#04B17B]/6 rounded-full blur-[180px]" />
                </motion.div>

                {/* Animated grid dots */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

                {/* Floating particles */}
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="absolute pointer-events-none"
                        style={{
                            top: `${15 + i * 13}%`, left: `${10 + i * 15}%`,
                            width: i % 2 === 0 ? '2px' : '1px', height: i % 2 === 0 ? '2px' : '1px',
                            background: i % 3 === 0 ? '#2B6AFF' : 'white',
                            borderRadius: '50%',
                            animation: `float ${6 + i}s ease-in-out ${i * 0.5}s infinite alternate`,
                            opacity: 0.3
                        }} />
                ))}

                <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
                    {/* Status badge */}
                    <Reveal delay={0}>
                        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[#2B6AFF]/30 bg-[#2B6AFF]/5 backdrop-blur-md mb-10 group cursor-default">
                            <div className="w-2 h-2 rounded-full bg-[#04B17B] animate-pulse shadow-[0_0_10px_#04B17B]" />
                            <span className="text-[11px] font-bold text-[#2B6AFF] uppercase tracking-[0.35em]">Disponible • Pasaje, El Oro · Ecuador</span>
                        </div>
                    </Reveal>

                    {/* Main headline */}
                    <Reveal delay={80}>
                        <h1 className="text-[3.2rem] sm:text-[5rem] md:text-[8rem] lg:text-[10rem] font-editorial tracking-tighter leading-[0.82] mb-8">
                            <span className={`text-transparent bg-clip-text drop-shadow-2xl block
                                ${theme === 'dark' 
                                    ? 'bg-gradient-to-b from-white via-white to-white/30' 
                                    : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-600'
                                }`}>
                                SANTIAGO
                            </span>
                            <span className="relative inline-block mt-3 md:mt-5">
                                <span className="absolute -inset-4 blur-[120px] bg-[#2B6AFF]/40 animate-pulse pointer-events-none" />
                                <span className="relative liquid-gold-text">CÓRDOVA</span>
                            </span>
                        </h1>
                    </Reveal>

                    {/* Sub-tagline */}
                    <Reveal delay={160}>
                        <p className={`text-lg md:text-2xl max-w-2xl mx-auto mb-4 font-light tracking-wide leading-relaxed text-balance transition-colors
                            ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            Soluciones tributarias de precisión para líderes y empresas que exigen{' '}
                            <span className={`font-semibold border-b border-[#2B6AFF] ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>rendimiento absoluto</span>{' '}
                            y blindaje fiscal total.
                        </p>
                    </Reveal>

                    {/* Trust badges row */}
                    <Reveal delay={220}>
                        <div className="flex flex-wrap justify-center gap-3 mb-12 mt-8">
                            <TrustBadge theme={theme} icon={LucideIcons.Award} label="Años de experiencia" value="10+" />
                            <TrustBadge theme={theme} icon={LucideIcons.Users} label="Clientes satisfechos" value="500+" />
                            <TrustBadge theme={theme} icon={LucideIcons.Shield} label="Cumplimiento SRI" value="100%" />
                            <TrustBadge theme={theme} icon={LucideIcons.MapPin} label="Ubicación" value="El Oro, Ecuador" />
                        </div>
                    </Reveal>

                    {/* CTA Buttons */}
                    <Reveal delay={280}>
                        <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
                            <MagneticButton onClick={onNavigateToServices}>
                                <div className={`group relative w-64 h-14 rounded-full font-bold text-xs uppercase tracking-widest overflow-hidden transition-all duration-300 active:scale-95 shadow-lg shadow-blue-500/25 border border-white/10
                                    ${theme === 'dark'
                                        ? 'bg-gradient-to-r from-[#2B6AFF] to-[#6366F1] text-white tactical-glow-primary hover:from-[#1A53D9] hover:to-[#5558DD]'
                                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl'
                                    }`}>
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 group-hover:-translate-y-full transition-transform duration-400">
                                        <LucideIcons.Sparkles size={16} />
                                        <span>Ver Servicios</span>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-400 bg-white text-[#020617] font-extrabold">
                                        <LucideIcons.ArrowRight size={16} />
                                        <span>Comenzar Ahora</span>
                                    </div>
                                </div>
                            </MagneticButton>
                            <MagneticButton href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20me%20interesa%20agendar%20una%20consulta%20gratuita.`} target="_blank" rel="noopener noreferrer">
                                <div className={`flex items-center gap-3 transition-all duration-300 group px-7 py-4 rounded-full border active:scale-95
                                    ${theme === 'dark' 
                                        ? 'text-slate-300 hover:text-white border-white/10 hover:bg-white/5 hover:border-[#2B6AFF]/40' 
                                        : 'text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-[#2B6AFF]/20 group-hover:border-[#2B6AFF] transition-all">
                                        <LucideIcons.MessageCircle size={18} className="text-[#2B6AFF]" />
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-widest font-mono">Consulta Gratuita</span>
                                </div>
                            </MagneticButton>
                        </div>
                    </Reveal>
                </div>

                {/* Hero bottom marquee */}
                <div className={`absolute bottom-0 w-full py-5 border-t bg-opacity-60 backdrop-blur-sm overflow-hidden pointer-events-none transition-colors
                    ${theme === 'dark' ? 'border-white/5 bg-[#020617]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex whitespace-nowrap animate-marquee">
                        {[...Array(8)].map((_, i) => (
                            <span key={i} className={`mx-8 text-3xl font-editorial uppercase tracking-tighter transition-colors
                                ${theme === 'dark' ? 'text-white/5' : 'text-slate-800/5'}`}>
                                Contabilidad · Tributación · Asesoría · SRI · RIMPE ·
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            {/* ── AUTHORITY TICKER ── */}
            <AuthorityTicker theme={theme} />

            {/* ══════════════════════════════════════════════════════════════
                STATS / TELEMETRÍA
            ══════════════════════════════════════════════════════════════ */}
            <section className={`py-32 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <div className="absolute inset-0 bg-dot-matrix opacity-15" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <StaggerContainer className={`grid grid-cols-2 md:grid-cols-4 gap-1 border rounded-[3rem] overflow-hidden transition-all duration-500
                        ${theme === 'dark' 
                            ? 'border-white/10 bg-white/5 backdrop-blur-3xl glass-premium-2 shadow-2xl' 
                            : 'border-slate-200 bg-white shadow-xl'
                        }`}>
                        {[
                            { label: "Clientes Activos", end: 500, suffix: "+", icon: LucideIcons.Users },
                            { label: "Ahorro Generado", end: 1200000, prefix: "$", icon: LucideIcons.TrendingUp },
                            { label: "Años de Trayectoria", end: 10, suffix: "+", icon: LucideIcons.Award },
                            { label: "Efectividad SRI", end: 100, suffix: "%", icon: LucideIcons.Activity }
                        ].map((stat, i) => (
                            <StaggerItem key={i}>
                                <div className={`p-10 md:p-14 hover:bg-white/[0.03] transition-colors group relative border-r last:border-r-0 h-full ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                                    <div className="absolute top-6 right-6 text-[#00A896] opacity-20 group-hover:opacity-80 transition-opacity">
                                        <stat.icon size={20} />
                                    </div>
                                    <AnimatedStat theme={theme} end={stat.end} label={stat.label} prefix={stat.prefix} suffix={stat.suffix} />
                                    <div className="mt-6 w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} whileInView={{ width: '100%' }} transition={{ duration: 2, ease: "easeOut", delay: i * 0.15 }}
                                            className="h-full bg-gradient-to-r from-[#00A896] to-sky-400" />
                                    </div>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </div>
            </section>


            {/* ══════════════════════════════════════════════════════════════
                SIMULADOR FISCAL INTERACTIVO
            ══════════════════════════════════════════════════════════════ */}
            <section className={`py-24 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-12">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Diagnóstico Rápido</div>
                            <h2 className={`text-4xl md:text-6xl font-editorial tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                SIMULA TU <br />
                                <span className="text-shimmer-elite">PERFIL TRIBUTARIO</span>
                            </h2>
                            <p className={`text-lg font-light max-w-xl mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                Descubre tu régimen del SRI y encuentra el plan ideal de forma instantánea.
                            </p>
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <SpotlightCard theme={theme} className="glass-premium-2 shadow-2xl relative">
                            {/* Archive Scan Effect */}
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-scan pointer-events-none" />
                            
                            <div className="p-8 md:p-12">
                                <div className="flex flex-col md:flex-row gap-8 items-stretch justify-between">
                                    {/* Left Controls */}
                                    <div className="flex-1 space-y-6">
                                        {/* Activity Select */}
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left pl-2">Tipo de Actividad Económica</label>
                                            <div className={`grid grid-cols-3 gap-2 p-1.5 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                                {[
                                                    { id: 'comercial', label: 'Comercio / RIMPE', icon: LucideIcons.Store },
                                                    { id: 'profesional', label: 'Serv. Profesional', icon: LucideIcons.User },
                                                    { id: 'discapacidad_3ra_edad', label: '3ra Edad / IVA', icon: LucideIcons.Heart }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setCalcActividad(opt.id as any)}
                                                        className={`py-3 px-2 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
                                                            calcActividad === opt.id 
                                                                ? 'bg-[#00A896] text-white shadow-lg' 
                                                                : `${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`
                                                        }`}
                                                    >
                                                        <opt.icon size={16} />
                                                        <span className="truncate w-full text-center">{opt.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Income Slider */}
                                        {calcActividad !== 'discapacidad_3ra_edad' && (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                                                    <span>Ingresos Anuales Estimados</span>
                                                    <span className="text-emerald-400 font-mono text-xs">${calcIngresos.toLocaleString()}</span>
                                                </div>
                                                <div className="relative py-2">
                                                    <input
                                                        type="range"
                                                        min="1000"
                                                        max="350000"
                                                        step="5000"
                                                        value={calcIngresos}
                                                        onChange={e => setCalcIngresos(parseInt(e.target.value, 10))}
                                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00A896]"
                                                    />
                                                    <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-2 px-1">
                                                        <span>$1k</span>
                                                        <span>$20k (Popular)</span>
                                                        <span>$300k (Emprendedor)</span>
                                                        <span>$350k+</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Vertical Divider */}
                                    <div className={`hidden md:block w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />

                                    {/* Right Recommendation Result */}
                                    <div className="flex-1 flex flex-col justify-between text-left space-y-6">
                                        <div className="space-y-2">
                                            <div className="text-[9px] font-bold text-[#00A896] uppercase tracking-[0.25em]">Régimen Detectado</div>
                                            <div className={`text-2xl font-editorial tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{recommendation.regimen}</div>
                                            <p className={`text-xs font-light leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{recommendation.description}</p>
                                        </div>
                                        
                                        <div className={`flex items-center gap-4 p-4 px-6 rounded-2xl border w-full justify-between
                                            ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200/80 shadow-inner'}`}>
                                            <div className="text-left">
                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Plan Sugerido</div>
                                                <div className={`text-sm font-semibold truncate max-w-[150px] ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{recommendation.planTitle}</div>
                                                <div className="text-base font-mono font-bold text-emerald-500">${recommendation.price}</div>
                                            </div>
                                            <a
                                                href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20he%20realizado%20la%20simulaci%C3%B3n%20en%20el%20sitio%20web%20y%20me%20recomienda%20el%20plan%20*${encodeURIComponent(recommendation.planTitle)}*%20(${encodeURIComponent(recommendation.regimen)}).%20Quisiera%20agendar%20una%20consulta.`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-5 py-3 rounded-xl bg-[#00A896] hover:bg-teal-600 text-white font-bold text-[10px] uppercase tracking-wider transition-all shadow-md shadow-teal-500/20 hover:scale-105"
                                            >
                                                Consultar Plan
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>
                    </Reveal>
                </div>
            </section>


            {/* ══════════════════════════════════════════════════════════════
                CALENDARIO TRIBUTARIO INTERACTIVO POR RUC
            ══════════════════════════════════════════════════════════════ */}
            <section id="calendario-ruc" className={`py-24 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-100'}`}>
                <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-12">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Obligaciones al Día</div>
                            <h2 className={`text-4xl md:text-6xl font-editorial tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                CALENDARIO SRI <br />
                                <span className="text-shimmer-elite">PERSONALIZADO</span>
                            </h2>
                            <p className={`text-lg font-light max-w-xl mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                Selecciona el noveno dígito de tu RUC o Cédula y obtén tus fechas límites mensuales exactas.
                            </p>
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <SpotlightCard theme={theme} className="glass-premium-2 shadow-2xl relative">
                            <div className="p-8 md:p-12">
                                <div className="space-y-8">
                                    {/* Selector de dígitos */}
                                    <div className="space-y-4 text-center">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecciona el Noveno Dígito de tu Identificación</label>
                                        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit => (
                                                <button
                                                    key={digit}
                                                    onClick={() => setSelectedRucDigit(digit)}
                                                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono text-base font-bold transition-all hover:scale-105 active:scale-95
                                                        ${selectedRucDigit === digit
                                                            ? 'bg-[#00A896] text-white shadow-lg shadow-teal-500/30'
                                                            : `${theme === 'dark' ? 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`
                                                        }`}
                                                >
                                                    {digit}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Línea de tiempo y resultados */}
                                    <div className={`p-6 md:p-8 rounded-3xl border text-left
                                        ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-white border-slate-200/80 shadow-md'}`}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                            <div>
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[9px] font-bold uppercase tracking-widest mb-4">
                                                    <LucideIcons.AlertTriangle size={10} /> Fechas Límites Mensuales
                                                </div>
                                                <h4 className={`text-2xl font-editorial tracking-tight mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                                    Vence el día <span className="text-[#00A896]">{deadline.day}</span> de cada mes
                                                </h4>
                                                <p className={`text-xs font-light leading-relaxed mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    Si el día de vencimiento cae en fin de semana o feriado, la fecha límite se traslada al siguiente día hábil de acuerdo a la normativa del SRI.
                                                </p>
                                                <div className="flex gap-2">
                                                    <a
                                                        href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20mi%20RUC%20termina%20en%20d%C3%ADgito%20${selectedRucDigit}%20y%20vence%20el%20${deadline.day}%20de%20cada%20mes.%20Quisiera%20asesoramiento%20tributario.`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00A896] hover:bg-teal-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105"
                                                    >
                                                        <LucideIcons.CalendarClock size={12} /> Agendar Recordatorios
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Visual Timeline Animation */}
                                            <div className="relative h-44 flex flex-col justify-between py-2 border-l-2 border-slate-700/30 pl-6">
                                                <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-[#00A896] to-transparent pointer-events-none" />
                                                
                                                <div className="relative group">
                                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-[#00A896] border-4 border-[#020617] transition-all" />
                                                    <div className="text-[9px] font-bold text-[#00A896] uppercase tracking-wider">Inicio del Mes</div>
                                                    <p className="text-[10px] text-slate-500 font-light mt-0.5">Emisión de comprobantes y recolección de facturas de compras.</p>
                                                </div>
                                                
                                                <div className="relative group">
                                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-amber-500 border-4 border-[#020617] animate-pulse" />
                                                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Día {deadline.day} del mes</div>
                                                    <p className="text-[10px] text-slate-500 font-light mt-0.5">Fecha límite improrrogable para enviar declaración de IVA y Retenciones.</p>
                                                </div>
                                                
                                                <div className="relative group">
                                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-red-600 border-4 border-[#020617]" />
                                                    <div className="text-[9px] font-bold text-red-600 uppercase tracking-wider">A partir del día {deadline.day + 1}</div>
                                                    <p className="text-[10px] text-slate-500 font-light mt-0.5">Generación automática de multas por declaración tardía (SRI).</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>
                    </Reveal>
                </div>
            </section>


            {/* ══════════════════════════════════════════════════════════════
                BENTO GRID – SERVICIOS
            ══════════════════════════════════════════════════════════════ */}
            <section id="servicios" className={`py-36 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                            <div className="max-w-2xl text-left">
                                <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Suite de Servicios</div>
                                <h2 className={`text-4xl md:text-7xl font-editorial tracking-tighter mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                    SOLUCIONES DE <br />
                                    <span className="text-shimmer-elite">ALTO IMPACTO</span>
                                </h2>
                                <p className={`text-lg font-light ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Cada servicio está diseñado para la <span className={`${theme === 'dark' ? 'text-white' : 'text-slate-905'} font-medium`}>máxima eficiencia operativa</span> y blindaje fiscal.
                                </p>
                            </div>
                            <div className="hidden md:block text-right">
                                <span className={`text-6xl font-editorial block leading-none ${theme === 'dark' ? 'text-white/8' : 'text-slate-300/30'}`}>2026</span>
                                <span className="text-[10px] font-bold text-[#00A896] tracking-[0.3em] uppercase">Ecosistema Fiscal</span>
                            </div>
                        </div>
                    </Reveal>

                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Feature card large */}
                        <StaggerItem className="md:col-span-2">
                            <SpotlightCard theme={theme} className="interactive-card h-full">
                                <div className="flex flex-col h-full justify-between p-10 min-h-[440px] text-left">
                                    <div>
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-900/50 flex items-center justify-center mb-8 shadow-lg shadow-[#00A896]/20">
                                            <LucideIcons.BarChart3 className="text-white" size={28} />
                                        </div>
                                        <h3 className={`text-3xl md:text-5xl font-editorial tracking-tight mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>OPTIMIZACIÓN FISCAL</h3>
                                        <p className={`text-lg leading-relaxed max-w-xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                            Analizamos cada variable de su estructura financiera para maximizar deducciones legales y eliminar pagos en exceso con precisión quirúrgica.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 text-[#00A896] font-bold text-xs uppercase tracking-widest group/link cursor-pointer" onClick={onNavigateToServices}>
                                        <span>Ver Detalles</span>
                                        <LucideIcons.ArrowUpRight size={16} className="group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                                    </div>
                                </div>
                            </SpotlightCard>
                        </StaggerItem>

                        <StaggerItem>
                            <SpotlightCard theme={theme} className="interactive-card h-full">
                                <div className="flex flex-col h-full p-10 min-h-[440px] text-left">
                                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                                        <LucideIcons.ShieldCheck className="text-[#00A896]" size={28} />
                                    </div>
                                    <h3 className={`text-3xl font-editorial tracking-tight mb-4 uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Blindaje Jurídico</h3>
                                    <p className={`leading-relaxed mb-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Defensa técnica ante entes de control. Integridad patrimonial garantizada frente a auditorías del SRI.
                                    </p>
                                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        <span>Disponibilidad</span>
                                        <span className="text-[#00A896]">Inmediata</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </StaggerItem>

                        <StaggerItem>
                            <SpotlightCard theme={theme} className="interactive-card h-full">
                                <div className="flex flex-col h-full p-10 min-h-[360px] text-left">
                                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                                        <LucideIcons.Zap className="text-yellow-400" size={26} />
                                    </div>
                                    <h3 className={`text-3xl font-editorial tracking-tight mb-4 uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Gestión Turbo</h3>
                                    <p className={`leading-relaxed text-base ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Declaraciones automatizadas, reportes mensuales en tiempo real. Nunca más venza plazos.
                                    </p>
                                </div>
                            </SpotlightCard>
                        </StaggerItem>

                        <StaggerItem className="md:col-span-2">
                            <SpotlightCard theme={theme} className="interactive-card overflow-hidden h-full">
                                <div className="flex flex-col md:flex-row h-full">
                                    <div className="flex-1 p-10 flex flex-col justify-center text-left">
                                        <h3 className={`text-3xl md:text-5xl font-editorial tracking-tight mb-4 uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Consultoría Estratégica</h3>
                                        <p className={`text-lg font-light leading-relaxed mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                            Sesiones ejecutivas para diseñar rutas de crecimiento bajo marcos fiscales eficientes y conformes con la ley.
                                        </p>
                                        <MagneticButton onClick={onNavigateToServices}>
                                            <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-colors
                                                ${theme === 'dark' ? 'bg-white text-black hover:bg-[#00A896] hover:text-white' : 'bg-slate-900 text-white hover:bg-[#00A896]'}`}>
                                                <LucideIcons.Calendar size={14} />
                                                Agendar Sesión
                                            </div>
                                        </MagneticButton>
                                    </div>
                                    <div className={`flex-1 p-10 flex items-center justify-center border-l relative min-h-[200px] ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="absolute inset-0 tactical-grid opacity-20" />
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-[#00A896]/20 blur-3xl rounded-full" />
                                            <LucideIcons.Globe className={`relative z-10 ${theme === 'dark' ? 'text-white/15' : 'text-slate-900/10'}`} size={140} />
                                        </div>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </StaggerItem>

                        {/* Firma Electrónica */}
                        <StaggerItem>
                            <SpotlightCard theme={theme} className="interactive-card h-full">
                                <div className="flex flex-col h-full p-10 min-h-[300px] justify-between text-left">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                            <LucideIcons.FileKey className="text-purple-400" size={22} />
                                        </div>
                                        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full uppercase tracking-wider">Digital</span>
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-editorial tracking-tight mb-3 uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Firma Electrónica</h3>
                                        <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Token .P12 válido para SRI, Quipux y todos los trámites legales.</p>
                                    </div>
                                    <div className={`mt-6 pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                                        <span className={`text-2xl font-editorial ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>${serviceFees?.customPunctualServices?.find((s: any) => s.id === 'firma-electronica')?.price?.toString() || "35"}</span>
                                        <span className="text-slate-500 text-xs ml-2 uppercase tracking-wider">vigencia 1 año</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </StaggerItem>

                        {/* Devolución IVA */}
                        <StaggerItem>
                            <SpotlightCard theme={theme} className="interactive-card h-full">
                                <div className="flex flex-col h-full p-10 min-h-[300px] justify-between text-left">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                            <LucideIcons.DollarSign className="text-emerald-400" size={22} />
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider">Recuperación</span>
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-editorial tracking-tight mb-3 uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Devolución IVA</h3>
                                        <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Para 3ra Edad y Discapacidad. Recupere su IVA mensual garantizado.</p>
                                    </div>
                                    <div className={`mt-6 pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                                        <button onClick={onNavigateToServices} className="text-[#00A896] text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                                            Ver precio <LucideIcons.ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </StaggerItem>
                    </StaggerContainer>

                    <Reveal delay={200}>
                        <div className="mt-12 text-center">
                            <MagneticButton onClick={onNavigateToServices}>
                                <div className={`inline-flex items-center gap-3 px-10 py-5 border rounded-full text-sm font-medium hover:border-[#00A896]/50 hover:bg-[#00A896]/5 transition-all duration-500
                                    ${theme === 'dark' ? 'border-white/15 text-white' : 'border-slate-200 text-slate-700'}`}>
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
            <section id="sobre-mi" className={`py-36 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-[#00A896]/8 rounded-full blur-[200px] -translate-y-1/2 pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        {/* Left: Profile card */}
                        <Reveal>
                            <div className="relative">
                                {/* Main profile card */}
                                <div className={`relative border rounded-[2.5rem] p-10 overflow-hidden transition-all duration-500
                                    ${theme === 'dark' ? 'bg-white/5 border-white/10 glass-premium-2' : 'bg-white border-slate-200 shadow-xl'}`}>
                                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00A896]/60 to-transparent" />
                                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-[#00A896]/10 rounded-full blur-2xl" />

                                    {/* Avatar */}
                                    <div className="flex items-center gap-6 mb-10 text-left">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#00A896] to-[#005F56] flex items-center justify-center shadow-[0_0_40px_rgba(0,168,150,0.3)]">
                                                <span className="text-4xl font-editorial text-white">SC</span>
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#00A896] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,168,150,0.5)]">
                                                <LucideIcons.Check size={14} className="text-white" strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className={`text-2xl font-editorial tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>SANTIAGO CÓRDOVA</h3>
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
                                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                                <cred.icon size={14} className="text-[#00A896] flex-shrink-0" />
                                                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{cred.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* WhatsApp CTA inside card */}
                                    <a href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quiero%20una%20consulta%20gratuita.`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-3 w-full py-4 bg-[#00A896] text-white rounded-2xl font-bold text-sm hover:bg-[#009486] transition-all duration-300 shadow-[0_8px_30px_rgba(0,168,150,0.35)] hover:shadow-[0_12px_40px_rgba(0,168,150,0.5)]">
                                        <LucideIcons.MessageCircle size={18} />
                                        Agendar Consulta Gratuita
                                    </a>
                                </div>

                                {/* Floating stats */}
                                <div className={`absolute -bottom-6 -right-6 border rounded-2xl px-6 py-4 shadow-xl hidden md:block transition-all duration-500
                                    ${theme === 'dark' ? 'bg-[#020617] border-white/10 glass-premium-2' : 'bg-white border-slate-200'}`}>
                                    <div className="text-3xl font-editorial text-[#00A896]">$1.2M+</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">en ahorro para clientes</div>
                                </div>
                            </div>
                        </Reveal>

                        {/* Right: Bio + process */}
                        <Reveal delay={150}>
                            <div className="text-left">
                                <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Sobre mí</div>
                                <h2 className={`text-4xl md:text-6xl font-editorial tracking-tighter mb-8 leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                    EXPERTO EN<br />
                                    <span className="text-shimmer-elite">SOLUCIONES</span><br />
                                    TRIBUTARIAS
                                </h2>
                                <p className={`text-lg font-light leading-relaxed mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Soy <strong className={`${theme === 'dark' ? 'text-white' : 'text-slate-900'} font-semibold`}>Santiago Córdova</strong>, Ingeniero en Ciencias Empresariales con más de una década dedicada a la asesoría fiscal y tributaria en Ecuador.
                                </p>
                                <p className={`text-base font-light leading-relaxed mb-10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Mi misión es simple: que usted pague solo lo que <span className={`${theme === 'dark' ? 'text-white' : 'text-slate-900'} font-medium border-b border-[#00A896]`}>la ley exige</span>, ni un centavo más. He trabajado con emprendedores, profesionales independientes y empresas del sector comercial e industrial, logrando optimizaciones fiscales de hasta el 40%.
                                </p>

                                {/* Specializations */}
                                <div className="flex flex-wrap gap-2">
                                    {["RIMPE Popular", "RIMPE Emprendedor", "Régimen General", "Devolución IVA", "Renta Personas Naturales", "Agente de Retención", "Firma Electrónica", "Contabilidad Mensual"].map(tag => (
                                        <span key={tag} className={`px-4 py-2 rounded-full border text-xs transition-all duration-300 cursor-default
                                            ${theme === 'dark' 
                                                ? 'border-white/10 text-slate-400 bg-white/5 hover:border-[#00A896]/50 hover:text-[#00A896]' 
                                                : 'border-slate-200 text-slate-600 bg-white hover:border-[#00A896]/50 hover:text-[#00A896] hover:shadow-sm'
                                            }`}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>


            {/* ─── WORK PROCESS ─── */}
            <section className={`py-36 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-100'}`}>
                <div className="absolute inset-0 bg-dot-matrix opacity-10" />
                <div className="absolute right-0 top-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[180px] pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
                        <Reveal>
                            <div className="text-left">
                                <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Metodología</div>
                                <h2 className={`text-4xl md:text-6xl font-editorial tracking-tighter mb-8 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                    CÓMO<br />
                                    <span className="text-shimmer-elite">TRABAJAMOS</span>
                                </h2>
                                <p className={`text-lg font-light leading-relaxed mb-10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Un proceso claro, transparente y orientado a resultados. Desde la consulta inicial hasta la gestión continua de su situación fiscal.
                                </p>
                                <MagneticButton onClick={onNavigateToServices}>
                                    <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-medium transition-all duration-500 border
                                        ${theme === 'dark' 
                                            ? 'bg-white/5 border-white/10 text-white hover:border-[#00A896]/50 hover:bg-[#00A896]/10' 
                                            : 'bg-white border-slate-200 text-slate-700 hover:border-[#00A896]/50 hover:bg-slate-50 shadow-sm'
                                        }`}>
                                        <LucideIcons.Play size={14} className="text-[#00A896]" />
                                        Iniciar el Proceso
                                    </div>
                                </MagneticButton>
                            </div>
                        </Reveal>

                        <div className="space-y-10 text-left">
                            <ProcessStep theme={theme} number="1" title="Diagnóstico Gratuito" icon={LucideIcons.Search}
                                description="Evaluamos su situación tributaria actual sin costo. Identificamos riesgos, oportunidades de ahorro y el régimen óptimo para su actividad." delay={50} />
                            <div className="w-[1px] h-8 bg-gradient-to-b from-[#00A896]/50 to-transparent ml-7" />
                            <ProcessStep theme={theme} number="2" title="Plan Personalizado" icon={LucideIcons.FileText}
                                description="Diseñamos una hoja de ruta fiscal a medida. Calendarios de obligaciones, estrategia de deducciones y cronograma de gestiones." delay={150} />
                            <div className="w-[1px] h-8 bg-gradient-to-b from-[#00A896]/50 to-transparent ml-7" />
                            <ProcessStep theme={theme} number="3" title="Ejecución Experta" icon={LucideIcons.Zap}
                                description="Tramitamos, declaramos y gestionamos todo ante el SRI. Usted recibe reportes claros y tranquilidad total." delay={250} />
                            <div className="w-[1px] h-8 bg-gradient-to-b from-[#00A896]/50 to-transparent ml-7" />
                            <ProcessStep theme={theme} number="4" title="Seguimiento Continuo" icon={LucideIcons.RefreshCw}
                                description="Monitoreo permanente de su cuenta en el SRI. Alertas preventivas y asesoría proactiva para que nunca sea sorprendido." delay={350} />
                        </div>
                    </div>
                </div>
            </section>


            {/* ══════════════════════════════════════════════════════════════
                TESTIMONIALES
            ══════════════════════════════════════════════════════════════ */}
            <section className={`py-36 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00A896]/5 rounded-full blur-[200px] pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-20">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Testimonios</div>
                            <h2 className={`text-4xl md:text-7xl font-editorial tracking-tighter mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                LO QUE DICEN<br />
                                <span className="text-shimmer-elite">MIS CLIENTES</span>
                            </h2>
                            <p className={`text-lg font-light max-w-xl mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                Resultados reales de personas y empresas que confiaron su patrimonio a nuestro equipo.
                            </p>
                        </div>
                    </Reveal>

                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                        <TestimonialCard theme={theme} delay={0}
                            quote="Santiago Córdova me ayudó a regularizar 3 años de obligaciones pendientes con el SRI sin ninguna multa. Su conocimiento es extraordinario y la atención es personalizada."
                            name="María José L." role="Comerciante · Pasaje, El Oro" />
                        <TestimonialCard theme={theme} delay={100}
                            quote="Gracias a su asesoría en el régimen RIMPE, ahorro más del 30% en mis obligaciones tributarias cada año. Totalmente recomendado para cualquier emprendedor."
                            name="Carlos Ramos" role="Emprendedor · Machala, El Oro" />
                        <TestimonialCard theme={theme} delay={200}
                            quote="La devolución del IVA para mi madre de la tercera edad fue gestionada en tiempo récord. Proceso impecable, transparente y con resultados garantizados."
                            name="Andrea Vásquez" role="Particular · Santa Rosa, El Oro" />
                        <TestimonialCard theme={theme} delay={80}
                            quote="Llevamos 4 años con Santiago Córdova y es el mejor asesor tributario que he tenido. Siempre disponible, proactivo y con soluciones innovadoras."
                            name="Roberto Espinoza" role="Ingeniero Civil · Independiente" />
                        <TestimonialCard theme={theme} delay={180}
                            quote="Recibí mi firma electrónica el mismo día y pude comenzar a facturar inmediatamente. Un servicio rápido, profesional y completamente digital."
                            name="Diana Torres" role="Profesional Independiente" />
                        <TestimonialCard theme={theme} delay={280}
                            quote="La optimización de mi nómina y retenciones me generó un ahorro significativo. Su análisis financiero es detallado y altamente confiable."
                            name="Luis Morales" role="Director · PyME Comercial" />
                    </StaggerContainer>

                    {/* Rating summary */}
                    <Reveal delay={300}>
                        <div className={`mt-16 flex flex-col md:flex-row items-center justify-center gap-8 p-8 border rounded-3xl max-w-2xl mx-auto transition-all duration-500
                            ${theme === 'dark' ? 'border-white/10 bg-white/5 glass-premium-2' : 'border-slate-200 bg-white shadow-md'}`}>
                            <div className="text-center">
                                <div className={`text-6xl font-editorial ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>5.0</div>
                                <div className="flex gap-1 justify-center mt-2">
                                    {[...Array(5)].map((_, i) => <LucideIcons.Star key={i} size={16} className="text-[#d4af37] fill-[#d4af37]" />)}
                                </div>
                                <div className="text-slate-500 text-xs mt-2 uppercase tracking-wider">Calificación promedio</div>
                            </div>
                            <div className="w-[1px] h-16 bg-white/10 hidden md:block" />
                            <div className="text-center md:text-left">
                                <div className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Basado en +100 reseñas</div>
                                <div className="text-slate-400 text-sm font-light">Google · Facebook · Referencias directas</div>
                                <div className="text-[#00A896] text-xs mt-2 font-bold uppercase tracking-wider">✓ Verificados y auténticos</div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>


            {/* ══════════════════════════════════════════════════════════════
                RECURSOS / FAQ CON BÚSQUEDA Y FILTROS
            ══════════════════════════════════════════════════════════════ */}
            <section id="recursos" className={`py-36 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-100'}`}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-[#00A896]/8 rounded-full blur-[200px] pointer-events-none" />
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-12">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] mb-5">— Base de Conocimiento</div>
                            <h2 className={`text-4xl md:text-7xl font-editorial tracking-tighter mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                PREGUNTAS<br />
                                <span className="text-shimmer-elite">FRECUENTES</span>
                            </h2>
                            <p className={`text-lg font-light ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Desmitificando la complejidad fiscal con precisión y claridad.</p>
                        </div>
                    </Reveal>

                    {/* FAQ Filter and Search Panel */}
                    <Reveal delay={50}>
                        <div className="mb-10 space-y-4">
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 bg-opacity-45 shadow-inner backdrop-blur-xl">
                                <LucideIcons.Search className="text-slate-400 flex-shrink-0" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar pregunta o respuesta fiscal..."
                                    value={faqSearch}
                                    onChange={e => setFaqSearch(e.target.value)}
                                    className={`w-full bg-transparent border-none outline-none text-sm font-light ${theme === 'dark' ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
                                />
                                {faqSearch && (
                                    <button onClick={() => setFaqSearch("")} className="text-slate-400 hover:text-white">
                                        <LucideIcons.X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Categorías chips */}
                            <div className="flex flex-wrap gap-2 justify-center">
                                {faqCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setFaqCategory(cat)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300
                                            ${faqCategory === cat
                                                ? 'bg-[#00A896] text-white shadow-lg shadow-teal-500/20'
                                                : `${theme === 'dark' ? 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Reveal>

                    {/* FAQ items lists */}
                    <StaggerContainer className="space-y-4 text-left">
                        {filteredFaqs.length > 0 ? (
                            filteredFaqs.map((faq, i) => (
                                <FaqItem 
                                    key={faq.question + i} 
                                    theme={theme} 
                                    delay={i * 50} 
                                    category={faq.category} 
                                    question={faq.question} 
                                    answer={faq.answer} 
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-500 font-light text-sm">
                                <LucideIcons.HelpCircle className="mx-auto text-slate-400 mb-3" size={32} />
                                No se encontraron respuestas para tu búsqueda. Prueba con otras palabras clave.
                            </div>
                        )}
                    </StaggerContainer>
                </div>
            </section>


            {/* ══════════════════════════════════════════════════════════════
                CTA FINAL
            ══════════════════════════════════════════════════════════════ */}
            <section id="contacto" className={`py-36 px-6 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <div className="absolute inset-0 tactical-grid opacity-15 pointer-events-none" />
                <Reveal>
                    <div className="max-w-6xl mx-auto relative group/cta">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#00A896] via-sky-500 to-purple-600 rounded-[4rem] blur-3xl opacity-15 group-hover/cta:opacity-35 transition-opacity duration-1000 animate-slow-pan" />
                        <div className={`relative border rounded-[4rem] p-14 md:p-28 text-center overflow-hidden transition-all duration-500
                            ${theme === 'dark' ? 'bg-black/50 border-white/10 glass-premium-2' : 'bg-white border-slate-200/80 shadow-2xl'}`}>
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-scan" />

                            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[#00A896]/30 bg-[#00A896]/5 mb-10">
                                <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_8px_#00A896]" />
                                <span className="text-[11px] font-bold text-[#00A896] uppercase tracking-[0.35em]">Consulta gratuita sin compromiso</span>
                            </div>

                            <h2 className={`text-5xl md:text-8xl lg:text-[8rem] font-editorial tracking-tighter mb-10 leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                HABLEMOS<br />
                                <span className="text-shimmer-elite">HOY MISMO.</span>
                            </h2>
                            <p className={`text-xl md:text-2xl font-light mb-14 max-w-2xl mx-auto text-balance ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                Su tranquilidad fiscal comienza con una sola consulta. Sin costos ocultos. Sin compromisos. Solo resultados.
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-6 items-center">
                                <MagneticButton href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quiero%20agendar%20una%20consulta%20tributaria%20gratuita.`} target="_blank" rel="noreferrer">
                                    <div className="group relative px-12 py-6 bg-white text-black rounded-full font-bold text-xs uppercase tracking-[0.3em] overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.25)] hover:shadow-[#00A896]/50 transition-all duration-700">
                                        <div className="absolute inset-0 bg-[#00A896] transform translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                        <span className="relative z-10 group-hover:text-white flex items-center gap-3">
                                            <LucideIcons.MessageCircle size={20} /> WhatsApp Ahora
                                        </span>
                                    </div>
                                </MagneticButton>
                                <div className={`flex items-center gap-3 text-slate-500 text-[11px] font-bold uppercase tracking-[0.4em] px-8 py-6 border rounded-full backdrop-blur-md hover:border-[#00A896]/40 hover:text-[#00A896] transition-all duration-500 cursor-default group
                                    ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white shadow-sm'}`}>
                                    <LucideIcons.MapPin size={18} className="text-[#00A896] group-hover:scale-110 transition-transform" />
                                    Pasaje, El Oro · Ecuador
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className={`mt-14 pt-10 border-t flex flex-col md:flex-row justify-center gap-10 text-xs text-slate-500 uppercase tracking-widest ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
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


            {/* ── NEWS AND LEAD MAGNET ── */}
            <NewsSection theme={theme} onReadNews={(item) => setSelectedNews(item)} />
            <LeadMagnetBanner phoneNumber={phoneNumber} theme={theme} />


            {/* ══════════════════════════════════════════════════════════════
                FOOTER (Premium and Elegant Dark Footer always for contrast)
            ══════════════════════════════════════════════════════════════ */}
            <footer className="border-t border-white/5 py-20 bg-[#020617] relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-14 mb-16">
                        <div className="md:col-span-2 text-left">
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

                        <div className="text-left">
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

                        <div className="text-left">
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
                            © 2026 · <span className="text-[#00A896]">SANTIAGO CÓRDOVA</span> · Todos los derechos reservados
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
            <WhatsAppWidget phoneNumber={phoneNumber} />
        </div>
    );
};
