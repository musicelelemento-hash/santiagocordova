
import React, { useState, useEffect } from 'react';
import { Check, ShoppingCart, ArrowRight, X, Trash2, CheckCircle, User, Phone, CreditCard, Mail, Star, TrendingUp, MapPin, Menu, LogOut } from 'lucide-react';
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

    // Sanitized phone number for WhatsApp API
    const phoneNumber = "593978980722"; 
    const displayPhone = "+593 978 980 722";

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auto-fill form when user logs in
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
            // Don't clear user data if logged in
            if (!currentUser) {
                setClientName('');
                setClientEmail('');
            }
            setClientPhone('');
            setClientRuc('');
        }, 3000);
    };

    const pricingPlans = [
        {
            title: "Paquete Declaración de Impuestos – Empleados",
            price: "49.99",
            originalPrice: "75.30",
            save: "25.31",
            features: ["Una Declaración de IVA", "Una Declaración Impuesto a la Renta", "Una Elaboración y Presentación de Anexo de Gastos Personales"],
            icon: User,
            popular: true
        },
        {
            title: "PLAN RIMPE – Negocio Popular",
            price: "4.99",
            originalPrice: "8.99",
            save: "4.00",
            features: ["Declaración Impuesto a la Renta", "Declaración de IVA mensual", "Declaración en Cero", "Resumen Resultado Financiero", "Asesoría Contable", "Soporte"],
            icon: Star,
            popular: false
        },
        {
            title: "Plan RIMPE – Emprendedor",
            price: "8.99",
            originalPrice: "12.99",
            save: "4.00",
            features: ["Declaración de IVA", "Declaración de Impuesto a la Renta", "Nota: Transacciones se refiere a las compras o ventas."],
            icon: TrendingUp,
            popular: true
        },
        {
            title: "Patente Municipal",
            price: "25.00",
            originalPrice: "35.00",
            save: "10.00",
            features: ["Declaración Patente Municipal", "Gestión de la patente municipal."],
            icon: MapPin,
            popular: false
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-body overflow-x-hidden">
            {/* Navbar */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg py-3' : 'bg-slate-900 py-4'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <button onClick={onNavigateToHome} className="flex items-center space-x-3 group">
                        <Logo className="w-10 h-10" />
                        <div className="flex flex-col text-left">
                            <span className="text-lg font-display font-bold text-gold tracking-wide leading-none">GESTIONES</span>
                            <span className="text-xs font-light tracking-[0.2em] text-white">TRIBUTARIAS</span>
                        </div>
                    </button>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                        <button onClick={onNavigateToHome} className="text-sm font-medium text-white hover:text-gold transition-colors">Inicio</button>
                        <span className="text-sm font-bold text-gold border-b-2 border-gold pb-1 cursor-default">Servicios</span>
                        <button onClick={() => setIsCartOpen(true)} className="relative text-white hover:text-gold transition-colors flex items-center gap-1 text-sm font-medium">
                            <ShoppingCart size={18} /> Carrito
                            {cart.length > 0 && (
                                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                    {cart.length}
                                </span>
                            )}
                        </button>

                        {currentUser ? (
                            <div className="flex items-center space-x-3 border-l border-slate-700 pl-4">
                                <span className="text-sm text-gold font-medium">{currentUser.name}</span>
                                <button onClick={onLogout} className="text-slate-400 hover:text-red-400 transition-colors" title="Cerrar Sesión">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="text-sm font-medium text-white hover:text-gold transition-colors flex items-center gap-1">
                                <User size={18} /> Cuenta
                            </button>
                        )}

                        <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-gold transition-colors">Contáctanos</a>

                        <button 
                            onClick={onAdminAccess}
                            className="px-5 py-2 bg-gold/10 border border-gold/50 text-gold hover:bg-gold hover:text-black font-bold rounded-full transition-all duration-300 text-sm uppercase tracking-wider"
                        >
                            Administración
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center space-x-4">
                        <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-white hover:text-gold transition-colors">
                            <ShoppingCart size={24} />
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-slate-900 absolute w-full border-b border-gray-800 animate-fade-in-down shadow-2xl">
                        <div className="px-4 pt-2 pb-6 space-y-2">
                             <button onClick={() => { onNavigateToHome(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-white hover:bg-slate-800 rounded-md">Inicio</button>
                             <div className="block px-3 py-2 text-base font-bold text-gold bg-slate-800 rounded-md">Servicios</div>
                             
                             {currentUser ? (
                                <div className="px-3 py-2 border-t border-slate-700 mt-2">
                                    <p className="text-sm text-slate-400 mb-2">Hola, {currentUser.name}</p>
                                    <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="flex items-center text-red-400 font-medium"><LogOut size={16} className="mr-2"/> Cerrar Sesión</button>
                                </div>
                             ) : (
                                <button onClick={() => { setIsAuthModalOpen(true); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-white hover:bg-slate-800 rounded-md flex items-center gap-2"><User size={18}/> Mi Cuenta</button>
                             )}

                             <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-base font-medium text-white hover:bg-slate-800 rounded-md">Contáctanos (WhatsApp)</a>
                             <button onClick={() => { onAdminAccess(); setMobileMenuOpen(false); }} className="w-full text-left block px-3 py-2 text-base font-bold text-gold hover:bg-slate-800 rounded-md border-t border-slate-700 mt-2 pt-4">Administración</button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Services / Pricing Section */}
            <section className="pt-32 pb-20 bg-slate-50 text-slate-900 relative min-h-screen">
                 <div className="max-w-7xl mx-auto px-4 relative z-10">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 mb-4">Nuestros Servicios</h1>
                        <p className="text-slate-600 max-w-2xl mx-auto text-lg">Seleccione el plan ideal y añádalo a su pedido para comenzar.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {pricingPlans.map((plan, index) => (
                            <div 
                                key={index} 
                                className={`bg-white rounded-2xl shadow-lg border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                                    ${plan.popular ? 'border-blue-200 ring-4 ring-blue-50' : 'border-gray-100'}
                                `}
                            >
                                <div className={`p-6 ${plan.popular ? 'bg-blue-50' : 'bg-white'}`}>
                                    <h3 className="text-lg font-bold text-blue-700 min-h-[3.5rem] leading-tight">{plan.title}</h3>
                                    
                                    <div className="mt-4 flex items-baseline gap-2">
                                        <span className="text-gray-400 line-through text-sm">${plan.originalPrice}</span>
                                        <span className="text-4xl font-bold text-slate-900">${plan.price}</span>
                                    </div>
                                    
                                    <div className="mt-2 inline-block bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
                                        AHORRA ${plan.save}
                                    </div>
                                </div>

                                <div className="p-6 flex-grow bg-white">
                                    <div className="mb-4">
                                        <select className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                            <option>Estándar</option>
                                        </select>
                                    </div>

                                    <button 
                                        onClick={() => handleAddToCart(plan)}
                                        className="w-full py-2.5 rounded-full font-bold text-blue-600 border-2 border-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 text-sm mb-6"
                                    >
                                        <ShoppingCart size={16} /> Añadir al Carrito
                                    </button>

                                    <p className="text-blue-600 text-xs font-medium mb-3">Este paquete incluye:</p>
                                    <ul className="space-y-2">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start text-xs text-gray-600 leading-relaxed">
                                                <Check size={14} className="mr-2 flex-shrink-0 text-blue-500 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Cart Modal (Sidebar) */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-slide-in-right text-slate-900">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                            <h3 className="text-2xl font-display font-bold text-slate-900">Su Pedido</h3>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto space-y-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-50"/>
                                    <p>Su carrito está vacío.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">{item.title}</p>
                                            <p className="text-blue-600 font-bold">${item.price.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center mb-6 text-xl font-bold">
                                <span>Total</span>
                                <span className="text-green-600">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                                disabled={cart.length === 0}
                                className="w-full py-4 bg-gold text-black font-bold rounded-xl hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    <div className="text-center py-8">
                        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce" />
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">¡Solicitud Recibida!</h3>
                        <p className="text-gray-600 dark:text-gray-300">Gracias por su pedido. Un asesor se pondrá en contacto con usted brevemente para coordinar.</p>
                    </div>
                ) : (
                    <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-slate-800 rounded-lg mb-4">
                            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 border-b border-blue-200 dark:border-blue-700 pb-2">Resumen</h4>
                            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                {cart.map(i => <li key={i.id} className="flex justify-between"><span>{i.title}</span><span>${i.price.toFixed(2)}</span></li>)}
                            </ul>
                            <div className="flex justify-between font-bold text-lg mt-3 pt-2 border-t border-blue-200 dark:border-blue-700 text-slate-800 dark:text-white">
                                <span>Total a Pagar:</span>
                                <span>${cartTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre Completo *</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full pl-10 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-gold" placeholder="Juan Pérez" disabled={!!currentUser}/>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Teléfono / WhatsApp *</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                    <input required type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full pl-10 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-gold" placeholder="0991234567"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">RUC / CI (Opcional)</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                    <input type="text" value={clientRuc} onChange={e => setClientRuc(e.target.value)} className="w-full pl-10 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-gold" placeholder="1712345678001"/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico (Opcional)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="w-full pl-10 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-gold" placeholder="juan@email.com" disabled={!!currentUser}/>
                            </div>
                        </div>

                        <button type="submit" className="w-full py-4 bg-gold text-black font-bold rounded-xl hover:bg-yellow-500 transition-colors text-lg shadow-lg mt-4">
                            Confirmar Pedido
                        </button>
                        <p className="text-xs text-center text-gray-500 mt-2">Sus datos serán tratados con confidencialidad.</p>
                    </form>
                )}
            </Modal>

            {/* Footer */}
            <footer className="bg-black py-12 border-t border-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center space-x-3 mb-4 md:mb-0">
                        <Logo className="w-8 h-8 opacity-80" />
                        <div>
                            <span className="text-lg font-display font-bold text-slate-300 block leading-none">Gestiones Tributarias</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Santiago Cordova</span>
                        </div>
                    </div>
                    <div className="text-slate-500 text-sm text-center md:text-right">
                        <p className="mb-1">Asesor en Finanzas Tributarias</p>
                        <p className="mb-1 flex items-center justify-center md:justify-end gap-1"><MapPin size={14}/> Colon y Sucre / Pasaje - El Oro</p>
                        <p className="mb-1 flex items-center justify-center md:justify-end gap-1"><Phone size={14}/> {displayPhone}</p>
                        <p className="mt-4 text-xs opacity-60">&copy; {new Date().getFullYear()} Todos los derechos reservados.</p>
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
