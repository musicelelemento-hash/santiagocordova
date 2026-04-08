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

                    return (
                        <button
                            key={cat.key}
                            onClick={() => onFilterChange?.(cat.key)}
                            className={`
                                relative group overflow-hidden p-4 rounded-[1.5rem] border transition-all duration-300 text-left
                                ${isActive 
                                    ? `bg-white dark:bg-slate-900 border-slate-900 dark:border-white shadow-xl scale-[1.02] z-10` 
                                    : `glass-zen border-transparent hover:border-slate-200 dark:hover:border-white/10`
                                }
                            `}
                        >
                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <div className={`p-2 rounded-xl transition-all ${styles.bg} ${styles.text}`}>
                                    <cat.icon size={18} strokeWidth={2.5} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                    {percentage}%
                                </span>
                            </div>
                            
                            <div className="relative z-10">
                                <p className={`text-[9px] font-black uppercase tracking-[0.1em] mb-1 ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>
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
