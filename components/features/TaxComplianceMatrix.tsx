import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, IvaFrequency, Declaration } from '../../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod } from '../../services/sri';
import { format, subMonths, startOfMonth, endOfMonth, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientCompliance, getObligationsForPeriod } from '../../services/complianceEngine';

interface TaxComplianceMatrixProps {
    clients: Client[];
    onViewClient: (client: Client) => void;
    onUploadReceipt: (client: Client, period: string) => void;
    onPreviewReceipt: (client: Client, declaration: Declaration) => void;
    theme?: 'light' | 'dark';
}

export const TaxComplianceMatrix: React.FC<TaxComplianceMatrixProps> = ({ 
    clients, 
    onViewClient, 
    onUploadReceipt, 
    onPreviewReceipt,
    theme = 'dark'
}) => {
    const [frequency, setFrequency] = useState<IvaFrequency>('Mensual');
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedRuc, setCopiedRuc] = useState<string | null>(null);

    const handleCopyRuc = (ruc: string) => {
        navigator.clipboard.writeText(ruc).then(() => {
            setCopiedRuc(ruc);
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
            setTimeout(() => setCopiedRuc(null), 2000);
        });
    };

    const today = new Date();

    // Generar periodos a mostrar
    const periods = useMemo(() => {
        const result = [];
        if (frequency === 'Mensual') {
            const maxMonth = selectedYear === today.getFullYear() ? today.getMonth() + 1 : 12;
            for (let m = maxMonth; m >= 1; m--) {
                const monthStr = m < 10 ? `0${m}` : `${m}`;
                result.push(`${selectedYear}-${monthStr}`);
            }
        } else if (frequency === 'Semestral') {
            const currentYear = today.getFullYear();
            if (selectedYear < currentYear) {
                result.push(`${selectedYear}-S2`);
                result.push(`${selectedYear}-S1`);
            } else {
                if (today.getMonth() >= 6) {
                    result.push(`${selectedYear}-S2`);
                }
                result.push(`${selectedYear}-S1`);
            }
        }
        return result;
    }, [frequency, selectedYear]);

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            !c.isDeleted && 
            c.isActive && 
            c.taxProfile?.ivaFrequency === frequency &&
            (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.ruc.includes(searchTerm))
        ).sort((a, b) => {
            const digitA = parseInt(a.ruc[8], 10) === 0 ? 10 : parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10) === 0 ? 10 : parseInt(b.ruc[8], 10);
            return digitA - digitB || a.name.localeCompare(b.name);
        });
    }, [clients, frequency, searchTerm]);

    const getStatusIcon = (declaration?: Declaration) => {
        if (!declaration) return <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/5 shadow-inner" title="Sin Registro" />;
        
        const isPaid = declaration.status === DeclarationStatus.Pagada;
        const isSent = declaration.status === DeclarationStatus.Enviada;
        
        if (isPaid) return <LucideIcons.CheckCircle2 size={12} className="text-emerald-500 shadow-sm" strokeWidth={3} />;
        if (isSent) return <LucideIcons.Send size={12} className="text-sky-500 shadow-sm" strokeWidth={3} />;
        return <LucideIcons.Clock size={12} className="text-amber-500 shadow-sm" strokeWidth={3} />;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                        <LucideIcons.LayoutGrid size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-premium">Matriz de Obligaciones</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Control Centralizado de IVA</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/20 p-1.5 rounded-2xl border border-slate-200/50 dark:border-white/5">
                        <button
                            onClick={() => setFrequency('Mensual')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${frequency === 'Mensual' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Mensual
                        </button>
                        <button
                            onClick={() => setFrequency('Semestral')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${frequency === 'Semestral' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Semestral
                        </button>
                    </div>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                        className="bg-slate-100 dark:bg-black/25 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-sm"
                    >
                        {[2026, 2025, 2024].map(y => (
                            <option key={y} value={y} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white">{y}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <div className="relative group flex-1 md:w-64">
                        <LucideIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Filtrar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary outline-none transition-all uppercase tracking-widest"
                        />
                    </div>
                    
                    <button 
                        onClick={() => window.print()}
                        className="p-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:text-primary hover:border-primary transition-all no-print shadow-sm"
                        title="Imprimir Reporte"
                    >
                        <LucideIcons.Printer size={20} />
                    </button>
                </div>
            </div>

            {/* Progress Summary mini-dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                {(() => {
                    const totalClients = filteredClients.length;
                    if (totalClients === 0) return null;
                    
                    const lastPeriod = periods[0];
                    const declaredCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada))).length;
                    const pdfCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && d.proof_file)).length;
                    
                    return (
                        <>
                            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                        <LucideIcons.CheckSquare size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Declarados</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{declaredCount}<span className="text-xs text-slate-400 font-bold ml-1">/ {totalClients}</span></p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-sky-500/10 text-sky-500 rounded-2xl">
                                        <LucideIcons.Paperclip size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Respaldos</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{pdfCount}<span className="text-xs text-slate-400 font-bold ml-1">/ {totalClients}</span></p>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-lg flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Eficiencia Mensual</p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Ciclo {lastPeriod}</p>
                                    </div>
                                    <span className="text-lg font-black text-emerald-500">{Math.round((pdfCount / totalClients) * 100)}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-white/10">
                                    <div 
                                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                        style={{ width: `${(pdfCount / totalClients) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Matrix Table */}
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-2xl overflow-hidden overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[800px] text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/5">
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 w-64 border-r border-slate-200/50 dark:border-white/10">Cliente</th>
                            {periods.map(p => (
                                <th key={p} className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center border-r border-slate-200/50 dark:border-white/5 last:border-r-0">
                                    {formatPeriodForDisplay(p).replace('IVA ', '')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
                        {filteredClients.map((client, index) => {
                            const currentDigit = parseInt(client.ruc[8], 10);
                            const prevDigit = index > 0 ? parseInt(filteredClients[index - 1].ruc[8], 10) : null;
                            const showDivider = currentDigit !== prevDigit;

                            return (
                                <React.Fragment key={client.id}>
                                    {showDivider && (
                                        <tr className="bg-slate-100/50 dark:bg-white/5 border-t border-slate-200/50 dark:border-white/10">
                                            <td colSpan={periods.length + 1} className="px-8 py-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-[0.3em]">
                                                            Dígito {currentDigit} • Vencimiento: Día {currentDigit === 1 ? '10' : currentDigit === 2 ? '12' : currentDigit === 3 ? '14' : currentDigit === 4 ? '16' : currentDigit === 5 ? '18' : currentDigit === 6 ? '20' : currentDigit === 7 ? '22' : currentDigit === 8 ? '24' : currentDigit === 9 ? '26' : '28'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest no-print">
                                                        {filteredClients.filter(c => parseInt(c.ruc[8], 10) === currentDigit).length} Clientes
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group/row">
                                        <td 
                                            className="px-8 py-5 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200/50 dark:border-white/10 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800 transition-colors"
                                            onClick={() => onViewClient(client)}
                                        >
                                            <div className="flex items-center gap-3 cursor-pointer group/name relative">
                                                {/* ZEN 3.1 Compliance Dot */}
                                                <div 
                                                    className={`absolute -left-2 w-1.5 h-6 rounded-full ${
                                                        getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any).overallColor === 'red' ? 'bg-rose-500' :
                                                        getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any).overallColor === 'orange' ? 'bg-orange-500' :
                                                        getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any).overallColor === 'yellow' ? 'bg-amber-400' :
                                                        getClientCompliance(client, today, (frequency === 'Ninguno' ? 'all' : frequency) as any).overallColor === 'green' ? 'bg-emerald-500' :
                                                        'bg-slate-300'
                                                    }`}
                                                />
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-colors ${
                                                    theme === 'dark' ? 'bg-white/5 text-slate-500 group-hover/name:bg-primary group-hover/name:text-white' : 'bg-slate-100 text-slate-400 group-hover/name:bg-primary group-hover/name:text-white'
                                                }`}>
                                                    {client.ruc[8]}
                                                </div>
                                                <div className="flex flex-col">
                                                    {/* Clicking the name copies RUC */}
                                                    <button
                                                        title="Clic para copiar RUC"
                                                        onClick={(e) => { e.stopPropagation(); handleCopyRuc(client.ruc); }}
                                                        className={`text-left text-sm font-black truncate max-w-[200px] transition-colors ${
                                                            copiedRuc === client.ruc
                                                                ? 'text-emerald-500'
                                                                : 'text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary'
                                                        }`}
                                                    >
                                                        {copiedRuc === client.ruc ? '✓ RUC copiado' : (client.tradeName || client.name)}
                                                    </button>
                                                    <span className="text-[9px] font-mono font-bold text-slate-400 tracking-widest mt-1">
                                                        {client.ruc}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const obligations = getObligationsForPeriod(client, p);
                                            const declarations = client.declarations || [];
                                            
                                            // Determine if this cell is generally "Done" (all obligations met)
                                            const allObligationsDone = obligations.length > 0 && obligations.every(ob => {
                                                const d = declarations.find(dh => 
                                                    dh.period === p && 
                                                    (dh.type === ob.type || (!dh.type && (ob.type === 'IVA' || ob.type === 'RENTA')))
                                                );
                                                return d && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file) && d.proof_file;
                                            });

                                            return (
                                                <td key={p} className={`px-2 py-4 border-r border-slate-200/50 dark:border-white/5 last:border-r-0 transition-colors ${allObligationsDone ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
                                                    <div className="flex flex-wrap justify-center gap-2 min-w-[70px]">
                                                        {obligations.map(ob => {
                                                            const d = declarations.find(dh => 
                                                                dh.period === p && 
                                                                (dh.type === ob.type || (!dh.type && (ob.type === 'IVA' || ob.type === 'RENTA')))
                                                            );
                                                            const hasProof = !!d?.proof_file;
                                                            const isPaid = d?.status === DeclarationStatus.Pagada || !!d?.is_paid;
                                                            const isSent = d?.status === DeclarationStatus.Enviada || isPaid || hasProof;
                                                            
                                                            const isDone = hasProof;
                                                            const isOverdue = isPast(getDueDateForPeriod(client, p) || new Date()) && !isDone;

                                                            return (
                                                                <div 
                                                                    key={`${p}-${ob.type}`}
                                                                    className={`group/ob relative flex flex-col items-center justify-center w-12 h-14 rounded-xl cursor-pointer transition-all duration-300 border ${
                                                                        isDone ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/30 hover:bg-emerald-600 hover:scale-110 z-10' : 
                                                                        isSent && !hasProof ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 border-amber-300 hover:bg-amber-200' :
                                                                        isOverdue ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-200 hover:bg-rose-100' :
                                                                        'bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 hover:text-slate-600'
                                                                    }`}
                                                                    title={isDone ? `Ver PDF de ${ob.label}` : `Subir PDF para ${ob.label}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (hasProof) onPreviewReceipt(client, d!);
                                                                        else onUploadReceipt(client, p);
                                                                    }}
                                                                >
                                                                    <span className={`text-[8px] font-black tracking-wider uppercase mb-1 ${isDone ? 'opacity-90' : 'opacity-60'}`}>{ob.type}</span>
                                                                    
                                                                    {isDone ? (
                                                                        <LucideIcons.FileCheck size={16} strokeWidth={2.5} className={isPaid ? 'text-white drop-shadow-md' : 'text-emerald-100'} />
                                                                    ) : isSent ? (
                                                                        <LucideIcons.AlertCircle size={16} strokeWidth={2.5} />
                                                                    ) : isOverdue ? (
                                                                        <LucideIcons.XCircle size={16} strokeWidth={2.5} />
                                                                    ) : (
                                                                        <LucideIcons.UploadCloud size={16} strokeWidth={2} className="opacity-50 group-hover/ob:opacity-100" />
                                                                    )}

                                                                    {isDone && isPaid && (
                                                                        <div className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white rounded-full p-0.5 shadow-sm" title="Honorarios Pagados">
                                                                            <LucideIcons.DollarSign size={8} strokeWidth={4} />
                                                                        </div>
                                                                    )}
                                                                    {!hasProof && isOverdue && (
                                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {obligations.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-200/50 dark:bg-white/10 my-6" />}
                                                    </div>
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
                        <LucideIcons.Inbox size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay clientes para este criterio</p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 px-4 no-print pb-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                        <LucideIcons.FileCheck size={14} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest font-premium">Completado</span>
                        <span className="text-[8px] font-bold text-slate-400">PDF + Declarado</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 border border-amber-300 flex items-center justify-center">
                        <LucideIcons.AlertCircle size={14} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest font-premium">Sin Respaldo</span>
                        <span className="text-[8px] font-bold text-slate-400">Declarado, falta PDF</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 border border-rose-200 flex items-center justify-center relative">
                        <LucideIcons.XCircle size={14} strokeWidth={3} />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest font-premium">Vencido</span>
                        <span className="text-[8px] font-bold text-slate-400">Acción requerida urgente</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                            <LucideIcons.FileCheck size={14} strokeWidth={3} />
                        </div>
                        <div className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white rounded-full p-0.5 shadow-sm">
                            <LucideIcons.DollarSign size={10} strokeWidth={4} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest font-premium">Honorario Pagado</span>
                        <span className="text-[8px] font-bold text-slate-400">Cobro registrado con éxito</span>
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
