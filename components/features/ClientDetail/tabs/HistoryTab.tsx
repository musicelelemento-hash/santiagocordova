import React from 'react';
import { Client, Declaration } from '../../../../types';
import * as LucideIcons from 'lucide-react';
import { DocumentTimeline } from '../DocumentTimeline';
import { DeclarationHistoryTable } from '../DeclarationHistoryTable';

interface HistoryTabProps {
    client: Client;
    editedClient: Client;
    setPreviewItem: (item: Declaration | null) => void;
    handleDownload: (decl: Declaration) => void;
    handleWhatsAppPaymentRequest: (period: string, type: string) => void;
    handleShowReceipt: (declaration: Declaration) => void;
    handleRevertPayment: (period: string) => void;
    setConfirmation: (conf: { action: 'declare' | 'pay'; period: string } | null) => void;
    handleQuickPay: (period: string) => void;
    setUploadingTarget: (target: { type: string; period?: string } | null) => void;
    proofInputRef: React.RefObject<HTMLInputElement>;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
    client,
    editedClient,
    setPreviewItem,
    handleDownload,
    handleWhatsAppPaymentRequest,
    handleShowReceipt,
    handleRevertPayment,
    setConfirmation,
    handleQuickPay,
    setUploadingTarget,
    proofInputRef
}) => {
    const totalDeclared = (client.declarations || []).filter(d => d.status === 'Enviada' || d.status === 'Pagada').length;
    const totalPaid = (client.declarations || []).filter(d => d.is_paid).length;
    const totalPending = (client.declarations || []).filter(d => d.status === 'Pendiente').length;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-6">
                {[
                    { label: 'Declaradas', value: totalDeclared, icon: LucideIcons.Send, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20' },
                    { label: 'Pagadas', value: totalPaid, icon: LucideIcons.CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-100 dark:border-emerald-500/20' },
                    { label: 'Pendientes', value: totalPending, icon: LucideIcons.Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-100 dark:border-amber-500/20' },
                ].map((kpi) => (
                    <div key={kpi.label} className={`${kpi.bg} ${kpi.border} border rounded-3xl p-7 flex items-center gap-6 transition-all hover:scale-[1.02] shadow-sm backdrop-blur-sm`}>
                        <div className={`p-3.5 rounded-2xl bg-white/80 dark:bg-white/10 shadow-sm`}>
                            <kpi.icon className={kpi.color} size={22} strokeWidth={2} />
                        </div>
                        <div>
                            <p className={`text-3xl font-bold ${kpi.color} leading-none font-mono tracking-tighter`}>{kpi.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mt-2">{kpi.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Registro Operativo */}
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-10 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group border border-slate-200/50 dark:border-white/10 transition-all duration-500 hover:shadow-primary/5">
                {/* Decorative glow */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/5 rounded-full blur-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6 relative z-10">
                    <div>
                        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 dark:bg-blue-500/15 rounded-2xl">
                                <LucideIcons.Activity className="text-blue-500" size={24} />
                            </div>
                            Registro Operativo
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-3">
                            Trazabilidad de acciones y validaciones
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/5 px-5 py-3 rounded-2xl border border-slate-100 dark:border-white/5 self-start sm:self-auto">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        {(client.declarations || []).filter(d => d.proof_file || d.status === 'Enviada' || d.status === 'Pagada').length} registros
                    </div>
                </div>

                <DocumentTimeline
                    client={client}
                    onViewPreview={(decl) => setPreviewItem(decl)}
                    onDownload={handleDownload}
                    onWhatsApp={(period) => handleWhatsAppPaymentRequest(period, 'IVA')}
                />
            </div>

            {/* Historial de Declaraciones */}
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-white/10 transition-all duration-500 hover:shadow-primary/5">

                <div className="px-10 pt-10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-100 dark:border-white/5">
                    <div>
                        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <LucideIcons.FileClock className="text-primary" size={24} />
                            </div>
                            Resumen de Declaraciones
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-3">
                            Gestión fiscal detallada por período
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/5 px-5 py-3 rounded-2xl border border-slate-100 dark:border-white/5 self-start sm:self-auto">
                        <LucideIcons.Database size={14} className="text-primary" />
                        {(editedClient.declarations || []).length} registros
                    </div>
                </div>

                <DeclarationHistoryTable
                    client={client}
                    history={editedClient.declarations || []}
                    onShowReceipt={handleShowReceipt}
                    onRevertPayment={handleRevertPayment}
                    onDeclare={(period) => setConfirmation({ action: 'declare', period })}
                    onPay={handleQuickPay}
                    onUpload={(p) => { setUploadingTarget({ type: 'iva', period: p }); proofInputRef.current?.click(); }}
                    onWhatsApp={(period) => handleWhatsAppPaymentRequest(period, 'IVA')}
                />
            </div>
        </div>
    );
};
