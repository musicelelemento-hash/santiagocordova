import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight,
    Award, BarChart3, Calculator, Calendar, CalendarClock, Check, CheckCircle2, ChevronDown,
    Clock, DollarSign, Download, ExternalLink, FileKey, FileSpreadsheet, FileText, Fingerprint, Globe,
    GraduationCap, Grid, Heart, HelpCircle, Home, Layers, Lock,
    MapPin, Menu, MessageCircle, Moon, Phone, Play, RefreshCw,
    Search, Shield, ShieldAlert, ShieldCheck, Sparkles, Star, Store, Sun,
    TrendingUp, User, UserCheck, Users, X, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import { PublicUser } from '../types';
import { useAppStore } from '../store/useAppStore';
import { validarIdentificacionEcuatoriana } from '../utils/sriCalculators';
import { Scroll3DCanvas } from '../components/3d/Scroll3DCanvas';

interface LandingPageProps {
    onAdminAccess: () => void;
    onNavigateToServices: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
    theme?: 'light' | 'dark';
    toggleTheme?: () => void;
}

// ─── MAGNETIC BUTTON (Pointer Responsive with 3D Float) ──────────────────────
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
        setPosition({ x: (clientX - (left + width / 2)) * 0.2, y: (clientY - (top + height / 2)) * 0.2 });
    };
    const content = (
        <div ref={btnRef} onMouseMove={handleMouseMove} onMouseLeave={() => setPosition({ x: 0, y: 0 })}
            style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
            className={`transition-transform duration-200 ease-out ${className}`} onClick={onClick}>
            {children}
        </div>
    );
    if (href) return <a href={href} target={target} rel={rel} className="block">{content}</a>;
    return content;
};

// ─── HARDWARE-ACCELERATED CUSTOM CURSOR ──────────────────────────────────────
const CustomCursor = () => {
    const cursorRef = React.useRef<HTMLDivElement>(null);
    const dotRef = React.useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = React.useState(false);
    
    React.useEffect(() => {
        let rafId: number;
        const moveCursor = (e: MouseEvent) => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                if (cursorRef.current && dotRef.current) {
                    const x = e.clientX;
                    const y = e.clientY;
                    cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                    dotRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                }
            });
        };
        const handleOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target) {
                setIsHovering(!!target.closest('button, a, .interactive-card, .touch-scale, input, select'));
            }
        };
        window.addEventListener('mousemove', moveCursor, { passive: true });
        window.addEventListener('mouseover', handleOver, { passive: true });
        return () => { 
            cancelAnimationFrame(rafId);
            window.removeEventListener('mousemove', moveCursor); 
            window.removeEventListener('mouseover', handleOver); 
        };
    }, []);

    return (
        <>
            <div ref={cursorRef} className={`custom-cursor hidden md:block ${isHovering ? 'cursor-hovering' : ''}`} style={{ willChange: 'transform' }} />
            <div ref={dotRef} className="custom-cursor-dot hidden md:block" style={{ willChange: 'transform' }} />
        </>
    );
};

// ─── SCROLL PROGRESS BAR (Self-contained, zero parent re-renders) ─────────────
const ScrollProgressBar = () => {
    const barRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    if (barRef.current) {
                        const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
                        const pct = totalScroll > 0 ? (window.scrollY / totalScroll) * 100 : 0;
                        barRef.current.style.width = `${pct}%`;
                    }
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="w-full max-w-6xl h-[2px] bg-white/10 mb-3 rounded-full overflow-hidden">
            <div ref={barRef} className="h-full bg-gradient-to-r from-[#00A896] via-[#2B6AFF] to-[#C9A96E] transition-all duration-75 origin-left" style={{ width: '0%' }} />
        </div>
    );
};

// ─── TACTICAL GRID ───────────────────────────────────────────────────────────
const TacticalGrid = () => <div className="fixed inset-0 tactical-grid pointer-events-none z-[1] opacity-35" />;

// ─── AURORA BACKGROUND ───────────────────────────────────────────────────────
const AuroraBackground = ({ theme = 'dark' }: { theme?: 'light' | 'dark' }) => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -inset-[10px] ${theme === 'dark' ? 'opacity-50' : 'opacity-30'}`}>
            <div className="aurora-blob bg-[#00A896]/25 top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full animate-float" />
            <div className="aurora-blob bg-[#2B6AFF]/20 bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full animate-float-delayed" />
            <div className="aurora-blob bg-[#C9A96E]/15 top-[20%] right-[10%] w-[40%] h-[40%] rounded-full animate-float" style={{ animationDelay: '-4s' }} />
        </div>
    </div>
);

// ─── HIGH-FPS REVEAL ON SCROLL ───────────────────────────────────────────────
const Reveal = ({ children, className = "", delay = 0, yOffset = 20 }: { children: React.ReactNode; className?: string; delay?: number; yOffset?: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: yOffset }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-6% 0px" }}
            transition={{ 
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
                delay: delay / 1000 
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

// ─── SPOTLIGHT CARD (Luminous Glass 2.0 with 3D Hover Tilt) ──────────────────
const SpotlightCard = ({ children, className = "", theme = 'dark' }: { children: React.ReactNode; className?: string; theme?: 'light' | 'dark' }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
    const [opacity, setOpacity] = useState(0);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPosition({ x, y });
        setOpacity(1);

        const rx = ((y / rect.height) - 0.5) * -4;
        const ry = ((x / rect.width) - 0.5) * 4;
        setTilt({ rx, ry });
    };

    const handleMouseLeave = () => {
        setOpacity(0);
        setTilt({ rx: 0, ry: 0 });
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transition: 'transform 0.2s ease-out'
            }}
            className={`relative rounded-[2rem] border overflow-hidden transition-colors duration-300 ${
                theme === 'dark' 
                    ? 'bg-[#051424]/85 border-white/10 text-white shadow-2xl backdrop-blur-xl hover:border-[#00A896]/40' 
                    : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl shadow-slate-900/5 backdrop-blur-md hover:border-[#00A896]/50'
            } ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 z-10"
                style={{
                    opacity,
                    background: `radial-gradient(450px circle at ${position.x}px ${position.y}px, rgba(0, 168, 150, 0.18), transparent 80%)`,
                }}
            />
            {children}
        </div>
    );
};

// ─── AUTHORITY TICKER ────────────────────────────────────────────────────────
const AuthorityTicker = ({ theme = 'dark' }: { theme?: 'light' | 'dark' }) => {
    const items = [
        "INGENIERÍA TRIBUTARIA DE ALTO NIVEL",
        "CONTROL TOTAL SRI 2026",
        "TU TRANQUILIDAD FISCAL GARANTIZADA",
        "FIRMAS ELECTRÓNICAS .P12 EN 24 HORAS",
        "BLINDAJE ANTE GLOSAS Y CLAUSURAS",
        "DEVOLUCIÓN DE IVA ADULTO MAYOR",
        "AUTOMATIZACIÓN ALGORÍTMICA NUEVA LUZ 3.0",
        "ATENCIÓN DIRECTA PASAJE · EL ORO"
    ];
    return (
        <div className={`py-3.5 border-y overflow-hidden relative ${theme === 'dark' ? 'bg-[#020617] border-white/10' : 'bg-slate-100 border-slate-200'}`}>
            <div className="flex whitespace-nowrap animate-marquee">
                {[...items, ...items].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-5 mx-5">
                        <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-[#00A896] uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00A896] animate-pulse" />
                            {item}
                        </span>
                        <span className="text-[#C9A96E] text-xs font-mono">✦</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── TRUST BADGE ─────────────────────────────────────────────────────────────
const TrustBadge = ({ icon: Icon, label, value, theme = 'dark' }: { icon: React.ElementType; label: string; value: string; theme?: 'light' | 'dark' }) => (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-md hover:border-[#00A896]/40 hover:bg-[#00A896]/10 transition-all duration-300 group
        ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/90 shadow-sm'}`}>
        <Icon size={16} className="text-[#00A896] group-hover:scale-110 transition-transform" />
        <div>
            <div className={`text-xs font-bold leading-none font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</div>
            <div className="text-slate-400 text-[9px] uppercase tracking-wider mt-0.5 font-sans">{label}</div>
        </div>
    </div>
);

// ─── ECUADORIAN PROVINCE LIST HELPER ──────────────────────────────────────────
const PROVINCES_MAP: Record<string, string> = {
    "01": "Azuay", "02": "Bolívar", "03": "Cañar", "04": "Carchi", "05": "Cotopaxi",
    "06": "Chimborazo", "07": "El Oro (Pasaje / Machala)", "08": "Esmeraldas", "09": "Guayas",
    "10": "Imbabura", "11": "Loja", "12": "Los Ríos", "13": "Manabí", "14": "Morona Santiago",
    "15": "Napo", "16": "Pastaza", "17": "Pichincha (Quito)", "18": "Tungurahua",
    "19": "Zamora Chinchipe", "20": "Galápagos", "21": "Sucumbíos", "22": "Orellana",
    "23": "Santo Domingo", "24": "Santa Elena"
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: LANDING PAGE (Luxury Tier 2026)
// ═══════════════════════════════════════════════════════════════════════════════
export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices, theme = 'dark', toggleTheme }) => {
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState<'top' | 'fases' | 'simulador' | 'multas-sri' | 'calendario-ruc' | 'servicios' | 'faq'>('top');
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showBiometric, setShowBiometric] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const phoneNumber = "593978980722";

    const { serviceFees } = useAppStore();

    // RUC & Calculator states
    const [selectedRucDigit, setSelectedRucDigit] = useState<number | null>(1);
    const [calcRucInput, setCalcRucInput] = useState("");
    const [rucValidationMsg, setRucValidationMsg] = useState<{ 
        type: 'success' | 'error' | 'none'; 
        text: string; 
        province?: string;
        details?: string 
    }>({ type: 'none', text: '' });
    
    // Tax Simulator states
    const [calcIngresos, setCalcIngresos] = useState(18000);
    const [calcActividad, setCalcActividad] = useState<'comercial' | 'profesional' | 'discapacidad_3ra_edad'>('comercial');

    // Penalty / Multas Estimator states
    const [penaltyMeses, setPenaltyMeses] = useState(3);
    const [penaltyType, setPenaltyType] = useState<'sin_ventas' | 'con_ventas'>('con_ventas');
    const [penaltyVentasEst, setPenaltyVentasEst] = useState(1500);

    // FAQ & Testimonials states
    const [faqSearch, setFaqSearch] = useState("");
    const [faqCategory, setFaqCategory] = useState("Todo");
    const [testiCityFilter, setTestiCityFilter] = useState("Todos");

    // Live Modulo 10 Validation & Province Detection
    useEffect(() => {
        const input = calcRucInput.trim();
        if (!input) {
            setRucValidationMsg({ type: 'none', text: '' });
            return;
        }

        if (validarIdentificacionEcuatoriana(input)) {
            const digit = parseInt(input.charAt(8), 10);
            setSelectedRucDigit(digit);

            const provCode = input.substring(0, 2);
            const provinceName = PROVINCES_MAP[provCode] || "Ecuador";
            const thirdDigit = parseInt(input.charAt(2), 10);
            
            let details = "";
            let typeLabel = "";
            
            if (thirdDigit < 6) {
                typeLabel = "Persona Natural";
                details = "Sujeto a régimen RIMPE (Popular si ingresos ≤ $20K, Emprendedor hasta $300K) o Régimen General. Declaraciones semestrales o mensuales.";
            } else if (thirdDigit === 9) {
                typeLabel = "Persona Jurídica (Sociedad Privada)";
                details = "Obligación de llevar contabilidad formal. Declaración mensual obligatoria de IVA, Renta y retenciones en la fuente.";
            } else if (thirdDigit === 6) {
                typeLabel = "Entidad Pública";
                details = "Sujeto a normas de contabilidad gubernamental y retención especial del 100% de IVA en compras públicas.";
            }

            setRucValidationMsg({
                type: 'success',
                text: `✓ Identificación Válida (${typeLabel})`,
                province: provinceName,
                details: details
            });
        } else {
            if (input.length >= 10) {
                setRucValidationMsg({
                    type: 'error',
                    text: "✗ Identificación No Válida",
                    details: "El número no supera el algoritmo de validación del SRI (módulos 10/11) o no tiene el formato ecuatoriano válido."
                });
            } else {
                setRucValidationMsg({ type: 'none', text: '' });
            }
        }
    }, [calcRucInput]);

    // Throttled Scroll Listener (passive + requestAnimationFrame + Active Section Spy)
    useEffect(() => {
        let isScrolledVal = false;
        let ticking = false;

        const sections: { id: 'top' | 'fases' | 'simulador' | 'multas-sri' | 'calendario-ruc' | 'servicios' | 'faq'; el: HTMLElement | null }[] = [
            { id: 'top', el: document.getElementById('top') },
            { id: 'fases', el: document.getElementById('fases') },
            { id: 'simulador', el: document.getElementById('simulador') },
            { id: 'multas-sri', el: document.getElementById('multas-sri') },
            { id: 'calendario-ruc', el: document.getElementById('calendario-ruc') },
            { id: 'servicios', el: document.getElementById('servicios') },
            { id: 'faq', el: document.getElementById('faq') }
        ];

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollYVal = window.scrollY;
                    const nextScrolled = scrollYVal > 50;
                    if (nextScrolled !== isScrolledVal) {
                        isScrolledVal = nextScrolled;
                        setScrolled(nextScrolled);
                    }

                    if (scrollYVal < window.innerHeight * 1.5) {
                        const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
                        const prog = totalScroll > 0 ? (scrollYVal / totalScroll) * 100 : 0;
                        setScrollProgress(prog);
                    }

                    // Section Spy
                    const scrollPos = scrollYVal + window.innerHeight * 0.35;
                    for (let i = sections.length - 1; i >= 0; i--) {
                        const sec = sections[i];
                        if (sec.el && sec.el.offsetTop <= scrollPos) {
                            setActiveSection(sec.id);
                            break;
                        }
                    }

                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleProtectedAccess = () => {
        setShowBiometric(true);
        setTimeout(() => { setShowBiometric(false); onAdminAccess(); }, 2200);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    // Advanced RIMPE 2026 Tax Table Simulation Math
    const calculateDetailedTax = (ingresos: number, actividad: string) => {
        const npPrice = serviceFees?.rentaNP || 50;
        const semPrice = serviceFees?.ivaSemestral || 80;
        const menPrice = (serviceFees?.ivaMensual || 20) * 5;
        const devPrice = serviceFees?.devolucionIva || 30;

        if (actividad === 'discapacidad_3ra_edad') {
            return {
                regimen: "Grupos Prioritarios (SRI)",
                planTitle: "Devolución IVA Tercera Edad",
                price: devPrice,
                impuestoEstimadoAnual: 0,
                ahorroEstimado: 1200,
                formularios: "Solicitud Digital de Devolución Mensual SRI",
                description: "Trámite 100% digital de recuperación mensual del IVA para Tercera Edad y Discapacidad. Acreditación bancaria directa con cero trámite presencial."
            };
        }
        
        if (actividad === 'profesional') {
            const gastoDeducibleEst = ingresos * 0.4;
            const baseImponible = Math.max(0, ingresos - gastoDeducibleEst);
            const impuestoEstimado = baseImponible > 11902 ? (baseImponible - 11902) * 0.10 : 0;
            return {
                regimen: "Régimen General (Servicios Profesionales)",
                planTitle: "Profesionales Autónomos",
                price: menPrice,
                impuestoEstimadoAnual: Math.round(impuestoEstimado),
                ahorroEstimado: Math.round(impuestoEstimado * 0.45),
                formularios: "Formulario 104 Mensual + Formulario 102 Renta Anual",
                description: "Gestión contable mensual completa para profesionales independientes, médicos, ingenieros y consultores. Asesoría fiscal para deducción máxima y devolución de retenciones."
            };
        }

        // RIMPE Scale
        if (ingresos <= 20000) {
            return {
                regimen: "RIMPE - Negocio Popular",
                planTitle: "RIMPE Negocio Popular",
                price: npPrice,
                impuestoEstimadoAnual: 60,
                ahorroEstimado: 350,
                formularios: "Formulario 102A Simplificado Anual (Notas de venta autorizadas)",
                description: "Declaración anual obligatoria simplificada para microempresarios, tiendas, talleres y comercios con facturación de hasta $20,000 USD al año."
            };
        } else if (ingresos <= 300000) {
            let impuestoEstimado = 60;
            if (ingresos > 20000 && ingresos <= 50000) {
                impuestoEstimado = 60 + (ingresos - 20000) * 0.01;
            } else if (ingresos <= 100000) {
                impuestoEstimado = 360 + (ingresos - 50000) * 0.0125;
            } else if (ingresos <= 200000) {
                impuestoEstimado = 985 + (ingresos - 100000) * 0.015;
            } else {
                impuestoEstimado = 2485 + (ingresos - 200000) * 0.02;
            }

            return {
                regimen: "RIMPE - Emprendedor",
                planTitle: "RIMPE Emprendedor",
                price: semPrice,
                impuestoEstimadoAnual: Math.round(impuestoEstimado),
                ahorroEstimado: Math.round(impuestoEstimado * 0.35 + 450),
                formularios: "Formulario 104 Semestral de IVA + Formulario 102A Renta",
                description: "Declaraciones semestrales de IVA y declaración anual de Renta para empresas y comercios con ingresos entre $20,001 y $300,000 USD."
            };
        } else {
            const baseEst = ingresos * 0.25;
            const impuestoEstimado = baseEst * 0.25;
            return {
                regimen: "Régimen General (Corporativo)",
                planTitle: "Consultoría Corporativa Pro",
                price: 150,
                impuestoEstimadoAnual: Math.round(impuestoEstimado),
                ahorroEstimado: Math.round(impuestoEstimado * 0.28),
                formularios: "Formulario 104 Mensual + Retenciones + Estados Financieros Anuales",
                description: "Planificación fiscal corporativa integral, auditoría preventiva de balance y blindaje ante auditorías del SRI para empresas consolidadas."
            };
        }
    };

    const taxDetails = useMemo(() => calculateDetailedTax(calcIngresos, calcActividad), [calcIngresos, calcActividad, serviceFees]);

    // SRI Penalty Estimator Math
    const calculatePenaltyRisk = (meses: number, tipo: 'sin_ventas' | 'con_ventas', ventas: number) => {
        const multaPorMes = tipo === 'sin_ventas' ? 30 : 45;
        const totalMultaBase = meses * multaPorMes;
        const interesEstimado = tipo === 'con_ventas' ? (ventas * 0.15 * 0.012 * meses) : 0;
        const totalRiesgo = Math.round(totalMultaBase + interesEstimado);
        return {
            totalRiesgo,
            multaBase: totalMultaBase,
            interes: Math.round(interesEstimado),
            ahorroConNosotros: Math.round(totalRiesgo * 0.6)
        };
    };

    const penaltyResult = useMemo(() => calculatePenaltyRisk(penaltyMeses, penaltyType, penaltyVentasEst), [penaltyMeses, penaltyType, penaltyVentasEst]);

    // SRI Monthly Deadline dates & Days-left calculation
    const getRucDeadlineInfo = (digit: number) => {
        const days = [28, 10, 12, 14, 16, 18, 20, 22, 24, 26];
        const day = days[digit] || 10;
        
        const now = new Date();
        const currentMonthDay = now.getDate();
        let daysLeft = day - currentMonthDay;
        let isImminent = false;
        
        if (daysLeft < 0) {
            daysLeft += 30; // Next cycle
        }
        if (daysLeft <= 3) {
            isImminent = true;
        }

        return { 
            day, 
            label: `Día ${day} de cada mes`,
            daysLeft,
            isImminent
        };
    };

    const deadlineInfo = getRucDeadlineInfo(selectedRucDigit ?? 1);

    // Dynamic Elite Bento Services
    const eliteServices = [
        {
            id: 'declaraciones',
            title: "Declaraciones SRI & Blindaje Mensual",
            category: "Gestión Fiscal",
            tag: "Más Solicitado",
            icon: FileSpreadsheet,
            popular: true,
            price: serviceFees?.ivaMensual || 20,
            period: "/mes",
            desc: "Presentación impecable de formularios 104 (IVA) y retenciones con validación matemática en casilleros 615/617.",
            features: ["Revisión de comprobantes electrónicos", "Cálculo óptimo de crédito tributario", "Sin riesgo de multas ni moras"]
        },
        {
            id: 'firma_electronica',
            title: "Firma Electrónica .P12 Express",
            category: "Identidad Digital",
            tag: "Entrega en 24h",
            icon: FileKey,
            price: serviceFees?.firmaElectronica || 25,
            period: "único",
            desc: "Emisión ágil de archivo .P12 legalmente válido ante el SRI, Quipux y facturación electrónica autorizada.",
            features: ["Vigencia 1, 2 o 5 años", "Configuración remota asistida", "100% digital con tu cédula"]
        },
        {
            id: 'devolucion_iva',
            title: "Devolución de IVA Tercera Edad",
            category: "Grupos Prioritarios",
            tag: "Acreditación Bancaria",
            icon: Heart,
            price: serviceFees?.devolucionIva || 30,
            period: "/solicitud",
            desc: "Recuperación mensual de valores de IVA pagados en compras para personas de 65+ años y discapacidad.",
            features: ["Solicitud digital ante el SRI", "Seguimiento hasta acreditación", "Atención humana y preferente"]
        },
        {
            id: 'rimpe_anual',
            title: "Declaración Renta Anual & RIMPE",
            category: "Planificación",
            tag: "Obligatorio Anual",
            icon: Calculator,
            price: serviceFees?.rentaNP || 50,
            period: "/año",
            desc: "Presentación del Formulario 102/102A con cruce de retenciones para Negocio Popular, Emprendedores y General.",
            features: ["Encuadre exacto en tabla SRI", "Deducción de gastos personales", "Certificado oficial de cumplimiento"]
        },
        {
            id: 'regularizacion_ruc',
            title: "Regularización de RUC & Glosas",
            category: "Defensa Fiscal",
            tag: "Levantamiento Inmediato",
            icon: ShieldAlert,
            price: 60,
            period: "base",
            desc: "Reactivación de RUC suspendido, puesta al día de declaraciones pendientes y solicitud de facilidades de pago.",
            features: ["Diagnóstico histórico sin costo", "Eliminación de clausuras", "Cálculo exacto de recargos mínimos"]
        },
        {
            id: 'facturacion_web',
            title: "Facturación Electrónica & Sistema Web",
            category: "Tecnología",
            tag: "Nueva Luz 3.0",
            icon: Zap,
            price: 45,
            period: "anual",
            desc: "Software moderno en la nube para emitir facturas, notas de crédito, retenciones y guías de remisión ilimitadas.",
            features: ["Envío automático de XML/PDF al cliente", "Conexión directa SRI 2026", "Compatible con celular y PC"]
        }
    ];

    // FAQ items
    const faqs = [
        { 
            category: "Régimen", 
            question: "¿Cuáles son las diferencias y obligaciones del RIMPE 2026 en Ecuador?",
            answer: "El régimen RIMPE se divide en Negocio Popular (ingresos brutos hasta $20,000 anuales, emite notas de venta o facturas sin IVA y realiza declaración anual con tarifa progresiva base de $60) y RIMPE Emprendedor (ingresos entre $20,001 y $300,000 anuales, factura con IVA y declara de forma semestral). Diagnosticamos su caso para garantizar el régimen correcto y evitar multas del SRI." 
        },
        { 
            category: "Firma Electrónica", 
            question: "¿Cómo tramitar la Firma Electrónica .P12 en Pasaje y El Oro?",
            answer: "Emitimos firmas electrónicas en archivo .P12 válidas para facturación electrónica, Quipux y trámites legales en menos de 24 horas. El proceso es 100% digital con tu cédula y papeleta de votación vigentes, sin necesidad de hacer filas en el Registro Civil." 
        },
        { 
            category: "Devolución IVA", 
            question: "¿Cómo funciona la Devolución de IVA para Tercera Edad y Discapacidad?",
            answer: "Las personas de 65 años en adelante o con carnet de discapacidad tienen derecho por ley a recuperar mensualmente el IVA pagado en compras de bienes y servicios de primera necesidad. Realizamos la solicitud digital ante el SRI hasta la acreditación directa en su cuenta bancaria." 
        },
        { 
            category: "Ingeniería SRI", 
            question: "¿Por qué elegir Soluciones Tributarias PRO frente a un contador tradicional?",
            answer: "Soluciones Tributarias PRO combina más de 10 años de experiencia fiscal con automatización algorítmica (sistema Nueva Luz 3.0), garantizando cero errores en casilleros de retenciones (615/617), sincronización inmediata de comprobantes electrónicos y blindaje fiscal continuo ante auditorías del SRI." 
        },
        { 
            category: "Regularización", 
            question: "¿Qué hacer si tengo declaraciones atrasadas o multas acumuladas en el SRI?",
            answer: "Analizamos tu historial tributario sin costo inicial, estructuramos las declaraciones pendientes con cálculo exacto de intereses y gestionamos facilidades de pago o remisiones de ley para restablecer tu RUC en estado activo en menos de 48 horas." 
        }
    ];

    const filteredFaqs = faqs.filter(faq => {
        const matchesCategory = faqCategory === "Todo" || faq.category === faqCategory;
        const matchesSearch = faq.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
                             faq.answer.toLowerCase().includes(faqSearch.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const testimonials = [
        {
            name: "Ing. Carlos Mendoza",
            city: "Machala",
            role: "Gerente Comercial · Sector Bananero",
            quote: "La tranquilidad que tengo ahora con mis declaraciones no tiene precio. Santiago automatizó todo mi esquema de retenciones y nunca más tuve una notificación del SRI."
        },
        {
            name: "Dra. Mariana Valarezo",
            city: "Pasaje",
            role: "Especialista Médica · Consulta Privada",
            quote: "Como profesional independiente no tenía tiempo para llevar el control contable. Con Soluciones Tributarias PRO todo está al día y recuperaron mis retenciones a favor."
        },
        {
            name: "Roberto Aguilar",
            city: "El Guabo",
            role: "Comerciante Mayorista · RIMPE",
            quote: "Emitieron mi firma electrónica .P12 en horas y me configuraron la facturación electrónica. Excelente servicio, honesto, ágil y muy profesional."
        },
        {
            name: "Lcda. Sonia Carrión",
            city: "Santa Rosa",
            role: "Familiar de Adulto Mayor",
            quote: "Gestionaron la devolución del IVA de mi abuelita en tiempo récord. Cada mes recibimos el depósito directo en la cuenta del Banco del Pichincha sin complicaciones."
        }
    ];

    const filteredTestimonials = testimonials.filter(t => testiCityFilter === "Todos" || t.city === testiCityFilter);

    return (
        <div className={`${theme === 'dark' ? 'bg-[#0b1326] text-slate-100' : 'bg-slate-50 text-slate-900'} min-h-screen selection:bg-[#00A896]/30 selection:text-white font-sans overflow-x-hidden transition-colors duration-500`}>

            {/* ── BIOMETRIC OVERLAY (Admin Access) ── */}
            <AnimatePresence>
                {showBiometric && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center">
                        <div className="relative w-72 h-72 border border-white/20 rounded-3xl p-10 bg-[#051424]/90 overflow-hidden shadow-2xl flex items-center justify-center">
                            <Fingerprint size={100} className="text-[#00A896] animate-pulse" />
                        </div>
                        <div className="mt-8 text-center">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.5em] mb-2 font-mono animate-pulse">Autenticación Biométrica</div>
                            <div className="text-white font-display text-2xl font-bold tracking-tight">CENTRO DE CONTROL TRIBUTARIO</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CustomCursor />
            <TacticalGrid />

            {/* ── FLOATING SMART WHATSAPP LEAD ASSISTANT ── */}
            <div className="fixed bottom-20 md:bottom-8 right-6 z-50 pointer-events-auto">
                <AnimatePresence>
                    {isAssistantOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`mb-4 w-80 md:w-96 rounded-[2rem] border shadow-2xl backdrop-blur-2xl p-6 text-left ${
                                theme === 'dark' ? 'bg-[#051424]/95 border-[#00A896]/30 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
                            }`}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A896] to-[#2B6AFF] flex items-center justify-center text-white">
                                        <Logo className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold font-display">Asistente Fiscal Directo</div>
                                        <div className="text-[10px] text-[#00A896] font-mono font-bold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-[#00A896] animate-ping" />
                                            Santiago Córdova en línea
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAssistantOpen(false)}
                                    className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <p className="text-xs text-slate-300 font-light mb-4 leading-relaxed">
                                Selecciona el tema de tu consulta para atenderte de forma prioritaria en WhatsApp:
                            </p>

                            <div className="space-y-2 font-mono text-xs">
                                {[
                                    { text: "📊 Simulación RIMPE 2026", msg: "Hola Santiago Córdova, deseo simular y encuadrar mi régimen RIMPE 2026." },
                                    { text: "🔐 Firma Electrónica .P12", msg: "Hola Santiago Córdova, requiero tramitar mi Firma Electrónica .P12 Express en 24h." },
                                    { text: "👴 Devolución IVA Tercera Edad", msg: "Hola Santiago Córdova, deseo gestionar la devolución de IVA para adulto mayor / discapacidad." },
                                    { text: "🚨 Declaraciones Atrasadas SRI", msg: "Hola Santiago Córdova, tengo declaraciones pendientes y quiero regularizar mi RUC sin multas excesivas." }
                                ].map((item, i) => (
                                    <a
                                        key={i}
                                        href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(item.msg)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`block p-3 rounded-xl border transition-all text-left font-bold ${
                                            theme === 'dark' 
                                                ? 'bg-white/5 border-white/10 hover:bg-[#00A896]/20 hover:border-[#00A896]/50 text-slate-200' 
                                                : 'bg-slate-50 border-slate-200 hover:bg-teal-50 hover:border-[#00A896] text-slate-800'
                                        }`}
                                    >
                                        {item.text}
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setIsAssistantOpen(o => !o)}
                    aria-label="Abrir asistente de consulta rápida"
                    className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-[#00A896] to-[#028090] text-white rounded-full shadow-[0_0_30px_rgba(0,168,150,0.5)] border-2 border-white/20 hover:scale-105 active:scale-95 transition-all font-mono font-bold text-xs uppercase tracking-wider"
                >
                    <MessageCircle size={20} />
                    <span className="hidden md:inline">¿Dudas Fiscales? Chatear</span>
                </button>
            </div>

            {/* ── TOP FLOATING NAVIGATION DOCK ── */}
            <header className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-3 px-4 pointer-events-none">
                <ScrollProgressBar />
                <nav className={`pointer-events-auto transition-all duration-500 flex items-center justify-between px-4 py-2 rounded-full border shadow-2xl backdrop-blur-2xl
                    ${scrolled 
                        ? `w-full max-w-5xl scale-[0.98] ${theme === 'dark' ? 'bg-[#051424]/90 border-white/15 shadow-[#00A896]/5' : 'bg-white/90 border-slate-200 shadow-lg shadow-slate-900/5'}` 
                        : `w-full max-w-6xl ${theme === 'dark' ? 'bg-[#051424]/75 border-white/10' : 'bg-white/80 border-slate-200/80 shadow-md'}`
                    }`}>
                    {/* Brand Identifier */}
                    <div className="flex items-center gap-3 cursor-pointer pl-1 group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00A896] to-[#2B6AFF] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,168,150,0.4)] group-hover:scale-105 transition-transform">
                            <Logo className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className={`text-sm font-bold tracking-tight leading-none font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SANTIAGO CÓRDOVA</span>
                            <span className="text-[10px] font-bold text-[#00A896] tracking-[0.2em] uppercase font-mono mt-0.5">Soluciones Tributarias PRO</span>
                        </div>
                    </div>

                    {/* Navigation Desktop Links with Active Section Pill */}
                    <div className="hidden lg:flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5 font-sans relative">
                        {[
                            { label: 'Inicio', target: 'top' },
                            { label: '4 Fases', target: 'fases' },
                            { label: 'Simulador RIMPE', target: 'simulador' },
                            { label: 'Calculadora Multas', target: 'multas-sri' },
                            { label: 'Calendario RUC', target: 'calendario-ruc' },
                            { label: 'Servicios', target: 'servicios' },
                            { label: 'FAQ', target: 'faq' }
                        ].map((link) => {
                            const isActive = activeSection === link.target;
                            return (
                                <button
                                    key={link.label}
                                    onClick={() => scrollToSection(link.target)}
                                    className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                        isActive 
                                            ? 'text-white font-bold' 
                                            : theme === 'dark' 
                                            ? 'text-slate-300 hover:text-white hover:bg-white/10' 
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNavSection"
                                            className="absolute inset-0 bg-[#00A896] rounded-full shadow-md shadow-[#00A896]/30 z-[-1]"
                                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10">{link.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Direct Actions */}
                    <div className="flex items-center gap-2">
                        {toggleTheme && (
                            <button 
                                onClick={toggleTheme}
                                aria-label="Cambiar tema claro/oscuro"
                                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                                    theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                            </button>
                        )}

                        <a 
                            href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20agendar%20una%20consulta%20tributaria%20gratuita.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00A896] hover:bg-[#028090] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#00A896]/20 font-mono"
                        >
                            <MessageCircle size={14} />
                            <span>Consulta VIP</span>
                        </a>

                        <button
                            onClick={handleProtectedAccess}
                            aria-label="Acceso al panel administrativo"
                            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                                theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-400 hover:text-[#00A896] hover:border-[#00A896]/40' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title="Panel Administrativo"
                        >
                            <ShieldCheck size={16} />
                        </button>
                    </div>
                </nav>
            </header>

            {/* ── MOBILE BOTTOM FLOATING ISLAND DOCK ── */}
            <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50 pointer-events-auto">
                <div className={`flex items-center justify-around py-2 px-2 rounded-full border shadow-2xl backdrop-blur-2xl
                    ${theme === 'dark' ? 'bg-[#051424]/95 border-white/15' : 'bg-white/95 border-slate-200 shadow-xl'}`}>
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`flex flex-col items-center p-1 ${activeSection === 'top' ? 'text-[#00A896]' : 'text-slate-400'}`}>
                        <Home size={18} />
                        <span className="text-[8px] font-bold uppercase mt-0.5 font-mono">Inicio</span>
                    </button>
                    <button onClick={() => scrollToSection('simulador')} className={`flex flex-col items-center p-1 ${activeSection === 'simulador' ? 'text-[#00A896]' : 'text-slate-400'}`}>
                        <Calculator size={18} />
                        <span className="text-[8px] font-bold uppercase mt-0.5 font-mono">Simulador</span>
                    </button>
                    {/* VIP WhatsApp Glowing Button */}
                    <div className="relative -mt-6">
                        <a
                            href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20agendar%20una%20consulta%20tributaria.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-12 h-12 p-2.5 bg-[#00A896] rounded-full text-white shadow-[0_0_25px_rgba(0,168,150,0.6)] border-2 border-[#0b1326] active:scale-95 transition-transform"
                        >
                            <MessageCircle size={20} />
                        </a>
                    </div>
                    <button onClick={() => scrollToSection('calendario-ruc')} className={`flex flex-col items-center p-1 ${activeSection === 'calendario-ruc' ? 'text-[#00A896]' : 'text-slate-400'}`}>
                        <Calendar size={18} />
                        <span className="text-[8px] font-bold uppercase mt-0.5 font-mono">RUC SRI</span>
                    </button>
                    <button onClick={() => scrollToSection('servicios')} className={`flex flex-col items-center p-1 ${activeSection === 'servicios' ? 'text-[#00A896]' : 'text-slate-400'}`}>
                        <Layers size={18} />
                        <span className="text-[8px] font-bold uppercase mt-0.5 font-mono">Servicios</span>
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                HERO SECTION (Luxury Tier with Dynamic 3D WebGL)
            ════════════════════════════════════════════════════════════════ */}
            <section id="top" className={`relative min-h-screen flex items-center justify-center overflow-hidden pt-32 pb-20 md:pt-36 md:pb-24 ${theme === 'dark' ? 'bg-[#0b1326]' : 'bg-gradient-to-b from-white via-slate-50 to-slate-100'}`}>
                {/* High-FPS 3D Background */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-75">
                    <Scroll3DCanvas scrollProgress={scrollProgress / 100} theme={theme} />
                </div>

                <AuroraBackground theme={theme} />
                <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

                <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center text-left">
                        
                        {/* Left Column: Headlines, Slogans & Pillars */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Badges row */}
                            <Reveal delay={0}>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-[#00A896]/30 bg-[#00A896]/10 backdrop-blur-md">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_10px_#00A896]" />
                                        <span className="text-[11px] font-bold text-[#00A896] uppercase tracking-[0.25em] font-mono">INGENIERÍA TRIBUTARIA DE ALTO NIVEL</span>
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A96E]/30 bg-[#C9A96E]/10 backdrop-blur-md text-[10px] font-bold text-[#C9A96E] uppercase tracking-widest font-mono">
                                        <ShieldCheck size={13} className="text-[#C9A96E]" /> SRI 2026 SINCRONIZADO
                                    </div>
                                </div>
                            </Reveal>

                            {/* Main Headline with Liquid Gold Surname */}
                            <Reveal delay={60}>
                                <h1 className="text-[2.6rem] sm:text-[4rem] md:text-[4.8rem] lg:text-[5.2rem] font-display tracking-tight leading-[0.95] font-extrabold">
                                    <span className={`block ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>SANTIAGO</span>
                                    <span className="relative inline-block mt-1">
                                        <span className="text-gold-gradient drop-shadow-[0_0_35px_rgba(201,169,110,0.35)]">
                                            CÓRDOVA
                                        </span>
                                    </span>
                                </h1>
                            </Reveal>

                            {/* Brand Slogan / Value Promise */}
                            <Reveal delay={120}>
                                <div className="space-y-3 max-w-2xl">
                                    <p className="text-xl md:text-2xl font-bold text-teal-gradient font-display">
                                        "Tu tranquilidad fiscal, nuestro compromiso de élite."
                                    </p>
                                    <p className={`text-base md:text-lg font-light leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                        La certeza de tener tu contabilidad, declaraciones del SRI y retenciones <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>100% blindadas</span> con automatización de software de precisión en Pasaje, El Oro y todo el Ecuador.
                                    </p>
                                </div>
                            </Reveal>

                            {/* Trust badges row */}
                            <Reveal delay={180}>
                                <div className="flex flex-wrap gap-2.5">
                                    <TrustBadge theme={theme} icon={Award} label="Experiencia" value="10+ Años" />
                                    <TrustBadge theme={theme} icon={Users} label="Empresas & Clientes" value="500+" />
                                    <TrustBadge theme={theme} icon={Shield} label="Blindaje SRI" value="100% Cero Multas" />
                                    <TrustBadge theme={theme} icon={MapPin} label="Ubicación" value="Pasaje · El Oro" />
                                </div>
                            </Reveal>

                            {/* CTA Action Buttons */}
                            <Reveal delay={240}>
                                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center pt-2">
                                    <MagneticButton onClick={() => scrollToSection('simulador')}>
                                        <div className="h-14 px-8 rounded-2xl font-bold text-xs uppercase tracking-widest overflow-hidden transition-all duration-300 active:scale-95 shadow-xl flex items-center justify-center gap-3 bg-gradient-to-r from-[#00A896] to-[#028090] text-white border border-[#00A896]/40 shadow-[#00A896]/20 hover:shadow-[#00A896]/40 font-mono">
                                            <Sparkles size={16} />
                                            <span>Simulador RIMPE 2026</span>
                                            <ArrowRight size={16} />
                                        </div>
                                    </MagneticButton>

                                    <MagneticButton href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20agendar%20una%20consulta%20tributaria%20gratuita.`} target="_blank" rel="noopener noreferrer">
                                        <div className={`flex items-center justify-center gap-3 transition-all duration-300 px-7 py-4 rounded-2xl border active:scale-95 h-14
                                            ${theme === 'dark' 
                                                ? 'text-slate-300 hover:text-white border-white/10 hover:bg-white/5 hover:border-[#00A896]/40' 
                                                : 'text-slate-700 hover:text-slate-950 border-slate-200 bg-white/80 hover:bg-slate-100'
                                            }`}>
                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[#00A896]">
                                                <MessageCircle size={16} />
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-semibold uppercase tracking-widest font-mono">WhatsApp VIP</span>
                                                <span className="text-[9px] text-[#00A896] font-mono font-bold">🟢 En línea ahora</span>
                                            </div>
                                        </div>
                                    </MagneticButton>
                                </div>
                            </Reveal>
                        </div>

                        {/* Right Column: Live Telemetry Fiscal Cockpit */}
                        <div className="lg:col-span-5">
                            <Reveal delay={150}>
                                <SpotlightCard theme={theme} className="p-8 relative">
                                    {/* Continuous Laser Scanning Line */}
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-scan pointer-events-none z-20" />

                                    <div className="flex items-center justify-between pb-5 border-b border-white/10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-[#00A896] animate-ping" />
                                            <span className="text-xs font-bold font-mono tracking-wider text-[#00A896] uppercase">CENTRO DE TELEMETRÍA FISCAL</span>
                                        </div>
                                        <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 font-bold">
                                            SRI 2026 ACTIVO
                                        </span>
                                    </div>

                                    <div className="py-6 space-y-5 font-mono text-left">
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-sans">Declaraciones Procesadas con Éxito</div>
                                            <div className={`text-3xl font-bold tracking-tight flex items-center justify-between font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                                <span>12,548+</span>
                                                <span className="text-xs text-[#00A896] font-semibold flex items-center gap-1 font-mono">
                                                    <TrendingUp size={14} /> +18.4% este mes
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-sans">Precisión Algorítmica</div>
                                                <div className="text-2xl font-bold text-[#00A896] font-display">99.9%</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-sans">Ahorro Generado</div>
                                                <div className="text-2xl font-bold text-[#C9A96E] font-display">$1.2M+</div>
                                            </div>
                                        </div>

                                        <div className={`p-4 rounded-2xl border space-y-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400 font-sans">Motor Nueva Luz 3.0:</span>
                                                <span className="text-[#00A896] font-bold">SINCRONIZADO</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-[#00A896] via-[#2B6AFF] to-[#C9A96E] w-[98%] rounded-full animate-pulse" />
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-sans">Conexión directa con SRI Ecuador, cálculo automático en casilleros 615/617.</div>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button 
                                            onClick={() => scrollToSection('fases')}
                                            className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border font-mono ${
                                                theme === 'dark' 
                                                    ? 'bg-white/10 hover:bg-[#00A896] hover:text-white text-white border-white/10' 
                                                    : 'bg-slate-900 hover:bg-[#00A896] text-white border-slate-900'
                                            }`}
                                        >
                                            <span>Conocer las 4 Fases de Blindaje</span>
                                            <ArrowUpRight size={16} />
                                        </button>
                                    </div>
                                </SpotlightCard>
                            </Reveal>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── GUARANTEE & CERTIFICATIONS RIBBON ── */}
            <div className={`py-6 border-b ${theme === 'dark' ? 'bg-[#020617] border-white/5' : 'bg-slate-100/80 border-slate-200'}`}>
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className="text-[#00A896] flex-shrink-0" />
                        <div>
                            <div className="text-xs font-bold font-mono">Interoperabilidad SRI</div>
                            <div className="text-[10px] text-slate-400">Validación directa 2026</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <FileKey size={20} className="text-[#C9A96E] flex-shrink-0" />
                        <div>
                            <div className="text-xs font-bold font-mono">Firmas .P12 Oficiales</div>
                            <div className="text-[10px] text-slate-400">Ley de Comercio Electrónico</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Lock size={20} className="text-[#00A896] flex-shrink-0" />
                        <div>
                            <div className="text-xs font-bold font-mono">Cifrado Bancario SSL</div>
                            <div className="text-[10px] text-slate-400">Protección de datos 256-bit</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Award size={20} className="text-[#C9A96E] flex-shrink-0" />
                        <div>
                            <div className="text-xs font-bold font-mono">Garantía Anti-Multas</div>
                            <div className="text-[10px] text-slate-400">Respaldo técnico 100%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── AUTHORITY TICKER ── */}
            <AuthorityTicker theme={theme} />

            {/* ════════════════════════════════════════════════════════════════
                SECCIÓN: LAS 4 FASES DE LA INGENIERÍA TRIBUTARIA
            ════════════════════════════════════════════════════════════════ */}
            <section id="fases" className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#051424]' : 'bg-slate-100/70'}`}>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-16 space-y-3">
                            <div className="text-[11px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Metodología de Control Total</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                LAS 4 FASES DE LA <br />
                                <span className="text-teal-gradient">
                                    INGENIERÍA TRIBUTARIA DE ÉLITE
                                </span>
                            </h2>
                            <p className="text-base font-light text-slate-400 max-w-2xl mx-auto">
                                Nuestro proceso metódico garantiza que tu negocio nunca pague multas ni recargos innecesarios al SRI.
                            </p>
                        </div>
                    </Reveal>

                    <div className="relative">
                        {/* Connecting Trace Beam for Desktop */}
                        <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#00A896]/40 to-transparent -translate-y-12 z-0 pointer-events-none" />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                            {[
                                {
                                    step: "01",
                                    title: "Diagnóstico & Auditoría Preventiva",
                                    icon: Search,
                                    tag: "Detección de Glosas",
                                    desc: "Análisis profundo de tus declaraciones históricas en el SRI para identificar inconsistencias y casilleros omitidos antes de cualquier notificación oficial."
                                },
                                {
                                    step: "02",
                                    title: "Automatización & Facturación SRI",
                                    icon: Zap,
                                    tag: "Tecnología .P12",
                                    desc: "Implementación de firmas electrónicas, validación inmediata de facturas recibidas y sincronización en la nube con respaldo digital inmutable."
                                },
                                {
                                    step: "03",
                                    title: "Blindaje Fiscal & Retenciones",
                                    icon: ShieldCheck,
                                    tag: "Cero Errores 615/617",
                                    desc: "Cálculo matemático exacto de retenciones de IVA y Renta. Clasificación jurídica precisa en RIMPE Popular o Emprendedor."
                                },
                                {
                                    step: "04",
                                    title: "Devolución & Paz Tributaria",
                                    icon: Heart,
                                    tag: "Recuperación de Fondos",
                                    desc: "Gestión de devolución de IVA para 3ra Edad y Discapacidad, y créditos tributarios a favor. La tranquilidad de estar al 100% con la ley."
                                }
                            ].map((phase, idx) => (
                                <Reveal key={phase.step} delay={idx * 80}>
                                    <SpotlightCard theme={theme} className="p-7 h-full flex flex-col justify-between group">
                                        <div>
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="w-12 h-12 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/30 flex items-center justify-center text-[#00A896] group-hover:scale-110 transition-transform">
                                                    <phase.icon size={22} />
                                                </div>
                                                <span className={`text-3xl font-bold font-display transition-colors ${theme === 'dark' ? 'text-white/20 group-hover:text-[#00A896]' : 'text-slate-300 group-hover:text-[#00A896]'}`}>{phase.step}</span>
                                            </div>
                                            <span className="text-[9px] font-bold font-mono px-2.5 py-1 rounded-full bg-[#00A896]/10 border border-[#00A896]/20 text-[#00A896] uppercase tracking-wider mb-3 inline-block">
                                                {phase.tag}
                                            </span>
                                            <h3 className={`text-lg font-bold mb-3 group-hover:text-[#00A896] transition-colors text-left ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{phase.title}</h3>
                                            <p className="text-xs md:text-sm font-light text-slate-400 leading-relaxed text-left">{phase.desc}</p>
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] font-bold text-[#00A896] font-mono uppercase tracking-wider">
                                            <CheckCircle2 size={13} />
                                            <span>Proceso Certificado</span>
                                        </div>
                                    </SpotlightCard>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                SIMULADOR FISCAL INTERACTIVO RIMPE 2026
            ════════════════════════════════════════════════════════════════ */}
            <section id="simulador" className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0b1326]' : 'bg-slate-50'}`}>
                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-14 space-y-3">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Diagnóstico Tributario en Vivo</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                SIMULADOR DE <br />
                                <span className="text-teal-gradient">
                                    RÉGIMEN TRIBUTARIO SRI 2026
                                </span>
                            </h2>
                            <p className="text-sm md:text-base font-light text-slate-400 max-w-lg mx-auto">
                                Selecciona tu actividad e ingresos anuales para calcular tu encuadre legal, impuesto proyectado y plan recomendado.
                            </p>
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <SpotlightCard theme={theme} className="p-8 md:p-12 border-[#00A896]/30">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Left Controls */}
                                <div className="lg:col-span-6 space-y-6 text-left">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Tipo de Actividad Económica</label>
                                        <div className={`grid grid-cols-3 gap-2 p-1.5 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                                            {[
                                                { id: 'comercial', label: 'Comercio / RIMPE', icon: Store },
                                                { id: 'profesional', label: 'Serv. Profesional', icon: User },
                                                { id: 'discapacidad_3ra_edad', label: '3ra Edad / IVA', icon: Heart }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setCalcActividad(opt.id as any)}
                                                    className={`py-3 px-2 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1.5 transition-all ${
                                                        calcActividad === opt.id 
                                                            ? 'bg-[#00A896] text-white shadow-lg shadow-[#00A896]/30' 
                                                            : theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                                    }`}
                                                >
                                                    <opt.icon size={16} />
                                                    <span className="truncate w-full text-center">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Income Slider & Direct Input */}
                                    {calcActividad !== 'discapacidad_3ra_edad' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                                <span>Ingresos Anuales Estimados</span>
                                                <span className="text-[#00A896] font-mono text-base font-bold">${calcIngresos.toLocaleString()} USD</span>
                                            </div>
                                            <div className="relative py-2">
                                                <input
                                                    type="range"
                                                    min="1000"
                                                    max="350000"
                                                    step="2500"
                                                    value={calcIngresos}
                                                    onChange={e => setCalcIngresos(parseInt(e.target.value, 10))}
                                                    className="w-full h-2 bg-slate-300 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00A896]"
                                                />
                                                <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-2">
                                                    <span>$1k</span>
                                                    <span>$20k (Popular)</span>
                                                    <span>$300k (Emprendedor)</span>
                                                    <span>$350k+</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Calculated Metrics Breakdown */}
                                    <div className={`p-4 rounded-2xl border space-y-3 ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex justify-between items-center text-xs font-mono">
                                            <span className="text-slate-400">Impuesto Estimado Anual:</span>
                                            <span className="font-bold text-[#00A896]">${taxDetails.impuestoEstimadoAnual.toLocaleString()} USD</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-mono">
                                            <span className="text-slate-400">Ahorro Potencial Asesorado:</span>
                                            <span className="font-bold text-[#C9A96E]">${taxDetails.ahorroEstimado.toLocaleString()} USD</span>
                                        </div>
                                        <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400">
                                            <span className="font-bold text-slate-300">Obligaciones:</span> {taxDetails.formularios}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Result Summary */}
                                <div className="lg:col-span-6 flex flex-col justify-between text-left space-y-6 lg:pl-6 lg:border-l lg:border-white/10">
                                    <div className="space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 text-[10px] font-bold text-[#00A896] uppercase tracking-widest font-mono">
                                            Régimen Oficial Detectado
                                        </div>
                                        <div className={`text-2xl md:text-3xl font-display font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                            {taxDetails.regimen}
                                        </div>
                                        <p className="text-xs md:text-sm font-light text-slate-400 leading-relaxed">
                                            {taxDetails.description}
                                        </p>
                                    </div>
                                    
                                    <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${theme === 'dark' ? 'bg-black/40 border-[#00A896]/30' : 'bg-white border-teal-200 shadow-md'}`}>
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Plan Recomendado</div>
                                            <div className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{taxDetails.planTitle}</div>
                                            <div className="text-xl font-mono font-extrabold text-[#00A896]">${taxDetails.price} USD</div>
                                        </div>
                                        <a
                                            href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20he%20realizado%20la%20simulaci%C3%B3n%20para%20ingresos%20de%20$${calcIngresos.toLocaleString()}%20USD%20(${encodeURIComponent(taxDetails.regimen)}).%20Quisiera%20agendar%20el%20plan%20*${encodeURIComponent(taxDetails.planTitle)}*.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00A896] to-[#028090] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md font-mono text-center whitespace-nowrap"
                                        >
                                            Solicitar Diagnóstico
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>
                    </Reveal>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                NUEVA HERRAMIENTA: CALCULADORA DE MULTAS Y REGULARIZACIÓN SRI
            ════════════════════════════════════════════════════════════════ */}
            <section id="multas-sri" className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#051424]' : 'bg-slate-100/70'}`}>
                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-14 space-y-3">
                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.4em] font-mono">— Diagnóstico de Sanciones</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                ¿TIENES DECLARACIONES PENDIENTES? <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-400 to-[#00A896]">
                                    CALCULADORA DE MULTAS & RECARGOS SRI
                                </span>
                            </h2>
                            <p className="text-sm md:text-base font-light text-slate-400 max-w-xl mx-auto">
                                Estima el valor acumulado de multas por declaraciones tardías o RUC cerrado y regularízalo antes de una clausura oficial.
                            </p>
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <SpotlightCard theme={theme} className="p-8 md:p-12 border-rose-500/20">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
                                <div className="lg:col-span-7 space-y-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                            Meses o Períodos sin Declarar
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="range"
                                                min="1"
                                                max="24"
                                                value={penaltyMeses}
                                                onChange={e => setPenaltyMeses(parseInt(e.target.value, 10))}
                                                className="flex-1 h-2 bg-slate-300 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                            />
                                            <span className="font-mono font-bold text-lg text-rose-500 px-4 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 min-w-[75px] text-center">
                                                {penaltyMeses} {penaltyMeses === 1 ? 'mes' : 'meses'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                            Tipo de Omisión
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setPenaltyType('sin_ventas')}
                                                className={`p-3 rounded-xl text-xs font-bold font-mono transition-all text-left ${
                                                    penaltyType === 'sin_ventas' 
                                                        ? 'bg-rose-500 text-white shadow-md' 
                                                        : theme === 'dark' ? 'bg-white/5 border border-white/10 text-slate-400' : 'bg-white border border-slate-200 text-slate-700'
                                                }`}
                                            >
                                                Declaración en Cero (Sin Ventas)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPenaltyType('con_ventas')}
                                                className={`p-3 rounded-xl text-xs font-bold font-mono transition-all text-left ${
                                                    penaltyType === 'con_ventas' 
                                                        ? 'bg-rose-500 text-white shadow-md' 
                                                        : theme === 'dark' ? 'bg-white/5 border border-white/10 text-slate-400' : 'bg-white border border-slate-200 text-slate-700'
                                                }`}
                                            >
                                                Con Ventas / Compras Realizadas
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className={`lg:col-span-5 p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
                                    theme === 'dark' ? 'bg-rose-950/20 border-rose-500/30' : 'bg-rose-50 border-rose-200'
                                }`}>
                                    <div>
                                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest font-mono">Riesgo Estimado Acumulado</div>
                                        <div className="text-3xl font-display font-extrabold text-rose-500 mt-1">
                                            ${penaltyResult.totalRiesgo} USD
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">
                                            Multa base por mora (~${penaltyResult.multaBase}) + intereses aplicables por resolución del SRI.
                                        </p>
                                    </div>

                                    <div className="pt-2 border-t border-rose-500/20">
                                        <a
                                            href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20tengo%20${penaltyMeses}%20meses%20sin%20declarar%20en%20el%20SRI%20y%20necesito%20regularizar%20mi%20RUC%20de%20forma%20urgente.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md font-mono flex items-center justify-center gap-2"
                                        >
                                            <ShieldAlert size={16} />
                                            <span>Regularizar Mi RUC Ahora</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>
                    </Reveal>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                CALENDARIO SRI & VALIDADOR DE RUC EN TIEMPO REAL
            ════════════════════════════════════════════════════════════════ */}
            <section id="calendario-ruc" className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0b1326]' : 'bg-slate-50'}`}>
                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-14 space-y-3">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Vencimientos SRI 2026</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                CALENDARIO SRI PERSONALIZADO <br />
                                <span className="text-teal-gradient">
                                    POR NOVENO DÍGITO DE RUC
                                </span>
                            </h2>
                            <p className="text-sm md:text-base font-light text-slate-400 max-w-xl mx-auto">
                                Valida tu Cédula o RUC en tiempo real para conocer tu fecha límite mensual exacta y evitar multas automáticas.
                            </p>
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <SpotlightCard theme={theme} className="p-8 md:p-12 border-[#00A896]/30">
                            <div className="space-y-8">
                                {/* Live RUC Input */}
                                <div className="max-w-md mx-auto space-y-3 text-center">
                                    <label htmlFor="ruc-input" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                        Ingresa tu Cédula o RUC (10 o 13 dígitos)
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="ruc-input"
                                            type="text"
                                            maxLength={13}
                                            value={calcRucInput}
                                            onChange={e => setCalcRucInput(e.target.value.replace(/\D/g, ''))}
                                            placeholder="Ej. 0702706813001"
                                            className={`w-full px-4 py-3.5 border rounded-2xl text-center text-base font-mono tracking-widest outline-none focus:border-[#00A896] transition-colors ${
                                                theme === 'dark' ? 'bg-black/50 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
                                            }`}
                                        />
                                    </div>
                                    {rucValidationMsg.text && (
                                        <div className={`text-xs font-semibold font-mono ${rucValidationMsg.type === 'success' ? 'text-[#00A896]' : 'text-rose-500'}`}>
                                            {rucValidationMsg.text}
                                            {rucValidationMsg.province && (
                                                <span className="block text-[11px] text-[#C9A96E] font-mono mt-0.5">
                                                    📍 Provincia: {rucValidationMsg.province}
                                                </span>
                                            )}
                                            {rucValidationMsg.details && (
                                                <p className="text-[11px] text-slate-400 mt-1 font-sans">{rucValidationMsg.details}</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 9th Digit Selector */}
                                <div className="space-y-3">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono text-center">
                                        O selecciona el 9no dígito manualmente:
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit => (
                                            <button
                                                key={digit}
                                                type="button"
                                                onClick={() => setSelectedRucDigit(digit)}
                                                className={`w-11 h-11 rounded-xl font-mono text-sm font-bold transition-all ${
                                                    selectedRucDigit === digit 
                                                        ? 'bg-[#00A896] text-white shadow-lg shadow-[#00A896]/40 scale-105' 
                                                        : theme === 'dark' ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                {digit}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Calculated Deadline Banner */}
                                <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 text-left ${
                                    theme === 'dark' ? 'bg-black/40 border-[#00A896]/30' : 'bg-slate-50 border-teal-200'
                                }`}>
                                    <div className="space-y-1">
                                        <div className="text-[9px] font-bold text-[#00A896] uppercase tracking-[0.25em] font-mono">Fecha Límite Mensual de Declaración</div>
                                        <div className={`text-2xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                            {deadlineInfo.label}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {deadlineInfo.isImminent ? (
                                                <span className="text-rose-400 font-bold">⚠️ Vencimiento próximo en menos de 3 días.</span>
                                            ) : (
                                                <span>Faltan aproximadamente {deadlineInfo.daysLeft} días para tu vencimiento.</span>
                                            )}
                                        </div>
                                    </div>
                                    <a
                                        href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20mi%20RUC%20termina%20en%20d%C3%ADgito%20${selectedRucDigit}%20(vence%20el%20${deadlineInfo.label})%20y%20deseo%20asegurar%20mi%20declaraci%C3%B3n%20a%20tiempo.`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-3.5 rounded-xl bg-[#00A896] hover:bg-[#028090] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md font-mono whitespace-nowrap"
                                    >
                                        Asegurar Declaración a Tiempo
                                    </a>
                                </div>
                            </div>
                        </SpotlightCard>
                    </Reveal>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                CATÁLOGO BENTO GRID: SERVICIOS TRIBUTARIOS DE ÉLITE
            ════════════════════════════════════════════════════════════════ */}
            <section id="servicios" className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#051424]' : 'bg-slate-100/70'}`}>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-16 space-y-3">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Soluciones Especializadas</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                SERVICIOS TRIBUTARIOS & <br />
                                <span className="text-teal-gradient">
                                    BLINDAJE CONTABLE DE ÉLITE
                                </span>
                            </h2>
                            <p className="text-sm md:text-base font-light text-slate-400 max-w-xl mx-auto">
                                Tarifas transparentes, atención directa y garantía fiduciaria en Pasaje, Machala y todo el Ecuador.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {eliteServices.map((service, idx) => (
                            <Reveal key={service.id} delay={idx * 60}>
                                <SpotlightCard theme={theme} className="p-8 h-full flex flex-col justify-between group">
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/30 flex items-center justify-center text-[#00A896] group-hover:scale-110 transition-transform">
                                                <service.icon size={22} />
                                            </div>
                                            <span className="text-[9px] font-bold font-mono px-3 py-1 rounded-full bg-[#00A896]/10 border border-[#00A896]/20 text-[#00A896] uppercase tracking-wider">
                                                {service.tag}
                                            </span>
                                        </div>

                                        <h3 className={`text-xl font-bold mb-2 group-hover:text-[#00A896] transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                            {service.title}
                                        </h3>
                                        <p className="text-xs font-light text-slate-400 leading-relaxed mb-6">
                                            {service.desc}
                                        </p>

                                        <ul className="space-y-2.5 mb-8 border-t border-white/5 pt-4">
                                            {service.features.map((feat, i) => (
                                                <li key={i} className="flex items-center gap-2.5 text-xs text-slate-300">
                                                    <Check size={14} className="text-[#00A896] flex-shrink-0" />
                                                    <span>{feat}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Tarifa Oficial</span>
                                            <span className="text-xl font-mono font-bold text-[#00A896]">
                                                ${service.price} USD <span className="text-xs text-slate-400 font-sans font-normal">{service.period}</span>
                                            </span>
                                        </div>
                                        <a
                                            href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20deseo%20contratar%20el%20servicio%20de%20*${encodeURIComponent(service.title)}*%20por%20$${service.price}%20USD.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2.5 rounded-xl bg-[#00A896] hover:bg-[#028090] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md font-mono"
                                        >
                                            Contratar
                                        </a>
                                    </div>
                                </SpotlightCard>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                MATRIZ DE AUTORIDAD: TRADICIONAL VS SOLUCIONES TRIBUTARIAS PRO
            ════════════════════════════════════════════════════════════════ */}
            <section className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0b1326]' : 'bg-slate-50'}`}>
                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-16 space-y-3">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Comparativa de Precisión</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                CONTABILIDAD TRADICIONAL <br />
                                <span className="text-teal-gradient">
                                    VS. SOLUCIONES TRIBUTARIAS PRO
                                </span>
                            </h2>
                            <p className="text-sm md:text-base font-light text-slate-400 max-w-xl mx-auto">
                                Conoce por qué cientos de empresas y profesionales confían en nuestro modelo de ingeniería tributaria.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                        {/* Traditional Accounting Box */}
                        <Reveal delay={100}>
                            <div className={`p-8 rounded-[2rem] border h-full space-y-6 ${
                                theme === 'dark' 
                                    ? 'border-rose-500/20 bg-rose-950/10 backdrop-blur-xl' 
                                    : 'border-rose-200 bg-rose-50/70 shadow-sm'
                            }`}>
                                <div className="flex items-center gap-3 text-rose-500">
                                    <ShieldAlert size={24} />
                                    <h3 className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Contabilidad Tradicional</h3>
                                </div>
                                <ul className={`space-y-4 text-xs md:text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    <li className="flex items-start gap-3">
                                        <span className="text-rose-500 font-bold">✕</span>
                                        <span>Procesos manuales propensos a errores de digitación en casilleros del SRI.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-rose-500 font-bold">✕</span>
                                        <span>Declaraciones a última hora con alto riesgo de multas e intereses por mora.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-rose-500 font-bold">✕</span>
                                        <span>Falta de seguimiento a retenciones y créditos tributarios acumulados.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-rose-500 font-bold">✕</span>
                                        <span>Atención lenta y comunicación dispersa por canales no organizados.</span>
                                    </li>
                                </ul>
                            </div>
                        </Reveal>

                        {/* Soluciones Tributarias PRO Box */}
                        <Reveal delay={200}>
                            <SpotlightCard theme={theme} className="p-8 border-[#00A896]/40 h-full space-y-6">
                                <div className="flex items-center gap-3 text-[#00A896]">
                                    <ShieldCheck size={24} />
                                    <h3 className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Soluciones Tributarias PRO</h3>
                                </div>
                                <ul className={`space-y-4 text-xs md:text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#00A896] font-bold">✓</span>
                                        <span><strong>Automatización algorítmica:</strong> Validación matemática continua sin fallas humanas.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#00A896] font-bold">✓</span>
                                        <span><strong>Blindaje Preventivo:</strong> Declaraciones listas días antes de la fecha límite oficial.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#00A896] font-bold">✓</span>
                                        <span><strong>Optimización Patrimonial:</strong> Recuperación activa de saldos de IVA y retenciones.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#00A896] font-bold">✓</span>
                                        <span><strong>Atención VIP Directa:</strong> Consultas ágiles con Santiago Córdova vía WhatsApp.</span>
                                    </li>
                                </ul>
                            </SpotlightCard>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                TESTIMONIOS DE CLIENTES VERIFICADOS (GEOLOCALIZADOS)
            ════════════════════════════════════════════════════════════════ */}
            <section className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#051424]' : 'bg-slate-100/70'}`}>
                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-12 space-y-3">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Casos de Éxito Reales</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                LO QUE DICEN NUESTROS <br />
                                <span className="text-teal-gradient">
                                    CLIENTES EN ECUADOR
                                </span>
                            </h2>
                        </div>
                    </Reveal>

                    {/* City filter chips */}
                    <div className="flex flex-wrap justify-center gap-2 mb-10">
                        {["Todos", "Pasaje", "Machala", "El Guabo", "Santa Rosa"].map(city => (
                            <button
                                key={city}
                                onClick={() => setTestiCityFilter(city)}
                                className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold transition-all ${
                                    testiCityFilter === city 
                                        ? 'bg-[#00A896] text-white shadow-md' 
                                        : theme === 'dark' ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-white' : 'bg-white border border-slate-200 text-slate-700'
                                }`}
                            >
                                {city}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {filteredTestimonials.map((t, idx) => (
                            <Reveal key={t.name} delay={idx * 80}>
                                <div className={`relative border rounded-[2rem] p-8 transition-all duration-500 h-full flex flex-col justify-between group
                                    ${theme === 'dark' 
                                        ? 'bg-[#0b1326]/80 border-white/10 hover:border-[#00A896]/50 shadow-2xl backdrop-blur-xl' 
                                        : 'bg-white border-slate-200/90 shadow-lg shadow-slate-900/5 hover:border-[#00A896]/50'
                                    }`}>
                                    <div>
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={14} className="text-[#f59e0b] fill-[#f59e0b]" />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-mono text-[#00A896] bg-[#00A896]/10 px-2.5 py-1 rounded-full border border-[#00A896]/20 font-bold">
                                                📍 {t.city}
                                            </span>
                                        </div>
                                        <p className={`text-sm leading-relaxed font-light mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>"{t.quote}"</p>
                                    </div>

                                    <div className={`flex items-center gap-4 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A896] to-[#2B6AFF] flex items-center justify-center text-white font-bold text-sm font-mono shadow-md">
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t.name}</div>
                                            <div className="text-[#00A896] text-xs font-semibold font-mono">{t.role}</div>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                PREGUNTAS FRECUENTES (FAQ INTERACTIVO)
            ════════════════════════════════════════════════════════════════ */}
            <section id="faq" className={`py-28 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0b1326]' : 'bg-slate-50'}`}>
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <Reveal>
                        <div className="text-center mb-12 space-y-3">
                            <div className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.4em] font-mono">— Respuestas Claras</div>
                            <h2 className={`text-3xl md:text-5xl font-display tracking-tight font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                PREGUNTAS FRECUENTES
                            </h2>
                            <p className="text-sm md:text-base font-light text-slate-400 max-w-lg mx-auto">
                                Resolvemos tus dudas más comunes sobre el SRI, RIMPE, firmas electrónicas y devolución de impuestos.
                            </p>
                        </div>
                    </Reveal>

                    {/* FAQ Filter Chips */}
                    <div className="flex flex-wrap justify-center gap-2 mb-8">
                        {["Todo", "Régimen", "Firma Electrónica", "Devolución IVA", "Ingeniería SRI", "Regularización"].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFaqCategory(cat)}
                                className={`px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all ${
                                    faqCategory === cat 
                                        ? 'bg-[#00A896] text-white shadow-md' 
                                        : theme === 'dark' ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4 text-left">
                        {filteredFaqs.map((faq, idx) => (
                            <Reveal key={faq.question} delay={idx * 40}>
                                <SpotlightCard theme={theme} className="p-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                                        <span className="text-[9px] font-bold text-[#00A896] bg-[#00A896]/15 px-3 py-1 rounded-full uppercase tracking-[0.2em] w-fit font-mono">
                                            {faq.category}
                                        </span>
                                        <h3 className={`text-base md:text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                            {faq.question}
                                        </h3>
                                    </div>
                                    <p className={`text-sm font-light leading-relaxed pt-2 border-t ${theme === 'dark' ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                                        {faq.answer}
                                    </p>
                                </SpotlightCard>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════
                FOOTER EJECUTIVO GEO-LOCALIZADO
            ════════════════════════════════════════════════════════════════ */}
            <footer className={`pt-20 pb-28 md:pb-16 border-t ${theme === 'dark' ? 'bg-[#051424] border-white/10 text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10 text-left">
                    <div className="space-y-4 md:col-span-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#00A896] to-[#2B6AFF] rounded-full flex items-center justify-center text-white">
                                <Logo className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="text-base font-bold text-white tracking-tight font-display">SANTIAGO CÓRDOVA</div>
                                <div className="text-[10px] text-[#00A896] font-mono uppercase tracking-widest font-bold">Soluciones Tributarias PRO</div>
                            </div>
                        </div>
                        <p className="text-sm font-light max-w-md leading-relaxed text-slate-300">
                            Ingeniería tributaria de precisión y blindaje fiscal en Ecuador. Tu tranquilidad contable en manos de profesionales certificados.
                        </p>
                        <div className="text-xs font-mono text-[#00A896]">
                            Pasaje · Machala · El Oro · Ecuador
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-xs font-bold text-white uppercase tracking-widest font-mono">Servicios de Élite</div>
                        <ul className="space-y-2 text-xs font-light">
                            <li>Declaraciones SRI (IVA y Renta)</li>
                            <li>Firma Electrónica .P12 Inmediata</li>
                            <li>Devolución de IVA Tercera Edad</li>
                            <li>Asesoría y Encuadre RIMPE 2026</li>
                            <li>Auditoría y Limpieza de Multas</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <div className="text-xs font-bold text-white uppercase tracking-widest font-mono">Contacto Directo</div>
                        <p className="text-xs font-light">Atención personalizada de lunes a sábado.</p>
                        <a
                            href={`https://wa.me/${phoneNumber}?text=Hola%20Santiago%20C%C3%B3rdova,%20quisiera%20agendar%20una%20consulta.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-bold text-[#00A896] hover:underline font-mono"
                        >
                            <Phone size={14} />
                            <span>+593 97 898 0722</span>
                        </a>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono">
                    <div>© {new Date().getFullYear()} Santiago Córdova. Todos los derechos reservados.</div>
                    <div className="mt-2 sm:mt-0 text-[#00A896]">Soluciones Tributarias PRO · Ecuador</div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
