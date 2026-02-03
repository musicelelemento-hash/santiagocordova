
import React, { useState, useEffect } from 'react';
import { Check, ShoppingCart, ArrowRight, X, Trash2, CheckCircle, User, Phone, CreditCard, Mail, Star, TrendingUp, MapPin, Menu, LogOut, MessageCircle, FileKey, Laptop, ShieldCheck, Briefcase, Package, Activity, Globe, DollarSign, Zap } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { AuthModal } from '../components/AuthModal';
import { OrderItem, WebOrder, PublicUser } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
        // Don't open cart automatically on mobile to keep flow fluid, just show the floating bar
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

    // --- DATA DEFINITION ---
    const plans = {
        tech: [
            {
                title: "Firma Electrónica",
                price: "35.00",
                description: "Token .P12 válido para facturación SRI, Quipux y trámites legales.",
                features: ["Vigencia 1 Año", "Entrega Inmediata", "Instalación Remota", "Soporte Técnico"],
                icon: FileKey,
                popular: false,
                color: "purple"
            },
            {
                title: "Pack Facturador",
                price: "55.00",
                originalPrice: "75.00",
                save: "20.00",
                description: "Sistema de facturación web ilimitado + Firma electrónica.",
                features: ["Firma Electrónica (1 Año)", "Facturación Ilimitada", "App Móvil", "Control de Inventario"],
                icon: Laptop,
                popular: true,
                color: "blue"
            }
        ],
        tax: [
            {
                title: "RIMPE Popular",
                price: "4.99",
                originalPrice: "8.99",
                save: "4.00",
                description: "Cumplimiento anual para pequeños negocios.",
                features: ["Declaración Renta Anual", "Reporte de Obligaciones", "Asesoría Básica"],
                icon: Star,
                popular: false,
                color: "teal"
            },
            {
                title: "RIMPE Emprendedor",
                price: "15.00",
                originalPrice: "25.00",
                save: "10.00",
                description: "Gestión semestral para negocios en crecimiento.",
                features: ["IVA Semestral", "Renta Anual", "Anexo Transaccional", "Soporte Prioritario"],
                icon: TrendingUp,
                popular: true,
                color: "teal"
            },
            {
                title: "Profesionales",
                price: "49.99",
                description: "Gestión mensual completa para servicios profesionales.",
                features: ["IVA Mensual", "Anexo Gastos Personales", "Devolución de Retenciones", "Planeación Fiscal"],
                icon: User,
                popular: false,
                color: "teal"
            }
        ],
        special: [
            {
                title: "Devolución IVA",
                price: "15.00",
                description: "Trámite para Tercera Edad y Discapacidad.",
                features: ["Análisis de facturas", "Carga de solicitud", "Seguimiento hasta acreditación"],
                icon: DollarSign,
                popular: true,
                color: "amber"
            },
            {
                title: "Patente Municipal",
                price: "25.00",
                description: "Declaración anual de patente y 1.5 por mil.",
                features: ["Cálculo de impuesto", "Generación de título", "Gestión de exoneraciones"],
                icon: MapPin,
                popular: false,
                color: "amber"
            }
        ]
    };

    const activePlans = (plans as any)[activeCategory] || [];

    const CategoryButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
        <button 
            onClick={() => { setActiveCategory(id as any); window.scrollTo({top: 300, behavior: 'smooth'}); }}
            className={`
                flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex-shrink-0
                ${activeCategory === id 
                    ? 'bg-[#00A896] text-white shadow-lg shadow-teal-500/30 scale-105' 
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-500 hover:bg-white hover:text-slate-800 border border-transparent'
                }
            `}
        >
            <Icon size={16} strokeWidth={2.5}/> {label}
            {activeCategory === id && <div className="w-1.5 h-1.5 rounded-full bg-white ml-1 animate-pulse"></div>}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-body text-slate-800 selection:bg-[#00A896] selection:text-white overflow-x-hidden pb-20 md:pb-0">
            
            {/* Header / Nav */}
            <nav className={`fixed w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-4 border-slate-100' : 'bg-[#0B2149] py-6 border-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <button onClick={onNavigateToHome} className="flex items-center gap-3 group">
                        <div className={`p-2 rounded-xl transition-all ${scrolled ? 'bg-[#0B2149]' : 'bg-white/10 border border-white/20'}`}>
                            <Logo className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <span className={`text-base font-display font-black tracking-tight leading-none block ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>GESTIONES</span>
                        </div>
                    </button>
                    
                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={onNavigateToHome} className={`text-sm font-bold transition-colors ${scrolled ? 'text-slate-500 hover:text-[#0B2149]' : 'text-white/70 hover:text-white'}`}>Inicio</button>
                        <button onClick={() => setIsCartOpen(true)} className={`relative flex items-center gap-2 text-sm font-bold transition-colors ${scrolled ? 'text-slate-800' : 'text-white'}`}>
                            <div className="relative">
                                <ShoppingCart size={20} />
                                {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{cart.length}</span>}
                            </div>
                            <span>Carrito</span>
                        </button>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 bg-[#00A896] text-white font-black rounded-xl hover:bg-teal-600 transition-all shadow-lg shadow-teal-500/30 text-xs uppercase tracking-wider flex items-center gap-2">
                            <MessageCircle size={16}/> Asesoría
                        </a>
                    </div>
                    
                    <button onClick={() => setMobileMenuOpen(true)} className={`md:hidden p-2 ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}><Menu size={24}/></button>
                </div>
            </nav>

             {/* Mobile Menu Overlay */}
             {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-[#020617] flex flex-col items-center justify-center space-y-8 animate-fade-in p-8">
                    <button className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white" onClick={() => setMobileMenuOpen(false)}>
                        <X size={24}/>
                    </button>
                    <button onClick={() => { onNavigateToHome(); setMobileMenuOpen(false); }} className="text-3xl font-display font-black text-white">Inicio</button>
                    <button onClick={() => { setIsCartOpen(true); setMobileMenuOpen(false); }} className="text-3xl font-display font-black text-white">Ver Carrito ({cart.length})</button>
                    <button onClick={() => { onAdminAccess(); setMobileMenuOpen(false); }} className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-8">Acceso Admin</button>
                </div>
            )}

            {/* Hero Section */}
            <div className="bg-[#0B2149] pt-32 pb-24 px-6 rounded-b-[3rem] relative overflow-hidden text-center shadow-2xl shadow-blue-900/20">
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                 <div className="absolute top-[-100px] right-[-100px] w-[600px] h-[600px] bg-[#00A896]/20 rounded-full blur-[120px]"></div>

                 <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest mb-6 backdrop-blur-md">
                        <Globe size={12}/> Servicios Digitales 2026
                    </div>
                    <h1 className="text-4xl md:text-7xl font-display font-black text-white mb-6 tracking-tight leading-[1.1]">
                        Soluciones a su <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00A896] to-emerald-300">Medida.</span>
                    </h1>
                 </div>
            </div>

            {/* --- STICKY CATEGORY NAV (MOBILE OPTIMIZED) --- */}
            <div className="sticky top-[72px] z-40 py-4 -mt-10 mb-8 overflow-x-auto no-scrollbar px-6 flex justify-center">
                <div className="inline-flex gap-2 p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-full">
                    <CategoryButton id="tax" label="Tributarios" icon={Briefcase} />
                    <CategoryButton id="tech" label="Firma & Fact." icon={Laptop} />
                    <CategoryButton id="special" label="Trámites" icon={Activity} />
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
                                <div className="absolute top-0 right-0 bg-[#00A896] text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest z-10">
                                    Popular
                                </div>
                            )}
                            
                            <div className="p-8 pb-0">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${plan.popular ? 'bg-[#0B2149] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <plan.icon size={28} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-2xl font-black text-[#0B2149] mb-2 leading-tight">{plan.title}</h3>
                                <p className="text-xs font-medium text-slate-500 min-h-[2.5rem] leading-relaxed line-clamp-2">{plan.description}</p>
                            </div>

                            <div className="p-8 pt-4">
                                <div className="flex items-end gap-2 mb-6">
                                    <span className="text-5xl font-display font-black text-slate-900 tracking-tighter">${plan.price}</span>
                                    {plan.originalPrice && (
                                        <div className="flex flex-col mb-1.5">
                                            <span className="text-xs font-bold text-slate-400 line-through">${plan.originalPrice}</span>
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">AHORRA ${plan.save}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 mb-8">
                                    {plan.features.map((feat: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 text-xs font-bold text-slate-600">
                                            <div className="min-w-[16px] mt-0.5 text-[#00A896]"><CheckCircle size={16}/></div>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>

                                <button 
                                    onClick={() => handleAddToCart(plan)}
                                    className={`
                                        w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg
                                        relative overflow-hidden group/btn
                                        ${plan.popular ? 'bg-[#00A896] text-white hover:bg-teal-600 shadow-teal-500/20' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}
                                    `}
                                >
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out"></div>
                                    <span className="relative flex items-center gap-2">
                                        <Zap size={16} fill="currentColor"/> Contratar Ahora
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
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{cart.length} Servicio{cart.length > 1 ? 's' : ''}</span>
                            <span className="text-xl font-black">${cartTotal.toFixed(2)}</span>
                        </div>
                        <button 
                            onClick={() => setIsCheckoutOpen(true)}
                            className="px-6 py-3 bg-[#00A896] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-teal-500/30"
                        >
                            Pagar <ArrowRight size={16}/>
                        </button>
                    </div>
                </div>
            )}

            {/* Cart Sidebar (Desktop) */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
                        <div className="p-6 bg-[#0B2149] text-white flex justify-between items-center shadow-lg z-10">
                            <h3 className="text-xl font-display font-black tracking-tight flex items-center gap-2">
                                <ShoppingCart size={20}/> Su Pedido
                            </h3>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-slate-50">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <Package size={64} strokeWidth={1} className="mb-4"/>
                                    <p className="font-black text-lg">Carrito Vacío</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center group">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm mb-1">{item.title}</p>
                                            <p className="text-[#00A896] font-black text-lg">${item.price.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-10">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-slate-400 font-bold text-sm uppercase tracking-wider">Total a Pagar</span>
                                <span className="text-3xl font-black text-[#0B2149] tracking-tight">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                                disabled={cart.length === 0}
                                className="w-full py-5 bg-[#00A896] text-white font-black rounded-2xl hover:bg-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-teal-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                            >
                                Confirmar Pedido <ArrowRight size={18}/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="Finalizar Solicitud">
                {orderSuccess ? (
                    <div className="text-center py-12">
                        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce shadow-lg shadow-emerald-500/30">
                            <CheckCircle size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-[#0B2149] mb-2">¡Solicitud Enviada!</h3>
                        <p className="text-slate-500 font-medium max-w-xs mx-auto">Un asesor revisará su pedido y le contactará vía WhatsApp en breve.</p>
                    </div>
                ) : (
                    <form onSubmit={handleCheckoutSubmit} className="space-y-5">
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumen</span>
                                <span className="text-xs font-bold text-[#00A896]">{cart.length} ítems</span>
                             </div>
                             <div className="text-2xl font-black text-[#0B2149]">${cartTotal.toFixed(2)}</div>
                         </div>

                         <div className="grid grid-cols-1 gap-4">
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#00A896] focus:bg-white transition-all placeholder-slate-400" placeholder="Su Nombre" disabled={!!currentUser}/>
                            </div>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input required type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#00A896] focus:bg-white transition-all placeholder-slate-400" placeholder="WhatsApp (099...)"/>
                            </div>
                             <div className="relative">
                                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input type="text" value={clientRuc} onChange={e => setClientRuc(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#00A896] focus:bg-white transition-all placeholder-slate-400" placeholder="RUC / CI (Opcional)"/>
                            </div>
                         </div>

                        <button type="submit" className="w-full py-5 bg-[#0B2149] text-white font-black rounded-2xl hover:bg-slate-800 transition-all text-sm uppercase tracking-widest shadow-xl mt-4 flex items-center justify-center gap-3">
                            Enviar Solicitud <CheckCircle size={18}/>
                        </button>
                    </form>
                )}
            </Modal>

            {/* Simple Clean Footer */}
            <footer className="bg-white border-t border-slate-100 py-12">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                        <Logo className="w-8 h-8"/>
                        <span className="font-display font-black text-slate-900 tracking-tight">SANTIAGO CORDOVA</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        © 2026. Todos los derechos reservados.
                    </p>
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
