import React from 'react';
import { FileCheck, Download, Search, Send, DollarSign, UploadCloud, RotateCcw, Eye, Calendar, MessageCircle } from 'lucide-react';
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
        <div className="bg-slate-950/60 backdrop-blur-2xl rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.6)] overflow-hidden relative aura-premium">
            <div className="p-6 sm:p-8 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 bg-slate-950/40">
                <div>
                    <h3 className="font-black text-white flex items-center gap-3 text-lg sm:text-xl uppercase tracking-tight">
                        <FileCheck size={20} className="text-cyan-400 sm:w-6 sm:h-6" /> Historial
                    </h3>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 ml-6 sm:ml-9">Registros y Estados SRI</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-slate-900 border border-white/5 rounded-xl">
                        <span className="text-[11px] font-black text-cyan-500 uppercase tracking-widest">{sortedHistory.length} ENTIDADES</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-slate-900/30">
                            <th className="px-5 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Sector</th>
                            <th className="px-5 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Estado</th>
                            <th className="px-5 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Financiero</th>
                            <th className="px-5 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em] text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedHistory.length > 0 ? sortedHistory.map((decl, idx) => (
                            <tr key={decl.period + idx} className="hover:bg-cyan-500/[0.03] transition-all duration-300 group">
                                <td className="px-5 sm:px-8 py-4 sm:py-6">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-950 border border-white/5 flex items-center justify-center text-slate-600 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all duration-500 shadow-inner">
                                            <Calendar size={14} className="sm:w-[18px] sm:h-[18px]" />
                                        </div>
                                        <div>
                                            <p className="font-black text-white text-xs sm:text-base uppercase tracking-tight">{formatPeriodForDisplay(decl.period)}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="w-1 h-1 rounded-full bg-cyan-500/40"></div>
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">ACTUALIZADO: {safeFormat(decl.updatedAt, 'dd MMM').toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-2xl ${
                                        decl.status === DeclarationStatus.Pagada ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5' :
                                        decl.status === DeclarationStatus.Enviada ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sky-500/5' : 
                                        'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5'
                                    }`}>
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                                            decl.status === DeclarationStatus.Pagada ? 'bg-emerald-400' :
                                            decl.status === DeclarationStatus.Enviada ? 'bg-sky-400' : 'bg-amber-400'
                                        }`} />
                                        {decl.status}
                                        {!decl.proof_file && (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && (
                                            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse" title="Falta Comprobante PDF" />
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            {decl.is_paid ? (
                                                <div className="flex items-center gap-1.5 text-emerald-400">
                                                    <DollarSign size={12} strokeWidth={3} />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Liquidado</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <RotateCcw size={12} className="opacity-50" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Pendiente</span>
                                                </div>
                                            )}
                                        </div>
                                        {decl.paidAt && (
                                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] font-mono ml-4">
                                                ID: {safeFormat(decl.paidAt, 'ddMMyy-HHmm').toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        {!decl.is_paid ? (
                                            <div className="flex items-center gap-3">
                                                {(decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && onWhatsApp && (
                                                    <button 
                                                        onClick={() => onWhatsApp(decl.period)} 
                                                        className="p-3 bg-slate-900 border border-white/5 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-xl active:scale-95" 
                                                        title="Solicitar Pago WhatsApp"
                                                    >
                                                        <MessageCircle size={18} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => onPay(decl.period)} 
                                                    className="p-3 bg-slate-900 border border-white/5 text-slate-400 hover:bg-emerald-500 hover:text-white transition-all rounded-xl shadow-xl active:scale-95" 
                                                    title="Registrar Pago"
                                                >
                                                    <DollarSign size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => onShowReceipt(decl)} 
                                                    className="p-3 bg-slate-900 border border-white/5 text-slate-400 hover:bg-cyan-500 hover:text-white transition-all rounded-xl shadow-xl active:scale-95" 
                                                    title="Ver Recibo"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => onRevertPayment(decl.period)} 
                                                    className="p-3 bg-slate-900 border border-white/5 text-slate-400 hover:bg-amber-500 hover:text-white transition-all rounded-xl shadow-xl active:scale-95" 
                                                    title="Revertir Pago"
                                                >
                                                    <RotateCcw size={18} />
                                                </button>
                                            </div>
                                        )}
                                        {decl.status === DeclarationStatus.Pendiente && (
                                            <button 
                                                onClick={() => onDeclare(decl.period)} 
                                                className="p-3 bg-slate-900 border border-white/5 text-slate-400 hover:bg-sky-500 hover:text-white transition-all rounded-xl shadow-xl active:scale-95" 
                                                title="Marcar Declarado"
                                            >
                                                <Send size={18} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onUpload(decl.period)} 
                                            className="p-3 bg-white text-slate-950 hover:bg-cyan-500 hover:text-white transition-all rounded-xl shadow-2xl active:scale-95" 
                                            title="Subir Comprobante"
                                        >
                                            <UploadCloud size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center relative overflow-hidden">
                                    <div className="relative z-10 flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-800">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] font-mono">
                                            Vector de Datos Vacío / No se encontraron registros
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Tactical design flourish */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
        </div>
    );
};
