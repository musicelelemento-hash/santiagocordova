
import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { ArrowRight, Lock, User, Briefcase } from 'lucide-react';
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
    const [loginType, setLoginType] = useState<'admin' | 'client'>('client'); // Default to client for broader access

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        // Simulate network delay for UX
        setTimeout(() => {
            if (loginType === 'admin') {
                // Admin Login Logic
                if (identifier === '@Santiago' && password === '') { // Keep original logic for admin
                    onSuccess('admin');
                } else {
                    setError('Credenciales administrativas incorrectas.');
                    setIsSubmitting(false);
                }
            } else {
                // Client Login Logic
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
        }, 800);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B2149] relative overflow-hidden font-body selection:bg-[#00A896] selection:text-white">
             {/* Background Effects */}
             <div className="absolute inset-0 bg-gradient-to-b from-[#0B2149] to-[#051135]"></div>
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00A896]/10 rounded-full blur-[120px] -mr-40 -mt-40"></div>
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] -ml-20 -mb-20"></div>

             <div className="relative z-10 w-full max-w-sm p-8">
                {/* Logo & Header */}
                <div className="flex flex-col items-center mb-10">
                    <div className="p-4 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl mb-6">
                        <Logo className="w-12 h-12" />
                    </div>
                    <h2 className="text-xl font-display font-bold text-white tracking-wide uppercase">
                        {loginType === 'admin' ? 'Acceso Administrativo' : 'Portal del Cliente'}
                    </h2>
                    <p className="text-slate-400 text-xs mt-2 font-medium tracking-wider">SOLUCIONES TRIBUTARIAS PRO</p>
                </div>

                {/* Login Type Switcher */}
                <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/5">
                    <button 
                        onClick={() => { setLoginType('client'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${loginType === 'client' ? 'bg-[#00A896] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Briefcase size={14}/> Soy Cliente
                    </button>
                    <button 
                        onClick={() => { setLoginType('admin'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${loginType === 'admin' ? 'bg-white text-[#0B2149] shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Lock size={14}/> Administración
                    </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-[#00A896] uppercase tracking-widest ml-1">
                            {loginType === 'client' ? 'RUC / Cédula' : 'Usuario'}
                        </label>
                        <div className="group relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[#00A896]">
                                <User size={18} />
                            </div>
                            <input 
                                type="text" 
                                value={identifier}
                                onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00A896]/50 focus:bg-white/10 transition-all font-mono"
                                placeholder={loginType === 'client' ? "1790000000001" : "Usuario Admin"}
                                autoComplete="off"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-[#00A896] uppercase tracking-widest ml-1">
                            {loginType === 'client' ? 'Clave SRI' : 'Contraseña'}
                        </label>
                        <div className="group relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[#00A896]">
                                <Lock size={18} />
                            </div>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00A896]/50 focus:bg-white/10 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-200 text-xs font-medium text-center animate-fade-in-down backdrop-blur-sm">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isSubmitting || !identifier} 
                        className="w-full h-14 bg-[#00A896] hover:bg-teal-500 text-white font-black rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-widest shadow-xl shadow-teal-900/20 hover:shadow-teal-900/40 transform hover:scale-[1.02] active:scale-95"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">Verificando...</span>
                        ) : (
                            <>
                                <span>Ingresar a Bóveda</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
                
                <div className="mt-12 text-center">
                    <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider">
                        Volver al Inicio
                    </button>
                </div>
             </div>
        </div>
    );
};
