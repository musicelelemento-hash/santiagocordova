import React from 'react';
import { Client, TaxRegime, ServiceFeesConfig, Declaration } from '../../../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../../../../services/sri';
import { getClientServiceFee } from '../../../../services/clientService';
import {
    ShieldCheck, AlertTriangle, DollarSign, Eye, EyeOff, Globe, Copy,
    Share2, MessageCircle, Settings, Activity, FileText, CalendarDays,
    BadgePercent, CheckCircle2, Clock, ArrowRight, Zap, Info, RefreshCcw,
    FileKey, Download, Trash2, UploadCloud
} from 'lucide-react';
import { TaxObligationCard } from '../TaxObligationCard';
import { PaymentHistoryChart } from '../PaymentHistoryChart';
import { ClientNotes } from '../ClientNotes';
import { FacturadorCard } from '../FacturadorCard';
import { useToast } from '../../../../context/ToastContext';
import { fileToBase64 } from '../../../../services/pdfExtraction';

interface ProfileTabProps {
    client: Client;
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    isEditing: boolean;
    isFullyAlDia: boolean;
    complianceStats: any;
    serviceFees: ServiceFeesConfig;
    setConfirmation: (conf: { action: 'declare' | 'pay'; period: string } | null) => void;
    handleQuickPay: (period: string) => void;
    setUploadingTarget: (target: { type: string; period?: string } | null) => void;
    proofInputRef: React.RefObject<HTMLInputElement>;
    setActiveTab: (tab: 'profile' | 'history' | 'vault' | 'settings') => void;
    handleWhatsApp: () => void;
    handleOpenSRI: () => void;
    handleShareViaWhatsApp: () => void;
    passwordVisible: boolean;
    setPasswordVisible: (visible: boolean) => void;
    handleExtraAction: (type: 'renta' | 'anexo' | 'devolucion', action: 'declare' | 'pay') => void;
    handleRentaRefundAction: (action: any) => void;
    handleElderlyRefundAction: (action: any) => void;
    handleRevertDeclaration: (period: string) => void;
    handleCancelDeclaration: (period: string) => void;
    onChangeIvaFrequency?: () => void;
}

// ── Badge de régimen con su descripción ─────────────────────────
const RegimeInfoPanel = ({ client }: { client: Client }) => {
    const isNegocioPopular = client.regime === TaxRegime.RimpeNegocioPopular;
    const isEmprendedor = client.regime === TaxRegime.RimpeEmprendedor;
    const isGeneral = client.regime === TaxRegime.General;
    const freq = client.taxProfile?.ivaFrequency || 'Mensual';

    let icon = <BadgePercent size={18} strokeWidth={1.5} />;
    let title = 'Régimen General';
    let description = `Declaración IVA ${freq} · Renta anual si supera $14,000`;
    let chipCls = 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300';

    if (isNegocioPopular) {
        icon = <FileText size={18} strokeWidth={1.5} />;
        title = 'RIMPE Negocio Popular';
        description = 'Una sola declaración anual · Impuesto a la Renta RIMPE · Sin IVA';
        chipCls = 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
    } else if (isEmprendedor) {
        icon = <Activity size={18} strokeWidth={1.5} />;
        title = 'RIMPE Emprendedor';
        description = 'Declaración semestral · Impuesto a la Renta anual';
        chipCls = 'bg-blue-50 text-blue-700 dark:bg-primary/10 dark:text-primary-low';
    }

    return (
        <div className={`flex items-start gap-4 px-5 py-4 rounded-2xl border border-slate-100 dark:border-white/10 ${chipCls} bg-opacity-50`}>
            <div className="mt-0.5 flex-shrink-0">{icon}</div>
            <div>
                <p className="text-xs font-bold">{title}</p>
                <p className="text-[11px] opacity-75 mt-0.5 leading-relaxed">{description}</p>
            </div>
        </div>
    );
};

// ── Estado del servicio (pagado / pendiente de cobro) ────────────
const ServicePaymentStatus = ({ isFullyAlDia, complianceStats, client, serviceFees, handleQuickPay, setConfirmation }: any) => {
    const ivaIsPaid = complianceStats?.iva?.is_paid ?? false;
    const rentaIsPaid = complianceStats?.renta?.is_paid ?? false;
    const needsIva = complianceStats?.iva?.needed ?? false;
    const needsRenta = complianceStats?.renta?.needed ?? false;

    const allPaid = (!needsIva || ivaIsPaid) && (!needsRenta || rentaIsPaid);

    return (
        <div className={`rounded-2xl p-5 border flex items-center justify-between gap-4 transition-all ${
            allPaid
                ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20'
                : 'bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/20'
        }`}>
            <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    allPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                    {allPaid ? <CheckCircle2 size={20} strokeWidth={2.5} /> : <Clock size={20} strokeWidth={2} />}
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {allPaid ? 'Servicios al Día' : 'Cobro Pendiente'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {allPaid ? 'Todos los servicios han sido cobrados' : 'Hay servicios declarados sin cobrar'}
                    </p>
                </div>
            </div>
            {!allPaid && needsIva && !ivaIsPaid && complianceStats?.iva?.isDeclared && (
                <button
                    onClick={() => handleQuickPay(complianceStats.iva.period)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all shadow-md"
                >
                    <DollarSign size={14} strokeWidth={2.5} />
                    Cobrar IVA
                </button>
            )}
        </div>
    );
};

export const ProfileTab: React.FC<ProfileTabProps> = ({
    client,
    editedClient,
    setEditedClient,
    isEditing,
    isFullyAlDia,
    complianceStats,
    serviceFees,
    setConfirmation,
    handleQuickPay,
    setUploadingTarget,
    proofInputRef,
    setActiveTab,
    handleWhatsApp,
    handleOpenSRI,
    handleShareViaWhatsApp,
    passwordVisible,
    setPasswordVisible,
    handleRentaRefundAction,
    handleElderlyRefundAction,
    handleRevertDeclaration,
    handleCancelDeclaration,
    onChangeIvaFrequency,
}) => {
    const { toast } = useToast();
    const isNegocioPopular = editedClient.regime === TaxRegime.RimpeNegocioPopular;

    const handleCopy = (text?: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">

            {/* ── TOP ROW: Identity & Service Status (Bento Grid) ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Info del régimen */}
                    <RegimeInfoPanel client={editedClient} />

                    {/* Estado del servicio */}
                    <ServicePaymentStatus
                        isFullyAlDia={isFullyAlDia}
                        complianceStats={complianceStats}
                        client={client}
                        serviceFees={serviceFees}
                        handleQuickPay={handleQuickPay}
                        setConfirmation={setConfirmation}
                    />
            </div>

            {/* ── MIDDLE ROW: Action Core ──────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* ── Column 1: Tax Obligations (Span 2) ── */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Sección: Obligaciones tributarias */}
                    <div className="bg-white dark:bg-surface/30 rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Zap size={13} className="text-primary" strokeWidth={2.5} />
                                Obligaciones Tributarias
                            </h3>
                            <button
                                onClick={() => setActiveTab('history')}
                                className="text-[10px] font-bold text-primary hover:text-primary/70 uppercase tracking-wider flex items-center gap-1 transition-colors"
                            >
                                Ver historial <ArrowRight size={12} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* IVA — Solo si NO es RIMPE Negocio Popular */}
                            {!isNegocioPopular && complianceStats?.iva?.needed && (
                                <TaxObligationCard
                                    type="iva"
                                    title={`IVA ${editedClient.taxProfile?.ivaFrequency === 'Semestral' ? 'Semestral' : 'Mensual'}`}
                                    period={complianceStats.iva.period}
                                    isDeclared={complianceStats.iva.isDeclared}
                                    isPaid={complianceStats.iva.is_paid}
                                    amount={getClientServiceFee(client, serviceFees, complianceStats.iva.period)}
                                    hasProofFile={complianceStats.iva.hasProofFile}
                                    dueDate={getDueDateForPeriod(client, complianceStats.iva.period) || undefined}
                                    onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats.iva.period })}
                                    onPay={() => handleQuickPay(complianceStats.iva.period)}
                                    onRevertDeclaration={() => handleRevertDeclaration(complianceStats.iva.period)}
                                    onCancel={() => handleCancelDeclaration(complianceStats.iva.period)}
                                    onUpload={() => { setUploadingTarget({ type: 'iva', period: complianceStats.iva.period }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* Renta Anual */}
                            {complianceStats?.renta?.needed && (
                                <TaxObligationCard
                                    type="renta"
                                    title={isNegocioPopular ? 'Impuesto a la Renta RIMPE (Anual)' : 'Impuesto a la Renta (Anual)'}
                                    period={complianceStats.renta.period}
                                    isDeclared={complianceStats.renta.isDeclared}
                                    isPaid={complianceStats.renta.is_paid}
                                    amount={editedClient.fee_structure?.annual ?? 10}
                                    hasProofFile={complianceStats.renta.hasProofFile}
                                    dueDate={getDueDateForPeriod(client, complianceStats.renta.period) || undefined}
                                    onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats.renta.period })}
                                    onPay={() => handleQuickPay(complianceStats.renta.period)}
                                    onRevertDeclaration={() => handleRevertDeclaration(complianceStats.renta.period)}
                                    onCancel={() => handleCancelDeclaration(complianceStats.renta.period)}
                                    onUpload={() => { setUploadingTarget({ type: 'renta', period: complianceStats.renta.period }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* RIMPE NP: sin IVA, mostrar aviso */}
                            {isNegocioPopular && !complianceStats?.renta?.needed && (
                                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/5 rounded-2xl border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400">
                                    <Info size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                                    <p className="text-xs font-medium leading-relaxed">
                                        RIMPE Negocio Popular no declara IVA. Solo tiene una declaración anual de Impuesto a la Renta RIMPE.
                                        Verifique que el perfil fiscal esté configurado correctamente.
                                    </p>
                                </div>
                            )}

                            {/* Devolución IVA Tercera Edad */}
                            {editedClient.taxProfile?.hasActiveDevolucionIva && (
                                <TaxObligationCard
                                    type="refund"
                                    title="Devolución IVA (Tercera Edad)"
                                    status={editedClient.elderlyDevolucionIvaStatus as any}
                                    resolutionFile={editedClient.elderlyDevolucionIvaResolutionFile}
                                    hasProofFile={!!editedClient.elderlyDevolucionIvaResolutionFile}
                                    onAction={handleElderlyRefundAction}
                                    onUpload={() => { setUploadingTarget({ type: 'devolucionIvaTerceraEdad' }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* Devolución Renta */}
                            {editedClient.taxProfile?.requiresAnnualRenta && editedClient.rentaRefundStatus && (
                                <TaxObligationCard
                                    type="renta_refund"
                                    title="Devolución Impuesto a la Renta"
                                    status={editedClient.rentaRefundStatus as any}
                                    isPaid={editedClient.rentaRefundPaid}
                                    hasProofFile={!!editedClient.rentaRefundResolutionFile}
                                    onAction={handleRentaRefundAction}
                                    onUpload={() => { setUploadingTarget({ type: 'devolucionRenta' }); proofInputRef.current?.click(); }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Column 2: Security & Quick Actions (Span 1) ── */}
                <div className="space-y-5">

                    {/* Claves de Acceso y Seguridad */}
                    <div className="bg-white dark:bg-surface/40 rounded-2xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clave SRI</p>
                                {isEditing && (
                                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Modo Edición</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-surface-low/50 rounded-xl border border-slate-100 dark:border-white/5">
                                {isEditing ? (
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={editedClient.sriPassword || ''}
                                        onChange={e => setEditedClient({ ...editedClient, sriPassword: e.target.value })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white tracking-wider font-mono outline-none border-b border-primary/30 pb-0.5 focus:border-primary"
                                        placeholder="Clave SRI"
                                    />
                                ) : (
                                    <code className="text-sm font-bold text-primary tracking-wider font-mono truncate">
                                        {passwordVisible ? editedClient.sriPassword : '•'.repeat(Math.min(editedClient.sriPassword?.length || 8, 12))}
                                    </code>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => handleCopy(editedClient.sriPassword)}
                                        className="p-1.5 hover:bg-primary/10 rounded-lg text-slate-400 hover:text-primary transition-all active:scale-90"
                                        title="Copiar Clave"
                                    >
                                        <Copy size={13} />
                                    </button>
                                    <button
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-1.5 hover:bg-primary/10 rounded-lg text-slate-400 hover:text-primary transition-all active:scale-90"
                                    >
                                        {passwordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Clave Firma Electrónica */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Clave Firma Electrónica</p>
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-surface-low/50 rounded-xl border border-slate-100 dark:border-white/5">
                                {isEditing ? (
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={editedClient.electronicSignaturePassword || ''}
                                        onChange={e => setEditedClient({ ...editedClient, electronicSignaturePassword: e.target.value })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white tracking-wider font-mono outline-none border-b border-primary/30 pb-0.5 focus:border-primary"
                                        placeholder="Clave Firma"
                                    />
                                ) : (
                                    <code className="text-sm font-bold text-primary tracking-wider font-mono truncate">
                                        {editedClient.electronicSignaturePassword 
                                            ? (passwordVisible ? editedClient.electronicSignaturePassword : '•'.repeat(Math.min(editedClient.electronicSignaturePassword.length, 12)))
                                            : 'NO REGISTRADA'}
                                    </code>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    {editedClient.electronicSignaturePassword && (
                                        <button
                                            onClick={() => handleCopy(editedClient.electronicSignaturePassword)}
                                            className="p-1.5 hover:bg-primary/10 rounded-lg text-slate-400 hover:text-primary transition-all active:scale-90"
                                            title="Copiar Clave"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-1.5 hover:bg-primary/10 rounded-lg text-slate-400 hover:text-primary transition-all active:scale-90"
                                    >
                                        {passwordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Archivo Firma Electrónica (.p12 / .pdf) */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <FileKey size={10} className="text-primary/50" /> Archivo de Firma (.p12 / PDF)
                            </p>
                            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-surface-low/50 rounded-xl border border-slate-100 dark:border-white/5">
                                {editedClient.signatureFile ? (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px] uppercase">
                                            {editedClient.signatureFile.name}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = editedClient.signatureFile?.content || '';
                                                    link.download = editedClient.signatureFile?.name || 'firma.p12';
                                                    link.click();
                                                }}
                                                className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                title="Descargar Firma"
                                            >
                                                <Download size={13} />
                                            </button>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditedClient(prev => {
                                                        const updated = { ...prev };
                                                        delete updated.signatureFile;
                                                        return updated;
                                                    })}
                                                    className="p-1 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-200"
                                                    title="Eliminar Firma"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        {isEditing ? (
                                            <label className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-slate-100 dark:bg-white/5 hover:bg-primary/10 dark:hover:bg-primary/20 text-slate-400 hover:text-primary rounded-lg border border-dashed border-slate-300 dark:border-white/10 cursor-pointer transition-all text-xs font-bold">
                                                <UploadCloud size={13} /> Subir Firma
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={async (e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) {
                                                            const content = await fileToBase64(f);
                                                            setEditedClient(prev => ({
                                                                ...prev,
                                                                signatureFile: {
                                                                    name: f.name,
                                                                    type: 'pdf',
                                                                    size: f.size,
                                                                    lastModified: f.lastModified,
                                                                    content
                                                                }
                                                            }));
                                                        }
                                                    }}
                                                />
                                            </label>
                                        ) : (
                                            <span className="text-[10px] font-mono font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest italic opacity-50">NO_ENTRY</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fecha de Vencimiento de la Firma */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <CalendarDays size={10} className="text-primary/50" /> Vencimiento de Firma
                            </p>
                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-surface-low/50 rounded-xl border border-slate-100 dark:border-white/5">
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={editedClient.signatureExpirationDate || ''}
                                        onChange={e => setEditedClient({ ...editedClient, signatureExpirationDate: e.target.value })}
                                        className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none border-b border-primary/30 pb-0.5 focus:border-primary [color-scheme:light] dark:[color-scheme:dark] cursor-pointer"
                                    />
                                ) : (
                                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {editedClient.signatureExpirationDate 
                                            ? new Date(editedClient.signatureExpirationDate).toLocaleDateString()
                                            : 'NO REGISTRADA'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={handleOpenSRI}
                                className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-surface-low/40 hover:bg-primary/5 dark:hover:bg-primary/10 border border-slate-100 dark:border-white/5 hover:border-primary/20 rounded-xl transition-all group active:scale-95"
                            >
                                <Globe size={18} className="text-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-primary uppercase tracking-wider">Ingresar SRI</span>
                            </button>
                            <button
                                onClick={handleShareViaWhatsApp}
                                className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-surface-low/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/30 rounded-xl transition-all group active:scale-95"
                            >
                                <Share2 size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 uppercase tracking-wider">Compartir</span>
                            </button>
                        </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="bg-white dark:bg-surface/40 rounded-2xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Acciones</p>

                        <button
                            onClick={handleWhatsApp}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-surface-low/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/30 rounded-xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-500 group-hover:scale-110 transition-transform">
                                    <MessageCircle size={15} strokeWidth={2} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">WhatsApp</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Contactar cliente</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </button>

                        <button
                            onClick={() => setActiveTab('settings')}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-surface-low/40 hover:bg-primary/5 dark:hover:bg-primary/10 border border-slate-100 dark:border-white/5 hover:border-primary/20 rounded-xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110 transition-all">
                                    <Settings size={15} strokeWidth={2} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Configuración Fiscal</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Régimen, tarifas, opciones</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </button>

                        {/* ── Cambio de frecuencia IVA ── */}
                        {editedClient.taxProfile?.ivaFrequency !== 'Ninguno' && onChangeIvaFrequency && (
                            <button
                                onClick={onChangeIvaFrequency}
                                className="w-full flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/40 rounded-xl transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-500 group-hover:scale-110 transition-transform">
                                        <RefreshCcw size={15} strokeWidth={2} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Cambiar Frecuencia IVA</p>
                                        <p className="text-[10px] text-indigo-500/70 dark:text-indigo-400/70 mt-0.5">
                                            Actual: <strong>{editedClient.taxProfile?.ivaFrequency}</strong> · Artesanos / Cambios de régimen
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-indigo-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab('history')}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-surface-low/40 hover:bg-primary/5 dark:hover:bg-primary/10 border border-slate-100 dark:border-white/5 hover:border-primary/20 rounded-xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110 transition-all">
                                    <CalendarDays size={15} strokeWidth={2} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Historial de Declaraciones</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Ver todos los períodos</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>



                    </div>
                </div>

            {/* ── BOTTOM ROW: Analytics & Facturador ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de honorarios */}
                <div className="bg-white dark:bg-surface/30 rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-sm h-full flex flex-col">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                        <Activity size={13} className="text-primary" strokeWidth={2.5} />
                        Historial de Honorarios
                    </h3>
                    <div className="flex-1">
                        <PaymentHistoryChart client={client} />
                    </div>
                </div>

                {/* Facturador Electrónico del Cliente */}
                <div className="h-full flex flex-col">
                    <FacturadorCard
                        config={editedClient.facturadorConfig || {}}
                        isEditing={isEditing}
                        onChange={(cfg) => setEditedClient(prev => ({ ...prev, facturadorConfig: cfg }))}
                    />
                </div>
            </div>

            {/* Notas del cliente */}
            <div className="pt-2">
                <ClientNotes
                    clientId={client.id}
                    notes={client.structuredNotes || []}
                />
            </div>
        </div>
    );
};
