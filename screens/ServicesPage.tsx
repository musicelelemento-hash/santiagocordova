import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Modal } from '../components/ui/Modal';
import { AuthModal } from '../components/features/AuthModal';
import { OrderItem, WebOrder, PublicUser } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';
import { validarIdentificacionEcuatoriana } from '../utils/sriCalculators';

interface ServicesPageProps {
    onAdminAccess: () => void;
    onSubmitOrder: (order: WebOrder) => void;
    onNavigateToHome: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
    theme?: 'light' | 'dark';
    toggleTheme?: () => void;
}

// Componente Local: SpotlightCard reutilizable con soporte de temas Stitch
const SpotlightCard: React.FC<{ children: React.ReactNode; className?: string; popular?: boolean; theme?: 'light' | 'dark' }> = ({ children, className = "", popular = false, theme = 'dark' }) => {
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
            className={`relative rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 ${
                theme === 'dark' 
                    ? `bg-[#051424]/90 border shadow-2xl backdrop-blur-xl ${popular ? 'border-[#00A896] ring-4 ring-[#00A896]/15' : 'border-white/10 hover:border-[#00A896]/40'}` 
                    : `bg-white border shadow-xl backdrop-blur-md ${popular ? 'border-[#00A896] ring-4 ring-[#00A896]/20' : 'border-slate-200 hover:border-[#00A896]/50'}`
            } ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, rgba(0, 168, 150, ${theme === 'dark' ? 0.18 : 0.12}), transparent 45%)`,
                }}
            />
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};

export const ServicesPage: React.FC<ServicesPageProps> = ({ onAdminAccess, onSubmitOrder, onNavigateToHome, currentUser, onLogin, onLogout, theme = 'dark', toggleTheme }) => {
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

    // Validar RUC/Cédula en tiempo real
    useEffect(() => {
        const ruc = clientRuc.trim();
        if (!ruc) {
            setRucError('');
            return;
        }
        if (validarIdentificacionEcuatoriana(ruc)) {
            setRucError('');
        } else {
            if (ruc.length >= 10) {
                setRucError('Identificación inválida para Ecuador. Verifique los dígitos.');
            } else {
                setRucError('');
            }
        }
    }, [clientRuc]);

    // Verificar validez total del formulario para habilitar el envío
    const isFormValid = React.useMemo(() => {
        const hasName = clientName.trim().length > 0;
        const hasPhone = clientPhone.trim().length > 0;
        const ruc = clientRuc.trim();
        const isRucValid = !ruc || validarIdentificacionEcuatoriana(ruc);
        return hasName && hasPhone && isRucValid;
    }, [clientName, clientPhone, clientRuc]);

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
        setCart(prev => [...prev, newItem]);
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
                title: "Firma Electrónica .P12",
                price: (serviceFees as any).customPunctualServices?.find((s: any) => s.id === 'firma-electronica')?.price?.toString() || "35.00",
                description: "Token digital .P12 válido para facturación SRI, Quipux y trámites legales con entrega inmediata.",
                features: ["Vigencia Oficial 1 Año", "Entrega Inmediata en 24h", "Instalación Remota", "Soporte Técnico Especializado"],
                icon: LucideIcons.FileKey,
                popular: false
            },
            {
                title: "Pack Facturador Pro",
                price: (serviceFees as any).customPunctualServices?.find((s: any) => s.id === 'pack-facturador')?.price?.toString() || "55.00",
                originalPrice: "75.00",
                save: "20.00",
                description: "Sistema de facturación web ilimitado + Firma electrónica certificada y emisión protegida.",
                features: ["Firma Electrónica (1 Año)", "Facturación Web Ilimitada", "Anulación de Facturas Gratis", "Migración Zifact Incluida"],
                icon: LucideIcons.Laptop,
                popular: true
            },
            {
                title: "Migración Ecuafact",
                price: "0.00",
                description: "Asistencia para migrar tus clientes y catálogo de productos desde Ecuafact hacia nuestro Facturador Pro.",
                features: ["Convertidor Automático (Excel)", "Mapeo Inteligente", "Respaldo Seguro", "100% Gratuito"],
                icon: LucideIcons.ArrowRightLeft,
                popular: false
            }
        ],
        tax: [
            {
                title: "RIMPE Negocio Popular",
                price: serviceFees.rentaNP.toString(),
                originalPrice: (serviceFees.rentaNP * 1.5).toFixed(2),
                save: (serviceFees.rentaNP * 0.5).toFixed(2),
                description: "Cumplimiento anual simplificado obligatorio para microempresarios y comercios.",
                features: ["Declaración Renta Anual", "Reporte de Obligaciones SRI", "Asesoría Contable Personalizada"],
                icon: LucideIcons.Star,
                popular: false
            },
            {
                title: "RIMPE Emprendedor",
                price: serviceFees.ivaSemestral.toString(),
                originalPrice: (serviceFees.ivaSemestral * 1.6).toFixed(2),
                save: (serviceFees.ivaSemestral * 0.6).toFixed(2),
                description: "Gestión semestral integral para negocios y emprendedores en fase de expansión.",
                features: ["IVA Semestral", "Renta Anual", "Anexo Transaccional ATS", "Soporte Prioritario de Élite"],
                icon: LucideIcons.TrendingUp,
                popular: true
            },
            {
                title: "Servicios Profesionales",
                price: (serviceFees.ivaMensual * 5).toString(),
                description: "Gestión contable mensual completa para prestadores de servicios profesionales autónomos.",
                features: ["IVA Mensual", "Anexo Gastos Personales", "Devolución de Retenciones", "Planeación Fiscal Continua"],
                icon: LucideIcons.User,
                popular: false
            }
        ],
        special: [
            {
                title: "Devolución IVA Tercera Edad",
                price: serviceFees.devolucionIva.toString(),
                description: "Trámite 100% digital de recuperación mensual del IVA para Tercera Edad y Discapacidad.",
                features: ["Análisis de Comprobantes Electrónicos", "Carga Oficial en el SRI", "Seguimiento hasta Acreditación Bancaria"],
                icon: LucideIcons.DollarSign,
                popular: true
            },
            {
                title: "Devolución Renta en Exceso",
                price: serviceFees.devolucionRenta.toString(),
                description: "Recuperación estructurada de retenciones de impuesto a la renta retenidas en exceso.",
                features: ["Análisis Detallado de Retenciones", "Solicitud de Devolución Web SRI", "Validación de Cuenta Bancaria"],
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
                planTitle: "Devolución IVA Tercera Edad",
                price: serviceFees.devolucionIva,
                description: "Trámite de recuperación mensual del IVA para Tercera Edad y Discapacidad. Recupera hasta el tope mensual de ley.",
                planObj: plans.special[0]
            };
        }
        
        if (actividad === 'profesional') {
            const price = serviceFees.ivaMensual * 5;
            return {
                regimen: "Régimen General (Servicios Profesionales)",
                planTitle: "Servicios Profesionales",
                price: price,
                description: "Gestión contable mensual completa para profesionales autónomos, con asesoría fiscal personalizada y devolución de retenciones.",
                planObj: plans.tax[2]
            };
        }

        if (ingresos <= 20000) {
            return {
                regimen: "RIMPE - Negocio Popular",
                planTitle: "RIMPE Negocio Popular",
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
                flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 flex-shrink-0 cursor-pointer
                ${activeCategory === id
                    ? 'bg-[#00A896] text-white shadow-lg shadow-[#00A896]/30 scale-105 font-bold'
                    : theme === 'dark'
                    ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                }
            `}
        >
            <Icon size={16} strokeWidth={2.5} /> {label}
            {activeCategory === id && <div className="w-1.5 h-1.5 rounded-full bg-white ml-1 animate-pulse"></div>}
        </button>
    );

    return (
        <div className={`min-h-screen font-sans selection:bg-[#00A896]/30 selection:text-white overflow-x-hidden pb-20 md:pb-0 relative transition-colors duration-500 ${
            theme === 'dark' ? 'bg-[#0b1326] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}>
            
            {/* Tactical Grid Background */}
            <div className="fixed inset-0 tactical-grid pointer-events-none z-[1] opacity-25" />

            {/* Header / Nav */}
            <nav className={`fixed w-full z-50 transition-all duration-500 border-b ${
                scrolled 
                    ? (theme === 'dark' ? 'bg-[#051424]/90 backdrop-blur-2xl shadow-2xl py-4 border-white/10' : 'bg-white/90 backdrop-blur-2xl shadow-xl py-4 border-slate-200')
                    : 'bg-transparent py-6 border-transparent'
            }`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center relative z-10">
                    <button onClick={onNavigateToHome} className="flex items-center gap-3 group text-left cursor-pointer">
                        <div className={`p-2 rounded-2xl transition-all shadow-md ${
                            theme === 'dark' ? 'bg-white/10 border border-white/20' : 'bg-white border border-slate-200 shadow-sm'
                        }`}>
                            <Logo className="w-6 h-6 text-[#00A896]" />
                        </div>
                        <div>
                            <span className={`text-sm font-bold tracking-tight leading-none block font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SANTIAGO CÓRDOVA</span>
                            <span className="text-[10px] font-bold text-[#00A896] tracking-[0.2em] uppercase leading-none mt-1 block font-mono">Soluciones Tributarias PRO</span>
                        </div>
                    </button>

                    <div className="hidden md:flex items-center gap-6">
                        <button onClick={onNavigateToHome} className={`text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                            theme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}>Inicio</button>
                        
                        <button onClick={() => setIsCartOpen(true)} className={`relative flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors group cursor-pointer ${
                            theme === 'dark' ? 'text-slate-300 hover:text-[#00A896]' : 'text-slate-700 hover:text-[#00A896]'
                        }`}>
                            <div className="relative">
                                <LucideIcons.ShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
                                {cart.length > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-[#00A896] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-[0_0_10px_#00A896]">
                                        {cart.length}
                                    </span>
                                )}
                            </div>
                            <span>Carrito</span>
                        </button>

                        {toggleTheme && (
                            <button
                                onClick={toggleTheme}
                                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                                    theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300 hover:text-white' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                                title="Cambiar tema"
                            >
                                {theme === 'dark' ? <LucideIcons.Sun size={15} /> : <LucideIcons.Moon size={15} />}
                            </button>
                        )}

                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 rounded-full bg-[#00A896] hover:bg-teal-600 text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#00A896]/20 font-mono">
                            <LucideIcons.MessageCircle size={16} /> Consulta VIP
                        </a>
                    </div>

                    <button onClick={() => setMobileMenuOpen(true)} className={`md:hidden p-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        <LucideIcons.Menu size={24} />
                    </button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center space-y-8 p-8 ${
                    theme === 'dark' ? 'bg-[#0b1326]' : 'bg-slate-50'
                }`}>
                    <button className="absolute top-8 right-8 p-3 bg-white/10 border border-white/15 rounded-full text-white cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                        <LucideIcons.X size={24} />
                    </button>
                    <button onClick={() => { onNavigateToHome(); setMobileMenuOpen(false); }} className={`text-3xl font-display font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Inicio</button>
                    <button onClick={() => { setIsCartOpen(true); setMobileMenuOpen(false); }} className={`text-3xl font-display font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Ver Carrito ({cart.length})</button>
                    {toggleTheme && (
                        <button onClick={() => { toggleTheme(); setMobileMenuOpen(false); }} className="text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-full bg-white/10 flex items-center gap-2">
                            {theme === 'dark' ? <LucideIcons.Sun size={16} /> : <LucideIcons.Moon size={16} />} Cambiar Tema
                        </button>
                    )}
                    <button onClick={() => { onAdminAccess(); setMobileMenuOpen(false); }} className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-8 border border-white/10 px-6 py-3 rounded-full bg-white/5">Acceso Admin</button>
                </div>
            )}

            {/* Hero Section */}
            <div className={`relative pt-36 pb-20 px-6 rounded-b-[4rem] overflow-hidden text-center border-b transition-colors duration-500 ${
                theme === 'dark' ? 'bg-[#051424]/90 border-white/10 shadow-2xl' : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-200 shadow-xl'
            }`}>
                <div className="relative z-10 max-w-4xl mx-auto space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00A896]/10 border border-[#00A896]/30 text-[#00A896] text-xs font-bold uppercase tracking-widest mb-2 font-mono">
                        <LucideIcons.Globe size={14} /> CATÁLOGO DE SOLUCIONES TRIBUTARIAS 2026
                    </div>
                    <h1 className={`text-4xl sm:text-6xl md:text-7xl font-display font-black tracking-tight leading-tight uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        SERVICIOS & <br /> <span className="text-[#00A896]">FIRMA ELECTRÓNICA.</span>
                    </h1>
                    <p className={`text-base md:text-lg max-w-2xl mx-auto font-light leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                        Liderazgo contable por el Ing. Santiago Córdova. Optimiza tu perfil tributario con nuestro simulador inteligente y contrata firmas electrónicas o declaraciones de forma ágil y segura.
                    </p>
                </div>
            </div>

            {/* --- CALCULADORA TRIBUTARIA INTERACTIVA --- */}
            <div className="max-w-5xl mx-auto px-6 -mt-10 mb-16 relative z-30">
                <SpotlightCard theme={theme} className="shadow-2xl relative border-[#00A896]/30" popular={true}>
                    <div className="p-6 md:p-10">
                        <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
                            {/* Left Info */}
                            <div className="max-w-md text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-full text-[10px] font-bold uppercase tracking-widest mb-3 font-mono">
                                    <LucideIcons.Activity size={12} /> Inteligencia Fiscal SRI
                                </div>
                                <h3 className={`text-2xl md:text-3xl font-display font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Simula tu Perfil Tributario</h3>
                                <p className={`text-xs font-light leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                    Selecciona tu tipo de actividad y rango de ingresos anuales estimados para diagnosticar tu régimen SRI y plan sugerido.
                                </p>
                            </div>

                            {/* Right Controls */}
                            <div className="w-full lg:w-96 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Actividad Económica</label>
                                    <select
                                        value={calcActividad}
                                        onChange={e => setCalcActividad(e.target.value as any)}
                                        className={`w-full p-3 rounded-2xl border text-xs font-bold outline-none cursor-pointer ${
                                            theme === 'dark' ? 'bg-[#020b14] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                        }`}
                                    >
                                        <option value="comercial">Comercio, Bienes y Servicios (General/RIMPE)</option>
                                        <option value="profesional">Servicios Profesionales / Honorarios</option>
                                        <option value="discapacidad_3ra_edad">Tercera Edad / Discapacidad (Devolución IVA)</option>
                                    </select>
                                </div>

                                {calcActividad !== 'discapacidad_3ra_edad' && (
                                    <div>
                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-mono">
                                            <span>Ingresos Anuales:</span>
                                            <span className="text-[#00A896] text-xs font-mono">${calcIngresos.toLocaleString()}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1000}
                                            max={350000}
                                            step={1000}
                                            value={calcIngresos}
                                            onChange={e => setCalcIngresos(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#00A896]"
                                        />
                                        <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                                            <span>$1k</span>
                                            <span>$20k (Popular)</span>
                                            <span>$300k (Emprendedor)</span>
                                            <span>$350k+</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recommendation Result Card */}
                        <div className={`mt-8 pt-6 border-t flex flex-col md:flex-row gap-6 items-center justify-between ${
                            theme === 'dark' ? 'border-white/10' : 'border-slate-200'
                        }`}>
                            <div className="text-left space-y-1">
                                <div className="text-[9px] font-bold text-[#00A896] uppercase tracking-[0.2em] font-mono">Régimen Detectado</div>
                                <div className={`text-xl font-display font-bold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{recommendation.regimen}</div>
                                <p className={`text-xs font-light leading-relaxed max-w-xl ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{recommendation.description}</p>
                            </div>
                            
                            <div className={`flex items-center gap-4 p-4 px-6 rounded-3xl border w-full md:w-auto justify-between md:justify-start ${
                                theme === 'dark' ? 'bg-[#020b14] border-white/10' : 'bg-slate-100 border-slate-200'
                            }`}>
                                <div className="text-left">
                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">Plan Sugerido</div>
                                    <div className={`text-sm font-bold truncate max-w-[150px] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{recommendation.planTitle}</div>
                                    <div className="text-xl font-mono font-black text-[#00A896]">${recommendation.price}</div>
                                </div>
                                <button
                                    onClick={() => handleAddToCart(recommendation.planObj)}
                                    className="px-6 py-3 rounded-2xl bg-[#00A896] hover:bg-teal-600 text-white font-bold text-xs uppercase tracking-wider transition-all scale-105 hover:scale-110 active:scale-95 shadow-lg shadow-[#00A896]/20 font-mono cursor-pointer"
                                >
                                    Contratar
                                </button>
                            </div>
                        </div>
                    </div>
                </SpotlightCard>
            </div>

            {/* --- STICKY CATEGORY NAV --- */}
            <div className="sticky top-[72px] z-40 py-4 mb-8 overflow-x-auto no-scrollbar px-6 flex justify-center">
                <div className={`inline-flex gap-2 p-1.5 rounded-full border shadow-2xl backdrop-blur-2xl ${
                    theme === 'dark' ? 'bg-[#051424]/90 border-white/10' : 'bg-white/90 border-slate-200'
                }`}>
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
                            theme={theme}
                            popular={plan.popular}
                            className="flex flex-col justify-between relative"
                        >
                            <div className="p-8 pb-0">
                                {plan.popular && (
                                    <div className="absolute top-0 right-0 bg-gradient-to-r from-[#00A896] to-teal-500 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest z-10 font-mono">
                                        Más Popular
                                    </div>
                                )}

                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform hover:scale-110 ${
                                    plan.popular 
                                        ? 'bg-[#00A896] text-white shadow-lg shadow-[#00A896]/20' 
                                        : theme === 'dark' 
                                        ? 'bg-white/5 text-[#00A896] border border-white/10' 
                                        : 'bg-teal-50 text-[#00A896] border border-teal-100'
                                }`}>
                                    <plan.icon size={26} strokeWidth={1.5} />
                                </div>
                                <h3 className={`text-xl font-black mb-2 leading-tight uppercase tracking-wide font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{plan.title}</h3>
                                <p className={`text-xs font-light min-h-[3rem] leading-relaxed line-clamp-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{plan.description}</p>
                            </div>

                            <div className="p-8 pt-4">
                                <div className={`flex items-end gap-2 mb-6 border-t pt-4 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                                    <span className={`text-4xl font-mono font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>${plan.price}</span>
                                    {plan.originalPrice && (
                                        <div className="flex flex-col mb-1">
                                            <span className="text-[10px] font-medium text-slate-500 line-through">${plan.originalPrice}</span>
                                            <span className="text-[9px] font-bold text-[#00A896] bg-[#00A896]/10 border border-[#00A896]/20 px-1.5 py-0.5 rounded uppercase font-mono">AHORRA ${plan.save}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3.5 mb-8">
                                    {plan.features.map((feat: string, i: number) => (
                                        <div key={i} className={`flex items-start gap-3 text-xs font-light ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                            <div className="min-w-[16px] mt-0.5 text-[#00A896]"><LucideIcons.CheckCircle size={15} /></div>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleAddToCart(plan)}
                                    className={`
                                        w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg font-mono cursor-pointer
                                        ${plan.popular ? 'bg-[#00A896] text-white hover:bg-teal-600 shadow-[#00A896]/20' : theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10' : 'bg-slate-900 text-white hover:bg-slate-800'}
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
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-4">
                    <div className={`p-4 rounded-2xl shadow-2xl flex justify-between items-center border backdrop-blur-2xl ${
                        theme === 'dark' ? 'bg-[#051424]/95 text-white border-white/20' : 'bg-white/95 text-slate-900 border-slate-200'
                    }`}>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{cart.length} Servicio{cart.length > 1 ? 's' : ''}</span>
                            <span className="text-xl font-mono font-bold">${cartTotal.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={() => setIsCheckoutOpen(true)}
                            className="px-6 py-3 bg-[#00A896] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#00A896]/30 cursor-pointer"
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
                    <div className={`relative w-full max-w-md h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300 border-l ${
                        theme === 'dark' ? 'bg-[#051424] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 relative z-10">
                            <h3 className={`text-xl font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Su Carrito</h3>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors cursor-pointer"><LucideIcons.X size={20} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-2 relative z-10 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 text-slate-500">
                                    <LucideIcons.Package size={64} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-sm font-light">Su carrito está vacío.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-colors ${
                                        theme === 'dark' ? 'bg-white/5 border-white/5 hover:border-[#00A896]/30' : 'bg-slate-50 border-slate-200 hover:border-[#00A896]/40'
                                    }`}>
                                        <div>
                                            <p className={`font-semibold text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                                            <span className="text-[#00A896] font-mono font-bold text-lg">${item.price.toFixed(2)}</span>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-rose-400 hover:text-rose-300 p-2 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"><LucideIcons.Trash2 size={16} /></button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className={`mt-6 pt-6 border-t relative z-10 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-6 text-lg font-medium">
                                <span className="text-slate-400">Total</span>
                                <span className="text-[#00A896] text-2xl font-mono font-bold">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                                disabled={cart.length === 0}
                                className="w-full py-4 bg-[#00A896] hover:bg-teal-600 text-white font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[#00A896]/20 flex items-center justify-center gap-3 uppercase tracking-wider text-xs cursor-pointer"
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
                    <div className={`text-center py-16 px-6 rounded-3xl relative overflow-hidden ${
                        theme === 'dark' ? 'bg-[#051424] text-white' : 'bg-white text-slate-900'
                    }`}>
                        <div className="w-24 h-24 bg-[#00A896] text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#00A896]/30 animate-bounce">
                            <LucideIcons.Check size={48} strokeWidth={3} />
                        </div>
                        <h3 className="text-3xl font-display font-bold tracking-wide mb-4">¡Pedido Recibido!</h3>
                        <p className="text-slate-400 font-light text-base leading-relaxed max-w-sm mx-auto">
                            Procesando y redireccionando de forma segura a WhatsApp para el desglose de su pedido...
                        </p>
                    </div>
                ) : (
                    <div className={`p-2 rounded-3xl relative overflow-hidden font-sans ${
                        theme === 'dark' ? 'bg-[#051424] text-white' : 'bg-white text-slate-900'
                    }`}>
                        {/* Header Moderno */}
                        <div className="mb-6 text-center relative z-10">
                            <div className="inline-flex p-3 bg-[#00A896]/10 border border-[#00A896]/20 rounded-2xl mb-3">
                                <LucideIcons.ShieldCheck className="text-[#00A896]" size={32} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-display font-bold tracking-tight">Finalizar Contratación</h3>
                            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1 font-mono">Gestión Tributaria Pro - Santiago Córdova</p>
                        </div>

                        <form onSubmit={handleCheckoutSubmit} className="space-y-5 relative z-10">
                            {/* Resumen */}
                            <div className={`p-5 rounded-3xl border relative overflow-hidden shadow-xl ${
                                theme === 'dark' ? 'bg-[#020b14] border-white/10' : 'bg-slate-50 border-slate-200'
                            }`}>
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00A896]"></div> Resumen de Compra
                                </h4>
                                <div className="space-y-2 mb-4 max-h-36 overflow-y-auto pr-1">
                                    {cart.map(i => (
                                        <div key={i.id} className="flex justify-between items-center text-xs">
                                            <span className={`font-light truncate max-w-[220px] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{i.title}</span>
                                            <span className="font-mono font-bold text-[#00A896]">${i.price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-end pt-3 border-t border-white/5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</span>
                                    <span className={`text-2xl font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Campos de Datos */}
                            <div className="space-y-3.5">
                                <div>
                                    <label htmlFor="checkout-name" className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-2 tracking-wider">Nombre Destinatario</label>
                                    <input 
                                        required 
                                        id="checkout-name"
                                        type="text" 
                                        value={clientName} 
                                        onChange={e => setClientName(e.target.value)} 
                                        className={`w-full p-3.5 rounded-2xl border text-sm outline-none transition-all ${
                                            theme === 'dark' ? 'bg-[#020b14] border-white/10 text-white focus:border-[#00A896]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#00A896]'
                                        }`}
                                        placeholder="Juan Pérez" 
                                        disabled={!!currentUser} 
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="checkout-phone" className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-2 tracking-wider">WhatsApp Contacto</label>
                                        <input 
                                            required 
                                            id="checkout-phone"
                                            type="tel" 
                                            value={clientPhone} 
                                            onChange={e => setClientPhone(e.target.value)} 
                                            className={`w-full p-3.5 rounded-2xl border text-sm outline-none transition-all ${
                                                theme === 'dark' ? 'bg-[#020b14] border-white/10 text-white focus:border-[#00A896]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#00A896]'
                                            }`}
                                            placeholder="099 123 4567" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="checkout-ruc" className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-2 tracking-wider">RUC / Cédula (Opcional)</label>
                                        <input 
                                            id="checkout-ruc"
                                            type="text" 
                                            value={clientRuc} 
                                            onChange={e => setClientRuc(e.target.value.replace(/\D/g, ''))} 
                                            className={`w-full p-3.5 rounded-2xl border text-sm outline-none transition-all ${
                                                rucError 
                                                    ? 'border-rose-500/50 focus:border-rose-500' 
                                                    : theme === 'dark' ? 'bg-[#020b14] border-white/10 text-white focus:border-[#00A896]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#00A896]'
                                            }`} 
                                            placeholder="0702706813001" 
                                        />
                                    </div>
                                </div>
                                {rucError && (
                                    <p className="text-rose-400 text-[10px] pl-2 font-semibold">{rucError}</p>
                                )}
                            </div>

                            {/* Botón de Acción */}
                            <button 
                                id="checkout-submit"
                                type="submit" 
                                disabled={!isFormValid}
                                className={`w-full py-4 text-white font-bold rounded-2xl transition-all text-xs uppercase tracking-widest shadow-2xl cursor-pointer ${
                                    isFormValid 
                                        ? 'bg-[#00A896] hover:bg-teal-600 shadow-[#00A896]/20 active:scale-95' 
                                        : 'bg-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    Enviar Pedido por WhatsApp <LucideIcons.Zap size={15} fill="currentColor" />
                                </span>
                            </button>
                        </form>
                    </div>
                )}
            </Modal>

            {/* Footer */}
            <footer className={`border-t py-12 relative z-10 ${
                theme === 'dark' ? 'bg-[#051424]/90 border-white/10' : 'bg-white border-slate-200'
            }`}>
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Logo className="w-6 h-6 text-[#00A896]" />
                        <span className={`font-display font-bold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SANTIAGO CÓRDOVA</span>
                    </div>
                    <div className="flex gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        <button onClick={onNavigateToHome} className="hover:text-[#00A896] transition-colors cursor-pointer">Inicio</button>
                        <button onClick={onAdminAccess} className="hover:text-[#00A896] transition-colors cursor-pointer">Administración</button>
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

export default ServicesPage;