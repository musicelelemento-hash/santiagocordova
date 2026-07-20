import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, IvaFrequency, Declaration, TaxRegime, TaxObligationType } from '../../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod } from '../../services/sri';
import { format, subMonths, startOfMonth, endOfMonth, isPast, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientCompliance, getObligationsForPeriod } from '../../services/complianceEngine';
import { useToast } from '../../context/ToastContext';

type MatrixMode = 'IVA' | 'RENTA';

interface TaxComplianceMatrixProps {
    clients: Client[];
    onViewClient: (client: Client) => void;
    onUploadReceipt: (client: Client, period: string, type: TaxObligationType) => void;
    onPreviewReceipt: (client: Client, declaration: Declaration) => void;
    onTogglePayment?: (client: Client, period: string, type: 'IVA' | 'RENTA', isPaid: boolean) => void;
    onTogglePriority?: (client: Client, period: string, type: TaxObligationType, isPriority: boolean) => void;
    theme?: 'light' | 'dark';
    initialMode?: MatrixMode;
}

export const TaxComplianceMatrix: React.FC<TaxComplianceMatrixProps> = ({ 
    clients, 
    onViewClient, 
    onUploadReceipt, 
    onPreviewReceipt,
    onTogglePayment,
    onTogglePriority,
    theme = 'dark',
    initialMode = 'IVA'
}) => {
    const { toast } = useToast();
    const [frequency, setFrequency] = useState<IvaFrequency>('Mensual');
    const [matrixMode, setMatrixMode] = useState<MatrixMode>(initialMode);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [copiedRuc, setCopiedRuc] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
    
    // Period Sorting State
    const [sortPeriod, setSortPeriod] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'missing_first' | 'completed_first' | null>(null);

    // Sync mode when navigating between matrix/renta tabs
    React.useEffect(() => {
        setMatrixMode(initialMode);
    }, [initialMode]);

    const handleCopyRuc = (ruc: string, clientName: string) => {
        navigator.clipboard.writeText(ruc).then(() => {
            setCopiedRuc(ruc);
            toast.success(`RUC de ${clientName} copiado al portapapeles`);
            setTimeout(() => setCopiedRuc(null), 2000);
        }).catch(() => {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = ruc;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedRuc(ruc);
            toast.success(`RUC de ${clientName} copiado`);
            setTimeout(() => setCopiedRuc(null), 2000);
        });
    };

    const handleCopyKey = (password: string, clientId: string, clientName: string) => {
        navigator.clipboard.writeText(password).then(() => {
            setCopiedKey(clientId);
            toast.success(`Clave SRI de ${clientName} copiada`);
            setTimeout(() => setCopiedKey(null), 2000);
        }).catch(() => {
            setCopiedKey(clientId);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    const today = new Date();

    // Generar periodos a mostrar
    const periods = useMemo(() => {
        const result: string[] = [];
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-12

        if (matrixMode === 'RENTA') {
            // Renta: mostrar 3 años fiscales (año anterior, anteanterior, uno más atrás)
            for (let i = 1; i <= 3; i++) {
                result.push((currentYear - i).toString());
            }
            return result;
        }

        if (frequency === 'Mensual') {
            // El mensual solo habilita hasta el mes anterior
            let maxMonth: number;
            if (selectedYear === currentYear) {
                maxMonth = currentMonth - 1;
                if (maxMonth < 1) maxMonth = 0; // Enero: sin meses del año actual
            } else {
                maxMonth = 12;
            }
            for (let m = maxMonth; m >= 1; m--) {
                const monthStr = m < 10 ? `0${m}` : `${m}`;
                result.push(`${selectedYear}-${monthStr}`);
            }
        } else if (frequency === 'Semestral') {
            // Mostrar 3 semestres hacia atrás desde el actual
            const currentSemester = currentMonth <= 6 ? 1 : 2;

            const semList: string[] = [];
            let yr = currentYear;
            let sem = currentSemester;

            const totalNeeded = 3;
            while (semList.length < totalNeeded) {
                sem -= 1;
                if (sem < 1) { sem = 2; yr -= 1; }
                semList.push(`${yr}-S${sem}`);
            }

            const s1Enabled = currentSemester === 1 && currentMonth >= 6;
            const s2Enabled = currentSemester === 2 && currentMonth >= 12;
            if (s1Enabled || s2Enabled) {
                result.push(`${currentYear}-S${currentSemester}`);
            }
            result.push(...semList);
        }
        return result;
    }, [frequency, matrixMode, selectedYear, today]);

    const findDeclarationForOb = (clientDeclarations: Declaration[], period: string, obType: string) => {
        return clientDeclarations.find(dh => {
            let targetPeriod = period;
            if (obType === 'ICE') {
                targetPeriod = `${period}:ICE`;
            } else if (obType === 'ANEXO') {
                if (matrixMode === 'RENTA') {
                    targetPeriod = `${period}:GAP`;
                } else {
                    targetPeriod = `${period}:ANEXO_ICE`;
                }
            } else if (obType === 'PVP') {
                targetPeriod = `${period}:PVP`;
            } else if (obType === 'DEVOLUCION') {
                targetPeriod = `${period}:DEV`;
            }
            const matchPeriod = dh.period === targetPeriod || dh.period === targetPeriod.replace(':', '-');
            const matchType = dh.type === obType || (!dh.type && (obType === 'IVA' || obType === 'RENTA'));
            return matchPeriod && matchType;
        });
    };

    // Check if client has uploaded all proofs for the displayed matrix periods
    const isClientCompletedForPeriod = (client: Client, p: string) => {
        const obligations = getObligationsForPeriod(client, p);
        if (obligations.length === 0) return true;
        const declarations = client.declarations || [];
        return obligations.every(ob => {
            const d = findDeclarationForOb(declarations, p, ob.type);
            return d && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file) && d.proof_file;
        });
    };

    const isClientUpToDate = (client: Client) => {
        return periods.every(p => isClientCompletedForPeriod(client, p));
    };

    const handleSortByPeriod = (p: string) => {
        if (sortPeriod === p) {
            if (sortDirection === 'missing_first') {
                setSortDirection('completed_first');
            } else if (sortDirection === 'completed_first') {
                setSortPeriod(null);
                setSortDirection(null);
            }
        } else {
            setSortPeriod(p);
            setSortDirection('missing_first');
        }
    };

    const filteredClients = useMemo(() => {
        const hasPriorityDeclaration = (c: Client) => {
            return (c.declarations || []).some(d => d.isPriority && d.status === DeclarationStatus.Pendiente);
        };

        return clients.filter(c => {
            const clientFreq = c.taxProfile?.ivaFrequency ||
                (c.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' :
                 c.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual');

            const isActive = !c.isDeleted && c.isActive;

            if (matrixMode === 'RENTA') {
                const hasRenta = c.taxProfile?.requiresAnnualRenta ||
                    c.regime === TaxRegime.RimpeEmprendedor ||
                    c.regime === TaxRegime.RimpeNegocioPopular ||
                    c.regime === TaxRegime.General;
                return isActive && hasRenta;
            }

            return isActive && clientFreq === frequency;
        }).sort((a, b) => {
            const priorityA = hasPriorityDeclaration(a);
            const priorityB = hasPriorityDeclaration(b);
            if (priorityA !== priorityB) {
                return priorityA ? -1 : 1;
            }

            // Custom Period Sorting
            if (sortPeriod && sortDirection) {
                const isCompletedA = isClientCompletedForPeriod(a, sortPeriod);
                const isCompletedB = isClientCompletedForPeriod(b, sortPeriod);
                
                if (isCompletedA !== isCompletedB) {
                    if (sortDirection === 'missing_first') {
                        return isCompletedA ? 1 : -1;
                    } else {
                        return isCompletedA ? -1 : 1;
                    }
                }
            }

            if (isWorkspaceMode) {
                const upToDateA = isClientUpToDate(a);
                const upToDateB = isClientUpToDate(b);
                if (upToDateA !== upToDateB) {
                    return upToDateA ? 1 : -1;
                }
            }
            const digitA = parseInt(a.ruc[8], 10) === 0 ? 10 : parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10) === 0 ? 10 : parseInt(b.ruc[8], 10);
            return digitA - digitB || a.name.localeCompare(b.name);
        });
    }, [clients, frequency, matrixMode, isWorkspaceMode, periods, sortPeriod, sortDirection]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white/95 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-4">
                    <div className={`p-3 text-white rounded-2xl shadow-lg ${
                        matrixMode === 'RENTA' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary shadow-primary/20'
                    }`}>
                        {matrixMode === 'RENTA' ? <LucideIcons.Award size={20} /> : <LucideIcons.LayoutGrid size={20} />}
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight font-premium">
                            {matrixMode === 'RENTA' ? 'Matriz de Renta Anual' : 'Matriz de Obligaciones'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                            {matrixMode === 'RENTA' ? 'Impuesto a la Renta · Historial Fiscal' : 'Control de Respaldos de IVA'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Integrated Segmented Control for Mode/Frequency */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-950/40 p-1 rounded-2xl border border-slate-200/30 dark:border-white/5">
                        {[
                            { id: 'iva-mensual', label: 'IVA Mensual', mode: 'IVA' as MatrixMode, freq: 'Mensual' as IvaFrequency, icon: LucideIcons.Calendar },
                            { id: 'iva-semestral', label: 'IVA Semestral', mode: 'IVA' as MatrixMode, freq: 'Semestral' as IvaFrequency, icon: LucideIcons.CalendarRange },
                            { id: 'renta-anual', label: 'Renta Anual', mode: 'RENTA' as MatrixMode, freq: 'Ninguno' as IvaFrequency, icon: LucideIcons.Award }
                        ].map(tab => {
                            const isActive = matrixMode === tab.mode && (tab.mode === 'RENTA' || frequency === tab.freq);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setMatrixMode(tab.mode);
                                        if (tab.mode === 'IVA') {
                                            setFrequency(tab.freq);
                                        }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                                        isActive 
                                            ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                                            : 'text-slate-405 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                                    }`}
                                >
                                    <tab.icon size={12} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Year Selector */}
                    {matrixMode === 'IVA' && frequency === 'Mensual' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                            className="bg-slate-100/80 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-200/30 dark:border-white/5 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-white/15 transition-all shadow-sm"
                        >
                            {[today.getFullYear(), today.getFullYear() - 1].map(y => (
                                <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">{y}</option>
                            ))}
                        </select>
                    )}

                    {/* Workspace desk switcher */}
                    <button
                        onClick={() => setIsWorkspaceMode(!isWorkspaceMode)}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border shadow-sm ${
                            isWorkspaceMode 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-500/50 shadow-emerald-500/10' 
                                : 'bg-slate-100/80 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 border-slate-200/30 dark:border-white/5 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                        title="Priorizar clientes con obligaciones pendientes"
                    >
                        <LucideIcons.Briefcase size={12} />
                        <span>{isWorkspaceMode ? 'Pendientes Primero' : 'Orden Dígito'}</span>
                    </button>

                    <button 
                        onClick={() => window.print()}
                        className="p-2.5 bg-slate-100/80 dark:bg-slate-950/40 text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-white rounded-xl border border-slate-200/30 dark:border-white/5 transition-all no-print shadow-sm"
                        title="Imprimir Reporte"
                    >
                        <LucideIcons.Printer size={16} />
                    </button>
                </div>
            </div>

            {/* Progress Summary mini-dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                {(() => {
                    const totalClients = filteredClients.length;
                    if (totalClients === 0) return null;
                    
                    const lastPeriod = periods[0];
                    const clientsWithObligations = filteredClients.filter(c => getObligationsForPeriod(c, lastPeriod).length > 0);
                    const totalClientsCount = clientsWithObligations.length;
                    const denominator = totalClientsCount > 0 ? totalClientsCount : totalClients;
                    
                    const declaredCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada))).length;
                    const pdfCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && d.proof_file)).length;
                    
                    const efficiencyPercent = Math.round((pdfCount / Math.max(1, denominator)) * 100);

                    return (
                        <>
                            <div className="glass-card-premium p-4 flex items-center gap-4 hover:translate-y-[-2px] transition-all">
                                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                    <LucideIcons.CheckSquare size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-405 dark:text-slate-400 uppercase tracking-widest mb-0.5">Declarados</p>
                                    <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none font-premium">
                                        {declaredCount}
                                        <span className="text-xs text-slate-400 font-bold ml-1">/ {denominator}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="glass-card-premium p-4 flex items-center gap-4 hover:translate-y-[-2px] transition-all">
                                <div className="p-3 bg-sky-500/10 text-sky-500 rounded-2xl">
                                    <LucideIcons.Paperclip size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-405 dark:text-slate-400 uppercase tracking-widest mb-0.5">Respaldos</p>
                                    <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none font-premium">
                                        {pdfCount}
                                        <span className="text-xs text-slate-400 font-bold ml-1">/ {denominator}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="md:col-span-2 glass-card-premium p-4 flex flex-col justify-center tactical-glow-primary hover:translate-y-[-2px] transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-405 dark:text-slate-400 uppercase tracking-widest">
                                            {matrixMode === 'RENTA' ? 'Eficiencia Renta' : 'Eficiencia Mensual'}
                                        </p>
                                        <p className="text-[8px] font-bold text-slate-400/80 uppercase tracking-wider mt-0.5">Ciclo {formatPeriodForDisplay(lastPeriod)}</p>
                                    </div>
                                    <span className="text-base font-extrabold text-emerald-500 font-premium">{efficiencyPercent}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200/30 dark:border-white/10">
                                    <div 
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000"
                                        style={{ width: `${efficiencyPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Matrix Table */}
            <div className="glass-card-premium rounded-[2rem] shadow-tactical overflow-hidden overflow-x-auto custom-scrollbar border border-slate-200/50 dark:border-white/10">
                <table className="w-full min-w-[800px] text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-200/30 dark:border-white/5">
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-64 border-r border-slate-200/30 dark:border-white/10">Cliente</th>
                            {periods.map(p => (
                                <th 
                                    key={p} 
                                    className="px-4 py-4 text-[9px] font-black text-slate-405 dark:text-slate-450 uppercase tracking-[0.15em] text-center border-r border-slate-200/30 dark:border-white/5 last:border-r-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none group/th"
                                    onClick={() => handleSortByPeriod(p)}
                                    title="Clic para agrupar (Faltantes / Listos)"
                                >
                                    <div className="flex items-center justify-center gap-1.5 relative">
                                        {formatPeriodForDisplay(p).replace('IVA ', '')}
                                        <div className={`transition-all duration-200 ${sortPeriod === p ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-30'}`}>
                                            <LucideIcons.ArrowDownUp 
                                                size={12} 
                                                className={sortPeriod === p ? (sortDirection === 'missing_first' ? 'text-rose-500' : 'text-emerald-500') : 'text-slate-400'} 
                                            />
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/20 dark:divide-white/5">
                        {filteredClients.map((client, index) => {
                            const currentDigit = parseInt(client.ruc[8], 10);
                            const prevDigit = index > 0 ? parseInt(filteredClients[index - 1].ruc[8], 10) : null;
                            const showDivider = !isWorkspaceMode && (currentDigit !== prevDigit);

                            return (
                                <React.Fragment key={client.id}>
                                    {showDivider && (
                                        <tr className="bg-slate-100/30 dark:bg-[#020617]/50 border-t border-b border-slate-200/30 dark:border-white/10">
                                            <td colSpan={periods.length + 1} className="px-6 py-2.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(43,106,255,0.6)]"></div>
                                                        <span className="text-[9px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-[0.15em] font-premium">
                                                            Dígito RUC <span className="font-mono text-primary font-black">{currentDigit}</span>
                                                        </span>
                                                        <span className="text-slate-300 dark:text-white/10 mx-1">|</span>
                                                        <span className="text-[9px] text-slate-405 dark:text-slate-400 font-mono tracking-wider">
                                                            Vence: Día {currentDigit === 1 ? '10' : currentDigit === 2 ? '12' : currentDigit === 3 ? '14' : currentDigit === 4 ? '16' : currentDigit === 5 ? '18' : currentDigit === 6 ? '20' : currentDigit === 7 ? '22' : currentDigit === 8 ? '24' : currentDigit === 9 ? '26' : '28'} de cada mes
                                                        </span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-slate-400/80 uppercase tracking-widest no-print">
                                                        {filteredClients.filter(c => parseInt(c.ruc[8], 10) === currentDigit).length} Clientes
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="hover:bg-slate-55/30 dark:hover:bg-slate-950/20 transition-colors group/row">
                                        <td 
                                            className="px-6 py-4 sticky left-0 bg-white/95 dark:bg-[#020617]/95 backdrop-blur-md z-10 border-r border-slate-200/30 dark:border-white/10 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-950/80 transition-colors shadow-[4px_0_12px_-4px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.4)]"
                                            onClick={() => onViewClient(client)}
                                        >
                                            <div className="flex items-center gap-3 cursor-pointer group/name relative">
                                                {/* ZEN 3.1 Compliance Dot */}
                                                {(() => {
                                                    const compliance = getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any);
                                                    const dotColor = 
                                                        compliance.overallColor === 'red' ? 'bg-rose-500 shadow-rose-555/50' :
                                                        compliance.overallColor === 'orange' ? 'bg-orange-505 shadow-orange-555/50' :
                                                        compliance.overallColor === 'yellow' ? 'bg-amber-400 shadow-amber-455/50' :
                                                        compliance.overallColor === 'green' ? 'bg-emerald-505 shadow-emerald-555/50' :
                                                        'bg-slate-400';
                                                    return (
                                                        <div 
                                                            className={`absolute -left-2 w-1.5 h-6 rounded-full transition-all duration-300 ${dotColor}`}
                                                            title={`Cumplimiento: ${compliance.score}%`}
                                                        />
                                                    );
                                                })()}
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold tracking-wider transition-colors bg-slate-100 dark:bg-white/5 text-slate-500 group-hover/name:bg-primary group-hover/name:text-white">
                                                    {client.ruc[8]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black truncate max-w-[160px] text-slate-900 dark:text-white group-hover/name:text-primary transition-colors font-premium">
                                                            {client.tradeName || client.name}
                                                        </span>
                                                        {isWorkspaceMode && (
                                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                                                isClientUpToDate(client) 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                                                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                                                            }`}>
                                                                {isClientUpToDate(client) ? 'Al Día' : 'Pendiente'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mt-1 no-print">
                                                        <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
                                                            {client.ruc}
                                                        </span>
                                                        
                                                        {/* Copiar RUC */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCopyRuc(client.ruc, client.name); }}
                                                            className={`p-1 rounded transition-all border ${
                                                                copiedRuc === client.ruc
                                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
                                                                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-primary hover:border-primary/30'
                                                            }`}
                                                            title={copiedRuc === client.ruc ? "RUC Copiado" : "Copiar RUC"}
                                                        >
                                                            {copiedRuc === client.ruc ? <LucideIcons.Check size={8} className="text-emerald-500" strokeWidth={3} /> : <LucideIcons.Copy size={8} />}
                                                        </button>

                                                        {/* Copiar Clave SRI */}
                                                        {client.sriPassword && (
                                                            <button
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleCopyKey(client.sriPassword!, client.id, client.name);
                                                                }}
                                                                className={`p-1 rounded transition-all border ${
                                                                    copiedKey === client.id
                                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
                                                                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-emerald-500 hover:border-emerald-500/30'
                                                                }`}
                                                                title={copiedKey === client.id ? "Clave Copiada" : `Copiar Clave SRI`}
                                                            >
                                                                {copiedKey === client.id ? <LucideIcons.Check size={8} className="text-emerald-500" strokeWidth={3} /> : <LucideIcons.Key size={8} />}
                                                            </button>
                                                        )}

                                                        {/* Enlace SRI */}
                                                        <a
                                                            href="https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1 rounded border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center"
                                                            title="Ir a SRI en Línea"
                                                        >
                                                            <LucideIcons.ExternalLink size={8} />
                                                        </a>
                                                    </div>

                                                    <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider mt-1 print-only hidden">
                                                        {client.ruc}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const obligations = getObligationsForPeriod(client, p);
                                            const declarations = client.declarations || [];
                                            
                                            const allObligationsDone = obligations.length > 0 && obligations.every(ob => {
                                                const d = findDeclarationForOb(declarations, p, ob.type);
                                                return d && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file);
                                            });

                                            return (
                                                <td key={p} className={`px-2 py-3 border-r border-slate-200/20 dark:border-white/5 last:border-r-0 transition-colors ${allObligationsDone ? 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.03]' : ''}`}>
                                                    <div className="flex flex-wrap justify-center gap-2 min-w-[70px]">
                                                        {obligations.map(ob => {
                                                            const d = findDeclarationForOb(declarations, p, ob.type);
                                                            const hasProof = !!d?.proof_file;
                                                            const isPaid = d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                            const isSent = d?.status === DeclarationStatus.Enviada || isPaid || hasProof;
                                                            
                                                            const isDone = hasProof;
                                                            const isManualDone = !hasProof && (d?.status === DeclarationStatus.Enviada || d?.status === DeclarationStatus.Pagada);
                                                            const isOverdue = isPast(getDueDateForPeriod(client, p) || new Date()) && !isDone && !isManualDone;

                                                            return (
                                                                <div 
                                                                    key={`${p}-${ob.type}`}
                                                                    className={`group/ob relative flex flex-col items-center justify-center w-14 h-14 rounded-xl cursor-pointer transition-all duration-300 border ${
                                                                        isDone ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-600/50 shadow-md shadow-emerald-500/10 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 z-10' : 
                                                                        isManualDone ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white border-amber-500/50 shadow-md shadow-amber-500/10 hover:scale-105 hover:shadow-lg z-10 animate-pulse' :
                                                                        d?.isPriority ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white border-orange-600/50 shadow-md shadow-orange-500/10 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25 z-10 animate-pulse' :
                                                                        isOverdue ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 border-rose-250 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/30 hover:scale-105' :
                                                                        'bg-slate-50 dark:bg-slate-900/40 text-slate-405 dark:text-slate-400 border-slate-200/50 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-200 hover:scale-105'
                                                                    }`}
                                                                    title={isDone ? `Ver PDF de ${ob.label}` : isManualDone ? `Atención: Sin PDF de ${ob.label}. Haz click para subirlo.` : d?.isPriority ? `Prioridad Alta: Subir PDF para ${ob.label}` : `Subir PDF para ${ob.label}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (hasProof) onPreviewReceipt(client, d!);
                                                                        else onUploadReceipt(client, p, ob.type as any);
                                                                    }}
                                                                >
                                                                    <span className={`text-[7px] font-black tracking-widest uppercase mb-1.5 ${isDone || isManualDone || d?.isPriority ? 'opacity-90' : 'opacity-55'}`}>{ob.type}</span>
                                                                    
                                                                    {isDone ? (
                                                                        <LucideIcons.ShieldCheck size={14} strokeWidth={3} className="text-white drop-shadow-sm" />
                                                                    ) : isManualDone ? (
                                                                        <LucideIcons.AlertTriangle size={14} strokeWidth={3} className="text-white drop-shadow-sm" />
                                                                    ) : d?.isPriority ? (
                                                                        <LucideIcons.Pin size={12} strokeWidth={2.5} className="text-white rotate-45" />
                                                                    ) : isOverdue ? (
                                                                        <LucideIcons.AlertCircle size={14} strokeWidth={2.5} />
                                                                    ) : (
                                                                        <LucideIcons.Upload size={12} strokeWidth={2} className="opacity-40 group-hover/ob:opacity-100 group-hover/ob:scale-110 transition-all" />
                                                                    )}

                                                                    {isDone ? (
                                                                        <>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const msg = encodeURIComponent(`Buen día, le adjunto el comprobante de la declaración.`);
                                                                                const phoneStr = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                                                                if (phoneStr) {
                                                                                    const whatsappPhone = phoneStr.startsWith('0') ? '593' + phoneStr.substring(1) : (phoneStr.startsWith('593') ? phoneStr : '593' + phoneStr);
                                                                                    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, '_blank');
                                                                                } else {
                                                                                    alert('El cliente no tiene un número de teléfono registrado.');
                                                                                }
                                                                            }}
                                                                            className={`absolute -bottom-1.5 -right-1.5 rounded-full p-1 shadow-sm transition-all z-20 bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 opacity-0 group-hover/ob:opacity-100 scale-90 hover:scale-110`}
                                                                            title="Notificar por WhatsApp"
                                                                        >
                                                                            <LucideIcons.MessageCircle size={10} strokeWidth={2.5} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (onTogglePayment) onTogglePayment(client, p, ob.type as any, !isPaid);
                                                                            }}
                                                                            className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm transition-all z-20 ${
                                                                                isPaid 
                                                                                    ? 'bg-sky-500 text-white shadow-sky-500/20 scale-100' 
                                                                                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300/30 dark:border-slate-700/30 opacity-0 group-hover/ob:opacity-100 scale-90 hover:scale-110'
                                                                            }`}
                                                                            title={isPaid ? "Marcar Honorario como Pendiente" : "Marcar Honorario como Pagado"}
                                                                        >
                                                                            <LucideIcons.DollarSign size={8} strokeWidth={4} />
                                                                        </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (onTogglePriority) onTogglePriority(client, p, ob.type as any, !d?.isPriority);
                                                                            }}
                                                                            className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm transition-all z-20 ${
                                                                                d?.isPriority 
                                                                                    ? 'bg-amber-500 text-white shadow-amber-500/20 scale-100' 
                                                                                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300/30 dark:border-slate-700/30 opacity-0 group-hover/ob:opacity-100 scale-90 hover:scale-110'
                                                                            }`}
                                                                            title={d?.isPriority ? "Quitar Prioridad" : "Marcar como Prioridad"}
                                                                        >
                                                                            <LucideIcons.Pin size={8} strokeWidth={4} className={d?.isPriority ? 'rotate-45' : ''} />
                                                                        </button>
                                                                    )}
                                                                    {!hasProof && isOverdue && (
                                                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse border border-white dark:border-slate-900" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {obligations.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-200/30 dark:bg-white/5 my-6 mx-auto" />}
                                                    </div>
                                                    {obligations.length > 1 && (
                                                        <div className="mt-2 flex justify-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const allPaid = obligations.every(ob => {
                                                                        const d = findDeclarationForOb(declarations, p, ob.type);
                                                                        return d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                                    });
                                                                    
                                                                    obligations.forEach(ob => {
                                                                        if (onTogglePayment) {
                                                                            onTogglePayment(client, p, ob.type as any, !allPaid);
                                                                        }
                                                                    });
                                                                }}
                                                                className={`flex items-center justify-center gap-1 px-2.5 py-0.75 rounded-lg text-[8px] font-bold uppercase tracking-wider border transition-all duration-300 ${
                                                                    obligations.every(ob => {
                                                                        const d = findDeclarationForOb(declarations, p, ob.type);
                                                                        return d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                                    })
                                                                        ? 'bg-sky-500 hover:bg-sky-600 border-sky-600 text-white shadow-sm active:scale-95'
                                                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-white/5 hover:border-slate-350 dark:hover:border-white/15 active:scale-95'
                                                                }`}
                                                                title={
                                                                    obligations.every(ob => {
                                                                        const d = findDeclarationForOb(declarations, p, ob.type);
                                                                        return d?.status === DeclarationStatus.Pagada || !!d?.is_paid || client.isCourtesy;
                                                                    }) ? "Marcar todo como Pendiente" : "Marcar todo como Pagado"
                                                                }
                                                            >
                                                                <LucideIcons.Coins size={9} strokeWidth={2.5} />
                                                                <span>COBRO COMPLETO</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                {filteredClients.length === 0 && (
                    <div className="py-20 text-center">
                        <LucideIcons.Inbox size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="text-xs font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">No hay clientes para este criterio</p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-slate-200/30 dark:border-white/5 no-print">
                <span className="text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest font-premium">Leyenda de Estados</span>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px]">
                            <LucideIcons.Check size={10} strokeWidth={3} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Completado (PDF + Declaración)</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/40 flex items-center justify-center text-[9px]">
                            <LucideIcons.Upload size={10} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Sin Respaldo (Falta PDF)</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-rose-50 dark:bg-rose-950/20 text-rose-500 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center relative text-[9px]">
                            <LucideIcons.AlertCircle size={10} strokeWidth={2.5} />
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Vencido (Urgente)</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px]">
                            <LucideIcons.Check size={10} strokeWidth={3} />
                            <div className="absolute -top-1 -right-1 bg-sky-500 text-white rounded-full p-0.25 shadow-sm">
                                <LucideIcons.DollarSign size={6} strokeWidth={4} />
                            </div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider">Honorario Pagado</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: landscape; 
                        margin: 1cm; 
                    }
                    body { 
                        background: white !important; 
                        color: black !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .custom-scrollbar::-webkit-scrollbar { display: none; }
                    table { 
                        border-collapse: collapse !important;
                        width: 100% !important;
                        font-size: 8px !important;
                    }
                    th, td { 
                        border: 1px solid #e2e8f0 !important; 
                        padding: 8px !important;
                        background: transparent !important;
                        color: black !important;
                    }
                    .sticky { position: static !important; }
                    .bg-white\\/40, .dark\\:bg-slate-900\\/40 { 
                        background: transparent !important; 
                        border: none !important;
                        box-shadow: none !important;
                    }
                    h2 { color: black !important; }
                }
            `}} />
        </div>
    );
};
