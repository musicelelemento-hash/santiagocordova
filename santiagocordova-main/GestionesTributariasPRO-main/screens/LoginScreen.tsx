
import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { ArrowRight, Lock, User } from 'lucide-react';

interface LoginScreenProps {
    onSuccess: () => void;
    onBack: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess, onBack }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Actualización de credenciales: Usuario '@Santiago', Clave vacía
        if (username === '@Santiago' && password === '') {
            onSuccess();
        } else {
            setError('Credenciales incorrectas. Acceso denegado.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
             
             <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-800">
                <div className="text-center mb-8">
                    <div className="inline-block p-3 rounded-full bg-gold/10 mb-4">
                        <Logo className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white">Acceso Administrativo</h2>
                    <p className="text-slate-400 text-sm mt-2">Sistema de Gestión Interna</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gold uppercase tracking-wider mb-2">Usuario</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                                placeholder="Ingrese su usuario"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gold uppercase tracking-wider mb-2">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs text-center">
                            {error}
                        </div>
                    )}

                    <button type="submit" className="w-full py-3 bg-gold hover:bg-white text-black font-bold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 group">
                        <span>Ingresar al Sistema</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>
                
                <button onClick={onBack} className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    &larr; Volver al sitio público
                </button>
             </div>
        </div>
    );
};
