import React, { useState, useEffect } from 'react';
import { ShieldCheck, Activity, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Theme } from '../../types';

interface SystemPulseProps {
    userName?: string;
    role?: string;
    sessionCode?: string;
    version?: string;
    theme?: Theme;
    isCollapsed?: boolean;
}

export const SystemPulse: React.FC<SystemPulseProps> = ({
    userName = "Santiago Cordova",
    role = "ADMINISTRADOR",
    sessionCode = "AQ.Ab8RN",
    version = "v1.0",
    theme = "dark",
    isCollapsed = false
}) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (isCollapsed) {
        return (
            <div className="flex flex-col items-center gap-6 py-6 px-2 select-none animate-in fade-in duration-500 font-premium">
                {/* Clock only */}
                <div className="flex flex-col items-center">
                    <span className={`text-xs font-mono font-bold tracking-tight ${
                        theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                    }`}>
                        {format(currentTime, 'HH:mm')}
                    </span>
                </div>

                {/* Led connection dot */}
                <div className="relative" title="Conexión Segura Activa">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-white/10'
                    }`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    </div>
                </div>

                {/* Glass initials badge */}
                <div 
                    className={`w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/10 to-emerald-500/10 border flex items-center justify-center text-xs font-black tracking-widest hover:scale-105 transition-transform ${
                        theme === 'light' 
                            ? 'border-slate-200 text-slate-700 bg-slate-50' 
                            : 'border-white/10 text-slate-200 bg-white/5'
                    }`}
                    title={`${userName} (${role})`}
                >
                    {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>

                {/* Mini shield check */}
                <span title="Seguridad Activa">
                    <ShieldCheck size={14} className="text-slate-500 opacity-40 hover:opacity-100 hover:text-primary transition-all cursor-help mt-2" />
                </span>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-4 p-5 select-none animate-fade-in font-premium">
            {/* Clock & Date Section - Minimalist */}
            <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-light tracking-tighter tabular-nums ${
                    theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                }`}>
                    {format(currentTime, 'HH:mm')}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                    {format(currentTime, 'd MMM', { locale: es })}
                </span>
            </div>

            {/* Identity Section - Ultra Minimalist Profile Badge */}
            <div className={`pt-4 border-t ${
                theme === 'light' ? 'border-slate-100' : 'border-white/5'
            }`}>
                <div className="flex items-center gap-3">
                    {/* Tiny Initials Avatar */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black tracking-wider ${
                        theme === 'light' 
                            ? 'bg-slate-100 border border-slate-200 text-slate-700'
                            : 'bg-white/5 border border-white/10 text-slate-300'
                    }`}>
                        {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-xs font-bold truncate ${
                            theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                        }`}>
                            {userName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[8px] font-black uppercase tracking-wider ${
                                theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                                {role}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
