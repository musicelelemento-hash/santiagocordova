import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Modal } from '../components/ui/Modal';
import { AuthModal } from '../components/features/AuthModal';
import { OrderItem, WebOrder, PublicUser } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';

interface ServicesPageProps {
    onAdminAccess: () => void;
    onSubmitOrder: (order: WebOrder) => void;
    onNavigateToHome: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
}

// Helper: Algoritmo de validación de RUC y Cédula de Ecuador (Módulo 10 y 11)
export const validarIdentificacionEcuatoriana = (id: string): boolean => {
    const cedula = id.trim();
    if (cedula.length !== 10 && cedula.length !== 13) return false;
    
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) return false;
    
    const tercerDigito = parseInt(cedula.substring(2, 3), 10);
    if (tercerDigito < 0 || (tercerDigito > 6 && tercerDigito !== 9)) return false;
    
    // Algoritmo Módulo 10 para personas naturales
    if (tercerDigito < 6) {
        const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;
        
        for (let i = 0; i < 9; i++) {
            let valor = parseInt(cedula.charAt(i), 10) * coeficientes[i];
            if (valor > 9) valor -= 9;
            suma += valor;
        }
        
        const decenaSuperior = Math.ceil(suma / 10) * 10;
        const residuo = decenaSuperior - suma;
        const verificadorCalculado = residuo === 10 ? 0 : residuo;
        
        const esIdentificacionValida = verificadorCalculado === digitoVerificador;
        
        if (cedula.length === 13) {
            return esIdentificacionValida && cedula.substring(10, 13) === "001";
        }
        return esIdentificacionValida;
    }
    
    // Sociedades privadas / extranjeros (tercer dígito 9 - Módulo 11)
    if (tercerDigito === 9 && cedula.length === 13) {
        const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
        const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        
        for (let i = 0; i < 9; i++) {
            suma += parseInt(cedula.charAt(i), 10) * coeficientes[i];
        }
        
        const residuo = suma % 11;
        const verificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
        
        return verificadorCalculado === digitoVerificador && cedula.substring(10, 13) === "001";
    }
    
    // Sociedades públicas (tercer dígito 6 - Módulo 11)
    if (tercerDigito === 6 && cedula.length === 13) {
        const digitoVerificador = parseInt(cedula.substring(8, 9), 10);
        const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        
        for (let i = 0; i < 8; i++) {
            suma += parseInt(cedula.charAt(i), 10) * coeficientes[i];
        }
        
        const residuo = suma % 11;
        const verificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
        
        return verificadorCalculado === digitoVerificador && cedula.substring(9, 13) === "0001";
    }
    
    return false;
};

// Componente Local: SpotlightCard reutilizable para el tema Dark Zen
const SpotlightCard: React.FC<{ children: React.ReactNode; className?: string; popular?: boolean }> = ({ children, className = "", popular = false }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPosition({ x, y });
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setOpacity(1)}
            onMouseLeave={handleMouseLeave}
            className={`relative bg-white/5 border rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 ${
                popular ? 'border-[#00A896] ring-4 ring-[#00A896]/10' : 'border-white/10'
            } ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, rgba(0, 168, 150, 0.15), transparent 45%)`,
                }}
            />
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};

export const ServicesPage: React.FC<ServicesPageProps> = ({ onAdminAccess, onSubmitOrder, onNavigateToHome, currentUser, onLogin, onLogout }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<'tax' | 'tech' | 'special'>('tax');

    // Cart & Store State
    const { serviceFees } = useAppStore();
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    // Checkout Form State
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientRuc, setClientRuc] = useState('');
    const [rucError, setRucError] = useState('');
    const [orderSuccess, setOrderSuccess] = useState(false);

    // Tax Calculator State
    const [calcIngresos, setCalcIngresos] = useState(15000);
    const [calcActividad, setCalcActividad] = useState<'comercial' | 'profesional' | 'discapacidad_3ra_edad'>('comercial');

    const phoneNumber = "593978980722";
    const whatsappLink = `https://wa.me/${phoneNumber}`;

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (currentUser) {
            setClientName(currentUser.name);
            setClientEmail(currentUser.email);
        }
    }, [currentUser]);

    const handleAddToCart = (service: any) => {
        const newItem: OrderItem = {
            id: uuidv4(),
            title: service.title,
            price: parseFloat(service.price),
            quantity: 1
        };
        setCart([...cart, newItem]);
        if (window.innerWidth > 768) {
            setIsCartOpen(true);
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

    const handleCheckoutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !clientPhone) {
            alert("Nombre y Teléfono son obligatorios");
            return;
        }

        // Validación de RUC / Cédula
        if (clientRuc) {
            if (!validarIdentificacionEcuatoriana(clientRuc)) {
                setRucError('El RUC o Cédula ingresado no es válido para Ecuador. Por favor verifique el número.');
                return;
            } else {
                setRucError('');
            }
        }

        const newOrder: WebOrder = {
            id: uuidv4(),
            clientName,
            clientPhone,
            clientEmail,
            clientRuc,
            items: cart,
            total: cartTotal,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Enviar pedido a la base de datos
        onSubmitOrder(newOrder);
        setOrderSuccess(true);

        // Generar enlace dinámico de WhatsApp con desglose de precios
        const messageHeader = `*Hola Ing. Santiago Córdova*, he realizado un pedido de servicios tributarios desde su sitio web:\n\n`;
        const messageClient = `👤 *Cliente:* ${clientName}\n📞 *Teléfono:* ${clientPhone}\n🆔 *RUC/Cédula:* ${clientRuc || 'No proporcionado'}\n✉️ *Email:* ${clientEmail || 'No proporcionado'}\n\n`;
        const messageItemsHeader = `📋 *Desglose de Servicios Solicitados:*\n`;
        const messageItems = cart.map((item, idx) => `${idx + 1}. *${item.title}* - $${item.price.toFixed(2)}`).join('\n');
        const messageTotal = `\n\n💰 *Total a Pagar:* $${cartTotal.toFixed(2)}\n\nPor favor, indíqueme los siguientes pasos para procesar la gestión. ¡Muchas gracias!`;

        const fullMessage = messageHeader + messageClient + messageItemsHeader + messageItems + messageTotal;
        const encodedMessage = encodeURIComponent(fullMessage);
        const dynamicWhatsappLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

        // Redirigir al chat de WhatsApp personalizado en una nueva pestaña
        setTimeout(() => {
            window.open(dynamicWhatsappLink, '_blank');
        }, 1200);

        setTimeout(() => {
            setOrderSuccess(false);
            setIsCheckoutOpen(false);
            setIsCartOpen(false);
            setCart([]);
            if (!currentUser) {
                setClientName('');
                setClientEmail('');
            }
            setClientPhone('');
            setClientRuc('');
            setRucError('');
        }, 3000);
    };

    // Dinámicamente mapear servicios desde las tarifas configuradas
    const plans = {
        tech: [
            {
                title: "Firma Electrónica",
                price: (serviceFees as any).customPunctualServices?.find((s: any) => s.id === 'firma-electronica')?.price?.toString() || "35.00",
                description: "Token digital .P12 válido para facturación SRI, Quipux y trámites legales.",
                features: ["Vigencia 1 Año", "Entrega Inmediata", "Instalación Remota", "Soporte Técnico"],
                icon: LucideIcons.FileKey,
                popular: false
            },
            {
                title: "Pack Facturador",
                price: (serviceFees as any).customPunctualServices?.find((s: any) => s.id === 'pack-facturador')?.price?.toString() || "55.00",
                originalPrice: "75.00",
                save: "20.00",
                description: "Sistema de facturación web ilimitado + Firma electrónica certificada.",
                features: ["Firma Electrónica (1 Año)", "Facturación Ilimitada", "App Móvil Incluida", "Control de Inventario"],
                icon: LucideIcons.Laptop,
                popular: true
            }
        ],
        tax: [
            {
                title: "RIMPE Popular",
                price: serviceFees.rentaNP.toString(),
                originalPrice: (serviceFees.rentaNP * 1.5).toFixed(2),
                save: (serviceFees.rentaNP * 0.5).toFixed(2),
                description: "Cumplimiento anual simplificado para pequeños negocios y microempresas.",
                features: ["Declaración Renta Anual", "Reporte de Obligaciones", "Asesoría Contable Básica"],
                icon: LucideIcons.Star,
                popular: false
            },
            {
                title: "RIMPE Emprendedor",
                price: serviceFees.ivaSemestral.toString(),
                originalPrice: (serviceFees.ivaSemestral * 1.6).toFixed(2),
                save: (serviceFees.ivaSemestral * 0.6).toFixed(2),
                description: "Gestión semestral integral para negocios y emprendedores en fase de crecimiento.",
                features: ["IVA Semestral", "Renta Anual", "Anexo Transaccional", "Soporte Prioritario de Elite"],
                icon: LucideIcons.TrendingUp,
                popular: true
            },
            {
                title: "Profesionales",
                price: (serviceFees.ivaMensual * 5).toString(),
                description: "Gestión contable mensual completa para prestadores de servicios profesionales.",
                features: ["IVA Mensual", "Anexo Gastos Personales", "Devolución de Retenciones", "Planeación Fiscal Anual"],
                icon: LucideIcons.User,
                popular: false
            }
        ],
        special: [
            {
                title: "Devolución IVA",
                price: serviceFees.devolucionIva.toString(),
                description: "Trámite de recuperación mensual del IVA para Tercera Edad y Discapacidad.",
                features: ["Análisis de Facturas Físicas/Electrónicas", "Carga de Solicitud en SRI", "Seguimiento Continuo hasta Acreditación"],
                icon: LucideIcons.DollarSign,
                popular: true
            },
            {
                title: "Devolución Renta",
                price: serviceFees.devolucionRenta.toString(),
                description: "Recuperación estructurada de retenciones de Renta en exceso.",
                features: ["Análisis Detallado de Retenciones", "Solicitud de Devolución por Internet", "Gestión de Validación Bancaria"],
                icon: LucideIcons.ArrowDownCircle,
                popular: false
            }
        ]
    };

    const activePlans = (plans as any)[activeCategory] || [];

    // Recomendación del perfil contable
    const getTaxRecommendation = (ingresos: number, actividad: string) => {
        if (actividad === 'discapacidad_3ra_edad') {
            return {
                regimen: "Grupos Prioritarios (SRI)",
                planTitle: "Devolución IVA",
                price: serviceFees.devolucionIva,
                description: "Trámite de recuperación mensual del IVA para Tercera Edad y Discapacidad. Recupera hasta el tope mensual de ley.",
                planObj: plans.special[0]
            };
        }
        
        if (actividad === 'profesional') {
            const price = serviceFees.ivaMensual * 5;
            return {
                regimen: "Régimen General (Servicios Profesionales)",
                planTitle: "Profesionales",
                price: price,
                description: "Gestión contable mensual completa para profesionales autónomos, con asesoría fiscal personalizada y devolución de retenciones.",
                planObj: plans.tax[2]
            };
        }

        if (ingresos <= 20000) {
            return {
                regimen: "RIMPE - Negocio Popular",
                planTitle: "RIMPE Popular",
                price: serviceFees.rentaNP,
                description: "Declaración anual simplificada obligatoria para microempresarios con ingresos anuales de hasta $20,000.",
                planObj: plans.tax[0]
            };
        } else if (ingresos <= 300000) {
            return {
                regimen: "RIMPE - Emprendedor",
                planTitle: "RIMPE Emprendedor",
                price: serviceFees.ivaSemestral,
                description: "Cumplimiento y declaración semestral de IVA y renta anual para negocios que facturan entre $20,001 y $300,000.",
                planObj: plans.tax[1]
            };
        } else {
            return {
                regimen: "Régimen General (Corporativo)",
                planTitle: "Consultoría Estratégica",
                price: 150.00,
                description: "Planificación fiscal corporativa avanzada, auditoría preventiva y contabilidad completa para empresas consolidadas.",
                planObj: {
                    title: "Consultoría Estratégica",
                    price: "150.00",
                    description: "Sesiones ejecutivas para planificación fiscal corporativa.",
                    features: ["Planificación Fiscal Avanzada", "Auditoría Tributaria Preventiva", "Soporte Legal Continuo"],
                    icon: LucideIcons.Globe
                }
            };
        }
    };

    const recommendation = getTaxRecommendation(calcIngresos, calcActividad);

    const CategoryButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
        <button
            onClick={() => { setActiveCategory(id as any); }}
            className={`
                flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 flex-shrink-0
                ${activeCategory === id
                    ? 'bg-[#00A896] text-white shadow-lg shadow-teal-500/30 scale-105'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-transparent'
                }
            `}
        >
            <Icon size={16} strokeWidth={2.5} /> {label}
            {activeCategory === id && <div className="w-1.5 h-1.5 rounded-full bg-white ml-1 animate-pulse"></div>}
        </button>
    );

    return (
        <div className="min-h-screen bg-[#020617] font-body text-slate-200 selection:bg-[#00A896]/30 selection:text-white overflow-x-hidden pb-20 md:pb-0 relative">
            
            {/* Tactical Grid Background */}
            <div className="fixed inset-0 tactical-grid pointer-events-none z-[1] opacity-25" />
            <div className="fixed inset-0 bg-noise-animated opacity-[0.02] pointer-events-none z-[2]" />

            {/* Header / Nav */}
            <nav className={`fixed w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#020617]/90 backdrop-blur-md shadow-2xl py-4 border-white/10' : 'bg-transparent py-6 border-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center relative z-10">
                    <button onClick={onNavigateToHome} className="flex items-center gap-3 group">
                        <div className={`p-2 rounded-xl transition-all ${scrolled ? 'bg-white/5 border border-white/10' : 'bg-white/10 border border-white/20'}`}>
                            <Logo className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                            <span className="text-sm font-display font-semibold tracking-tight leading-none block text-white whitespace-nowrap">SANTIAGO CORDOVA</span>
                            <span className="text-[10px] font-bold text-[#00A896] tracking-[0.2em] uppercase leading-none mt-1 block">Asesoría Fiscal de Élite</span>
                        </div>
                    </button>

                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={onNavigateToHome} className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">Inicio</button>
                        <button onClick={() => setIsCartOpen(true)} className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-[#00A896] transition-colors group">
                            <div className="relative">
                                <LucideIcons.ShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
                                {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-[#00A896] text-white text-[10px] font-semibold w-4 h-4 flex items-center justify-center rounded-full shadow-[0_0_10px_#00A896]">{cart.length}</span>}
                            </div>
                            <span>Carrito</span>
                        </button>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 rounded-full bg-[#00A896] hover:bg-teal-600 text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-teal-500/20">
                            <LucideIcons.MessageCircle size={16} /> Asesoría Rápida
                        </a>
                    </div>

                    <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-white"><LucideIcons.Menu size={24} /></button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-[#020617] flex flex-col items-center justify-center space-y-8 animate-fade-in p-8">
                    <div className="absolute inset-0 tactical-grid opacity-20 pointer-events-none" />
                    <button className="absolute top-8 right-8 p-3 bg-white/5 border border-white/10 rounded-full text-white" onClick={() => setMobileMenuOpen(false)}>
                        <LucideIcons.X size={24} />
                    </button>
                    <button onClick={() => { onNavigateToHome(); setMobileMenuOpen(false); }} className="text-3xl font-display font-semibold text-white">Inicio</button>
                    <button onClick={() => { setIsCartOpen(true); setMobileMenuOpen(false); }} className="text-3xl font-display font-semibold text-white">Ver Carrito ({cart.length})</button>
                    <button onClick={() => { onAdminAccess(); setMobileMenuOpen(false); }} className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-8 border border-white/5 px-6 py-3 rounded-full bg-white/5">Acceso Admin</button>
                </div>
            )}

            {/* Hero Section */}
            <div className="relative pt-40 pb-20 px-6 rounded-b-[4rem] overflow-hidden text-center bg-[#020617] border-b border-white/10 shadow-2xl">
                {/* Secondary Aurora Effects */}
                <div className="absolute -inset-[10px] opacity-40 z-[0] pointer-events-none">
                    <div className="aurora-blob bg-[#00A896]/20 top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full animate-float" />
                    <div className="aurora-blob bg-[#028090]/25 bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full animate-float-delayed" />
                </div>
                <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#00A896] text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md">
                        <LucideIcons.Globe size={12} /> Ecosistema Digital 2026
                    </div>
                    <h1 className="text-5xl md:text-8xl font-editorial tracking-tight text-white mb-6 leading-none">
                        PORTAFOLIO DE <br /> <span className="text-shimmer-elite">SERVICIOS.</span>
                    </h1>
                    <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mt-4 font-light tracking-wide leading-relaxed">
                        Diseñado por el Ing. Santiago Córdova. Optimiza tu perfil tributario con nuestro simulador interactivo y contrata firmas electrónicas o declaraciones de forma ágil y segura.
                    </p>
                </div>
            </div>

            {/* --- CALCULADORA TRIBUTARIA INTERACTIVA (Top Highlight) --- */}
            <div className="max-w-5xl mx-auto px-6 -mt-10 mb-16 relative z-30">
                <SpotlightCard className="glass-premium-2 shadow-2xl relative" popular={true}>
                    {/* Archive Scan Effect */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-scan pointer-events-none" />
                    
                    <div className="p-8 md:p-12">
                        <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
                            {/* Left Info */}
                            <div className="max-w-md text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                                    <LucideIcons.Activity size={12} /> Inteligencia Fiscal SRI
                                </div>
                                <h3 className="text-2xl md:text-3xl font-editorial text-white mb-3">Simula tu Perfil Tributario</h3>
                                <p className="text-xs text-slate-400 leading-relaxed font-light">
                                    Introduce tu actividad contable e ingresos estimados anuales. Nuestro sistema te indicará en qué régimen tributario encajas y cuál es la estructura de precios idónea para tu caso.
                                </p>
                            </div>

                            {/* Center Controls */}
                            <div className="w-full lg:w-auto flex-1 max-w-lg space-y-6">
                                {/* Activity Select */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left pl-2">Tipo de Actividad Económica</label>
                                    <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
                                        {[
                                            { id: 'comercial', label: 'Comercio / RIMPE', icon: LucideIcons.Store },
                                            { id: 'profesional', label: 'Serv. Profesional', icon: LucideIcons.User },
                                            { id: 'discapacidad_3ra_edad', label: '3ra Edad / IVA', icon: LucideIcons.Heart }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setCalcActividad(opt.id as any)}
                                                className={`py-3 px-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
                                                    calcActividad === opt.id 
                                                        ? 'bg-[#00A896] text-white shadow-lg' 
                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <opt.icon size={16} />
                                                <span className="truncate w-full text-center">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Income Slider (Only if not third age) */}
                                {calcActividad !== 'discapacidad_3ra_edad' && (
                                    <div className="space-y-2">
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
                                            <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 px-1">
                                                <span>$1k</span>
                                                <span>$20k (Popular)</span>
                                                <span>$300k (Emprendedor)</span>
                                                <span>$350k+</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recommendation Result Card */}
                        <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row gap-6 items-center justify-between">
                            <div className="text-left space-y-1">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Régimen Detectado</div>
                                <div className="text-xl font-editorial text-[#00A896] tracking-wide">{recommendation.regimen}</div>
                                <p className="text-xs text-slate-300 font-light leading-relaxed max-w-xl">{recommendation.description}</p>
                            </div>
                            
                            <div className="flex items-center gap-4 bg-black/40 p-4 px-6 rounded-3xl border border-white/5 w-full md:w-auto justify-between md:justify-start">
                                <div className="text-left">
                                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Plan Sugerido</div>
                                    <div className="text-base font-semibold text-white truncate max-w-[150px]">{recommendation.planTitle}</div>
                                    <div className="text-lg font-mono font-bold text-emerald-400">${recommendation.price}</div>
                                </div>
                                <button
                                    onClick={() => handleAddToCart(recommendation.planObj)}
                                    className="px-6 py-3.5 rounded-xl bg-[#00A896] hover:bg-teal-600 text-white font-bold text-xs uppercase tracking-widest transition-all scale-105 hover:scale-110 active:scale-95 shadow-lg shadow-teal-500/20"
                                >
                                    Contratar Plan
                                </button>
                            </div>
                        </div>
                    </div>
                </SpotlightCard>
            </div>

            {/* --- STICKY CATEGORY NAV --- */}
            <div className="sticky top-[72px] z-40 py-4 mb-8 overflow-x-auto no-scrollbar px-6 flex justify-center">
                <div className="inline-flex gap-2 p-1.5 bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-full">
                    <CategoryButton id="tax" label="Tributarios" icon={LucideIcons.Briefcase} />
                    <CategoryButton id="tech" label="Firma & Fact." icon={LucideIcons.Laptop} />
                    <CategoryButton id="special" label="Trámites" icon={LucideIcons.Activity} />
                </div>
            </div>

            {/* Plans Grid */}
            <div className="max-w-7xl mx-auto px-6 relative z-20 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activePlans.map((plan: any, index: number) => (
                        <SpotlightCard
                            key={index}
                            popular={plan.popular}
                            className="flex flex-col justify-between"
                        >
                            <div className="p-8 pb-0">
                                {plan.popular && (
                                    <div className="absolute top-0 right-0 bg-[#00A896] text-white text-[9px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest z-10">
                                        Popular
                                    </div>
                                )}

                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform hover:scale-110 ${plan.popular ? 'bg-[#00A896] text-white' : 'bg-white/5 text-[#00A896] border border-white/10'}`}>
                                    <plan.icon size={26} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 leading-tight uppercase tracking-wide">{plan.title}</h3>
                                <p className="text-xs font-light text-slate-400 min-h-[3rem] leading-relaxed line-clamp-3">{plan.description}</p>
                            </div>

                            <div className="p-8 pt-4">
                                <div className="flex items-end gap-2 mb-6 border-t border-white/5 pt-4">
                                    <span className="text-4xl font-mono font-bold text-white tracking-tighter">${plan.price}</span>
                                    {plan.originalPrice && (
                                        <div className="flex flex-col mb-1">
                                            <span className="text-[10px] font-medium text-slate-500 line-through">${plan.originalPrice}</span>
                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">AHORRA ${plan.save}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3.5 mb-8">
                                    {plan.features.map((feat: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 text-xs font-light text-slate-300">
                                            <div className="min-w-[16px] mt-0.5 text-[#00A896]"><LucideIcons.CheckCircle size={15} /></div>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleAddToCart(plan)}
                                    className={`
                                        w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg
                                        ${plan.popular ? 'bg-[#00A896] text-white hover:bg-teal-600 shadow-teal-500/10' : 'bg-white/15 text-white hover:bg-white/20 shadow-black/10'}
                                    `}
                                >
                                    <LucideIcons.Zap size={14} fill="currentColor" /> Contratar Ahora
                                </button>
                            </div>
                        </SpotlightCard>
                    ))}
                </div>
            </div>

            {/* --- FLOATING CART BAR (MOBILE ONLY) --- */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-slide-up-fade">
                    <div className="bg-[#020617]/90 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-white/10 backdrop-blur-xl">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{cart.length} Servicio{cart.length > 1 ? 's' : ''}</span>
                            <span className="text-xl font-mono font-bold">${cartTotal.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={() => setIsCheckoutOpen(true)}
                            className="px-6 py-3 bg-[#00A896] rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-teal-500/30"
                        >
                            Pagar <LucideIcons.ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Cart Sidebar (Desktop) */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-[#020617] border-l border-white/10 h-full shadow-2xl p-6 flex flex-col animate-slide-in-right text-slate-200">
                        <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 relative z-10">
                            <h3 className="text-xl font-editorial font-medium text-white tracking-wide uppercase">Su Carrito</h3>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><LucideIcons.X size={20} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-2 relative z-10">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 text-slate-500">
                                    <LucideIcons.Package size={64} className="mx-auto mb-4 opacity-15" />
                                    <p className="text-sm font-light">Su carrito está vacío.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-[#00A896]/30 transition-colors">
                                        <div>
                                            <p className="font-semibold text-xs text-white uppercase tracking-wide">{item.title}</p>
                                            <span className="text-[#00A896] font-mono font-bold text-lg">${item.price.toFixed(2)}</span>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-xl transition-all"><LucideIcons.Trash2 size={16} /></button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10 relative z-10">
                            <div className="flex justify-between items-center mb-6 text-lg font-medium">
                                <span className="text-slate-400">Total</span>
                                <span className="text-emerald-400 text-2xl font-mono font-bold">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                                disabled={cart.length === 0}
                                className="w-full py-5 bg-[#00A896] text-white font-bold rounded-2xl hover:bg-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-teal-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                            >
                                Finalizar Pedido <LucideIcons.ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="">
                {orderSuccess ? (
                    <div className="text-center py-16 px-6 animate-fade-in bg-[#020617] text-white rounded-3xl relative overflow-hidden">
                        <div className="absolute inset-0 tactical-grid opacity-10" />
                        <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-400/20 animate-bounce">
                            <LucideIcons.Check size={48} strokeWidth={3} />
                        </div>
                        <h3 className="text-3xl font-editorial tracking-wide mb-4">¡Pedido Recibido!</h3>
                        <p className="text-slate-400 font-light text-base leading-relaxed max-w-sm mx-auto">
                            Procesando y redireccionando de forma segura a WhatsApp para el desglose de su pedido...
                        </p>
                    </div>
                ) : (
                    <div className="p-1 bg-[#020617] text-white rounded-3xl relative overflow-hidden">
                        <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none" />
                        
                        {/* Header Moderno */}
                        <div className="mb-8 text-center relative z-10">
                            <div className="inline-flex p-3 bg-white/5 border border-white/10 rounded-2xl mb-4">
                                <LucideIcons.ShieldCheck className="text-[#00A896]" size={32} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-editorial tracking-tight">Finalizar Contratación</h3>
                            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1">Gestión Tributaria Pro - Santiago Córdova</p>
                        </div>

                        <form onSubmit={handleCheckoutSubmit} className="space-y-6 relative z-10">
                            {/* Resumen Glassmorphic */}
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A896]/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00A896]"></div> Resumen de Compra
                                </h4>
                                <div className="space-y-3 mb-6 max-h-40 overflow-y-auto pr-1">
                                    {cart.map(i => (
                                        <div key={i.id} className="flex justify-between items-center group">
                                            <span className="text-xs font-light text-slate-300 group-hover:text-white transition-colors">{i.title}</span>
                                            <span className="font-mono font-bold text-xs text-[#00A896]">${i.price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-end pt-4 border-t border-white/5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</span>
                                    <span className="text-3xl font-mono font-bold text-white tracking-tighter">${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Campos de Datos */}
                            <div className="space-y-4">
                                <div className="group">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2 ml-4 tracking-wider">Nombre Destinatario</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <LucideIcons.User className="text-slate-500" size={18} />
                                        </div>
                                        <input 
                                            required 
                                            type="text" 
                                            value={clientName} 
                                            onChange={e => setClientName(e.target.value)} 
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 focus:border-[#00A896] rounded-2xl outline-none font-medium text-sm text-white placeholder-slate-600 transition-all" 
                                            placeholder="Juan Pérez" 
                                            disabled={!!currentUser} 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="group">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2 ml-4 tracking-wider">WhatsApp de Contacto</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <LucideIcons.Phone className="text-slate-500" size={18} />
                                            </div>
                                            <input 
                                                required 
                                                type="tel" 
                                                value={clientPhone} 
                                                onChange={e => setClientPhone(e.target.value)} 
                                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 focus:border-[#00A896] rounded-2xl outline-none font-medium text-sm text-white placeholder-slate-600 transition-all" 
                                                placeholder="099 123 4567" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="group">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2 ml-4 tracking-wider">RUC / Cédula</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <LucideIcons.CreditCard className="text-slate-500" size={18} />
                                            </div>
                                            <input 
                                                type="text" 
                                                value={clientRuc} 
                                                onChange={e => {
                                                    setClientRuc(e.target.value);
                                                    if (rucError) setRucError('');
                                                }} 
                                                className={`w-full pl-12 pr-4 py-4 bg-white/5 border rounded-2xl outline-none font-medium text-sm text-white placeholder-slate-600 transition-all ${
                                                    rucError ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#00A896]'
                                                }`} 
                                                placeholder="0702..." 
                                            />
                                        </div>
                                    </div>
                                </div>
                                {rucError && (
                                    <p className="text-red-400 text-[10px] pl-4 font-semibold animate-pulse">{rucError}</p>
                                )}
                            </div>

                            {/* Botón de Acción */}
                            <button 
                                type="submit" 
                                className="w-full py-5 bg-[#00A896] text-white font-bold rounded-2xl hover:bg-teal-600 transition-all text-xs uppercase tracking-widest shadow-2xl relative overflow-hidden group/submit"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/submit:translate-x-full transition-transform duration-1000"></div>
                                <span className="flex items-center justify-center gap-3">
                                    Enviar Solicitud & WhatsApp <LucideIcons.Zap size={16} fill="currentColor" />
                                </span>
                            </button>
                            
                            <p className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <LucideIcons.Lock size={12} /> Canal de Transmisión Encriptada
                            </p>
                        </form>
                    </div>
                )}
            </Modal>

            {/* Simple Footer */}
            <footer className="bg-black/40 border-t border-white/5 py-12 relative z-10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                        <Logo className="w-8 h-8" />
                        <span className="font-editorial text-lg tracking-tighter text-white">SANTIAGO CORDOVA</span>
                    </div>
                    <div className="flex gap-8 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        <a href="#" className="hover:text-[#00A896] transition-colors">Privacidad</a>
                        <a href="#" className="hover:text-[#00A896] transition-colors">Términos</a>
                        <button onClick={onAdminAccess} className="hover:text-white transition-colors">Administración</button>
                    </div>
                </div>
            </footer>

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onLogin={(user) => {
                    onLogin(user);
                    setIsAuthModalOpen(false);
                }}
            />
        </div>
    );
};