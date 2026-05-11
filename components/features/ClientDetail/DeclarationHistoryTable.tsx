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

/**
 * Sello de Cumplimiento Zenith
 * Diferencia entre "Declarado" (palabra) y "Verificado" (hecho real con PDF)
 */
const ComplianceSeal: React.FC<{ status: DeclarationStatus; hasProof: boolean }> = ({ status, hasProof }) => {
    if (status === DeclarationStatus.Pendiente) {
        return (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10 opacity-60">
                <LucideIcons.Clock size={10} strokeWidth={3} />
                Pendiente
            </div>
        );
    }

    if (status === DeclarationStatus.Cancelada) {
        return (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 text-rose-500 border border-rose-200 dark:border-rose-500/20">
                <LucideIcons.XCircle size={10} strokeWidth={3} />
                Cancelada
            </div>
        );
    }

    // El estado de "Oro": Declarado y con PDF
    if (hasProof) {
        return (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] group">
                <LucideIcons.ShieldCheck size={11} strokeWidth={3} className="text-emerald-500 animate-pulse" />
                <span className="flex items-center gap-1">
                    Verificado <span className="text-[7px] opacity-60 font-medium">SRI</span>
                </span>
            </div>
        );
    }

    // El estado de "Advertencia": Dice que está enviado pero falta el papel
    return (
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-500/5 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <LucideIcons.FileWarning size={11} strokeWidth={3} className="text-amber-500" />
            <span>Enviado</span>
            <div className="w-1 h-1 rounded-full bg-amber-500 animate-ping" />
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

    // Obtener honorario estimado de la estructura de cobro del cliente
    const getEstimatedFee = (period: string) => {
        if (!client.fee_structure) return null;
        // Lógica simple: si el periodo es semestral o mensual
        const isSemestral = period.includes('S1') || period.includes('S2');
        return isSemestral ? client.fee_structure.semestral : client.fee_structure.monthly;
    };

    if (sortedHistory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-700 px-10">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl mb-6 border border-slate-100 dark:border-white/5">
                    <LucideIcons.Search size={40} strokeWidth={1.5} className="opacity-40" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">Sin historial</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            {/* Header Industrial */}
            <div className="grid grid-cols-[1.5fr_1.2fr_1.2fr_1fr_auto] gap-0 bg-slate-50/80 dark:bg-white/3 border-b border-slate-100 dark:border-white/5 px-8 py-4">
                {['Obligación / Periodo', 'Integridad SRI', 'Honorarios', 'Cronología', 'Comandos'].map((h) => (
                    <div key={h} className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">{h}</div>
                ))}
            </div>

            <div className="divide-y divide-slate-50 dark:divide-white/5">
                {sortedHistory.map((decl, idx) => {
                    const fee = decl.amount || getEstimatedFee(decl.period);
                    
                    return (
                        <div
                            key={decl.period + idx}
                            className="grid grid-cols-[1.5fr_1.2fr_1.2fr_1fr_auto] gap-0 px-8 py-6 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04] transition-all duration-300 group/row items-center"
                        >
                            {/* 1. Periodo y Tipo */}
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 border ${
                                    decl.status === DeclarationStatus.Pendiente 
                                    ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400' 
                                    : 'bg-primary/10 border-primary/20 text-primary'
                                }`}>
                                    <LucideIcons.FileText size={18} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-tight">
                                        {formatPeriodForDisplay(decl.period)}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                        {decl.type || 'IVA MENSUAL'}
                                    </p>
                                </div>
                            </div>

                            {/* 2. Integridad Técnica (PDF vs SRI) */}
                            <div className="flex flex-col gap-1">
                                <ComplianceSeal status={decl.status} hasProof={!!decl.proof_file} />
                                {decl.proof_file && (
                                    <button 
                                        onClick={() => onShowReceipt(decl)}
                                        className="text-[8px] font-bold text-primary hover:underline flex items-center gap-1 uppercase tracking-tighter"
                                    >
                                        <LucideIcons.ExternalLink size={8} /> Ver Comprobante Digital
                                    </button>
                                )}
                            </div>

                            {/* 3. Liquidación Financiera (Honorarios) */}
                            <div>
                                {decl.is_paid ? (
                                    <div className="flex flex-col">
                                        <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                                            <LucideIcons.CheckCircle2 size={12} strokeWidth={3} />
                                            <span>${fee?.toFixed(2) || '0.00'}</span>
                                        </div>
                                        <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-400 ml-4">Liquidado</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <div className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-600 font-bold text-xs">
                                            <LucideIcons.CircleDashed size={12} />
                                            <span>${fee?.toFixed(2) || '0.00'}</span>
                                        </div>
                                        <span className="text-[8px] font-black uppercase tracking-tighter text-amber-500/80 ml-4 animate-pulse">Por Cobrar</span>
                                    </div>
                                )}
                            </div>

                            {/* 4. Cronología */}
                            <div className="flex flex-col gap-1 font-mono">
                                {decl.declaredAt && (
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                        <LucideIcons.Send size={10} />
                                        {safeFormat(decl.declaredAt, 'dd/MM/yy')}
                                    </div>
                                )}
                                {decl.paidAt && (
                                    <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500">
                                        <LucideIcons.DollarSign size={10} strokeWidth={3} />
                                        {safeFormat(decl.paidAt, 'dd/MM/yy')}
                                    </div>
                                )}
                                {!decl.declaredAt && !decl.paidAt && <span className="text-slate-200 dark:text-slate-800 tracking-[0.3em]">-----</span>}
                            </div>

                            {/* 5. Comandos de Gestión */}
                            <div className="flex items-center justify-end gap-1.5">
                                {!decl.is_paid ? (
                                    <>
                                        {decl.status !== DeclarationStatus.Pendiente && (
                                            <button
                                                onClick={() => onWhatsApp?.(decl.period)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                                                title="Recordar Pago"
                                            >
                                                <LucideIcons.MessageCircle size={14} strokeWidth={2.5} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onPay(decl.period)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-110 transition-all active:scale-90 shadow-lg shadow-black/10"
                                            title="Cobrar Honorario"
                                        >
                                            <LucideIcons.DollarSign size={14} strokeWidth={3} />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => onRevertPayment(decl.period)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 transition-all"
                                        title="Revertir Cobro"
                                    >
                                        <LucideIcons.RotateCcw size={14} />
                                    </button>
                                )}

                                <div className="h-4 w-[1px] bg-slate-100 dark:bg-white/10 mx-1" />

                                {decl.status === DeclarationStatus.Pendiente ? (
                                    <button
                                        onClick={() => onDeclare(decl.period)}
                                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                                    >
                                        Declarar
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onUpload(decl.period)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                            decl.proof_file 
                                            ? 'text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10' 
                                            : 'bg-amber-500 text-white animate-bounce-subtle hover:bg-amber-600 shadow-lg shadow-amber-500/20'
                                        }`}
                                        title={decl.proof_file ? "Actualizar Comprobante" : "¡SUBIR COMPROBANTE!"}
                                    >
                                        <LucideIcons.UploadCloud size={14} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
