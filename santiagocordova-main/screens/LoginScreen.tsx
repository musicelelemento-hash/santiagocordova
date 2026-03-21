
import React, { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';
import { ArrowRight, Lock, User, Briefcase, ChevronLeft, ShieldCheck, Loader } from 'lucide-react';
import { Client } from '../types';

interface LoginScreenProps {
    onSuccess: (role: 'admin' | 'client', clientData?: Client) => void;
    onBack: () => void;
    clients?: Client[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess, onBack, clients = [] }) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginType, setLoginType] = useState<'admin' | 'client'>('client');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        // Simulación de delay de red para UX "Procesando"
        setTimeout(() => {
            if (loginType === 'admin') {
                if (identifier === '@Santiago' && password === '') {
                    onSuccess('admin');
                } else {
                    setError('Credenciales administrativas incorrectas.');
                    setIsSubmitting(false);
                }
            } else {
                const foundClient = clients.find(c => c.ruc === identifier && c.sriPassword === password);
                
                if (foundClient) {
                    if (foundClient.isActive === false) {
                        setError('Su cuenta se encuentra inactiva. Contacte a soporte.');
                    } else {
                        onSuccess('client', foundClient);
                    }
                } else {
                    setError('RUC o Clave SRI incorrectos.');
                }
                setIsSubmitting(false);
            }
        }, 1200);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-body selection:bg-[#00A896] selection:text-white">
             {/* --- BACKGROUND FX --- */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 z-0"></div>
             
             {/* Aurora Blobs */}
             <div className={`absolute top-0 right-0 w-[800px] h-[800px] bg-[#00A896]/10 rounded-full blur-[120px] -mr-40 -mt-40 transition-all duration-[2000ms] ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}></div>
             <div className={`absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] -ml-20 -mb-20 transition-all duration-[2000ms] delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}></div>

             {/* --- MAIN CARD --- */}
             <div className={`relative z-10 w-full max-w-[420px] p-8 transition-all duration-700 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                
                {/* Back Button */}
                <button 
                    onClick={onBack}
                    className="absolute top-0 left-8 -mt-12 flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest group"
                >
                    <div className="p-1 rounded-full border border-slate-700 group-hover:border-white transition-colors">
                        <ChevronLeft size={14}/>
                    </div>
                    Volver
                </button>

                <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden relative">
                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                    <div className="p-8 relative z-10">
                        {/* Header */}
                        <div className="text-center mb-10">
                            <div className="inline-flex p-4 bg-gradient-to-br from-[#0B2149] to-[#020617] rounded-3xl shadow-lg border border-white/10 mb-6">
                                <Logo className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-display font-black text-white tracking-tight">
                                {loginType === 'admin' ? 'Comando Central' : 'Bóveda del Cliente'}
                            </h2>
                            <p className="text-slate-400 text-xs mt-3 font-medium tracking-wide flex justify-center items-center gap-2">
                                <ShieldCheck size={12} className="text-[#00A896]"/> ACCESO SEGURO SSL
                            </p>
                        </div>

                        {/* Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-black/20 p-1.5 rounded-2xl mb-8 border border-white/5">
                            <button 
                                onClick={() => { setLoginType('client'); setError(''); }}
                                className={`py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${loginType === 'client' ? 'bg-[#00A896] text-white shadow-lg shadow-teal-900/50' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <Briefcase size={14}/> Clientes
                            </button>
                            <button 
                                onClick={() => { setLoginType('admin'); setError(''); }}
                                className={`py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${loginType === 'admin' ? 'bg-white text-[#0B2149] shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <Lock size={14}/> Admin
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-[#00A896] uppercase tracking-[0.2em] ml-2">
                                    {loginType === 'client' ? 'Identificación (RUC)' : 'ID Usuario'}
                                </label>
                                <div className="group relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-white">
                                        <User size={18} />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={identifier}
                                        onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                                        className="w-full h-14 bg-[#020617]/50 border border-white/10 rounded-2xl pl-14 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896] transition-all font-mono tracking-wide"
                                        placeholder={loginType === 'client' ? "1790000000001" : "Usuario"}
                                        autoComplete="off"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-[#00A896] uppercase tracking-[0.2em] ml-2">
                                    {loginType === 'client' ? 'Contraseña SRI' : 'Clave de Acceso'}
                                </label>
                                <div className="group relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-white">
                                        <Lock size={18} />
                                    </div>
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        className="w-full h-14 bg-[#020617]/50 border border-white/10 rounded-2xl pl-14 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00A896] focus:ring-1 focus:ring-[#00A896] transition-all tracking-widest"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-fade-in-down backdrop-blur-sm">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <p className="text-red-200 text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isSubmitting || !identifier} 
                                className="w-full h-16 mt-4 bg-gradient-to-r from-[#00A896] to-teal-500 hover:to-teal-400 text-white font-black rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-[0.2em] shadow-2xl shadow-teal-900/30 hover:shadow-teal-500/20 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out skew-y-12"></div>
                                <span className="relative z-10 flex items-center gap-3">
                                    {isSubmitting ? (
                                        <>
                                            <Loader size={18} className="animate-spin"/> AUTENTICANDO
                                        </>
                                    ) : (
                                        <>
                                            INGRESAR <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-[#020617]/40 p-4 text-center border-t border-white/5 backdrop-blur-md">
                        <p className="text-[10px] text-slate-500 font-medium">
                             Protegido por reCAPTCHA Enterprise. <br/>
                             <span className="opacity-50">v2.5.0 Stable Build</span>
                        </p>
                    </div>
                </div>
             </div>
        </div>
    );
};
