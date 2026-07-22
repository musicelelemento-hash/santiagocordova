import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus } from '../../types';
import { getNinthDigit } from '../../services/sri';

interface SriCampaignWidgetProps {
    clients: Client[];
    selectedDigitFilter: number | null;
    onSelectDigitFilter: (digit: number | null) => void;
    theme?: 'light' | 'dark';
}

export const SriCampaignWidget: React.FC<SriCampaignWidgetProps> = ({
    clients,
    selectedDigitFilter,
    onSelectDigitFilter,
    theme = 'dark'
}) => {
    // Current date calculations
    const today = new Date();
    const currentDay = today.getDate();
    
    // Map day of month to SRI 9th digit due
    // 10th->1, 12th->2, 14th->3, 16th->4, 18th->5, 20th->6, 22nd->7, 24th->8, 26th->9, 28th->0
    const getDigitForDay = (day: number): number => {
        if (day <= 10) return 1;
        if (day <= 12) return 2;
        if (day <= 14) return 3;
        if (day <= 16) return 4;
        if (day <= 18) return 5;
        if (day <= 20) return 6;
        if (day <= 22) return 7;
        if (day <= 24) return 8;
        if (day <= 26) return 9;
        return 0;
    };

    const activeTodayDigit = getDigitForDay(currentDay);
    const activeDigit = selectedDigitFilter !== null ? selectedDigitFilter : activeTodayDigit;

    // Calculate days remaining in July/August Semestral S1 campaign (ends Aug 28)
    const campaignDeadline = new Date(today.getFullYear(), 7, 28); // Aug 28
    const diffTime = campaignDeadline.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Clients matching current active digit
    const digitSemestralClients = clients.filter(c => {
        const digit = getNinthDigit(c.ruc);
        const freq = c.taxProfile?.ivaFrequency || (c.regime === 'RimpeEmprendedor' ? 'Semestral' : 'Mensual');
        return digit === activeDigit && (freq === 'Semestral' || c.regime === 'RimpeEmprendedor');
    });

    const digitMensualClients = clients.filter(c => {
        const digit = getNinthDigit(c.ruc);
        const freq = c.taxProfile?.ivaFrequency || (c.regime === 'General' ? 'Mensual' : 'Mensual');
        return digit === activeDigit && freq === 'Mensual' && c.regime !== 'RimpeEmprendedor' && c.regime !== 'RimpeNegocioPopular';
    });

    const pendingSemestralCount = digitSemestralClients.filter(c => {
        const decls = c.declarations || [];
        return !decls.some(d => d.period.includes('S1') && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file));
    }).length;

    const pendingMensualCount = digitMensualClients.filter(c => {
        const decls = c.declarations || [];
        return !decls.some(d => d.period.endsWith('-06') && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file));
    }).length;

    // SRI Digit mapping table
    const digitDayMap: Record<number, number> = {
        1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28
    };

    return (
        <div className="relative w-full bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-[2.2rem] p-6 shadow-2xl overflow-hidden group/campaign no-print">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-[100px] pointer-events-none group-hover/campaign:bg-primary/30 transition-all duration-700" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                {/* Campaign Title Block */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                            <LucideIcons.Sparkles size={12} className="animate-pulse" />
                            Campaña Activa · SRI Ecuador
                        </span>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold tracking-wider">
                            ⏳ {daysRemaining}d restantes
                        </span>
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight font-premium flex items-center gap-2">
                            Semestral S1 · 2026
                            <span className="text-xs font-semibold text-slate-400 font-mono">
                                (Período: Enero – Junio 2026)
                            </span>
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Declaración semestral obligatoria de IVA para personas naturales y contribuyentes RIMPE.
                        </p>
                    </div>
                </div>

                {/* Active Digit Highlight Card */}
                <div className="flex flex-wrap items-center gap-4 bg-white/[0.03] border border-white/10 p-4 rounded-2xl backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex flex-col items-center justify-center font-mono shadow-lg shadow-amber-500/20">
                            <span className="text-[9px] uppercase font-black tracking-widest opacity-80">DÍGITO</span>
                            <span className="text-xl font-black leading-none">{activeDigit}</span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                    <LucideIcons.Clock size={12} />
                                    Dígito {activeDigit} {activeDigit === activeTodayDigit ? 'Vence Hoy' : `Vence día ${digitDayMap[activeDigit]}`}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-[11px] font-mono font-bold">
                                <span className="text-emerald-400">
                                    Semestral S1: <strong className="text-white">{digitSemestralClients.length}</strong> (Pend: {pendingSemestralCount})
                                </span>
                                <span className="text-slate-500">|</span>
                                <span className="text-sky-400">
                                    Mensual Jun: <strong className="text-white">{digitMensualClients.length}</strong> (Pend: {pendingMensualCount})
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Button */}
                    <button
                        onClick={() => {
                            if (selectedDigitFilter === activeDigit) {
                                onSelectDigitFilter(null);
                            } else {
                                onSelectDigitFilter(activeDigit);
                            }
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                            selectedDigitFilter === activeDigit
                                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/25 font-extrabold scale-105'
                                : 'bg-primary hover:bg-gradient-azure text-white shadow-primary/20 hover:scale-105'
                        }`}
                    >
                        <LucideIcons.Filter size={14} />
                        {selectedDigitFilter === activeDigit ? '✅ Viendo Dígito ' + activeDigit : 'Filtrar Matriz Dígito ' + activeDigit}
                    </button>
                </div>
            </div>

            {/* Selector de Dígitos del SRI (1 al 0) */}
            <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-premium flex items-center gap-1.5">
                    <LucideIcons.CalendarDays size={12} className="text-primary" />
                    Calendario SRI por 9º Dígito del RUC:
                </span>

                <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit => {
                        const isToday = digit === activeTodayDigit;
                        const isSelected = selectedDigitFilter === digit;
                        const day = digitDayMap[digit];

                        return (
                            <button
                                key={digit}
                                onClick={() => {
                                    if (selectedDigitFilter === digit) onSelectDigitFilter(null);
                                    else onSelectDigitFilter(digit);
                                }}
                                className={`group/btn relative px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                                    isSelected
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-105'
                                        : isToday
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-white/20'
                                }`}
                                title={`Dígito ${digit} vence el día ${day} del mes`}
                            >
                                <span>Dígito {digit}</span>
                                <span className={`text-[9px] px-1 rounded ${isToday ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'}`}>
                                    {day}º
                                </span>

                                {isToday && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                                )}
                            </button>
                        );
                    })}

                    {selectedDigitFilter !== null && (
                        <button
                            onClick={() => onSelectDigitFilter(null)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-white/10"
                        >
                            Ver Todos
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
