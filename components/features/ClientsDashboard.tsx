import React, { useMemo } from 'react';
import { Client, ServiceFeesConfig, TaxRegime, DeclarationStatus } from '../../types';
import * as LucideIcons from 'lucide-react';
import { getClientDebtSummary, getClientUndeclaredSummary } from '../../services/complianceEngine';
import { getClientServiceFee } from '../../services/clientService';
import { getWhatsAppUrl } from '../../services/sri';

export type QuickFilterKey = 
    | null
    | 'total'
    | 'fact-proyectada'
    | 'al-dia'
    | 'con-deuda'
    | 'claves-ok'
    | 'firmas-vencen'
    | 'regimen-general'
    | 'rimpe-emprendedor'
    | 'rimpe-popular'
    | 'iva-mensual'
    | 'iva-semestral'
    | 'exentos'
    | 'vencidos'
    | 'en-proceso';

interface ClientsDashboardProps {
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onExportCSV?: () => void;
    onSelectQuickFilter?: (filter: QuickFilterKey) => void;
    activeQuickFilter?: QuickFilterKey;
}

export const ClientsDashboard: React.FC<ClientsDashboardProps> = ({ 
    clients, 
    serviceFees, 
    onView, 
    onExportCSV,
    onSelectQuickFilter,
    activeQuickFilter
}) => {
    const today = useMemo(() => new Date(), []);

    const stats = useMemo(() => {
        const activeClients = clients.filter(c => !c.isDeleted && (c.isActive ?? true));
        const deletedClients = clients.filter(c => c.isDeleted);

        let totalDebt = 0;
        let debtors = 0;
        let alDia = 0;
        let vencidos = 0;
        let ordenes = 0;

        const byRegime: Record<string, number> = {
            'Régimen General': 0,
            'Rimpe Emprendedor': 0,
            'Rimpe Negocio Popular': 0,
        };

        let mensual = 0, semestral = 0, noiva = 0;
        let estimatedMonthlyRevenue = 0;

        activeClients.forEach(c => {
            const debtSummary = getClientDebtSummary(c, serviceFees, today);
            const undeclaredSummary = getClientUndeclaredSummary(c, today);

            if (debtSummary.totalDebt > 0) {
                totalDebt += debtSummary.totalDebt;
                debtors++;
            }

            if (undeclaredSummary.overduePeriodsCount > 0) vencidos++;
            else if ((c.declarations || []).some(d => d.is_paid && d.status === DeclarationStatus.Pendiente)) ordenes++;
            else if (!debtSummary.hasPendingPayment && !undeclaredSummary.hasPendingObligation) alDia++;

            const regUpper = (c.regime || '').toUpperCase();
            if (regUpper.includes('EMPRENDEDOR')) {
                byRegime['Rimpe Emprendedor']++;
            } else if (regUpper.includes('POPULAR')) {
                byRegime['Rimpe Negocio Popular']++;
            } else {
                byRegime['Régimen General']++;
            }

            const ivaFreq = c.taxProfile?.ivaFrequency;
            const isEmp = regUpper.includes('EMPRENDEDOR');
            const isPop = regUpper.includes('POPULAR');

            if (ivaFreq === 'Mensual' || (!ivaFreq && !isEmp && !isPop)) mensual++;
            else if (ivaFreq === 'Semestral' || isEmp) semestral++;
            else noiva++;

            if (!c.isCourtesy) {
                estimatedMonthlyRevenue += getClientServiceFee(c, serviceFees);
            }
        });

        return {
            total: activeClients.length,
            alDia, vencidos, ordenes, debtors, deletedCount: deletedClients.length,
            totalDebt, byRegime, mensual, semestral, noiva,
            estimatedMonthlyRevenue
        };
    }, [clients, serviceFees, today]);

    const REGIME_CONFIG = [
        { key: 'Régimen General', filterKey: 'regimen-general' as QuickFilterKey, label: 'Régimen General', color: 'bg-primary', textColor: 'text-primary' },
        { key: 'Rimpe Emprendedor', filterKey: 'rimpe-emprendedor' as QuickFilterKey, label: 'Rimpe Emprendedor', color: 'bg-violet-500', textColor: 'text-violet-400' },
        { key: 'Rimpe Negocio Popular', filterKey: 'rimpe-popular' as QuickFilterKey, label: 'Rimpe Negocio Popular', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
    ];

    const kpis = [
        {
            key: 'total' as QuickFilterKey,
            label: 'Clientes Activos',
            value: stats.total,
            sub: `${stats.deletedCount} en papelera`,
            icon: LucideIcons.Users,
            color: 'text-primary',
            bg: 'bg-primary/10',
            border: 'border-primary/20',
            hint: 'Ver todos los activos'
        },
        {
            key: 'al-dia' as QuickFilterKey,
            label: 'Al Día',
            value: stats.alDia,
            sub: `${stats.total > 0 ? Math.round(stats.alDia / stats.total * 100) : 0}% del total`,
            icon: LucideIcons.ShieldCheck,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            hint: 'Ver clientes al día'
        },
        {
            key: 'con-deuda' as QuickFilterKey,
            label: 'Con Deuda',
            value: stats.debtors,
            sub: `$${stats.totalDebt.toFixed(0)} pendiente`,
            icon: LucideIcons.AlertCircle,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/20',
            hint: 'Ver clientes con deuda'
        },
        {
            key: 'fact-proyectada' as QuickFilterKey,
            label: 'Honorarios/Mes',
            value: `$${stats.estimatedMonthlyRevenue.toFixed(0)}`,
            sub: 'estimado cartera',
            icon: LucideIcons.TrendingUp,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            hint: 'Ver cartera facturable'
        },
    ];

    const activeClients = useMemo(() =>
        clients.filter(c => !c.isDeleted && (c.isActive ?? true)).slice(0, 60),
        [clients]
    );

    return (
        <div className="space-y-8 pb-20">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi) => {
                    const isSelected = activeQuickFilter === kpi.key;
                    return (
                        <div
                            key={kpi.label}
                            onClick={() => onSelectQuickFilter?.(isSelected ? null : kpi.key)}
                            className={`glass-card-premium p-5 rounded-2xl border transition-all cursor-pointer select-none group relative overflow-hidden ${
                                isSelected 
                                    ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-slate-900 shadow-lg scale-[1.02] bg-primary/5' 
                                    : `${kpi.border} hover:scale-[1.02] hover:border-primary/50 hover:shadow-md`
                            }`}
                            title={`Clic para filtrar: ${kpi.hint}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`p-2.5 rounded-xl ${kpi.bg} border ${kpi.border}`}>
                                    <kpi.icon size={16} className={kpi.color} />
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                    isSelected 
                                        ? 'bg-primary text-white shadow-xs' 
                                        : 'text-slate-400 dark:text-slate-500 group-hover:text-primary group-hover:bg-primary/10'
                                }`}>
                                    {isSelected ? '✓ Activo' : 'Ver →'}
                                </span>
                            </div>
                            <p className={`text-2xl font-black font-mono ${kpi.color}`}>{kpi.value}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{kpi.label}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{kpi.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* Breakdown Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Regime */}
                <div className="glass-card-premium p-6 rounded-2xl border border-slate-200/30 dark:border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <LucideIcons.BarChart2 size={12} />
                            Distribución por Régimen
                        </h3>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Clic para filtrar</span>
                    </div>
                    <div className="space-y-3">
                        {REGIME_CONFIG.map(r => {
                            const count = stats.byRegime[r.key] || 0;
                            const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
                            const isSelected = activeQuickFilter === r.filterKey;
                            return (
                                <div 
                                    key={r.key}
                                    onClick={() => onSelectQuickFilter?.(isSelected ? null : r.filterKey)}
                                    className={`p-2.5 -mx-2.5 rounded-xl cursor-pointer transition-all border ${
                                        isSelected 
                                            ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30' 
                                            : 'border-transparent hover:bg-slate-100/70 dark:hover:bg-white/5 hover:border-slate-200/50 dark:hover:border-white/10'
                                    }`}
                                    title={`Clic para ver los ${count} clientes en ${r.label}`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${r.textColor}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary animate-pulse' : r.color}`} />
                                            {r.label}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black font-mono text-slate-700 dark:text-slate-200">
                                                {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 opacity-60 group-hover:opacity-100">
                                                {isSelected ? '✓' : '→'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${r.color} transition-all duration-700`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* IVA Frequency & Status */}
                <div className="glass-card-premium p-6 rounded-2xl border border-slate-200/30 dark:border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <LucideIcons.PieChart size={12} />
                            IVA &amp; Estado General
                        </h3>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Clic para filtrar</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { key: 'iva-mensual' as QuickFilterKey, label: 'IVA Mensual', value: stats.mensual, color: 'text-primary', bg: 'bg-primary/10' },
                            { key: 'iva-semestral' as QuickFilterKey, label: 'IVA Semestral', value: stats.semestral, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                            { key: 'exentos' as QuickFilterKey, label: 'Exentos', value: stats.noiva, color: 'text-slate-400', bg: 'bg-slate-500/10' },
                            { key: 'vencidos' as QuickFilterKey, label: 'Vencidos', value: stats.vencidos, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                            { key: 'en-proceso' as QuickFilterKey, label: 'En Proceso', value: stats.ordenes, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                            { key: 'al-dia' as QuickFilterKey, label: 'Al Día', value: stats.alDia, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        ].map(item => {
                            const isSelected = activeQuickFilter === item.key;
                            return (
                                <div 
                                    key={item.label} 
                                    onClick={() => onSelectQuickFilter?.(isSelected ? null : item.key)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                                        isSelected 
                                            ? 'bg-primary/15 border-primary ring-2 ring-primary/40 shadow-sm scale-[1.02]' 
                                            : `${item.bg} border-transparent hover:scale-[1.03] hover:ring-1 hover:ring-primary/40 active:scale-95`
                                    }`}
                                    title={`Clic para filtrar ${item.value} clientes en ${item.label}`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`text-lg font-black font-mono shrink-0 ${item.color}`}>{item.value}</span>
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight truncate">
                                            {item.label}
                                        </span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 opacity-60 shrink-0">
                                        {isSelected ? '✓' : '→'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Quick Directory */}
            <div className="glass-card-premium rounded-2xl border border-slate-200/30 dark:border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/20 dark:border-white/5">
                    <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <LucideIcons.ListFilter size={12} />
                        Directorio ({activeClients.length}{clients.filter(c => !c.isDeleted && (c.isActive ?? true)).length > 60 ? '+' : ''})
                    </h3>
                    {onExportCSV && (
                        <button
                            onClick={onExportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-primary border border-slate-200/30 dark:border-white/10 hover:border-primary/30 rounded-lg transition-all"
                        >
                            <LucideIcons.Download size={10} />
                            CSV
                        </button>
                    )}
                </div>
                <div className="divide-y divide-slate-200/10 dark:divide-white/5 max-h-[500px] overflow-y-auto">
                    {activeClients.map((client) => {
                        const debtSummary = getClientDebtSummary(client, serviceFees, today);
                        const undeclaredSummary = getClientUndeclaredSummary(client, today);
                        const isOverdue = undeclaredSummary.overduePeriodsCount > 0;
                        const hasDebt = debtSummary.hasPendingPayment;
                        const isOk = !isOverdue && !hasDebt;
                        const statusBarColor = isOverdue ? 'bg-rose-500' : hasDebt ? 'bg-amber-400' : 'bg-emerald-500';

                        return (
                            <div
                                key={client.id}
                                onClick={() => onView(client)}
                                className="flex items-center gap-4 px-6 py-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                            >
                                {/* Status bar */}
                                <div className={`w-1 h-8 rounded-full ${statusBarColor} flex-shrink-0`} />

                                {/* 9th digit badge */}
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/5 text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors flex-shrink-0">
                                    {client.ruc?.[8] || '?'}
                                </div>

                                {/* Name + RUC */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate font-premium">
                                        {client.tradeName || client.name}
                                    </p>
                                    <p className="text-[9px] font-mono text-slate-400 tracking-wider">{client.ruc}</p>
                                </div>

                                {/* Regime badge */}
                                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 flex-shrink-0 hidden sm:block">
                                    {client.regime === TaxRegime.RimpeEmprendedor ? 'EMP' :
                                     client.regime === TaxRegime.RimpeNegocioPopular ? 'NP' : 'GEN'}
                                </span>

                                {/* Debt amount */}
                                {hasDebt && debtSummary.totalDebt > 0 && (
                                    <span className="text-[9px] font-black text-rose-500 font-mono flex-shrink-0">
                                        -${debtSummary.totalDebt.toFixed(0)}
                                    </span>
                                )}

                                {/* Status pill */}
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${
                                    isOk ? 'bg-emerald-500/10 text-emerald-500' :
                                    isOverdue ? 'bg-rose-500/10 text-rose-500' :
                                    'bg-amber-500/10 text-amber-500'
                                }`}>
                                    {isOk ? '✓' : isOverdue ? '⚠' : '$'}
                                </span>

                                {/* Bóveda & WhatsApp Quick Actions */}
                                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => onView(client, 'vault')}
                                        className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all active:scale-95"
                                        title="Abrir Bóveda de Claves y Firma"
                                    >
                                        <LucideIcons.Lock size={13} />
                                    </button>
                                    {client.phones && client.phones.length > 0 && client.phones[0] && (
                                        <button
                                            onClick={() => window.open(getWhatsAppUrl(client.phones![0]), '_blank')}
                                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all active:scale-95"
                                            title="Abrir chat de WhatsApp"
                                        >
                                            <LucideIcons.MessageCircle size={13} />
                                        </button>
                                    )}
                                </div>

                                <LucideIcons.ChevronRight size={12} className="text-slate-300 dark:text-white/20 group-hover:text-primary transition-colors flex-shrink-0" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
