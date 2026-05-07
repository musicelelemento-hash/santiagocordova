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
    onCancel?: (period: string) => void;
    onRevertDeclaration?: (period: string) => void;
}

const StatusBadge: React.FC<{ status: DeclarationStatus; hasProof: boolean }> = ({ status, hasProof }) => {
    const config = {
        [DeclarationStatus.Pagada]: {
            label: 'Pagada',
            class: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
            dot: 'bg-emerald-500 shadow-emerald-500/50',
        },
        [DeclarationStatus.Enviada]: {
            label: 'Enviada',
            class: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
            dot: 'bg-blue-500 shadow-blue-500/50',
        },
        [DeclarationStatus.Pendiente]: {
            label: 'Pendiente',
            class: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
            dot: 'bg-amber-500 shadow-amber-500/50',
        },
    };
    const c = config[status] ?? config[DeclarationStatus.Pendiente];
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border ${c.class}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${c.dot} shadow-[0_0_6px]`} />
            {c.label}
            {!hasProof && (status === DeclarationStatus.Enviada || status === DeclarationStatus.Pagada) && (
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)] animate-pulse ml-0.5" title="Sin comprobante PDF" />
            )}
        </div>
    );
};

export const DeclarationHistoryTable: React.FC<DeclarationHistoryTableProps> = ({
    history,
    client,
    onShowReceipt,
    onRevertPayment,
    onDeclare,
    onPay,
    onUpload,
    onWhatsApp,
    onCancel,
    onRevertDeclaration
}) => {
    const sortedHistory = [...(history || [])].sort((a, b) => b.period.localeCompare(a.period));

    if (sortedHistory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-700 px-10 pb-10">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl mb-6 border border-slate-100 dark:border-white/5">
                    <LucideIcons.Search size={40} strokeWidth={1.5} className="opacity-40" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">Sin registros</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 dark:text-slate-700 mt-1">No hay declaraciones en el sistema</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-[minmax(160px,1fr)_140px_120px_120px_auto] gap-0 bg-slate-50/80 dark:bg-white/3 border-b border-slate-100 dark:border-white/5 px-10 py-4">
                {['Período', 'Estado SRI', 'Pago', 'Fecha', 'Gestión'].map((h) => (
                    <div key={h} className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 flex items-center">{h}</div>
                ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50 dark:divide-white/5">
                {sortedHistory.map((decl, idx) => (
                    <div
                        key={decl.period + idx}
                        className="grid grid-cols-[minmax(160px,1fr)_140px_120px_120px_auto] gap-0 px-10 py-5 hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06] transition-all duration-300 group/row items-center animate-in fade-in duration-300 fill-mode-both"
                        style={{ animationDelay: `${idx * 40}ms` }}
                    >
                        {/* Column 1: Period */}
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 group-hover/row:text-primary group-hover/row:bg-primary/10 group-hover/row:border-primary/20 transition-all duration-500 shadow-sm shrink-0">
                                <LucideIcons.Calendar size={16} strokeWidth={2} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">{formatPeriodForDisplay(decl.period)}</p>
                                {decl.updatedAt && (
                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 font-mono">
                                        {(safeFormat(decl.updatedAt, 'dd MMM yy') || '').toUpperCase()}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Status */}
                        <div>
                            <StatusBadge status={decl.status} hasProof={!!decl.proof_file} />
                        </div>

                        {/* Column 3: Payment */}
                        <div>
                            {decl.is_paid ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                    <LucideIcons.ShieldCheck size={12} strokeWidth={2.5} />
                                    Liquidado
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5">
                                    <LucideIcons.CircleDashed size={12} />
                                    Pendiente
                                </div>
                            )}
                        </div>

                        {/* Column 4: Date */}
                        <div className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {decl.paidAt
                                ? <span className="text-emerald-600 dark:text-emerald-400">{(safeFormat(decl.paidAt, 'dd/MM/yy') || '')}</span>
                                : decl.declaredAt
                                    ? (safeFormat(decl.declaredAt, 'dd/MM/yy') || '')
                                    : <span className="opacity-30">—</span>
                            }
                        </div>

                        {/* Column 5: Actions */}
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                            {!decl.is_paid ? (
                                <>
                                    {(decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada) && onWhatsApp && (
                                        <button
                                            onClick={() => onWhatsApp(decl.period)}
                                            title="Solicitar pago por WhatsApp"
                                            className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-emerald-500 hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                        >
                                            <LucideIcons.MessageCircle size={15} strokeWidth={2} />
                                        </button>
                                    )}
                                    {onCancel && decl.status !== DeclarationStatus.Cancelada && (
                                        <button
                                            onClick={() => onCancel(decl.period)}
                                            title="Cancelar"
                                            className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-rose-500 hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                        >
                                            <LucideIcons.X size={15} strokeWidth={2} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onPay(decl.period)}
                                        title="Registrar pago"
                                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-emerald-500 hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                    >
                                        <LucideIcons.DollarSign size={15} strokeWidth={2} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => onShowReceipt(decl)}
                                        title="Ver recibo"
                                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-slate-900 dark:hover:bg-primary hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                    >
                                        <LucideIcons.Eye size={15} strokeWidth={2} />
                                    </button>
                                    <button
                                        onClick={() => onRevertPayment(decl.period)}
                                        title="Revertir pago"
                                        className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-rose-500 hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                    >
                                        <LucideIcons.RotateCcw size={15} strokeWidth={2} />
                                    </button>
                                </>
                            )}

                            {decl.status === DeclarationStatus.Pendiente && (
                                <button
                                    onClick={() => onDeclare(decl.period)}
                                    title="Marcar como declarado"
                                    className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-blue-600 hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                >
                                    <LucideIcons.Send size={15} strokeWidth={2} />
                                </button>
                            )}

                            {decl.status === DeclarationStatus.Enviada && onRevertDeclaration && (
                                <button
                                    onClick={() => onRevertDeclaration(decl.period)}
                                    title="Revertir declaración"
                                    className="w-9 h-9 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:bg-amber-500 hover:text-white hover:border-transparent rounded-xl transition-all active:scale-95 shadow-sm"
                                >
                                    <LucideIcons.RotateCcw size={15} strokeWidth={2} />
                                </button>
                            )}

                            <button
                                onClick={() => onUpload(decl.period)}
                                title="Subir comprobante"
                                className="w-9 h-9 flex items-center justify-center bg-primary text-white hover:bg-primary/80 rounded-xl transition-all active:scale-95 shadow-md shadow-primary/20"
                            >
                                <LucideIcons.UploadCloud size={15} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
