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
    handleCancelDeclaration: (period: string) => void;
    handleRevertDeclaration: (period: string) => void;
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
    proofInputRef,
    handleCancelDeclaration,
    handleRevertDeclaration
}) => {
    const totalDeclared = (client.declarations || []).filter(d => d.status === 'Enviada' || d.status === 'Pagada').length;
    const totalPaid = (client.declarations || []).filter(d => d.is_paid).length;
    const totalPending = (client.declarations || []).filter(d => d.status === 'Pendiente').length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">

            {/* KPI Strip (Stitch Telemetry Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-mono">
                {[
                    { label: 'Declaradas', value: totalDeclared, icon: LucideIcons.Send, color: 'text-[#2B6AFF]', bg: 'bg-[#2B6AFF]/10 border-[#2B6AFF]/25', glow: 'shadow-[#2B6AFF]/15' },
                    { label: 'Pagadas', value: totalPaid, icon: LucideIcons.CheckCircle2, color: 'text-[#00A896]', bg: 'bg-[#00A896]/10 border-[#00A896]/25', glow: 'shadow-[#00A896]/15' },
                    { label: 'Pendientes', value: totalPending, icon: LucideIcons.Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', glow: 'shadow-amber-500/15' },
                ].map((kpi) => (
                    <div key={kpi.label} className={`bg-[#051424]/90 backdrop-blur-2xl ${kpi.border} border border-t-white/20 rounded-3xl p-6 flex items-center gap-5 transition-all hover:scale-[1.02] shadow-xl ${kpi.glow}`}>
                        <div className={`p-3.5 rounded-2xl ${kpi.bg} border ${kpi.border} ${kpi.color} shadow-sm`}>
                            <kpi.icon size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className={`text-3xl font-black ${kpi.color} leading-none font-mono tracking-tighter`}>{kpi.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1.5">{kpi.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Registro Operativo */}
            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/10 border-t-white/20 relative overflow-hidden group transition-all duration-500">
                {/* Decorative glow */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#2B6AFF]/10 rounded-full blur-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-6 relative z-10">
                    <div>
                        <h3 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight flex items-center gap-3">
                            <div className="p-3 bg-[#2B6AFF]/15 text-[#2B6AFF] border border-[#2B6AFF]/30 rounded-2xl">
                                <LucideIcons.Activity size={24} />
                            </div>
                            Registro Operativo
                        </h3>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-2">
                            Trazabilidad de acciones y validaciones contables
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#2B6AFF] bg-[#2B6AFF]/10 px-4 py-2 rounded-2xl border border-[#2B6AFF]/25 self-start sm:self-auto shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-[#2B6AFF] animate-pulse shadow-[0_0_6px_#2B6AFF]" />
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
            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 border-t-white/20 transition-all duration-500">

                <div className="p-6 sm:px-10 sm:pt-10 sm:pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10">
                    <div>
                        <h3 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight flex items-center gap-3">
                            <div className="p-3 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-2xl">
                                <LucideIcons.FileClock size={24} />
                            </div>
                            Resumen de Declaraciones
                        </h3>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-2">
                            Gestión fiscal detallada por período impositivo
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#00A896] bg-[#00A896]/10 px-4 py-2 rounded-2xl border border-[#00A896]/25 self-start sm:self-auto shadow-sm">
                        <LucideIcons.Database size={14} className="text-[#00A896]" />
                        {(editedClient.declarations || []).length} períodos
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
                    onCancel={handleCancelDeclaration}
                    onRevertDeclaration={handleRevertDeclaration}
                />
            </div>
        </div>
    );
};
