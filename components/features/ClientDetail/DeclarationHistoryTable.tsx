import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Declaration, DeclarationStatus, Client } from '../../../types';
import { formatPeriodForDisplay, safeFormat } from '../../../services/sri';

interface DeclarationHistoryTableProps {
    history: Declaration[];
    client: Client;
    onShowReceipt: (decl: Declaration) => void;
    onRevertPayment: (period: string) => void;
    onDeclare: (period: string) => void;
    onPay: (period: string) => void;
    onUpload: (period: string) => void;
    onWhatsApp?: (period: string) => void;
}

export const DeclarationHistoryTable: React.FC<DeclarationHistoryTableProps> = ({
    history,
    client,
    onShowReceipt,
    onRevertPayment,
    onDeclare,
    onPay,
    onUpload,
    onWhatsApp
}) => {
    const sortedHistory = [...(history || [])].sort((a, b) => b.period.localeCompare(a.period));

    return (
        <div className="bg-white dark:bg-surface/40 backdrop-blur-3xl rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-architect overflow-hidden relative group transition-all duration-700">
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-slate-50/50 dark:bg-surface-low/30">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-primary/10 border border-blue-100 dark:border-primary/20 flex items-center justify-center text-blue-600 dark:text-primary-low shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-105 transition-transform duration-1000">
                        <LucideIcons.FileCheck size={26} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-950 dark:text-slate-50 text-lg uppercase tracking-tight font-premium">
                            HISTORIAL FISCAL
                        </h3>
                        <p className="text-[9px] text-blue-500 dark:text-primary-low font-mono font-bold uppercase tracking-[0.3em] mt-1">LOGS_AND_RECORDS_SRI</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 rounded-xl shadow-sm">
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                            <span className="text-blue-600 dark:text-primary mr-1 text-xs">{sortedHistory.length}</span>
                            ENTITIES_LOADED
                        </span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-surface-low/10">
                            <th className="px-8 py-5 text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 border-r border-slate-50 dark:border-white/5 uppercase tracking-[0.3em]">Temporal Sector</th>
                            <th className="px-8 py-5 text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 border-r border-slate-50 dark:border-white/5 uppercase tracking-[0.3em]">SRI Status</th>
                            <th className="px-8 py-5 text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 border-r border-slate-50 dark:border-white/5 uppercase tracking-[0.3em]">Traceability</th>
                            <th className="px-8 py-5 text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] text-right">Operations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {sortedHistory.length > 0 ? sortedHistory.map((decl, idx) => (
                            <tr key={decl.period + idx} className="hover:bg-blue-50/30 dark:hover:bg-primary/5 transition-all duration-500 group/row">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-surface-low border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/row:text-blue-600 dark:group-hover/row:text-primary group-hover/row:bg-blue-50 dark:group-hover/row:bg-primary/20 group-hover/row:border-blue-100 dark:group-hover/row:border-primary/30 transition-all duration-700 shadow-sm overflow-hidden relative">
                                            <LucideIcons.Calendar size={18} strokeWidth={2} />
                                            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-blue-500 scale-x-0 group-hover/row:scale-x-100 transition-transform duration-700"></div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-950 dark:text-white text-sm uppercase tracking-tight font-premium">{formatPeriodForDisplay(decl.period)}</p>
                                            <div className="flex items-center gap-2.5 mt-1">
                                                <div className="w-1 h-1 rounded-full bg-blue-400 dark:bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-widest uppercase">SINC: <span className="text-slate-600 dark:text-slate-300 ml-1">{safeFormat(decl.updatedAt, 'dd MMM').toUpperCase()}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider border transition-all duration-500 ${
                                        decl.status === DeclarationStatus.Pagada ? 'bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-500/20' :
                                        decl.status === DeclarationStatus.Enviada ? 'bg-blue-50/50 dark:bg-primary/10 text-blue-700 dark:text-primary-low border-blue-100/50 dark:border-primary/20' : 
                                        'bg-amber-50/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100/50 dark:border-amber-500/20'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-1000 ${
                                            decl.status === DeclarationStatus.Pagada ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                            decl.status === DeclarationStatus.Enviada ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                                        }`} />
                                        {decl.status === DeclarationStatus.Pagada ? 'STATUS_PAID' : decl.status === DeclarationStatus.Enviada ? 'STATUS_SENT' : 'STATUS_PENDING'}
                                        {!decl.proof_file && (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && (
                                            <div className="ml-1 w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse" title="Falta Comprobante PDF" />
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2.5">
                                            {decl.is_paid ? (
                                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-100/50 dark:border-emerald-500/20">
                                                    <LucideIcons.ShieldCheck size={12} strokeWidth={2.5} />
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest">LIQUIDATED</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-surface-low px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/5">
                                                    <LucideIcons.RotateCcw size={12} className="opacity-50" strokeWidth={2.5} />
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest">PENDING_TX</span>
                                                </div>
                                            )}
                                        </div>
                                        {decl.paidAt && (
                                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-[0.2em] ml-1 opacity-70">
                                                FIXED_TIMESTAMP: {safeFormat(decl.paidAt, 'ddMMyy-HHmm').toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        {!decl.is_paid ? (
                                            <div className="flex items-center gap-2">
                                                {(decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && onWhatsApp && (
                                                    <button 
                                                        onClick={() => onWhatsApp(decl.period)} 
                                                        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:text-white rounded-lg transition-all active:scale-95" 
                                                        title="Solicitar Pago WhatsApp"
                                                    >
                                                        <LucideIcons.MessageCircle size={18} strokeWidth={2} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => onPay(decl.period)} 
                                                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white transition-all rounded-lg active:scale-95" 
                                                    title="Registrar Pago"
                                                >
                                                    <LucideIcons.DollarSign size={18} strokeWidth={2} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => onShowReceipt(decl)} 
                                                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-primary hover:text-white transition-all rounded-lg active:scale-95" 
                                                    title="Ver Recibo"
                                                >
                                                    <LucideIcons.Eye size={18} strokeWidth={2} />
                                                </button>
                                                <button 
                                                    onClick={() => onRevertPayment(decl.period)} 
                                                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-all rounded-lg active:scale-95" 
                                                    title="Revertir Pago"
                                                >
                                                    <LucideIcons.RotateCcw size={18} strokeWidth={2} />
                                                </button>
                                            </div>
                                        )}
                                        {decl.status === DeclarationStatus.Pendiente && (
                                            <button 
                                                onClick={() => onDeclare(decl.period)} 
                                                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-blue-600 dark:hover:bg-primary hover:text-white transition-all rounded-lg active:scale-95" 
                                                title="Marcar Declarado"
                                            >
                                                <LucideIcons.Send size={18} strokeWidth={2} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onUpload(decl.period)} 
                                            className="w-10 h-10 flex items-center justify-center bg-blue-600 dark:bg-primary text-white hover:bg-black dark:hover:bg-primary-low transition-all rounded-lg shadow-sm active:scale-95" 
                                            title="Subir Comprobante"
                                        >
                                            <LucideIcons.UploadCloud size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-10 py-24 text-center relative overflow-hidden bg-slate-50/20 dark:bg-surface-low/10">
                                    <div className="relative z-10 flex flex-col items-center gap-5">
                                        <div className="w-20 h-20 rounded-full bg-white dark:bg-surface-low border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-200 dark:text-slate-800 shadow-inner group-hover/empty:scale-105 transition-transform duration-1000">
                                            <LucideIcons.Search size={32} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
                                                DATA_STREAM_IDLE
                                            </p>
                                            <p className="text-[9px] font-mono font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em] mt-2">NO_RECORDS_FOUND_IN_SYSTEM</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Background Decorative Layer */}
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-50 dark:bg-primary/5 border border-blue-100/30 dark:border-primary/10 rounded-full blur-[100px] pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
        </div>
    );
};
