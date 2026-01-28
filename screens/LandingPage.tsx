
import React, { useState, useEffect } from 'react';
import { 
    ArrowRight, CheckCircle, Phone, Award, Briefcase, 
    TrendingUp, Star, Laptop, ShieldCheck, MessageCircle, 
    ChevronDown, User, Calculator, BookOpen, 
    DollarSign, ChevronRight, Trophy, MapPin, Bell
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

export const LandingPage: React.FC<LandingPageProps> = ({ onAdminAccess, onNavigateToServices, currentUser, onLogout }) => {
    const [scrolled, setScrolled] = useState(false);
    const [activeWiki, setActiveWiki] = useState('retenciones');
    const phoneNumber = "593978980722"; 
    const displayPhone = "+593 978 980 722";

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const wikiContent = {
        retenciones: {
            title: "¿Cuánto me deben retener en 2026?",
            desc: "Las retenciones en la fuente varían según su actividad económica. Profesionales retienen el 10%, servicios el 2.75% y bienes el 1.75%.",
            tips: ["Verifique su acta de calificación", "Evite multas por retención errónea", "Aplique el nuevo porcentaje de IVA"]
        },
        rimpe: {
            title: "RIMPE: Negocio Popular vs Emprendedor",
            desc: "Si vende menos de $20,000 anuales es Popular (Cuota fija). Si vende hasta $300,000 es Emprendedor (Tabla progresiva).",
            tips: ["Popular no emite facturas, usa Notas de Venta", "Emprendedor debe usar Facturación Electrónica", "Fecha límite: Mayo de cada año"]
        },
        iva: {
            title: "Devolución de IVA 3ra Edad",
            desc: "Los adultos mayores pueden recuperar hasta $108 mensuales de IVA pagado en compras personales de primera necesidad.",
            tips: ["Aplica para salud, alimentación y vestimenta", "El trámite es 100% digital con nosotros", "Depósito directo en su cuenta bancaria"]
        }
    };

    return (
        <div className="min-h-screen bg-white font-body text-slate-800 selection:bg-[#00A896] selection:text-white">
            
            {/* TOP BAR / NEWS TICKER (SEO Dynamic Info) */}
            <div className="bg-[#0B2149] py-3 px-6 overflow-hidden hidden sm:block border-b border-white/5">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-[#00A896] px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-widest shrink-0 animate-pulse shadow-lg shadow-teal-500/20">
                        <Bell size={12}/> Alerta SRI
                    </div>
                    <div className="text-xs text-slate-300 font-medium overflow-hidden whitespace-nowrap">
                        <span className="inline-block animate-marquee">
                            • SRI inicia controles sobre facturación electrónica en negocios populares • Fecha límite para Impuesto a la Renta de Sociedades se aproxima • Nuevos beneficios para exportadores de servicios 2026 •
                        </span>
                    </div>
                </div>
            </div>

            {/* NAVIGATION BAR - Swiss Style */}
            <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-4 border-b border-slate-100 top-0' : 'bg-transparent py-8 sm:top-10 top-0'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-4 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className={`p-2.5 rounded-xl transition-all ${scrolled ? 'bg-[#0B2149]' : 'bg-white/10 backdrop-blur-sm border border-white/20'}`}>
                            <Logo className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-xl font-display font-black tracking-tight leading-none uppercase ${scrolled ? 'text-[#0B2149]' : 'text-white'}`}>Santiago Cordova</span>
                            <span className={`text-[9px] font-black uppercase tracking-[0.25em] mt-1.5 ${scrolled ? 'text-[#00A896]' : 'text-slate-300'}`}>Soluciones Tributarias</span>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        {['Guía SRI', 'Servicios', 'Calculadora', 'Contacto'].map(item => (
                            <button 
                                key={item} 
                                onClick={() => scrollToSection(item === 'Guía SRI' ? 'wiki' : item.toLowerCase())}
                                className={`text-sm font-bold transition-all hover:text-[#00A896] ${scrolled ? 'text-slate-600' : 'text-white/80 hover:text-white'}`}
                            >
                                {item}
                            </button>
                        ))}
                        <button 
                            onClick={onAdminAccess}
                            className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 ${scrolled ? 'bg-[#0B2149] text-white hover:bg-slate-800' : 'bg-white text-[#0B2149] hover:bg-slate-100'}`}
                        >
                            Acceso Clientes
                        </button>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION - Premium Look */}
            <header className="relative min-h-screen flex items-center bg-[#0B2149] overflow-hidden pt-20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0B2149] via-[#051135] to-[#020617]"></div>
                {/* Abstract Shapes */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#00A896] rounded-full blur-[150px] opacity-10 -mr-40 -mt-40 animate-pulse-slow"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-10 -ml-20 -mb-20"></div>
                
                <div className="max-w-7xl mx-auto px-6 relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="text-center lg:text-left">
                        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[#00A896] text-xs font-black uppercase tracking-widest mb-10 animate-fade-in-down backdrop-blur-md shadow-lg">
                            <Trophy size={14} /> <span>Líder en Asesoría Tributaria 2026</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-black text-white leading-[1.05] mb-8 animate-fade-in-up tracking-tight">
                            Pague lo <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00A896] to-emerald-400 underline decoration-emerald-500/30 underline-offset-8">Justo</span> al <br/>
                            Estado.
                        </h1>
                        <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-lg leading-relaxed animate-fade-in-up font-medium mx-auto lg:mx-0">
                            Especialista en Pasaje y El Oro. Maximizamos sus beneficios fiscales y aseguramos su tranquilidad legal con el SRI.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start animate-fade-in-up">
                            <button onClick={onNavigateToServices} className="px-10 py-5 bg-[#00A896] text-white font-black rounded-2xl hover:bg-teal-500 transition-all transform hover:scale-105 shadow-2xl shadow-teal-500/30 flex items-center justify-center gap-3 text-sm tracking-wide uppercase">
                                CONSULTAR PLANES <ArrowRight size={18}/>
                            </button>
                            <a href={`https://wa.me/${phoneNumber}`} target="_blank" rel="noopener noreferrer" className="px-10 py-5 bg-white/5 border border-white/10 text-white font-black rounded-2xl hover:bg-white/10 backdrop-blur-md transition-all flex items-center justify-center gap-3 text-sm tracking-wide uppercase hover:border-white/30">
                                <MessageCircle size={18}/> HABLAR CON ASESOR
                            </a>
                        </div>
                    </div>
                    
                    <div className="hidden lg:flex justify-end relative animate-float">
                         <div className="relative">
                            <div className="absolute -inset-10 bg-[#00A896]/20 blur-[60px] rounded-full"></div>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[3rem] shadow-2xl relative z-10 w-[28rem] rotate-2 hover:rotate-0 transition-transform duration-700">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-4 bg-[#00A896] rounded-2xl text-white shadow-lg shadow-teal-500/20"><TrendingUp size={32}/></div>
                                    <span className="font-display font-black text-white text-xl tracking-tight uppercase">Ruta al Crecimiento</span>
                                </div>
                                <div className="space-y-6">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">IVA Recaudado</p>
                                            <p className="text-3xl font-black text-white">$4,500</p>
                                        </div>
                                        <div className="h-10 w-28 bg-[#00A896]/20 rounded-full flex items-center justify-center text-[10px] font-black text-[#00A896] uppercase tracking-widest border border-[#00A896]/30">
                                            EN REGLA
                                        </div>
                                    </div>
                                    <div className="p-6 bg-gradient-to-r from-[#00A896]/10 to-transparent rounded-3xl border border-[#00A896]/20">
                                        <p className="text-[10px] text-[#00A896] font-black uppercase mb-1 tracking-widest">Ahorro Fiscal Estimado</p>
                                        <p className="text-4xl font-black text-[#00A896]">$840.00</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-8 italic font-bold leading-tight text-center">Gestión inteligente de gastos personales y retenciones 2026.</p>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer opacity-20 hover:opacity-100 transition-opacity" onClick={() => scrollToSection('wiki')}>
                    <ChevronDown size={32} className="text-white"/>
                </div>
            </header>

            {/* SECTION: WIKI SRI - Modern Clean Cards */}
            <section id="wiki" className="py-32 bg-white relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <div className="inline-flex p-4 bg-[#00A896]/10 rounded-2xl text-[#00A896] mb-8">
                                <BookOpen size={36}/>
                            </div>
                            <h2 className="text-5xl font-display font-black text-[#0B2149] mb-8 leading-tight tracking-tight">
                                Centro de <br/>
                                <span className="text-[#00A896]">Recursos Tributarios.</span>
                            </h2>
                            <p className="text-xl text-slate-500 mb-12 leading-relaxed font-medium">
                                No solo gestionamos, educamos. Obtenga respuestas claras a las dudas más comunes de los contribuyentes en Pasaje.
                            </p>
                            
                            <div className="space-y-4">
                                {Object.keys(wikiContent).map((key) => (
                                    <button 
                                        key={key} 
                                        onClick={() => setActiveWiki(key)}
                                        className={`w-full p-6 rounded-[20px] text-left transition-all duration-300 flex justify-between items-center group ${activeWiki === key ? 'bg-[#0B2149] text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        <span className={`font-black uppercase tracking-tight text-sm ${activeWiki === key ? 'text-white' : 'text-slate-500 group-hover:text-[#0B2149]'}`}>{key}</span>
                                        <ChevronRight size={20} className={`${activeWiki === key ? 'text-[#00A896]' : 'text-slate-300'}`}/>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#0B2149] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden h-full min-h-[500px] flex flex-col justify-center">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-[#00A896] opacity-10 rounded-full blur-[80px] -mt-20 -mr-20"></div>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-display font-black text-[#00A896] mb-6">{(wikiContent as any)[activeWiki].title}</h3>
                                <p className="text-slate-300 leading-relaxed mb-10 text-lg font-medium">{(wikiContent as any)[activeWiki].desc}</p>
                                
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Tips Clave:</p>
                                    {(wikiContent as any)[activeWiki].tips.map((tip: string, i: number) => (
                                        <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
                                            <div className="w-2 h-2 rounded-full bg-[#00A896] mt-2 shadow-[0_0_10px_#00CBA9]"></div>
                                            <p className="font-bold text-sm text-slate-200">{tip}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SERVICES PREVIEW - Cards Style */}
            <section id="servicios" className="py-32 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-24">
                         <h2 className="text-4xl md:text-6xl font-display font-black text-[#0B2149] mb-6">Nuestras Soluciones</h2>
                         <p className="text-slate-500 font-medium max-w-xl mx-auto text-lg">Desde firmas electrónicas hasta planes anuales de gestión para grandes contribuyentes.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { title: 'Gestión RIMPE', icon: Briefcase, desc: 'Ideal para pequeños negocios y populares en el cantón Pasaje.' },
                            { title: 'Firma Electrónica', icon: Laptop, desc: 'Válida por 1 o 2 años. Entrega inmediata 100% digital.' },
                            { title: 'Asesoría VIP', icon: Star, desc: 'Atención personalizada y proyección de gastos para ahorrar impuestos.' }
                        ].map((s, i) => (
                            <div key={i} className="p-10 bg-white rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 hover:border-[#00A896] hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
                                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-[#0B2149] mb-10 group-hover:bg-[#00A896] group-hover:text-white transition-all duration-300">
                                    <s.icon size={36}/>
                                </div>
                                <h3 className="text-2xl font-black text-[#0B2149] mb-4 tracking-tight">{s.title}</h3>
                                <p className="text-slate-500 font-medium leading-relaxed mb-10 min-h-[3rem]">{s.desc}</p>
                                <button onClick={onNavigateToServices} className="flex items-center gap-3 font-black text-xs uppercase tracking-widest text-[#00A896] hover:gap-5 transition-all group/btn">
                                    Explorar tarifas <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform"/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TRUST / STATS */}
            <section className="py-32 bg-white">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-16 text-center">
                    {[
                        { val: '10+', label: 'Años de Experiencia', icon: Award },
                        { val: '500+', label: 'Clientes en Pasaje', icon: Briefcase }, 
                        { val: '$1.2M', label: 'IVA Recuperado', icon: DollarSign },
                        { val: '100%', label: 'Confidencialidad', icon: ShieldCheck }
                    ].map((st, i) => (
                        <div key={i} className="space-y-4">
                            <div className="flex justify-center text-[#00A896] opacity-20 mb-2"><st.icon size={56}/></div>
                            <p className="text-5xl font-display font-black text-[#0B2149] tracking-tight">{st.val}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{st.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA SECTION */}
            <section id="contacto" className="py-32 bg-[#0B2149] relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl md:text-7xl font-display font-black text-white mb-10 tracking-tight leading-[1.1]">
                        ¿Listo para ordenar <br/> sus finanzas?
                    </h2>
                    <p className="text-slate-400 text-xl mb-16 font-medium max-w-2xl mx-auto leading-relaxed">
                        Únase a los cientos de empresarios en El Oro que ya duermen tranquilos. Atendemos de forma presencial o remota.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6 justify-center">
                        <a 
                            href={`https://wa.me/${phoneNumber}`} 
                            className="px-12 py-6 bg-[#00A896] text-white font-black rounded-2xl hover:bg-teal-500 transition-all shadow-2xl shadow-teal-500/20 flex items-center justify-center gap-4 uppercase text-sm tracking-widest transform hover:scale-105"
                        >
                            <MessageCircle size={24}/> WhatsApp Directo
                        </a>
                        <div className="px-12 py-6 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl text-white font-black flex items-center justify-center gap-4 text-sm tracking-widest uppercase">
                            <Phone size={24} className="text-[#00A896]"/> {displayPhone}
                        </div>
                    </div>
                    <div className="mt-16 flex items-center justify-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest bg-white/5 inline-flex px-6 py-3 rounded-full border border-white/5">
                        <MapPin size={16} className="text-[#00A896]"/> Colón y Sucre / Pasaje - El Oro
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-950 py-20 text-white border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-4">
                        <Logo className="w-10 h-10 opacity-50" />
                        <div className="flex flex-col">
                            <span className="text-xl font-display font-black uppercase tracking-tighter">Santiago Cordova</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Asesoría Tributaria &copy; 2026</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-10 flex-wrap justify-center">
                        {['Inicio', 'Privacidad', 'SRI en Línea', 'Login Admin'].map(item => (
                            <button 
                                key={item} 
                                onClick={() => item === 'Login Admin' ? onAdminAccess() : window.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#00A896] transition-all"
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
};
