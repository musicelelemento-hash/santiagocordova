
import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, Clock, Phone, ChevronDown, Menu, X, Award, Briefcase, FileText, TrendingUp, DollarSign, Star, Check, ShoppingCart, Plus, Trash2, User, Mail, CreditCard, MapPin, LogOut } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PublicUser } from '../types';
import { AuthModal } from '../components/AuthModal';

interface LandingPageProps {
    onAdminAccess: () => void;
    onNavigateToServices: () => void;
    currentUser: PublicUser | null;
    onLogin: (user: PublicUser) => void;
    onLogout: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices, currentUser, onLogin, onLogout }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    
    // Sanitized phone number for WhatsApp API
    const phoneNumber = "593978980722"; 
    const displayPhone = "+593 978 980 722";

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white font-body overflow-x-hidden">
            {/* Navbar */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg py-3' : 'bg-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <Logo className="w-10 h-10" />
                        <div className="flex flex-col">
                            <span className="text-lg font-display font-bold text-gold tracking-wide leading-none">GESTIONES</span>
                            <span className="text-xs font-light tracking-[0.2em] text-white">TRIBUTARIAS</span>
                        </div>
                    </div>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-medium hover:text-gold transition-colors">Inicio</button>
                        <button onClick={onNavigateToServices} className="text-sm font-medium text-white hover:text-gold transition-colors flex items-center gap-1">Servicios</button>
                        
                        <button onClick={onNavigateToServices} className="text-sm font-medium text-white hover:text-gold transition-colors flex items-center gap-1">
                            <ShoppingCart size={18} /> Carrito
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
                        <button onClick={() => onNavigateToServices()} className="text-white hover:text-gold">
                            <ShoppingCart size={24} />
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
                             <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-white hover:bg-slate-800 rounded-md">Inicio</button>
                             <button onClick={() => { onNavigateToServices(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-bold text-gold bg-slate-800 rounded-md flex justify-between items-center">Servicios <ArrowRight size={16} /></button>
                             
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

            {/* Hero Section */}
            <section id="inicio" className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2070&auto=format&fit=crop" 
                        alt="Oficina" 
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/90 to-slate-950"></div>
                </div>
                
                <div className="relative z-10 max-w-5xl mx-auto px-4 text-center mt-12">
                    <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight">
                        Gestiones Tributarias <br/><span className="text-gold">Santiago Cordova</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-300 mb-4 max-w-3xl mx-auto font-light">
                        Asesor en Finanzas Tributarias
                    </p>
                    <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
                        Expertos en normativa ecuatoriana. Brindamos proyección financiera y tranquilidad legal para que su negocio crezca sin límites.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button onClick={onNavigateToServices} className="px-8 py-4 bg-gold text-black font-bold rounded-full hover:bg-white transition-all transform hover:scale-105 shadow-lg shadow-gold/20 inline-flex items-center justify-center gap-2 text-lg">
                            Ver Servicios y Precios <ArrowRight size={22}/>
                        </button>
                        <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="px-8 py-4 border border-white/30 bg-white/5 backdrop-blur-sm text-white font-bold rounded-full hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2 text-lg">
                            <Phone size={22}/> Contactar Asesor
                        </a>
                    </div>
                </div>
            </section>

            {/* Authority / About Section */}
            <section className="py-20 bg-slate-900 relative border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                             <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-2">Sobre su Asesor</h2>
                             <h3 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">Santiago Cordova</h3>
                             <h4 className="text-xl text-slate-300 mb-4">Asesor en Finanzas Tributarias</h4>
                             <p className="text-slate-400 leading-relaxed mb-6 text-lg">
                                 Con más de una década de experiencia en el sistema tributario ecuatoriano, me dedico a ofrecer soluciones fiscales precisas y estratégicas. Mi objetivo es asegurar que su negocio cumpla con todas las normativas del SRI, IESS y Supercias, optimizando sus recursos y evitando riesgos legales.
                             </p>
                             <div className="flex flex-col gap-4 mb-6">
                                <div className="flex items-center gap-3 text-slate-300">
                                    <CheckCircle className="text-gold" size={20}/>
                                    <span>Planificación Tributaria Estratégica</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-300">
                                    <CheckCircle className="text-gold" size={20}/>
                                    <span>Recuperación de Impuestos</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-300">
                                    <CheckCircle className="text-gold" size={20}/>
                                    <span>Defensa del Contribuyente</span>
                                </div>
                             </div>
                             <button onClick={onNavigateToServices} className="text-gold font-bold hover:text-white transition-colors flex items-center gap-2">
                                 Conoce nuestros planes de servicio <ArrowRight size={16}/>
                             </button>
                        </div>
                        <div className="relative">
                             <div className="absolute -inset-4 bg-gold/10 rounded-2xl blur-lg"></div>
                             <img 
                                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1974&auto=format&fit=crop" 
                                alt="Santiago Cordova Asesor" 
                                className="relative rounded-2xl shadow-2xl border border-slate-700 grayscale hover:grayscale-0 transition-all duration-500"
                             />
                             <div className="absolute -bottom-6 -right-6 bg-gold p-6 rounded-xl shadow-xl hidden md:block">
                                 <p className="text-black font-bold text-2xl font-display">100%</p>
                                 <p className="text-black/80 text-xs uppercase font-bold">Compromiso</p>
                             </div>
                        </div>
                     </div>
                </div>
            </section>

             {/* Why Choose Us */}
             <section className="py-20 bg-slate-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">¿Por qué elegirnos?</h2>
                        <p className="text-slate-400">Excelencia y precisión en cada declaración.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: Award, title: "Experiencia Comprobada", desc: "Amplio conocimiento en leyes tributarias y normativas vigentes." },
                            { icon: Clock, title: "Atención Oportuna", desc: "Respuestas rápidas y gestión eficiente de sus trámites." },
                            { icon: TrendingUp, title: "Asesoría Estratégica", desc: "Optimizamos su carga fiscal dentro del marco legal." }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-gold/30 transition-all duration-300 hover:-translate-y-1 group">
                                <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:bg-gold group-hover:text-black transition-colors text-gold">
                                    <item.icon size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

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
