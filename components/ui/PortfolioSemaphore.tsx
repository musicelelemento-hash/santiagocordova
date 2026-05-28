import React from 'react';
import { ComplianceSummary, ComplianceColor, COMPLIANCE_COLORS } from '../../services/complianceEngine';
import * as LucideIcons from 'lucide-react';

interface PortfolioSemaphoreProps {
    summary: ComplianceSummary;
    onFilterChange?: (color: ComplianceColor | 'all') => void;
    activeFilter?: ComplianceColor | 'all';
}

export const PortfolioSemaphore: React.FC<PortfolioSemaphoreProps> = ({ 
    summary, 
    onFilterChange,
    activeFilter = 'all'
}) => {
    const categories: { key: ComplianceColor; label: string; icon: any }[] = [
        { key: 'red', label: 'Vencidos', icon: LucideIcons.ShieldAlert },
        { key: 'orange', label: 'Hoy', icon: LucideIcons.Zap },
        { key: 'yellow', label: 'Próximos', icon: LucideIcons.Clock },
        { key: 'green', label: 'Al Día', icon: LucideIcons.CheckCircle2 },
        { key: 'gray', label: 'Inactivos', icon: LucideIcons.MinusCircle },
    ];

    return (
        <div className="w-full flex flex-col gap-4 animate-fade-in-up">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] font-premium">Estado de Cumplimiento Global</span>
                    <div className="h-[1px] w-12 bg-slate-200 dark:bg-white/10"></div>
                    <span className="text-[10px] font-bold text-primary tech-font italic">{summary.averageScore}% EFICIENCIA</span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {categories.map((cat) => {
                    const count = summary[cat.key];
                    const styles = COMPLIANCE_COLORS[cat.key];
                    const isActive = activeFilter === cat.key;
                    const percentage = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;

                    const activeColors: Record<ComplianceColor, string> = {
                        green: 'border-emerald-500/50 shadow-emerald-500/10 dark:border-emerald-400/40 dark:shadow-emerald-400/5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.04] dark:bg-emerald-400/[0.02]',
                        yellow: 'border-amber-500/50 shadow-amber-500/10 dark:border-amber-400/40 dark:shadow-amber-400/5 text-amber-600 dark:text-amber-400 bg-amber-500/[0.04] dark:bg-amber-400/[0.02]',
                        orange: 'border-orange-500/50 shadow-orange-500/10 dark:border-orange-400/40 dark:shadow-orange-400/5 text-orange-600 dark:text-orange-400 bg-orange-500/[0.04] dark:bg-orange-400/[0.02]',
                        red: 'border-rose-500/50 shadow-rose-500/10 dark:border-rose-400/40 dark:shadow-rose-400/5 text-rose-600 dark:text-rose-400 bg-rose-500/[0.04] dark:bg-rose-400/[0.02]',
                        gray: 'border-slate-400/50 shadow-slate-400/10 dark:border-slate-600/40 dark:shadow-slate-600/5 text-slate-500 dark:text-slate-400 bg-slate-500/[0.04] dark:bg-slate-400/[0.02]',
                    };

                    return (
                        <button
                            key={cat.key}
                            onClick={() => onFilterChange?.(cat.key)}
                            className={`
                                relative group overflow-hidden p-4 rounded-[1.5rem] border transition-all duration-500 text-left hover:scale-[1.01] active:scale-[0.99]
                                ${isActive 
                                    ? `bg-white dark:bg-surface shadow-xl scale-[1.02] z-10 ${activeColors[cat.key]}` 
                                    : `glass-zen border-transparent hover:border-slate-200 dark:hover:border-white/10 text-slate-600 dark:text-slate-300`
                                }
                            `}
                        >
                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <div className={`p-2 rounded-xl transition-all ${styles.bg} ${styles.text}`}>
                                    <cat.icon size={18} strokeWidth={2.5} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                    {percentage}%
                                </span>
                            </div>
                            
                            <div className="relative z-10">
                                <p className={`text-[9px] font-black uppercase tracking-[0.1em] mb-1 ${isActive ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {cat.label}
                                </p>
                                <p className={`text-2xl font-black tracking-tighter leading-none font-premium ${isActive ? 'text-slate-900 dark:text-white' : styles.text}`}>
                                    {count}
                                </p>
                            </div>

                            {/* Mini progress bar on the bottom of the card */}
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100 dark:bg-white/5 overflow-hidden">
                                <div 
                                    className={`h-full ${styles.dot} transition-all duration-1000`}
                                    style={{ width: isActive ? '100%' : `${percentage}%`, opacity: isActive ? 1 : 0.3 }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
