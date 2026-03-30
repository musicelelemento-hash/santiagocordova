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

export const ServicesPage: React.FC<ServicesPageProps> = ({ onAdminAccess, onSubmitOrder, onNavigateToHome, currentUser, onLogin, onLogout }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<'tax' | 'tech' | 'special'>('tax');

    // Cart State
    const { serviceFees } = useAppStore();
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    // Checkout Form State
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientRuc, setClientRuc] = useState('');
    const [orderSuccess, setOrderSuccess] = useState(false);

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

        onSubmitOrder(newOrder);
        setOrderSuccess(true);
        setCart([]);
        setTimeout(() => {
            setOrderSuccess(false);
            setIsCheckoutOpen(false);
            setIsCartOpen(false);
            if (!currentUser) {
                setClientName('');
                setClientEmail('');
            }
            setClientPhone('');
            setClientRuc('');
        }, 3000);
    };

    // Mapping services to dynamic fees from settings
    const plans = {
        tech: [
            {
                title: "Firma Electrónica",
                price: (serviceFees as any).customPunctualServices?.find((s: any) => s.id === 'firma-electronica')?.price?.toString() || "35.00",
                description: "Token .P12 válido para facturación SRI, Quipux y trámites legales.",
                features: ["Vigencia 1 Año", "Entrega Inmediata", "Instalación Remota", "Soporte Técnico"],
                icon: LucideIcons.FileKey,
                popular: false,
                color: "from-purple-500 to-indigo-500"
            },
            {
                title: "Pack Facturador",
                price: (serviceFees as any).customPunctualServices?.find((s: any) => s.id === 'pack-facturador')?.price?.toString() || "55.00",
                originalPrice: "75.00",
                save: "20.00",
                description: "Sistema de facturación web ilimitado + Firma electrónica.",
                features: ["Firma Electrónica (1 Año)", "Facturación Ilimitada", "App Móvil", "Control de Inventario"],
                icon: LucideIcons.Laptop,
                popular: true,
                color: "from-sky-400 to-cyan-500"
            }
        ],
        tax: [
            {
                title: "RIMPE Popular",
                price: serviceFees.rentaNP.toString(),
                originalPrice: (serviceFees.rentaNP * 1.5).toFixed(2),
                save: (serviceFees.rentaNP * 0.5).toFixed(2),
                description: "Cumplimiento anual para pequeños negocios.",
                features: ["Declaración Renta Anual", "Reporte de Obligaciones", "Asesoría Básica"],
                icon: LucideIcons.Star,
                popular: false,
                color: "from-slate-500 to-slate-700"
            },
            {
                title: "RIMPE Emprendedor",
                price: serviceFees.ivaSemestral.toString(),
                originalPrice: (serviceFees.ivaSemestral * 1.6).toFixed(2),
                save: (serviceFees.ivaSemestral * 0.6).toFixed(2),
                description: "Gestión semestral para negocios en crecimiento.",
                features: ["IVA Semestral", "Renta Anual", "Anexo Transaccional", "Soporte Prioritario"],
                icon: LucideIcons.TrendingUp,
                popular: true,
                color: "from-[#00A896] to-emerald-500"
            },
            {
                title: "Profesionales",
                price: (serviceFees.ivaMensual * 5).toString(), // Base is monthly, assuming professional pack is ~5x
                description: "Gestión mensual completa para servicios profesionales.",
                features: ["IVA Mensual", "Anexo Gastos Personales", "Devolución de Retenciones", "Planeación Fiscal"],
                icon: LucideIcons.User,
                popular: false,
                color: "from-amber-400 to-orange-500"
            }
        ],
        special: [
            {
                title: "Devolución IVA",
                price: serviceFees.devolucionIva.toString(),
                description: "Trámite para Tercera Edad y Discapacidad.",
                features: ["Análisis de facturas", "Carga de solicitud", "Seguimiento hasta acreditación"],
                icon: LucideIcons.DollarSign,
                popular: true,
                color: "from-emerald-400 to-emerald-700"
            },
            {
                title: "Devolución Renta",
                price: serviceFees.devolucionRenta.toString(),
                description: "Recuperación de retenciones en exceso.",
                features: ["Análisis de retenciones", "Solicitud de devolución", "Gestión de cuenta bancaria"],
                icon: LucideIcons.ArrowDownCircle,
                popular: false,
                color: "from-sky-400 to-indigo-700"
            }
        ]
    };

    const activePlans = (plans as any)[activeCategory] || [];

    const CategoryButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
        <button
            onClick={() => { setActiveCategory(id as any); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
            className={`
                flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 flex-shrink-0
                ${activeCategory === id
                    ? 'bg-[#00A896] text-white shadow-lg shadow-teal-500/30 scale-105'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-500 hover:bg-white hover:text-slate-800 border border-transparent'
                }
            `}
        >
            <Icon size={16} strokeWidth={2.5} /> {label}
            {activeCategory === id && <div className="w-1.5 h-1.5 rounded-full bg-white ml-1 animate-pulse"></div>}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-body text-slate-800 selection:bg-[#00A896] selection:text-white overflow-x-hidden pb-20 md:pb-0">

            {/* Header / Nav */}
            <nav className={`fixed w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-4 border-slate-100' : 'bg-[#0B2149] py-6 border-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <button onClick={onNavigateToHome} className="flex items-center gap-3 group">
                        <div className={`p-2 rounded-xl transition-all ${scrolled ? 'bg-slate-100 border border-slate-200' : 'bg-white/10 border border-white/20'}`}>
                            <Logo className={`w-6 h-6 ${scrolled ? 'text-[#0B2149]' : 'text-white'}`} />
                        </div>
                        <div className="text-left">
                            <span className={`text-base font-display font-semibold tracking-tight leading-none block ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>SERVICIOS</span>
                        </div>
                    </button>

                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={onNavigateToHome} className={`text-sm font-medium transition-colors ${scrolled ? 'text-slate-500 hover:text-[#0B2149]' : 'text-slate-300 hover:text-white'}`}>Inicio</button>
                        <button onClick={() => setIsCartOpen(true)} className={`relative flex items-center gap-2 text-sm font-medium transition-colors group ${scrolled ? 'text-slate-700 hover:text-[#00A896]' : 'text-white hover:text-[#00A896]'}`}>
                            <div className="relative">
                                <LucideIcons.ShoppingCart size={20} className="group-hover:scale-110 transition-transform" />
                                {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-[#00A896] text-white text-[9px] font-semibold w-4 h-4 flex items-center justify-center rounded-full shadow-[0_0_10px_#00A896]">{cart.length}</span>}
                            </div>
                            <span>Carrito</span>
                        </button>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className={`px-6 py-2.5 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${scrolled ? 'bg-[#0B2149] text-white hover:bg-slate-800' : 'bg-white/10 border border-white/20 text-white hover:bg-white hover:text-[#0B2149]'}`}>
                            <LucideIcons.MessageCircle size={16} /> Asesoría
                        </a>
                    </div>

                    <button onClick={() => setMobileMenuOpen(true)} className={`md:hidden p-2 ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}><LucideIcons.Menu size={24} /></button>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-[#020617] flex flex-col items-center justify-center space-y-8 animate-fade-in p-8">
                    <button className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white" onClick={() => setMobileMenuOpen(false)}>
                        <LucideIcons.X size={24} />
                    </button>
                    <button onClick={() => { onNavigateToHome(); setMobileMenuOpen(false); }} className="text-3xl font-display font-semibold text-white">Inicio</button>
                    <button onClick={() => { setIsCartOpen(true); setMobileMenuOpen(false); }} className="text-3xl font-display font-semibold text-white">Ver Carrito ({cart.length})</button>
                    <button onClick={() => { onAdminAccess(); setMobileMenuOpen(false); }} className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-8">Acceso Admin</button>
                </div>
            )}

            {/* Hero Section */}
            <div className="bg-[#0B2149] pt-32 pb-24 px-6 rounded-b-[3rem] relative overflow-hidden text-center shadow-2xl shadow-blue-900/20">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                <div className="absolute top-[-100px] right-[-100px] w-[600px] h-[600px] bg-[#00A896]/20 rounded-full blur-[120px]"></div>

                <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-white text-[10px] font-semibold uppercase tracking-widest mb-6 backdrop-blur-md">
                        <LucideIcons.Globe size={12} /> Servicios Digitales 2026
                    </div>
                    <h1 className="text-4xl md:text-7xl font-display font-semibold text-white mb-6 tracking-tight leading-[1.1]">
                        Soluciones a su <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00A896] to-emerald-300">Medida.</span>
                    </h1>
                </div>
            </div>

            {/* --- STICKY CATEGORY NAV (MOBILE OPTIMIZED) --- */}
            <div className="sticky top-[72px] z-40 py-4 -mt-10 mb-8 overflow-x-auto no-scrollbar px-6 flex justify-center">
                <div className="inline-flex gap-2 p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-full">
                    <CategoryButton id="tax" label="Tributarios" icon={LucideIcons.Briefcase} />
                    <CategoryButton id="tech" label="Firma & Fact." icon={LucideIcons.Laptop} />
                    <CategoryButton id="special" label="Trámites" icon={LucideIcons.Activity} />
                </div>
            </div>

            {/* Plans Grid */}
            <div className="max-w-7xl mx-auto px-6 relative z-20 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activePlans.map((plan: any, index: number) => (
                        <div
                            key={index}
                            className={`group bg-white rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden border relative ${plan.popular ? 'border-[#00A896] ring-4 ring-[#00A896]/10' : 'border-slate-100'}`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 right-0 bg-[#00A896] text-white text-[9px] font-semibold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest z-10">
                                    Popular
                                </div>
                            )}

                            <div className="p-8 pb-0">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${plan.popular ? 'bg-[#0B2149] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <plan.icon size={28} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-2xl font-semibold text-[#0B2149] mb-2 leading-tight">{plan.title}</h3>
                                <p className="text-xs font-medium text-slate-500 min-h-[2.5rem] leading-relaxed line-clamp-2">{plan.description}</p>
                            </div>

                            <div className="p-8 pt-4">
                                <div className="flex items-end gap-2 mb-6">
                                    <span className="text-5xl font-display font-semibold text-slate-900 tracking-tighter">${plan.price}</span>
                                    {plan.originalPrice && (
                                        <div className="flex flex-col mb-1.5">
                                            <span className="text-xs font-medium text-slate-400 line-through">${plan.originalPrice}</span>
                                            <span className="text-[9px] font-semibold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">AHORRA ${plan.save}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 mb-8">
                                    {plan.features.map((feat: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 text-xs font-medium text-slate-600">
                                            <div className="min-w-[16px] mt-0.5 text-[#00A896]"><LucideIcons.CheckCircle size={16} /></div>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleAddToCart(plan)}
                                    className={`
                                        w-full py-4 rounded-xl font-semibold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg
                                        relative overflow-hidden group/btn
                                        ${plan.popular ? 'bg-[#00A896] text-white hover:bg-teal-600 shadow-teal-500/20' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}
                                    `}
                                >
                                    <span className="relative flex items-center gap-2">
                                        <LucideIcons.Zap size={16} fill="currentColor" /> Contratar Ahora
                                    </span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- FLOATING CART BAR (MOBILE ONLY) --- */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 animate-slide-up-fade">
                    <div className="bg-[#0B2149] text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-white/10 backdrop-blur-xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">{cart.length} Servicio{cart.length > 1 ? 's' : ''}</span>
                            <span className="text-xl font-semibold">${cartTotal.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={() => setIsCheckoutOpen(true)}
                            className="px-6 py-3 bg-[#00A896] rounded-xl text-xs font-semibold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-teal-500/30"
                        >
                            Pagar <LucideIcons.ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Cart Sidebar (Desktop) */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-slide-in-right text-slate-900">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                            <h3 className="text-2xl font-display font-medium text-slate-900">Su Pedido</h3>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><LucideIcons.X size={24} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <LucideIcons.Package size={64} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-medium">Su carrito está vacío.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-brand-teal/30 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm text-slate-800">{item.title}</p>
                                            <span className="text-[#00A896] font-semibold text-lg">${item.price.toFixed(2)}</span>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-rose-400 p-2 hover:bg-red-50 rounded-xl transition-all"><LucideIcons.Trash2 size={18} /></button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex justify-between items-center mb-6 text-xl font-medium">
                                <span className="text-slate-500">Total</span>
                                <span className="text-emerald-400 text-2xl font-semibold">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                                disabled={cart.length === 0}
                                className="w-full py-5 bg-[#00A896] text-white font-semibold rounded-2xl hover:bg-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-teal-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                            >
                                Finalizar Pedido <LucideIcons.ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal - Premium Redesign */}
            <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="">
                {orderSuccess ? (
                    <div className="text-center py-16 px-6 animate-fade-in">
                        <div className="w-24 h-24 bg-emerald-400 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-400/40 animate-bounce">
                            <LucideIcons.Check size={48} strokeWidth={3} />
                        </div>
                        <h3 className="text-3xl font-display font-semibold text-slate-900 mb-4">¡Pedido en Marcha!</h3>
                        <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-sm mx-auto">
                            Hemos recibido su solicitud. En breves instantes un asesor se comunicará con usted para finalizar los detalles.
                        </p>
                    </div>
                ) : (
                    <div className="p-1">
                        {/* Header Moderno */}
                        <div className="mb-8 text-center">
                            <div className="inline-flex p-3 bg-[#0B2149]/5 rounded-2xl mb-4">
                                <LucideIcons.ShieldCheck className="text-[#0B2149]" size={32} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-display font-semibold text-slate-900 tracking-tight">Finalizar Contratación</h3>
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Soluciones Contables Pro</p>
                        </div>

                        <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                            {/* Resumen Glassmorphic */}
                            <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A896]/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00A896]"></div> Resumen de Compra
                                </h4>
                                <div className="space-y-3 mb-6">
                                    {cart.map(i => (
                                        <div key={i.id} className="flex justify-between items-center group">
                                            <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{i.title}</span>
                                            <span className="font-mono font-semibold text-[#00A896]">${i.price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total a Pagar</span>
                                    <span className="text-4xl font-display font-semibold text-white tracking-tighter">${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Campos de Datos */}
                            <div className="space-y-4">
                                <div className="group">
                                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-2 ml-4">Nombre Destinatario</label>
                                    <div className="relative group-focus-within:scale-[1.01] transition-transform">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <LucideIcons.User className="text-slate-300 group-focus-within:text-[#00A896] transition-colors" size={20} />
                                        </div>
                                        <input 
                                            required 
                                            type="text" 
                                            value={clientName} 
                                            onChange={e => setClientName(e.target.value)} 
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00A896] rounded-2xl focus:bg-white transition-all outline-none font-medium text-lg text-slate-800" 
                                            placeholder="Juan Pérez" 
                                            disabled={!!currentUser} 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="group">
                                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-2 ml-4">WhatsApp de Contacto</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <LucideIcons.Phone className="text-slate-300 group-focus-within:text-[#00A896] transition-colors" size={20} />
                                            </div>
                                            <input 
                                                required 
                                                type="tel" 
                                                value={clientPhone} 
                                                onChange={e => setClientPhone(e.target.value)} 
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00A896] rounded-2xl focus:bg-white transition-all outline-none font-medium text-lg text-slate-800" 
                                                placeholder="099 123 4567" 
                                            />
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-2 ml-4">RUC / Cédula (Opcional)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <LucideIcons.CreditCard className="text-slate-300 group-focus-within:text-[#00A896] transition-colors" size={20} />
                                            </div>
                                            <input 
                                                type="text" 
                                                value={clientRuc} 
                                                onChange={e => setClientRuc(e.target.value)} 
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00A896] rounded-2xl focus:bg-white transition-all outline-none font-medium text-lg text-slate-800" 
                                                placeholder="17..." 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Botón de Acción */}
                            <button 
                                type="submit" 
                                className="w-full py-5 bg-[#0B2149] text-white font-semibold rounded-3xl hover:bg-slate-900 transition-all text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 relative overflow-hidden group/submit"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/submit:translate-x-full transition-transform duration-1000"></div>
                                <span className="flex items-center justify-center gap-3">
                                    Enviar Solicitud <LucideIcons.Zap size={20} fill="currentColor" />
                                </span>
                            </button>
                            
                            <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                                <LucideIcons.Lock size={12} /> Conexión Segura & Encriptada
                            </p>
                        </form>
                    </div>
                )}
            </Modal>

            {/* Simple Footer */}
            <footer className="bg-white py-12 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                        <Logo className="w-8 h-8" />
                        <span className="font-display font-medium text-lg tracking-tight text-[#0B2149]">GESTIONES TRIBUTARIAS</span>
                    </div>
                    <div className="flex gap-8 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                        <a href="#" className="hover:text-[#00A896] transition-colors">Privacidad</a>
                        <a href="#" className="hover:text-[#00A896] transition-colors">Términos</a>
                        <button onClick={onAdminAccess} className="hover:text-[#0B2149] transition-colors">Administración</button>
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