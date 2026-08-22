
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import {
    ArrowRight, BadgeCheck, Briefcase, Building, ChevronLeft,
    Eye, EyeOff, HelpCircle, Loader, Lock, ShieldCheck, User
} from 'lucide-react';
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
    const [showPassword, setShowPassword] = useState(false);
    const [showSriHelp, setShowSriHelp] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    // ── Rate limiter (P0 Security) ──────────────────────────────────────────
    const RATE_KEY = 'login_attempts';
    const RATE_TS_KEY = 'login_block_until';

    const getRateState = () => ({
        attempts: parseInt(localStorage.getItem(RATE_KEY) || '0', 10),
        blockUntil: parseInt(localStorage.getItem(RATE_TS_KEY) || '0', 10),
    });

    const [rateError, setRateError] = useState<string>(() => {
        const { blockUntil } = getRateState();
        if (Date.now() < blockUntil) {
            const secs = Math.ceil((blockUntil - Date.now()) / 1000);
            return `Demasiados intentos. Espere ${secs}s.`;
        }
        return '';
    });

    // ── Remember Me (P1 Quality) ─────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem('login_remember_id');
        if (saved) setIdentifier(saved);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        const cleanIdentifier = identifier.trim();
        const cleanPassword = password.trim();

        if (!cleanIdentifier || !cleanPassword) {
            setError('Por favor complete ambos campos de acceso.');
            return;
        }

        // Rate limit check
        const { attempts, blockUntil } = getRateState();
        if (Date.now() < blockUntil) {
            const secs = Math.ceil((blockUntil - Date.now()) / 1000);
            setRateError(`Acceso bloqueado. Espere ${secs} segundos.`);
            return;
        }

        setIsSubmitting(true);
        setError('');
        setRateError('');

        // Remember Me
        if (rememberMe) {
            localStorage.setItem('login_remember_id', cleanIdentifier);
        } else {
            localStorage.removeItem('login_remember_id');
        }

        setTimeout(() => {
            if (loginType === 'admin') {
                const ADMIN_USER = (import.meta as any).env?.VITE_ADMIN_USER || '@Santiago';
                const ADMIN_PASS = (import.meta as any).env?.VITE_ADMIN_PASS || '';

                if (cleanIdentifier === ADMIN_USER && cleanPassword === ADMIN_PASS) {
                    localStorage.setItem(RATE_KEY, '0');
                    localStorage.removeItem(RATE_TS_KEY);
                    setPassword('');
                    onSuccess('admin');
                } else {
                    const newAttempts = attempts + 1;
                    localStorage.setItem(RATE_KEY, String(newAttempts));
                    if (newAttempts >= 5) {
                        const unblockAt = Date.now() + 30_000;
                        localStorage.setItem(RATE_TS_KEY, String(unblockAt));
                        setRateError('5 intentos fallidos. Acceso bloqueado por 30 segundos.');
                    } else {
                        setError(`Credenciales administrativas incorrectas. (Intento ${newAttempts}/5)`);
                    }
                    setIsSubmitting(false);
                }
            } else {
                const foundClient = clients.find(c => c.ruc === cleanIdentifier && c.sriPassword === cleanPassword);
                if (foundClient) {
                    if (foundClient.isActive === false) {
                        setError('Su cuenta se encuentra inactiva. Contacte a soporte.');
                    } else {
                        localStorage.setItem(RATE_KEY, '0');
                        setPassword('');
                        onSuccess('client', foundClient);
                    }
                } else {
                    const newAttempts = attempts + 1;
                    localStorage.setItem(RATE_KEY, String(newAttempts));
                    if (newAttempts >= 5) {
                        const unblockAt = Date.now() + 30_000;
                        localStorage.setItem(RATE_TS_KEY, String(unblockAt));
                        setRateError('5 intentos fallidos. Acceso bloqueado por 30 segundos.');
                    } else {
                        setError(`RUC o Clave SRI incorrectos. (Intento ${newAttempts}/5)`);
                    }
                }
                setIsSubmitting(false);
            }
        }, 1000);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#030712] relative overflow-hidden font-body selection:bg-brand-teal selection:text-white px-4 py-8">
            {/* Ambient Lighting & Mesh Gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(13,148,136,0.25),rgba(255,255,255,0))] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_120%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none" />
            
            {/* Subtle Grid Overlay */}
            <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
                    backgroundSize: '28px 28px'
                }}
            />

            {/* Glowing Aurora Spheres */}
            <motion.div
                animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.35, 0.55, 0.35],
                    rotate: [0, 90, 0]
                }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-gradient-to-br from-brand-teal/30 via-teal-500/20 to-sky-500/10 rounded-full blur-[130px] pointer-events-none"
            />
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.25, 0.45, 0.25],
                    rotate: [0, -90, 0]
                }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-gradient-to-tr from-sky-500/20 via-emerald-500/20 to-teal-400/10 rounded-full blur-[140px] pointer-events-none"
            />

            {/* Top Navigation & Live Security Status */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 max-w-6xl mx-auto pointer-events-none">
                <button
                    onClick={onBack}
                    className="pointer-events-auto group flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 text-slate-300 hover:text-white hover:border-brand-teal/40 hover:bg-slate-900/80 transition-all shadow-lg text-xs font-semibold uppercase tracking-wider"
                >
                    <ChevronLeft size={16} className="text-brand-teal group-hover:-translate-x-0.5 transition-transform" />
                    <span>Volver al Inicio</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 text-xs font-medium text-slate-400">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-slate-300 font-mono">SRI Direct</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">256-bit SSL</span>
                </div>
            </div>

            {/* Main Auth Card (Ampliada a 500px con excelente espaciado) */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-[500px]"
            >
                {/* Outer Glow Wrapper */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-teal/40 via-sky-500/20 to-emerald-500/30 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />

                <div className="relative bg-slate-950/90 backdrop-blur-3xl rounded-[2.5rem] border border-slate-800/90 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] overflow-hidden">
                    {/* Glossy Top Accent Line */}
                    <div className="h-1 w-full bg-gradient-to-r from-transparent via-brand-teal to-transparent opacity-80" />

                    <div className="p-8 sm:p-10 relative z-10 space-y-6">
                        {/* Header Header & Brand Badge */}
                        <div className="text-center">
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 2 }}
                                whileTap={{ scale: 0.95 }}
                                className="inline-flex p-4 bg-slate-900/90 rounded-2xl shadow-xl border border-slate-800/80 mb-4 relative group cursor-pointer"
                            >
                                <div className="absolute inset-0 bg-brand-teal/20 rounded-2xl blur-md group-hover:blur-lg transition-all opacity-0 group-hover:opacity-100" />
                                <Logo className="w-11 h-11 relative z-10" />
                            </motion.div>

                            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                                {loginType === 'admin' ? 'Comando Central' : 'Bóveda del Cliente'}
                            </h1>
                            <p className="text-slate-400 text-xs mt-2 font-medium flex items-center justify-center gap-1.5">
                                <ShieldCheck size={14} className="text-brand-teal" />
                                <span>{loginType === 'admin' ? 'Acceso Administrativo Privado' : 'Gestión Contable & Tributaria SRI'}</span>
                            </p>
                        </div>

                        {/* Role Switcher Tabs (Espaciosos y no aplastados) */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800/80 relative">
                            <button
                                type="button"
                                onClick={() => { setLoginType('client'); setError(''); }}
                                className={`relative py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2 z-10 ${
                                    loginType === 'client' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {loginType === 'client' && (
                                    <motion.div
                                        layoutId="activeRoleTab"
                                        className="absolute inset-0 bg-gradient-to-r from-brand-teal to-teal-600 rounded-xl shadow-lg shadow-brand-teal/25"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <Briefcase size={16} /> Cliente SRI
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => { setLoginType('admin'); setError(''); }}
                                className={`relative py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2 z-10 ${
                                    loginType === 'admin' ? 'text-slate-950 font-extrabold' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {loginType === 'admin' && (
                                    <motion.div
                                        layoutId="activeRoleTab"
                                        className="absolute inset-0 bg-white rounded-xl shadow-lg shadow-white/20"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <Lock size={16} /> Administrador
                                </span>
                            </button>
                        </div>

                        {/* Main Login Form */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            {/* Identifier Input Field (h-14 alto y espacioso) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1 block">
                                    {loginType === 'client' ? 'RUC o Identificación SRI' : 'Usuario Admin'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-teal transition-colors">
                                        {loginType === 'client' ? <Building size={18} /> : <User size={18} />}
                                    </div>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                                        className="w-full h-14 bg-slate-900/90 border border-slate-800 rounded-2xl pl-12 pr-4 text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal/60 focus:ring-4 focus:ring-brand-teal/15 transition-all shadow-inner"
                                        placeholder={loginType === 'client' ? "Ingrese su RUC o Cédula" : "Ingrese su usuario"}
                                        autoComplete="username"
                                        name="username"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Password Input Field (h-14 alto y espacioso) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1 block">
                                    {loginType === 'client' ? 'Clave de Acceso SRI' : 'Contraseña Segura'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-teal transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        className="w-full h-14 bg-slate-900/90 border border-slate-800 rounded-2xl pl-12 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal/60 focus:ring-4 focus:ring-brand-teal/15 transition-all font-mono shadow-inner"
                                        placeholder="••••••••••••"
                                        autoComplete="current-password"
                                        name="password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-800/50"
                                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me Checkbox */}
                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-brand-teal focus:ring-brand-teal focus:ring-offset-slate-950 cursor-pointer"
                                    />
                                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors font-medium">
                                        Recordar credenciales en este equipo
                                    </span>
                                </label>
                            </div>

                            {/* Error Notification */}
                            <AnimatePresence>
                                {(error || rateError) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 shadow-lg shadow-rose-500/5"
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                                        <p className="text-rose-300 text-xs font-semibold leading-relaxed">{rateError || error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit Button (Alto h-14, Robusto y Cómodo) */}
                            <motion.button
                                type="submit"
                                disabled={isSubmitting || !identifier || !password}
                                whileHover={{ scale: isSubmitting || !identifier || !password ? 1 : 1.015 }}
                                whileTap={{ scale: isSubmitting || !identifier || !password ? 1 : 0.98 }}
                                className="w-full h-14 mt-3 bg-gradient-to-r from-brand-teal to-teal-500 hover:from-teal-400 hover:to-teal-600 text-white font-black rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest shadow-xl shadow-brand-teal/20 relative overflow-hidden group cursor-pointer"
                            >
                                {/* Shimmer Effect */}
                                <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />

                                <span className="relative z-10 flex items-center gap-3 font-black">
                                    {isSubmitting ? (
                                        <>
                                            <Loader size={20} className="animate-spin text-white" />
                                            <span>Autenticando Acceso...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Ingresar al Sistema</span>
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform text-white" />
                                        </>
                                    )}
                                </span>
                            </motion.button>
                        </form>
                    </div>

                    {/* Footer Info & Security Seal */}
                    <div className="bg-slate-900/80 px-8 py-4 text-center border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                            <BadgeCheck size={15} className="text-brand-teal" />
                            <span>Servicios Contables Santiago Córdova</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                            v4.2 • SSL Encrypted
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

