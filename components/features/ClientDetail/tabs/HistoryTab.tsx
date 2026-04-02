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
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[3rem] p-10 shadow-architect relative overflow-hidden group border border-surface-low dark:border-white/10">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h3 className="text-xl font-extrabold text-on-surface dark:text-slate-100 tracking-tight uppercase flex items-center gap-4 font-premium">
                            <LucideIcons.Activity className="text-primary" size={24} />
                            REGISTRO OPERATIVO
                        </h3>
                        <p className="text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.25em] mt-3 font-premium">TRAZABILIDAD DE ACCIONES Y VALIDACIONES</p>
                    </div>
                </div>

                <DocumentTimeline
                    client={client}
                    onViewPreview={(decl) => setPreviewItem(decl)}
                    onDownload={handleDownload}
                    onWhatsApp={(period) => handleWhatsAppPaymentRequest(period, 'IVA')}
                />
            </div>
            
            <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[3rem] p-10 shadow-architect relative overflow-hidden group border border-surface-low dark:border-white/10">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-base font-extrabold text-on-surface dark:text-slate-100 tracking-tight uppercase flex items-center gap-3 font-premium">
                        <LucideIcons.FileClock className="text-tertiary" size={20} />
                        Resumen de Declaraciones
                    </h3>
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
