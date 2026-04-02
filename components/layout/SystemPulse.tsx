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
}

export const SystemPulse: React.FC<SystemPulseProps> = ({
    userName = "Santiago Cordova",
    role = "ADMINISTRADOR",
    sessionCode = "AQ.Ab8RN",
    version = "v1.0",
    theme = "dark"
}) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col gap-6 p-6 select-none animate-fade-in font-premium">
            {/* Clock & Date Section */}
            <div className="flex flex-col">
                <span className={`text-4xl font-light tracking-tighter tabular-nums ${
                    theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                }`}>
                    {format(currentTime, 'HH:mm')}
                </span>
                <span className={`text-[11px] font-medium mt-1 lowercase first-letter:uppercase ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                    {format(currentTime, 'EEEE, d MMMM', { locale: es })}
                </span>
            </div>

            {/* Operational Status Section */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        theme === 'light' ? 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.3)]' : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                    }`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] font-premium ${
                        theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                        Estado Operativo
                    </span>
                </div>
                
                <div className={`flex flex-col gap-1.5 pl-3.5 border-l ${
                    theme === 'light' ? 'border-slate-200' : 'border-white/5'
                }`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium ${
                            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                        }`}>SISTEMA INTEGRAL {version}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-black uppercase tracking-widest font-premium ${
                            theme === 'light' ? 'text-slate-400' : 'text-white/40'
                        }`}>Conexión Segura Activa</span>
                    </div>
                </div>
            </div>

            {/* Identity Section */}
            <div className={`mt-2 pt-6 border-t ${
                theme === 'light' ? 'border-slate-100' : 'border-white/5'
            }`}>
                <div className="flex flex-col gap-1">
                    <h3 className={`text-sm font-semibold tracking-tight ${
                        theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                    }`}>
                        {userName}
                    </h3>
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-[0.15em] font-premium ${
                            theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                            {role}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                            theme === 'light' 
                                ? 'text-slate-400 bg-slate-100 border-slate-200'
                                : 'text-white/30 bg-white/5 border-white/10' 
                        }`}>
                            {sessionCode}
                        </span>
                    </div>
                </div>
            </div>

            {/* System Shield Indicator - Minimalist */}
            <div className="mt-auto pt-4 flex justify-end">
                <ShieldCheck size={14} className="text-slate-800 opacity-50 hover:opacity-100 hover:text-white/50 transition-all cursor-help" />
            </div>
        </div>
    );
};
