import React, { useState, useEffect } from 'react';
import {
    X, Mail, Send, CheckCircle, AlertCircle, Copy, ExternalLink,
    RefreshCw, Eye, MessageSquare, PhoneCall, Sparkles, ShieldCheck
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Client, BillingPlan, MonthlyInvoicingRecord } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import {
    sendResendEmail,
    generatePlanRenewalHtml,
    generateLowDocumentsNoticeHtml,
    generateCredentialsDispatchHtml,
    generateMonthlyFillingStatementHtml
} from '../../services/resendEmailService';

interface ResendNoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    noticeType: 'renewal' | 'low_docs' | 'credentials' | 'filling_statement';
    additionalData?: {
        plan?: BillingPlan;
        daysRemaining?: number;
        remainingDocs?: number;
        monthlyRecord?: MonthlyInvoicingRecord;
        periodTitle?: string;
    };
}

export const ResendNoticeModal: React.FC<ResendNoticeModalProps> = ({
    isOpen,
    onClose,
    client,
    noticeType,
    additionalData
}) => {
    const { systemSettings } = useAppStore();
    const { toast } = useToast();

    const plan = additionalData?.plan || client.billingPlan || client.facturadorConfig || {};
    const [recipientEmail, setRecipientEmail] = useState(client.email || '');
    const [emailSubject, setEmailSubject] = useState('');
    const [generatedHtml, setGeneratedHtml] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState<boolean | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);
    const [previewTab, setPreviewTab] = useState<'preview' | 'html'>('preview');

    const clientName = client.tradeName || client.name;

    // Generate subject and HTML content depending on noticeType
    useEffect(() => {
        setRecipientEmail(client.email || '');
        setSendSuccess(null);
        setSendError(null);

        let subject = '';
        let html = '';

        if (noticeType === 'renewal') {
            const days = additionalData?.daysRemaining ?? (plan.expirationDate ? Math.ceil((new Date(plan.expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24)) : 15);
            subject = `Aviso de Renovación: Plan de Facturación SRI - ${clientName}`;
            html = generatePlanRenewalHtml(client, plan, days);
        } else if (noticeType === 'low_docs') {
            const docs = additionalData?.remainingDocs ?? 5;
            subject = `⚠️ Cupo de Comprobantes por Agotarse - ${clientName}`;
            html = generateLowDocumentsNoticeHtml(client, plan, docs);
        } else if (noticeType === 'credentials') {
            subject = `🔐 Tus Credenciales Oficiales de Facturador - ${clientName}`;
            html = generateCredentialsDispatchHtml(client, {
                programName: plan.programName || 'Facturador Electrónico',
                url: plan.url || 'https://app.ecuafact.com',
                username: plan.username || client.ruc,
                password: plan.password,
                sriPassword: client.sriPassword
            });
        } else if (noticeType === 'filling_statement') {
            const period = additionalData?.periodTitle || 'Mes en Curso';
            const rec = additionalData?.monthlyRecord || {
                period: 'Actual',
                count: 0,
                totalFee: 0
            };
            subject = `📄 Liquidación de Emisión de Facturas - Período ${period} - ${clientName}`;
            html = generateMonthlyFillingStatementHtml(client, rec, period);
        }

        setEmailSubject(subject);
        setGeneratedHtml(html);
    }, [isOpen, client, noticeType, additionalData, plan, clientName]);

    if (!isOpen) return null;

    const handleSendEmail = async () => {
        if (!recipientEmail || !recipientEmail.includes('@')) {
            toast.error("Por favor ingresa un correo electrónico de destino válido.");
            return;
        }

        setIsSending(true);
        setSendSuccess(null);
        setSendError(null);

        const res = await sendResendEmail({
            apiKey: systemSettings.resendApiKey,
            from: systemSettings.resendSenderEmail || 'facturacion@santiagocordova.com',
            to: recipientEmail.trim(),
            subject: emailSubject,
            html: generatedHtml
        });

        setIsSending(false);

        if (res.success) {
            setSendSuccess(true);
            toast.success(`✅ Correo enviado a ${recipientEmail} con éxito.`);
        } else {
            setSendSuccess(false);
            setSendError(res.error || 'Error desconocido al enviar');
            toast.error(res.error || 'Error al enviar el correo');
        }
    };

    const handleCopyHtml = () => {
        navigator.clipboard.writeText(generatedHtml);
        toast.success("Código HTML del correo copiado al portapapeles.");
    };

    const handleSendWhatsAppFallback = () => {
        const phone = client.phones?.[0];
        const num = typeof phone === 'object' ? (phone as any).number : (phone || '');
        const cleanPhone = num.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('593') ? cleanPhone : cleanPhone.startsWith('0') ? `593${cleanPhone.slice(1)}` : `593${cleanPhone}`;
        
        let text = `Estimado(a) *${clientName}* 👋,\n\n`;
        if (noticeType === 'renewal') {
            text += `Le recordamos que su plan de facturación electrónica en *${plan.programName || 'su facturador'}* está próximo a vencer. Puede coordinar su renovación anual para no interrumpir sus emisiones.\n\n🔗 Consulte su portal: https://santiagocordova.com/portal?ruc=${client.ruc}`;
        } else if (noticeType === 'credentials') {
            text += `Le compartimos sus accesos de facturador:\n🌐 Link: ${plan.url || 'https://app.ecuafact.com'}\n👤 Usuario: ${plan.username || client.ruc}\n🔑 Clave Facturador: ${plan.password || client.sriPassword}\n🏛️ Clave SRI: ${client.sriPassword}`;
        } else if (noticeType === 'low_docs') {
            text += `Le informamos que sus comprobantes en *${plan.programName || 'su facturador'}* están por agotarse. Recuerde recargar su paquete con anticipación.`;
        } else {
            const count = additionalData?.monthlyRecord?.count || 0;
            const fee = (additionalData?.monthlyRecord?.totalFee || 0).toFixed(2);
            text += `Presentamos el resumen de facturas llenadas en el período *${additionalData?.periodTitle || ''}*:\n📄 Total comprobantes: ${count}\n💰 Total a cancelar: $${fee} USD\n\nSaludos cordiales, *Ing. Santiago Córdova*.`;
        }

        const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <div className="space-y-5 font-mono text-xs">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-foreground/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-tertiary/20 to-primary/20 rounded-2xl text-tertiary border border-tertiary/30">
                            <Mail size={22} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-tertiary uppercase tracking-widest">
                                Envíos Ejecutivos · Resend
                            </div>
                            <h3 className="text-base font-black text-on-surface uppercase tracking-tight font-display mt-0.5">
                                {noticeType === 'renewal' && 'Aviso de Renovación de Plan'}
                                {noticeType === 'low_docs' && 'Alerta de Comprobantes Agotados'}
                                {noticeType === 'credentials' && 'Entrega Oficial de Credenciales'}
                                {noticeType === 'filling_statement' && 'Estado de Cuenta / Llenado'}
                            </h3>
                            <p className="text-[11px] text-on-surface-variant font-sans">
                                Cliente: <strong>{clientName}</strong> ({client.ruc})
                            </p>
                        </div>
                    </div>
                </div>

                {/* Formulario de Envío */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-low p-4 rounded-2xl border border-foreground/10">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Correo de Destino:</label>
                        <input
                            type="email"
                            required
                            placeholder="cliente@ejemplo.com"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Asunto:</label>
                        <input
                            type="text"
                            required
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                        />
                    </div>
                </div>

                {/* Aviso si no hay API Key */}
                {!systemSettings.resendApiKey && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>No has configurado tu clave API de Resend en Ajustes. Puedes previsualizar el correo o copiarlo.</span>
                        </div>
                        <span className="text-[9px] uppercase font-bold bg-amber-500/20 px-2 py-0.5 rounded">Modo Vista Previa</span>
                    </div>
                )}

                {/* Tabs de Vista Previa vs Código HTML */}
                <div className="flex items-center justify-between border-b border-foreground/10 pb-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPreviewTab('preview')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                previewTab === 'preview' ? 'bg-tertiary/20 text-tertiary border border-tertiary/30' : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            Vista Previa de Correo
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewTab('html')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                previewTab === 'html' ? 'bg-tertiary/20 text-tertiary border border-tertiary/30' : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            Código HTML
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyHtml}
                        className="flex items-center gap-1 text-[10px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                        <Copy size={12} />
                        <span>Copiar HTML</span>
                    </button>
                </div>

                {/* Contenedor del Preview */}
                <div className="max-h-[380px] overflow-y-auto rounded-2xl border border-foreground/10 bg-[#020617] p-2">
                    {previewTab === 'preview' ? (
                        <iframe
                            title="Email Preview"
                            srcDoc={generatedHtml}
                            className="w-full h-[360px] rounded-xl border-0 bg-transparent"
                        />
                    ) : (
                        <pre className="p-3 text-[10px] text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-[360px]">
                            {generatedHtml}
                        </pre>
                    )}
                </div>

                {/* Feedback de Envío */}
                {sendSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle size={16} />
                        <span>¡Correo enviado con éxito a {recipientEmail}!</span>
                    </div>
                )}
                {sendError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>{sendError}</span>
                    </div>
                )}

                {/* Acciones Finales */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-foreground/10">
                    <button
                        type="button"
                        onClick={handleSendWhatsAppFallback}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                        <PhoneCall size={14} />
                        <span>Enviar por WhatsApp</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 border border-foreground/10 hover:bg-foreground/5 text-on-surface-variant rounded-xl text-xs font-bold"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            onClick={handleSendEmail}
                            disabled={isSending || !recipientEmail}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-tertiary to-tertiary hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-tertiary/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                            <span>{isSending ? 'Enviando...' : 'Enviar por Resend'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
