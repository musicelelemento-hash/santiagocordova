
import React, { useState, useEffect } from 'react';
import { Logo } from '../components/ui/Logo';
import * as LucideIcons from 'lucide-react';
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
                if (identifier === '@Santiago' && password === 'Santiago2026') {
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-body selection:bg-brand-teal selection:text-white">
            {/* --- BACKGROUND FX --- */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 z-0"></div>

            {/* Aurora Blobs */}
            <div className={`absolute top-0 right-0 w-[800px] h-[800px] bg-brand-teal/10 rounded-full blur-[120px] -mr-40 -mt-40 transition-all duration-[2000ms] ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}></div>
            <div className={`absolute bottom-0 left-0 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] -ml-20 -mb-20 transition-all duration-[2000ms] delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}></div>

            {/* --- MAIN CARD --- */}
            <div className={`relative z-10 w-full max-w-[420px] p-6 transition-all duration-700 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>

                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="absolute top-0 left-6 -mt-12 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold uppercase tracking-widest group"
                >
                    <div className="p-1.5 rounded-xl border border-slate-800 group-hover:border-brand-teal/50 transition-colors bg-slate-900/50">
                        <LucideIcons.ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                    Volver
                </button>

                <div className="bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden relative">
                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                    <div className="p-8 relative z-10">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="inline-flex p-4 bg-slate-950 rounded-3xl shadow-xl border border-slate-800 mb-5">
                                <Logo className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                                {loginType === 'admin' ? 'Comando Central' : 'Bóveda del Cliente'}
                            </h2>
                            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-widest mt-2 flex justify-center items-center gap-2">
                                <LucideIcons.ShieldCheck size={14} className="text-brand-teal" /> Acceso Seguro SSL
                            </p>
                        </div>

                        {/* Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl mb-8 border border-slate-800">
                            <button
                                onClick={() => { setLoginType('client'); setError(''); }}
                                className={`py-3 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${loginType === 'client' ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20 scale-105' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LucideIcons.Briefcase size={14} /> Clientes
                            </button>
                            <button
                                onClick={() => { setLoginType('admin'); setError(''); }}
                                className={`py-3 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${loginType === 'admin' ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LucideIcons.Lock size={14} /> Admin
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-brand-teal uppercase tracking-widest ml-1">
                                    {loginType === 'client' ? 'Identificación (RUC)' : 'ID Usuario'}
                                </label>
                                <div className="group relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-teal">
                                        <LucideIcons.User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                                        className="w-full h-13 bg-slate-950/60 border border-slate-800 rounded-2xl pl-12 pr-4 text-xs font-mono font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal/50 focus:ring-4 focus:ring-brand-teal/10 transition-all"
                                        placeholder={loginType === 'client' ? "1790000000001" : "Usuario"}
                                        autoComplete={loginType === 'client' ? "username" : "username"}
                                        name="username"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-brand-teal uppercase tracking-widest ml-1">
                                    {loginType === 'client' ? 'Contraseña SRI' : 'Clave de Acceso'}
                                </label>
                                <div className="group relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-teal">
                                        <LucideIcons.Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        className="w-full h-13 bg-slate-950/60 border border-slate-800 rounded-2xl pl-12 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal/50 focus:ring-4 focus:ring-brand-teal/10 transition-all font-mono"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        name="password"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                    <p className="text-rose-300 text-xs font-medium">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !identifier}
                                className="w-full h-14 mt-4 bg-brand-teal hover:bg-teal-500 text-white font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest shadow-xl shadow-brand-teal/20 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    {isSubmitting ? (
                                        <>
                                            <LucideIcons.Loader size={18} className="animate-spin" /> AUTENTICANDO
                                        </>
                                    ) : (
                                        <>
                                            INGRESAR <LucideIcons.ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-slate-950/60 p-4 text-center border-t border-slate-800/80">
                        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                            Protegido por reCAPTCHA Enterprise <br />
                            <span className="opacity-40">Santiago Cordova Protocol v4.0</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
