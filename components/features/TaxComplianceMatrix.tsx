import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, IvaFrequency, Declaration } from '../../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod } from '../../services/sri';
import { format, subMonths, startOfMonth, endOfMonth, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

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
    const [searchTerm, setSearchTerm] = useState('');

    const today = new Date();

    // Generar periodos a mostrar
    const periods = useMemo(() => {
        const result = [];
        if (frequency === 'Mensual') {
            for (let i = 0; i < 6; i++) {
                const date = subMonths(today, i + 1);
                result.push(format(date, 'yyyy-MM'));
            }
        } else if (frequency === 'Semestral') {
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            
            if (currentMonth >= 6) { // Estamos en el periodo de declarar S1
                result.push(`${currentYear}-S1`);
                result.push(`${currentYear - 1}-S2`);
            } else { // Estamos en el periodo de declarar S2 del año pasado
                result.push(`${currentYear - 1}-S2`);
                result.push(`${currentYear - 1}-S1`);
            }
        }
        return result;
    }, [frequency]);

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
        if (!declaration) return <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/10" title="Sin Registro" />;
        
        switch (declaration.status) {
            case DeclarationStatus.Pagada:
                return <span title="Pagada"><LucideIcons.CheckCircle2 size={16} className="text-emerald-500" /></span>;
            case DeclarationStatus.Enviada:
                return <span title="Enviada"><LucideIcons.Send size={16} className="text-sky-500" /></span>;
            default:
                return <span title="Pendiente"><LucideIcons.Clock size={16} className="text-amber-500" /></span>;
        }
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

                <div className="relative group w-full md:w-64">
                    <LucideIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Filtrar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary outline-none transition-all"
                    />
                </div>
            </div>

            {/* Progress Summary mini-dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                    const totalClients = filteredClients.length;
                    if (totalClients === 0) return null;
                    
                    const lastPeriod = periods[0];
                    const declaredCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada))).length;
                    const pdfCount = filteredClients.filter(c => c.declarations?.some(d => d.period === lastPeriod && d.proof_file)).length;
                    
                    return (
                        <>
                            <div className="glass-zen p-4 flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                    <LucideIcons.CheckSquare size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Declarados ({lastPeriod})</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{declaredCount} <span className="text-xs text-slate-500">/ {totalClients}</span></p>
                                </div>
                            </div>
                            <div className="glass-zen p-4 flex items-center gap-4">
                                <div className="p-2 bg-sky-500/10 text-sky-500 rounded-lg">
                                    <LucideIcons.Paperclip size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Con Comprobante</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{pdfCount} <span className="text-xs text-slate-500">/ {totalClients}</span></p>
                                </div>
                            </div>
                            <div className="md:col-span-2 glass-zen p-4 flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eficiencia de Recaudación ({lastPeriod})</span>
                                    <span className="text-xs font-black text-emerald-500">{Math.round((pdfCount / totalClients) * 100)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-1000" 
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
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky left-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md z-10 w-64 border-r border-slate-200/50 dark:border-white/10">Cliente</th>
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
                                        <tr className="bg-slate-100/50 dark:bg-white/5 no-print">
                                            <td colSpan={periods.length + 1} className="px-8 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">
                                                        Dígito {currentDigit} • Vencimiento: Día {currentDigit === 1 ? '10' : currentDigit === 2 ? '12' : currentDigit === 3 ? '14' : currentDigit === 4 ? '16' : currentDigit === 5 ? '18' : currentDigit === 6 ? '20' : currentDigit === 7 ? '22' : currentDigit === 8 ? '24' : currentDigit === 9 ? '26' : '28'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group/row">
                                        <td 
                                            className="px-8 py-5 sticky left-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 border-r border-slate-200/50 dark:border-white/10 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800 transition-colors"
                                            onClick={() => onViewClient(client)}
                                        >
                                            <div className="flex items-center gap-3 cursor-pointer group/name">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-colors ${
                                                    theme === 'dark' ? 'bg-white/5 text-slate-500 group-hover/name:bg-primary group-hover/name:text-white' : 'bg-slate-100 text-slate-400 group-hover/name:bg-primary group-hover/name:text-white'
                                                }`}>
                                                    {client.ruc[8]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px]" title={client.name}>
                                                        {client.tradeName || client.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono font-bold text-slate-400 tracking-widest mt-1">
                                                        {client.ruc}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const declaration = client.declarations?.find(d => d.period === p);
                                            const hasProof = !!declaration?.proof_file;
                                            const isMissingPdf = (declaration?.status === DeclarationStatus.Enviada || declaration?.status === DeclarationStatus.Pagada) && !hasProof;
                                            const isDone = (declaration?.status === DeclarationStatus.Pagada || declaration?.status === DeclarationStatus.Enviada) && hasProof;
                                            
                                            return (
                                                <td key={p} className={`px-4 py-5 border-r border-slate-200/50 dark:border-white/5 last:border-r-0 transition-colors ${isDone ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {getStatusIcon(declaration)}
                                                            {hasProof ? (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); onPreviewReceipt(client, declaration!); }}
                                                                    className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:scale-110 transition-all shadow-sm"
                                                                    title="Ver Comprobante"
                                                                >
                                                                    <LucideIcons.Paperclip size={14} strokeWidth={2.5} />
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); onUploadReceipt(client, p); }}
                                                                    className={`p-1.5 rounded-lg transition-all ${isMissingPdf ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary'} hover:scale-110`}
                                                                    title={isMissingPdf ? "FALTA PDF" : "Subir Comprobante"}
                                                                >
                                                                    <LucideIcons.Upload size={14} strokeWidth={2.5} />
                                                                </button>
                                                            )}
                                                        </div>
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
            <div className="flex flex-wrap items-center gap-6 px-4">
                <div className="flex items-center gap-2">
                    <LucideIcons.CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">Pagada</span>
                </div>
                <div className="flex items-center gap-2">
                    <LucideIcons.Send size={14} className="text-sky-500" />
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">Enviada</span>
                </div>
                <div className="flex items-center gap-2">
                    <LucideIcons.Clock size={14} className="text-amber-500" />
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">Pendiente</span>
                </div>
                <div className="flex items-center gap-2">
                    <LucideIcons.Paperclip size={14} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">Con Comprobante</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 flex items-center justify-center bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-lg">
                        <LucideIcons.Upload size={14} />
                    </div>
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest font-premium animate-pulse">Falta Comprobante</span>
                </div>
            </div>
        </div>
    );
};
