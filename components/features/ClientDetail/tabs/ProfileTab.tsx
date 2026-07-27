import React from 'react';
import { Client, TaxRegime, ServiceFeesConfig, Declaration } from '../../../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../../../../services/sri';
import { getClientServiceFee } from '../../../../services/clientService';
import {
    ShieldCheck, AlertTriangle, DollarSign, Eye, EyeOff, Globe, Copy,
    Share2, MessageCircle, Settings, Activity, FileText, CalendarDays,
    BadgePercent, CheckCircle2, Clock, ArrowRight, Zap, Info, RefreshCcw,
    FileKey, Download, Trash2, UploadCloud, Mail
} from 'lucide-react';
import { TaxObligationCard } from '../TaxObligationCard';
import { ExecutiveObligationsTable } from '../ExecutiveObligationsTable';
import { PaymentHistoryChart } from '../PaymentHistoryChart';
import { ClientNotes } from '../ClientNotes';
import { FacturadorCard } from '../FacturadorCard';
import { useToast } from '../../../../context/ToastContext';
import { fileToBase64 } from '../../../../services/pdfExtraction';
import { downloadStoredFile } from '../../../../services/fileService';

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
    handleEmail?: () => void;
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
    handleEmail,
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

            {/* ── FILA 1: Mesa de Control Tributario y Cobros (Full Width) ── */}
            <div className="w-full">
                <ExecutiveObligationsTable
                    client={client}
                    complianceStats={complianceStats}
                    serviceFees={serviceFees}
                    onDeclare={(period) => setConfirmation({ action: 'declare', period })}
                    onQuickPay={handleQuickPay}
                    onUploadTarget={({ type, period }) => setUploadingTarget({ type, period })}
                    proofInputRef={proofInputRef}
                    onRevertDeclaration={handleRevertDeclaration}
                    onCancelDeclaration={handleCancelDeclaration}
                />
            </div>

            {/* ── FILA 2: Dashboard Experto en 2 Columnas Equilibradas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── COLUMNA 1: INTELIGENCIA FISCAL & ANALÍTICA TRIBUTARIA ── */}
                <div className="space-y-6 flex flex-col">
                    
                    {/* 1. Módulo de Inteligencia Fiscal SRI */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                                    <Activity size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                                        Inteligencia Fiscal SRI
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        Diagnóstico estratégico y régimen de contribuyente
                                    </p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                                Diagnóstico IA Active
                            </span>
                        </div>

                        {/* Ficha de Régimen y Frecuencia */}
                        <RegimeInfoPanel client={editedClient} />

                        {/* Notificaciones y Trámites Especiales */}
                        <div className="space-y-3">
                            {/* RIMPE NP: sin IVA */}
                            {isNegocioPopular && !complianceStats?.renta?.needed && (
                                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/5 rounded-2xl border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400">
                                    <Info size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                                    <p className="text-xs font-medium leading-relaxed">
                                        RIMPE Negocio Popular no declara IVA. Solo tiene una declaración anual de Impuesto a la Renta RIMPE.
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

                    {/* 2. Gráfico de Historial de Honorarios */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 shadow-sm flex-1 flex flex-col">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity size={14} className="text-blue-500" strokeWidth={2.5} />
                            Historial de Honorarios y Recaudación
                        </h3>
                        <div className="flex-1 min-h-[220px]">
                            <PaymentHistoryChart client={client} />
                        </div>
                    </div>

                    {/* 3. Bitácora / Notas Estructuradas del Cliente */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 shadow-sm">
                        <ClientNotes
                            clientId={client.id}
                            notes={client.structuredNotes || []}
                        />
                    </div>
                </div>


                {/* ── COLUMNA 2: SISTEMA DE FACTURACIÓN, CREDENCIALES & ACCIONES ── */}
                <div className="space-y-6 flex flex-col">

                    {/* 1. Acceso Rápido al Sistema de Facturación (Enlace a Bóveda) */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                                        Facturación Electrónica del Cliente
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                        {editedClient.facturadorConfig?.programName || 'No configurado'}
                                    </p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                                editedClient.facturadorConfig?.programName
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                                {editedClient.facturadorConfig?.programName ? 'Configurado' : 'Sin Configurar'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {editedClient.facturadorConfig?.url && (
                                <a
                                    href={editedClient.facturadorConfig.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 p-3 bg-slate-900 text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95"
                                >
                                    <Globe size={14} />
                                    <span>Abrir Sistema Web</span>
                                </a>
                            )}
                            <button
                                onClick={() => setActiveTab('vault')}
                                className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold transition-all active:scale-95"
                            >
                                <ShieldCheck size={14} className="text-teal-500" />
                                <span>Ver en Bóveda</span>
                                <ArrowRight size={13} className="text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* 2. Claves de Acceso y Firma Electrónica (.p12) */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 space-y-4 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <FileKey size={14} className="text-emerald-500" strokeWidth={2.5} />
                            Credenciales & Archivo de Firma Electrónica
                        </h3>

                        {/* Clave SRI */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clave SRI</p>
                                {isEditing && (
                                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Modo Edición</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-white/5">
                                {isEditing ? (
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={editedClient.sriPassword || ''}
                                        onChange={e => setEditedClient({ ...editedClient, sriPassword: e.target.value })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white tracking-wider font-mono outline-none border-b border-primary/30 pb-0.5 focus:border-primary"
                                        placeholder="Clave SRI"
                                    />
                                ) : (
                                    <code className="text-sm font-bold text-blue-600 dark:text-blue-400 tracking-wider font-mono truncate">
                                        {passwordVisible ? editedClient.sriPassword : '•'.repeat(Math.min(editedClient.sriPassword?.length || 8, 12))}
                                    </code>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => handleCopy(editedClient.sriPassword)}
                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90"
                                        title="Copiar Clave"
                                    >
                                        <Copy size={13} />
                                    </button>
                                    <button
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90"
                                    >
                                        {passwordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Clave Firma Electrónica */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Clave Firma Electrónica</p>
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-white/5">
                                {isEditing ? (
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={editedClient.electronicSignaturePassword || ''}
                                        onChange={e => setEditedClient({ ...editedClient, electronicSignaturePassword: e.target.value })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white tracking-wider font-mono outline-none border-b border-primary/30 pb-0.5 focus:border-primary"
                                        placeholder="Clave Firma"
                                    />
                                ) : (
                                    <code className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wider font-mono truncate">
                                        {editedClient.electronicSignaturePassword 
                                            ? (passwordVisible ? editedClient.electronicSignaturePassword : '•'.repeat(Math.min(editedClient.electronicSignaturePassword.length, 12)))
                                            : 'NO REGISTRADA'}
                                    </code>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    {editedClient.electronicSignaturePassword && (
                                        <button
                                            onClick={() => handleCopy(editedClient.electronicSignaturePassword)}
                                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90"
                                            title="Copiar Clave"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90"
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
                            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-white/5">
                                {editedClient.signatureFile ? (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px] uppercase">
                                            {editedClient.signatureFile.name}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (editedClient.signatureFile) {
                                                        downloadStoredFile(editedClient.signatureFile);
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                title="Descargar Firma"
                                            >
                                                <Download size={14} />
                                            </button>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditedClient(prev => {
                                                        const updated = { ...prev };
                                                        delete updated.signatureFile;
                                                        return updated;
                                                    })}
                                                    className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-200"
                                                    title="Eliminar Firma"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        {isEditing ? (
                                            <label className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 dark:bg-white/5 hover:bg-primary/10 dark:hover:bg-primary/20 text-slate-400 hover:text-primary rounded-lg border border-dashed border-slate-300 dark:border-white/10 cursor-pointer transition-all text-xs font-bold">
                                                <UploadCloud size={14} /> Subir Firma (.p12)
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
                                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest italic">SIN REGISTRO ADJUNTO</span>
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
                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-white/5">
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
                    </div>

                    {/* 3. Centro de Acciones Tácticas */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 space-y-3 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" strokeWidth={2.5} />
                            Centro de Acciones Tácticas
                        </p>

                        <button
                            onClick={handleWhatsApp}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-slate-200/40 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/30 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                                    <MessageCircle size={16} strokeWidth={2} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">WhatsApp Directo</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Enviar mensaje o cobro al cliente</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </button>

                        {handleEmail && (
                            <button
                                onClick={handleEmail}
                                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/40 hover:bg-sky-500/5 dark:hover:bg-sky-500/10 border border-slate-200/40 dark:border-white/5 hover:border-sky-200 dark:hover:border-sky-500/30 rounded-2xl transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-sky-50 dark:bg-sky-500/10 rounded-xl text-sky-500 group-hover:scale-110 transition-transform">
                                        <Mail size={16} strokeWidth={2} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Correo Electrónico Seguro</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Enviar dossier o comprobantes</p>
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-slate-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
                            </button>
                        )}

                        <button
                            onClick={handleOpenSRI}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/40 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 border border-slate-200/40 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/30 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
                                    <Globe size={16} strokeWidth={2} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Portal SRI en Línea</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Abrir acceso directo en nueva pestaña</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </button>

                        <button
                            onClick={handleShareViaWhatsApp}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/40 hover:bg-purple-500/5 dark:hover:bg-purple-500/10 border border-slate-200/40 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-500/30 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-500 group-hover:scale-110 transition-transform">
                                    <Share2 size={16} strokeWidth={2} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Compartir Ficha del Cliente</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Enviar resumen de estado por WhatsApp</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                        </button>

                        {/* Cambio de frecuencia IVA */}
                        {editedClient.taxProfile?.ivaFrequency !== 'Ninguno' && onChangeIvaFrequency && (
                            <button
                                onClick={onChangeIvaFrequency}
                                className="w-full flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/40 rounded-2xl transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-500 group-hover:scale-110 transition-transform">
                                        <RefreshCcw size={16} strokeWidth={2} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Cambiar Frecuencia IVA</p>
                                        <p className="text-[10px] text-indigo-500/70 dark:text-indigo-400/70 mt-0.5">
                                            Actual: <strong>{editedClient.taxProfile?.ivaFrequency}</strong>
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-indigo-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
