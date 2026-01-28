
import React, { useState, useEffect } from 'react';
import { Check, ShoppingCart, ArrowRight, X, Trash2, CheckCircle, User, Phone, CreditCard, Mail, Star, TrendingUp, MapPin, Menu, LogOut, MessageCircle, FileKey, Laptop, ShieldCheck, Briefcase, Package } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { AuthModal } from '../components/AuthModal';
import { OrderItem, WebOrder, PublicUser } from '../types';
import { INITIAL_SERVICE_FEES } from '../constants'; // Import default to check structure if needed, though we use local data usually passed via props if dynamic.
// Note: In a real dynamic app, ServicesPage should receive the configured fees/bundles from App.tsx via props.
// Assuming ServicesPage needs access to current `serviceFees` state, we should update App.tsx to pass it, or read from localStorage if strictly client-side for public view (less secure but works for this demo).
// For now, I'll use a hardcoded fallback + props pattern.

import { v4 as uuidv4 } from 'uuid';

// Mock fetching if not passed (In a real app, this comes from an API or Prop)
const getStoredBundles = () => {
    try {
        const stored = localStorage.getItem('serviceFees');
        if(stored) {
            const parsed = JSON.parse(stored);
            return parsed.serviceBundles || INITIAL_SERVICE_FEES.serviceBundles;
        }
    } catch(e) {}
    return INITIAL_SERVICE_FEES.serviceBundles;
}

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
    
    // Toggle State for Services
    const [activeCategory, setActiveCategory] = useState<'tax' | 'tech' | 'combos'>('combos'); // Default to combos to show off new feature
    
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

    // Load dynamic bundles
    const dynamicBundles = getStoredBundles() || [];

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
        setIsCartOpen(true);
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
    const techPlans = [
        {
            title: "Firma Electrónica (1 Año)",
            price: "35.00",
            description: "Esencial para facturación y trámites legales.",
            features: ["Archivo .P12 (Token Virtual)", "Válida para SRI, Judicial, Quipux", "Entrega 100% Online Inmediata", "Soporte de Instalación Remota"],
            icon: FileKey,
            color: "bg-purple-50 text-purple-700",
            popular: false
        },
        {
            title: "Pack Facturación PRO",
            price: "55.00",
            originalPrice: "75.00",
            save: "20.00",
            description: "Todo lo que necesita para empezar a facturar.",
            features: ["Firma Electrónica (1 Año)", "Sistema de Facturación Web/App", "Emisión Ilimitada de Comprobantes", "Control de Inventario Básico", "Reportes de Ventas"],
            icon: Laptop,
            color: "bg-blue-50 text-blue-700",
            popular: true
        }
    ];

    const taxPlans = [
        {
            title: "Declaración Mensual (Empleados)",
            price: "49.99",
            originalPrice: "75.30",
            save: "25.31",
            description: "Ideal para profesionales bajo relación de dependencia.",
            features: ["Declaración de IVA (Anual/Semestral)", "Impuesto a la Renta Personas Naturales", "Anexo de Gastos Personales", "Asesoría en Deducibles"],
            icon: User,
            popular: true
        },
        {
            title: "RIMPE – Negocio Popular",
            price: "4.99",
            originalPrice: "8.99",
            save: "4.00",
            description: "Para pequeños negocios con cuota fija anual.",
            features: ["Declaración Impuesto a la Renta", "Cumplimiento de Deberes Formales", "Reporte Financiero Anual", "Soporte ante notificaciones"],
            icon: Star,
            popular: false
        },
        {
            title: "RIMPE – Emprendedor",
            price: "8.99",
            originalPrice: "12.99",
            save: "4.00",
            description: "Para emprendedores en crecimiento.",
            features: ["Declaración de IVA Semestral", "Declaración de Impuesto a la Renta", "Registro de Compras y Ventas", "Asesoría Continua"],
            icon: TrendingUp,
            popular: false
        },
        {
            title: "Patente Municipal",
            price: "25.00",
            originalPrice: "35.00",
            save: "10.00",
            description: "Gestión de permisos municipales.",
            features: ["Declaración Patente Municipal", "Gestión de exoneraciones (si aplica)", "Cálculo de impuesto 1.5 por mil"],
            icon: MapPin,
            popular: false
        }
    ];

    const comboPlans = dynamicBundles.map(bundle => ({
        title: bundle.title,
        price: bundle.price.toFixed(2),
        originalPrice: bundle.originalPrice?.toFixed(2),
        save: bundle.originalPrice ? (bundle.originalPrice - bundle.price).toFixed(2) : null,
        description: bundle.description,
        features: bundle.features,
        icon: Package,
        color: "bg-emerald-50 text-emerald-700",
        popular: true
    }));

    const activePlans = activeCategory === 'tax' ? taxPlans : (activeCategory === 'tech' ? techPlans : comboPlans);

    return (
        <div className="min-h-screen bg-slate-50 font-body overflow-x-hidden text-slate-800">
            {/* Navbar ... (Existing Navbar Code) ... */}
            <nav className={`fixed w-full z-50 transition-all duration-300 border-b ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-4 border-slate-100' : 'bg-[#0B2149] py-4 border-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <button onClick={onNavigateToHome} className="flex items-center space-x-3 group h-10">
                        <Logo className="h-full w-auto" />
                        <div className="flex flex-col text-left">
                            <span className={`text-lg font-display font-black tracking-tight leading-none ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>GESTIONES</span>
                            <span className={`text-[9px] font-black tracking-[0.25em] uppercase ${scrolled ? 'text-[#00A896]' : 'text-slate-300'}`}>Tributarias</span>
                        </div>
                    </button>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                        <button onClick={onNavigateToHome} className={`text-sm font-bold transition-colors ${scrolled ? 'text-slate-600 hover:text-[#0B2149]' : 'text-slate-300 hover:text-white'}`}>Inicio</button>
                        <span className={`text-sm font-bold border-b-2 pb-1 cursor-default ${scrolled ? 'text-[#00A896] border-[#00A896]' : 'text-white border-white'}`}>Servicios</span>
                        <button onClick={() => setIsCartOpen(true)} className={`relative transition-colors flex items-center gap-1 text-sm font-bold ${scrolled ? 'text-slate-600 hover:text-[#00A896]' : 'text-slate-300 hover:text-white'}`}>
                            <ShoppingCart size={18} /> Carrito
                            {cart.length > 0 && (
                                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                    {cart.length}
                                </span>
                            )}
                        </button>

                        {currentUser ? (
                            <div className={`flex items-center space-x-3 border-l pl-4 ${scrolled ? 'border-slate-200' : 'border-slate-700'}`}>
                                <span className={`text-sm font-bold ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>{currentUser.name}</span>
                                <button onClick={onLogout} className="text-slate-400 hover:text-red-400 transition-colors" title="Cerrar Sesión">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className={`text-sm font-bold transition-colors flex items-center gap-1 ${scrolled ? 'text-slate-600 hover:text-[#0B2149]' : 'text-slate-300 hover:text-white'}`}>
                                <User size={18} /> Cuenta
                            </button>
                        )}

                        <a 
                            href={whatsappLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#00A896] text-white font-bold rounded-full transition-all duration-300 shadow-md hover:shadow-lg hover:bg-teal-600 text-xs uppercase tracking-wider"
                        >
                            <MessageCircle size={16} />
                            <span>Consultar</span>
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center space-x-4">
                        <button onClick={() => setIsCartOpen(true)} className={`relative p-2 ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>
                            <ShoppingCart size={24} />
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-white absolute w-full border-b border-slate-100 animate-fade-in-down shadow-xl">
                        <div className="px-4 pt-2 pb-6 space-y-2">
                             <button onClick={() => { onNavigateToHome(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 rounded-md">Inicio</button>
                             <div className="block px-3 py-2 text-base font-bold text-[#00A896] bg-slate-50 rounded-md">Servicios</div>
                             
                             {currentUser ? (
                                <div className="px-3 py-2 border-t border-slate-100 mt-2">
                                    <p className="text-sm text-slate-500 mb-2">Hola, {currentUser.name}</p>
                                    <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="flex items-center text-red-500 font-medium"><LogOut size={16} className="mr-2"/> Cerrar Sesión</button>
                                </div>
                             ) : (
                                <button onClick={() => { setIsAuthModalOpen(true); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 rounded-md flex items-center gap-2"><User size={18}/> Mi Cuenta</button>
                             )}

                             <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="block px-3 py-3 text-base font-bold text-white bg-[#00A896] rounded-md flex items-center justify-center gap-2 mt-4">
                                <MessageCircle size={18}/>
                                Consultar con Asesor Ahora
                             </a>
                             <button onClick={() => { onAdminAccess(); setMobileMenuOpen(false); }} className="w-full text-left block px-3 py-2 text-base font-bold text-slate-400 hover:text-[#0B2149] rounded-md border-t border-slate-100 mt-2 pt-4">Administración</button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Header with Selector */}
            <div className="bg-[#0B2149] pt-32 pb-24 px-4 text-center rounded-b-[3rem] relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00A896]/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                
                <div className="relative z-10 max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-display font-black text-white mb-6">Planes Flexibles</h1>
                    <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-10 font-medium">
                        Seleccione el tipo de servicio que necesita y optimice su gestión hoy mismo.
                    </p>

                    {/* Category Toggle */}
                    <div className="inline-flex bg-slate-800/50 p-1.5 rounded-full backdrop-blur-md border border-slate-700 shadow-xl overflow-x-auto max-w-full">
                        <button 
                            onClick={() => setActiveCategory('combos')}
                            className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${activeCategory === 'combos' ? 'bg-white text-[#0B2149] shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Package size={16}/> Packs & Combos
                        </button>
                        <button 
                            onClick={() => setActiveCategory('tax')}
                            className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${activeCategory === 'tax' ? 'bg-white text-[#0B2149] shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Briefcase size={16}/> Gestión Tributaria
                        </button>
                        <button 
                            onClick={() => setActiveCategory('tech')}
                            className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${activeCategory === 'tech' ? 'bg-white text-[#0B2149] shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Laptop size={16}/> Firma & Tecnología
                        </button>
                    </div>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="max-w-7xl mx-auto px-4 -mt-16 pb-24 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {activePlans.length > 0 ? activePlans.map((plan, index) => (
                        <div 
                            key={index} 
                            className={`bg-white rounded-[2rem] shadow-xl flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl relative overflow-hidden group border ${plan.popular ? 'border-[#00A896] ring-4 ring-teal-50/50 scale-[1.02]' : 'border-slate-100'}`}
                        >
                            {plan.popular && (
                                <div className="bg-[#00A896] text-white text-[10px] font-black text-center py-2 uppercase tracking-widest absolute top-0 left-0 w-full z-10 shadow-sm">
                                    Más Solicitado
                                </div>
                            )}
                            
                            <div className={`p-8 ${plan.popular ? 'pt-12' : ''}`}>
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${plan.color || 'bg-slate-100 text-slate-600'}`}>
                                    <plan.icon size={28} />
                                </div>
                                
                                <h3 className="text-xl font-black text-[#0B2149] mb-2 leading-tight min-h-[3.5rem]">{plan.title}</h3>
                                <p className="text-xs font-medium text-slate-500 mb-6 min-h-[2.5rem] leading-relaxed">{plan.description}</p>
                                
                                <div className="flex items-end gap-2 mb-2">
                                    <span className="text-4xl font-display font-black text-slate-900 tracking-tight">${plan.price}</span>
                                    {plan.originalPrice && <span className="text-sm font-bold text-slate-400 line-through mb-1.5">${plan.originalPrice}</span>}
                                </div>
                                
                                {plan.save && (
                                    <span className="inline-block bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full mb-6">
                                        AHORRAS ${plan.save}
                                    </span>
                                )}

                                <button 
                                    onClick={() => handleAddToCart(plan)}
                                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl uppercase tracking-wider transform active:scale-95
                                        ${plan.popular ? 'bg-[#00A896] text-white hover:bg-teal-600' : 'bg-[#0B2149] text-white hover:bg-slate-800'}
                                    `}
                                >
                                    <ShoppingCart size={18} /> Añadir al Carrito
                                </button>
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex-grow">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Lo que incluye:</p>
                                <ul className="space-y-4">
                                    {plan.features.map((feature: string, fIdx: number) => (
                                        <li key={fIdx} className="flex items-start text-xs font-bold text-slate-600">
                                            <CheckCircle size={16} className="mr-3 flex-shrink-0 text-green-500 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                            <p className="text-slate-400 font-bold">No hay planes disponibles en esta categoría.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Satisfaction Guarantee Section */}
            <section className="py-20 bg-white border-t border-slate-100">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <div className="inline-flex p-5 bg-[#0B2149]/5 rounded-full mb-8 text-[#0B2149]">
                        <ShieldCheck size={56} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-3xl font-display font-black text-slate-900 mb-6">Garantía de Servicio Profesional</h2>
                    <p className="text-slate-600 mb-10 leading-relaxed text-lg font-medium">
                        Entendemos la importancia de su tranquilidad fiscal. Si nuestro servicio no cumple con la normativa vigente o se presentan errores atribuibles a nuestra gestión, nos comprometemos a solucionarlo sin costo adicional.
                    </p>
                    <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-slate-700">
                        <span className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full text-green-700 border border-green-100"><Check className="text-green-500" size={16}/> Confidencialidad Total</span>
                        <span className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full text-green-700 border border-green-100"><Check className="text-green-500" size={16}/> Soporte Personalizado</span>
                        <span className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full text-green-700 border border-green-100"><Check className="text-green-500" size={16}/> Actualización Constante</span>
                    </div>
                </div>
            </section>

            {/* Cart Modal & Checkout Modal are rendered here... (Existing Logic) */}
            {/* Cart Modal (Sidebar) */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-slide-in-right text-slate-900">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                            <h3 className="text-2xl font-display font-black text-[#0B2149]">Su Pedido</h3>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <ShoppingCart size={64} className="mx-auto mb-4 opacity-20"/>
                                    <p className="font-bold">Su carrito está vacío.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 mb-1">{item.title}</p>
                                            <p className="text-[#00A896] font-black">${item.price.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <div className="flex justify-between items-center mb-8 text-2xl font-black text-[#0B2149]">
                                <span>Total</span>
                                <span className="text-green-600 font-mono tracking-tight">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                                disabled={cart.length === 0}
                                className="w-full py-5 bg-[#0B2149] text-white font-black rounded-2xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-wider text-sm shadow-xl"
                            >
                                Completar Pedido <ArrowRight size={20}/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="Finalizar Solicitud">
                {orderSuccess ? (
                    <div className="text-center py-12">
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce shadow-lg shadow-green-500/20">
                            <CheckCircle size={48} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-3">¡Solicitud Recibida!</h3>
                        <p className="text-slate-500 font-medium max-w-xs mx-auto">Gracias por su confianza. Un asesor se pondrá en contacto con usted en breve para coordinar los detalles.</p>
                    </div>
                ) : (
                    <form onSubmit={handleCheckoutSubmit} className="space-y-5">
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-8">
                            <h4 className="font-black text-[#0B2149] mb-4 text-xs uppercase tracking-widest border-b border-slate-200 pb-2">Resumen</h4>
                            <ul className="text-sm text-slate-600 space-y-3 font-medium">
                                {cart.map(i => <li key={i.id} className="flex justify-between"><span>{i.title}</span><span className="font-mono font-bold">${i.price.toFixed(2)}</span></li>)}
                            </ul>
                            <div className="flex justify-between font-black text-xl mt-4 pt-4 border-t border-slate-200 text-slate-900">
                                <span>Total a Pagar:</span>
                                <span className="font-mono text-[#00A896] tracking-tight">${cartTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Nombre Completo *</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full pl-12 p-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-[#00A896] font-bold text-slate-800 placeholder-slate-400" placeholder="Juan Pérez" disabled={!!currentUser}/>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Teléfono / WhatsApp *</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                    <input required type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full pl-12 p-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-[#00A896] font-bold text-slate-800 placeholder-slate-400" placeholder="0991234567"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">RUC / CI (Opcional)</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                    <input type="text" value={clientRuc} onChange={e => setClientRuc(e.target.value)} className="w-full pl-12 p-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-[#00A896] font-bold text-slate-800 placeholder-slate-400" placeholder="1712345678001"/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Correo Electrónico (Opcional)</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="w-full pl-12 p-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-[#00A896] font-bold text-slate-800 placeholder-slate-400" placeholder="juan@email.com" disabled={!!currentUser}/>
                            </div>
                        </div>

                        <button type="submit" className="w-full py-5 bg-[#00A896] text-white font-black rounded-xl hover:bg-teal-600 transition-colors text-sm uppercase tracking-widest shadow-xl mt-6 flex items-center justify-center gap-3">
                            Confirmar Pedido <CheckCircle size={20}/>
                        </button>
                        <p className="text-[10px] text-center text-slate-400 font-bold mt-4 uppercase tracking-wider">Sus datos serán tratados con estricta confidencialidad.</p>
                    </form>
                )}
            </Modal>

            {/* Footer ... (Existing Footer) ... */}
            <footer className="bg-slate-950 py-16 border-t border-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center space-x-4">
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <Logo className="w-8 h-auto" />
                        </div>
                        <div>
                            <span className="text-xl font-display font-black text-white block leading-none uppercase tracking-tight">SANTIAGO CORDOVA</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1 block">Soluciones Tributarias</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <a href="#" className="hover:text-[#00A896] transition-colors">Aviso Legal</a>
                        <a href="#" className="hover:text-[#00A896] transition-colors">Privacidad</a>
                        <a href="#" className="hover:text-[#00A896] transition-colors">Términos</a>
                    </div>

                    <div className="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center md:text-right">
                        <p>&copy; {new Date().getFullYear()} Santiago Cordova.</p>
                        <p>Todos los derechos reservados.</p>
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
