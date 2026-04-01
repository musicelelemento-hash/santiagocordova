import React from 'react';
import { FileCheck, Download, Search, Send, DollarSign, UploadCloud, RotateCcw, Eye, Calendar, MessageCircle, ShieldCheck } from 'lucide-react';
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
        <div className="bg-white dark:bg-surface/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-architect overflow-hidden relative group transition-all duration-700">
            <div className="p-10 border-b border-slate-50 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-slate-50/30 dark:bg-surface-low/30">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-primary/10 border border-blue-100 dark:border-primary/20 flex items-center justify-center text-blue-600 dark:text-primary-low shadow-sm group-hover:scale-105 transition-transform duration-1000">
                        <FileCheck size={28} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-950 dark:text-slate-50 text-xl uppercase tracking-tight font-premium">
                            HISTORIAL FISCAL
                        </h3>
                        <p className="text-[10px] sm:text-[11px] text-blue-500 dark:text-primary-low font-black uppercase tracking-[0.3em] mt-1.5 font-premium">REGISTROS Y ESTADOS SRI</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-6 py-3 bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm">
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 uppercase tracking-widest font-premium">{sortedHistory.length} <span className="text-blue-500 dark:text-primary">ENTIDADES</span></span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-surface-low/20">
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 dark:text-slate-500 border-r border-slate-50 dark:border-white/5 uppercase tracking-[0.3em] font-premium">Sector Temporal</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 dark:text-slate-500 border-r border-slate-50 dark:border-white/5 uppercase tracking-[0.3em] font-premium">Estado SRI</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 dark:text-slate-500 border-r border-slate-50 dark:border-white/5 uppercase tracking-[0.3em] font-premium">Trazabilidad</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] text-right font-premium">Interacción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {sortedHistory.length > 0 ? sortedHistory.map((decl, idx) => (
                            <tr key={decl.period + idx} className="hover:bg-blue-50/30 dark:hover:bg-primary/5 transition-all duration-500 group/row">
                                <td className="px-10 py-8">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-surface-low border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/row:text-blue-600 dark:group-hover/row:text-primary group-hover/row:bg-blue-50 dark:group-hover/row:bg-primary/20 group-hover/row:border-blue-100 dark:group-hover/row:border-primary/30 transition-all duration-700 shadow-sm">
                                            <Calendar size={20} strokeWidth={2} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-950 dark:text-slate-50 text-base uppercase tracking-tight font-premium">{formatPeriodForDisplay(decl.period)}</p>
                                            <div className="flex items-center gap-2.5 mt-1.5 pt-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest font-premium">SINC: {safeFormat(decl.updatedAt, 'dd MMM').toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-10 py-8">
                                    <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border font-premium shadow-sm ${
                                        decl.status === DeclarationStatus.Pagada ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' :
                                        decl.status === DeclarationStatus.Enviada ? 'bg-blue-50 dark:bg-primary/10 text-blue-700 dark:text-primary-low border-blue-100 dark:border-primary/20' : 
                                        'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20'
                                    }`}>
                                        <div className={`w-2.5 h-2.5 rounded-full animate-pulse transition-all duration-700 ${
                                            decl.status === DeclarationStatus.Pagada ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' :
                                            decl.status === DeclarationStatus.Enviada ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                                        }`} />
                                        {decl.status}
                                        {!decl.proof_file && (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && (
                                            <div className="ml-1 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-bounce" title="Falta Comprobante PDF" />
                                        )}
                                    </div>
                                </td>
                                <td className="px-10 py-8">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2.5">
                                            {decl.is_paid ? (
                                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                                                    <ShieldCheck size={14} strokeWidth={2.5} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest font-premium">Liquidado</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-surface-low px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5">
                                                    <RotateCcw size={14} className="opacity-50" strokeWidth={2.5} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest font-premium">Pendiente</span>
                                                </div>
                                            )}
                                        </div>
                                        {decl.paidAt && (
                                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.2em] font-mono ml-4 opacity-70">
                                                ID: {safeFormat(decl.paidAt, 'ddMMyy-HHmm').toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-10 py-8 text-right">
                                    <div className="flex justify-end gap-2.5">
                                        {!decl.is_paid ? (
                                            <div className="flex items-center gap-2.5">
                                                {(decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && onWhatsApp && (
                                                    <button 
                                                        onClick={() => onWhatsApp(decl.period)} 
                                                        className="w-11 h-11 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-90" 
                                                        title="Solicitar Pago WhatsApp"
                                                    >
                                                        <MessageCircle size={20} strokeWidth={2} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => onPay(decl.period)} 
                                                    className="w-11 h-11 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white transition-all rounded-xl shadow-sm active:scale-90" 
                                                    title="Registrar Pago"
                                                >
                                                    <DollarSign size={20} strokeWidth={2} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2.5">
                                                <button 
                                                    onClick={() => onShowReceipt(decl)} 
                                                    className="w-11 h-11 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-primary hover:text-white transition-all rounded-xl shadow-sm active:scale-90" 
                                                    title="Ver Recibo"
                                                >
                                                    <Eye size={20} strokeWidth={2} />
                                                </button>
                                                <button 
                                                    onClick={() => onRevertPayment(decl.period)} 
                                                    className="w-11 h-11 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-all rounded-xl shadow-sm active:scale-90" 
                                                    title="Revertir Pago"
                                                >
                                                    <RotateCcw size={20} strokeWidth={2} />
                                                </button>
                                            </div>
                                        )}
                                        {decl.status === DeclarationStatus.Pendiente && (
                                            <button 
                                                onClick={() => onDeclare(decl.period)} 
                                                className="w-11 h-11 flex items-center justify-center bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-blue-600 dark:hover:bg-primary hover:text-white transition-all rounded-xl shadow-sm active:scale-90" 
                                                title="Marcar Declarado"
                                            >
                                                <Send size={20} strokeWidth={2} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onUpload(decl.period)} 
                                            className="w-11 h-11 flex items-center justify-center bg-blue-600 dark:bg-primary text-white hover:bg-black dark:hover:bg-primary-low transition-all rounded-xl shadow-lg shadow-blue-200 dark:shadow-primary/20 active:scale-90" 
                                            title="Subir Comprobante"
                                        >
                                            <UploadCloud size={20} strokeWidth={2} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-10 py-32 text-center relative overflow-hidden bg-slate-50/20 dark:bg-surface-low/10">
                                    <div className="relative z-10 flex flex-col items-center gap-6">
                                        <div className="w-24 h-24 rounded-full bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-200 dark:text-slate-800 shadow-inner group-hover/empty:scale-110 transition-transform duration-1000">
                                            <Search size={40} strokeWidth={1} />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em] font-premium">
                                                DATA STREAM IDLE
                                            </p>
                                            <p className="text-[10px] font-black text-slate-200 dark:text-slate-700 uppercase tracking-[0.3em] font-premium mt-3">SISTEMA A LA ESPERA DE REGISTROS</p>
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
