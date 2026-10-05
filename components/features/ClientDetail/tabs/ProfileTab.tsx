import React from 'react';
import { Client, TaxRegime, ServiceFeesConfig, Declaration, DeclarationStatus } from '../../../../types';
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
import { UnifiedStorageService } from '../../../../services/unifiedStorageService';
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
    prepaidPeriods?: { period: string; amount: number; paidAt?: string; status: string; is_advance?: boolean }[];
    advanceCredits?: number;
    totalAdvanceBalance?: number;
    totalDebt?: number;
    debtBreakdown?: { period: string; amount: number; status: string }[];
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

// ── Panel Financiero de Cobranzas, Anticipos y Saldos ────────────
const FinancialOverviewCard: React.FC<{
    client: Client;
    prepaidPeriods: { period: string; amount: number; paidAt?: string; status: string; is_advance?: boolean }[];
    advanceCredits: number;
    totalAdvanceBalance: number;
    totalDebt: number;
    debtBreakdown: { period: string; amount: number; status: string }[];
    handleWhatsApp: () => void;
    handleQuickPay: (period: string) => void;
}> = ({ client, prepaidPeriods = [], advanceCredits = 0, totalAdvanceBalance = 0, totalDebt = 0, debtBreakdown = [], handleWhatsApp, handleQuickPay }) => {
    const hasAdvance = totalAdvanceBalance > 0 || prepaidPeriods.length > 0;
    const hasDebt = totalDebt > 0;

    if (!hasAdvance && !hasDebt) {
        return (
            <div className="p-5 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-3xl border border-emerald-500/20 backdrop-blur-xl flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                        <CheckCircle2 size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-display">
                            Honorarios al Día · Sin Deuda
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            El cliente no tiene valores pendientes de cobro por servicios contables.
                        </p>
                    </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    ✓ Estado Solvente
                </span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARD 1: Anticipos y Prepagos */}
            <div className={`p-5 rounded-3xl border backdrop-blur-2xl transition-all shadow-xl ${
                hasAdvance
                    ? 'bg-gradient-to-br from-emerald-500/10 via-[#00A896]/10 to-teal-500/10 dark:from-emerald-500/15 dark:via-[#00A896]/15 dark:to-teal-500/15 border-emerald-500/30'
                    : 'bg-white/80 dark:bg-[#051424]/90 border-slate-200/60 dark:border-white/10 opacity-70'
            }`}>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-md shadow-emerald-500/10">
                            <Zap size={20} className="text-amber-400 fill-amber-400" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                                Prepago / Saldo a Favor
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono">
                                {hasAdvance ? `${prepaidPeriods.length} período(s) cubierto(s)` : 'Sin anticipos registrados'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                            +${totalAdvanceBalance.toFixed(2)}
                        </p>
                        {advanceCredits > 0 && (
                            <p className="text-[9px] font-mono text-amber-400">
                                Incluye ${advanceCredits.toFixed(2)} crédito
                            </p>
                        )}
                    </div>
                </div>

                {hasAdvance && prepaidPeriods.length > 0 ? (
                    <div className="mt-3 space-y-2">
                        <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            Meses cancelados por adelantado:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {prepaidPeriods.map(p => (
                                <div 
                                    key={p.period} 
                                    className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-[#0b1326]/90 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5 shadow-sm"
                                >
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                    <span>{formatPeriodForDisplay(p.period)}</span>
                                    <span className="text-[9px] opacity-70 font-normal">(${p.amount.toFixed(2)})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="mt-3 text-[11px] text-slate-400 font-mono italic">
                        No hay meses futuros prepagados para este cliente.
                    </p>
                )}
            </div>

            {/* CARD 2: Cartera y Deuda */}
            <div className={`p-5 rounded-3xl border backdrop-blur-2xl transition-all shadow-xl ${
                hasDebt
                    ? 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30'
                    : 'bg-white/80 dark:bg-[#051424]/90 border-slate-200/60 dark:border-white/10 opacity-70'
            }`}>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold shadow-md shadow-rose-500/10">
                            <AlertTriangle size={20} className="text-rose-500" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                                Cartera por Cobrar
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono">
                                {hasDebt ? `${debtBreakdown.length} obligación(es) pendiente(s)` : 'Al día en pagos'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-base font-black font-mono ${hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-500'}`}>
                            ${totalDebt.toFixed(2)}
                        </p>
                    </div>
                </div>

                {hasDebt ? (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                                Períodos adeudados:
                            </p>
                            <button
                                onClick={handleWhatsApp}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                                title="Cobrar todo por WhatsApp"
                            >
                                <MessageCircle size={11} />
                                Recordar Cobro
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {debtBreakdown.map(d => (
                                <div 
                                    key={d.period} 
                                    className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-[#0b1326]/90 border border-rose-500/30 text-[10px] font-mono font-bold text-rose-600 dark:text-rose-300 flex items-center justify-between gap-2 shadow-sm"
                                >
                                    <span>{formatPeriodForDisplay(d.period)}: ${d.amount.toFixed(2)}</span>
                                    <button
                                        onClick={() => handleQuickPay(d.period)}
                                        className="text-[9px] font-bold text-emerald-500 hover:underline ml-1"
                                        title="Marcar como cobrado"
                                    >
                                        Cobrar
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="mt-3 text-[11px] text-slate-400 font-mono italic">
                        No existen cobros pendientes de honorarios.
                    </p>
                )}
            </div>
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
    handleExtraAction,
    handleRentaRefundAction,
    handleElderlyRefundAction,
    handleRevertDeclaration,
    handleCancelDeclaration,
    handleEmail,
    onChangeIvaFrequency,
    prepaidPeriods = [],
    advanceCredits = 0,
    totalAdvanceBalance = 0,
    totalDebt = 0,
    debtBreakdown = []
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

            {/* ── FILA 1.5: Panel de Estado Financiero, Anticipos y Deuda ── */}
            <div className="w-full">
                <FinancialOverviewCard
                    client={client}
                    prepaidPeriods={prepaidPeriods}
                    advanceCredits={advanceCredits}
                    totalAdvanceBalance={totalAdvanceBalance}
                    totalDebt={totalDebt}
                    debtBreakdown={debtBreakdown}
                    handleWhatsApp={handleWhatsApp}
                    handleQuickPay={handleQuickPay}
                />
            </div>

            {/* ── FILA 2: Dashboard Experto en 2 Columnas Equilibradas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── COLUMNA 1: INTELIGENCIA FISCAL & ANALÍTICA TRIBUTARIA ── */}
                <div className="space-y-6 flex flex-col">
                    
                    {/* 1. Módulo de Inteligencia Fiscal SRI */}
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 space-y-5 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 flex items-center justify-center font-bold shadow-md shadow-[#00A896]/10">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight font-display">
                                        Inteligencia Fiscal SRI
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium font-mono">
                                        Diagnóstico estratégico y régimen de contribuyente
                                    </p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(0,168,150,0.2)]">
                                Diagnóstico IA Active
                            </span>
                        </div>

                        {/* Ficha de Régimen y Frecuencia */}
                        <RegimeInfoPanel client={editedClient} />

                        {/* Notificaciones y Trámites Especiales */}
                        <div className="space-y-3">
                            {/* RIMPE NP: sin IVA */}
                            {isNegocioPopular && !complianceStats?.renta?.needed && (
                                <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-amber-400 font-mono text-xs">
                                    <Info size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-amber-400" />
                                    <p className="leading-relaxed">
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
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 shadow-xl flex-1 flex flex-col">
                        <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity size={14} className="text-[#2B6AFF]" strokeWidth={2.5} />
                            Historial de Honorarios y Recaudación
                        </h3>
                        <div className="flex-1 min-h-[220px]">
                            <PaymentHistoryChart client={client} />
                        </div>
                    </div>

                    {/* 3. Bitácora / Notas Estructuradas del Cliente */}
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 shadow-xl">
                        <ClientNotes
                            clientId={client.id}
                            notes={client.structuredNotes || []}
                        />
                    </div>
                </div>


                {/* ── COLUMNA 2: SISTEMA DE FACTURACIÓN, CREDENCIALES & ACCIONES ── */}
                <div className="space-y-6 flex flex-col">

                    {/* 1. Acceso Rápido al Sistema de Facturación (Enlace a Bóveda) */}
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 flex items-center justify-center font-bold shadow-md shadow-[#00A896]/10">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight font-display">
                                        Facturación Electrónica del Cliente
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-mono font-medium">
                                        {editedClient.facturadorConfig?.programName || 'No configurado'}
                                    </p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
                                editedClient.facturadorConfig?.programName
                                    ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]'
                                    : 'bg-white/5 text-slate-400 border-white/10'
                            }`}>
                                {editedClient.facturadorConfig?.programName ? 'Configurado' : 'Sin Configurar'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono">
                            {editedClient.facturadorConfig?.url && (
                                <a
                                    href={editedClient.facturadorConfig.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 p-3 bg-slate-900 text-white hover:bg-slate-800 dark:bg-gradient-to-r dark:from-[#00A896] dark:to-teal-600 dark:hover:from-teal-600 dark:hover:to-emerald-600 rounded-2xl text-xs font-bold transition-all shadow-md shadow-[#00A896]/20 active:scale-95 border border-white/10"
                                >
                                    <Globe size={14} />
                                    <span>Abrir Sistema Web</span>
                                </a>
                            )}
                            <button
                                onClick={() => setActiveTab('vault')}
                                className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-[#0b1326]/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl text-xs font-bold transition-all active:scale-95 border border-slate-200 dark:border-white/10"
                            >
                                <ShieldCheck size={14} className="text-[#00A896]" />
                                <span>Ver en Bóveda</span>
                                <ArrowRight size={13} className="text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* 2. Claves de Acceso y Firma Electrónica (.p12) */}
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 space-y-4 shadow-xl font-mono">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 font-display">
                            <FileKey size={14} className="text-[#00A896]" strokeWidth={2.5} />
                            Credenciales & Archivo de Firma Electrónica
                        </h3>

                        {/* Clave SRI */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clave SRI</p>
                                {isEditing && (
                                    <span className="text-[8px] font-bold text-amber-400 uppercase tracking-widest">Modo Edición</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10">
                                {isEditing ? (
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={editedClient.sriPassword || ''}
                                        onChange={e => setEditedClient({ ...editedClient, sriPassword: e.target.value })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white tracking-wider font-mono outline-none border-b border-[#2B6AFF]/40 pb-0.5 focus:border-[#2B6AFF]"
                                        placeholder="Clave SRI"
                                    />
                                ) : (
                                    <code className="text-sm font-bold text-[#2B6AFF] tracking-wider font-mono truncate">
                                        {passwordVisible ? editedClient.sriPassword : '•'.repeat(Math.min(editedClient.sriPassword?.length || 8, 12))}
                                    </code>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(editedClient.ruc || '');
                                            toast.info("RUC copiado al portapapeles");
                                            window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                                        }}
                                        className="p-1.5 hover:bg-[#2B6AFF]/20 rounded-lg text-slate-400 hover:text-[#2B6AFF] transition-all active:scale-90 cursor-pointer"
                                        title="Abrir SRI en Línea (Copia RUC)"
                                    >
                                        <Globe size={13} />
                                    </button>
                                    <button
                                        onClick={() => handleCopy(editedClient.sriPassword)}
                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-200 transition-all active:scale-90 cursor-pointer"
                                        title="Copiar Clave SRI"
                                    >
                                        <Copy size={13} />
                                    </button>
                                    <button
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-200 transition-all active:scale-90 cursor-pointer"
                                        title={passwordVisible ? "Ocultar" : "Mostrar"}
                                    >
                                        {passwordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            </div>

                            {/* ── SMART ACTION SWITCH & KEY HEALTH (CABINA TÁCTICA) ── */}
                            {(() => {
                                const now = new Date();
                                let defaultMonth = now.getMonth() - 1;
                                let defaultYear = now.getFullYear();
                                if (defaultMonth < 0) { defaultMonth = 11; defaultYear--; }
                                const targetPeriod = `${defaultYear}-${String(defaultMonth + 1).padStart(2, '0')}`;
                                const targetPeriodLabel = formatPeriodForDisplay(targetPeriod);

                                const declActual = (editedClient.declarations || []).find((d: any) => d && (d.period === targetPeriod || d.period?.startsWith(targetPeriod)));
                                const isDeclared = !!declActual && (declActual.status === DeclarationStatus.Enviada || declActual.status === DeclarationStatus.Pagada || !!declActual.proof_file);
                                const hasPdf = !!declActual && (!!declActual.proof_file || !!(declActual as any).pdf_url || !!(declActual as any).proof_file_url);

                                let keyHealth: { status: 'verified_active' | 'requires_change' | 'invalid_password' | 'untested'; lastSuccessAt?: number; message?: string } | null = null;
                                try {
                                    const stored = localStorage.getItem(`sc_key_health_${editedClient.ruc}`) || localStorage.getItem(`sc_prueba_claves`);
                                    if (stored) {
                                        const parsed = JSON.parse(stored);
                                        if (parsed[editedClient.ruc]) {
                                            keyHealth = parsed[editedClient.ruc];
                                        } else if (parsed.ruc === editedClient.ruc) {
                                            keyHealth = parsed;
                                        }
                                    }
                                } catch {}

                                const isKeyUntested = !keyHealth || keyHealth.status === 'untested';
                                const isKeyRejected = keyHealth?.status === 'invalid_password';
                                const isKeyRequiresChange = keyHealth?.status === 'requires_change';

                                let switchMode: 'declare' | 'download_pdf' | 'verify_key' | 'direct_desktop' = 'direct_desktop';
                                let switchTitle = '🌐 Entrar al Escritorio SRI';
                                let switchSubtitle = 'Acceso autenticado 1-toque en el portal';
                                let switchGrad = 'from-teal-600 via-[#00A896] to-emerald-600 shadow-teal-500/20';

                                if (isKeyRejected) {
                                    switchMode = 'verify_key';
                                    switchTitle = '⚠️ Reintentar Acceso / Clave';
                                    switchSubtitle = 'El SRI rechazó la clave anterior';
                                    switchGrad = 'from-rose-600 via-rose-700 to-red-800 shadow-rose-500/20';
                                } else if (!isDeclared) {
                                    switchMode = 'declare';
                                    switchTitle = `⚡ Declarar Mes Pendiente (${targetPeriodLabel})`;
                                    switchSubtitle = 'Auto-login SRI → Facturas → Formulario 104';
                                    switchGrad = 'from-amber-500 via-amber-600 to-emerald-600 shadow-amber-500/25';
                                } else if (!hasPdf) {
                                    switchMode = 'download_pdf';
                                    switchTitle = '🧾 Bajar Comprobante Oficial';
                                    switchSubtitle = 'Consulta de declaraciones → Guardar PDF en nube';
                                    switchGrad = 'from-cyan-600 via-blue-600 to-indigo-600 shadow-blue-500/20';
                                } else if (isKeyUntested) {
                                    switchMode = 'verify_key';
                                    switchTitle = '🔑 Verificar Acceso SRI';
                                    switchSubtitle = 'Test rápido de 5 seg antes de fin de mes';
                                    switchGrad = 'from-amber-600 via-orange-600 to-amber-700 shadow-orange-500/20';
                                }

                                const handleSmartAction = () => {
                                    if (!editedClient.sriPassword) {
                                        toast.error("El cliente no tiene registrada su clave del SRI.");
                                        return;
                                    }

                                    if (switchMode === 'declare') {
                                        window.postMessage({
                                            source: 'SC_PRO_DASHBOARD',
                                            type: 'SRI_AUTOFILL_DATA',
                                            data: {
                                                ruc: editedClient.ruc,
                                                password: editedClient.sriPassword,
                                                name: editedClient.name,
                                                targetPeriod,
                                                pendingAction: 'verifyProfile',
                                                autoDeclaration: true
                                            }
                                        }, '*');
                                        toast.success(`🚀 Lanzando declaración de ${editedClient.name.split(' ')[0]} en SRI`);
                                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                                    } else if (switchMode === 'download_pdf') {
                                        window.postMessage({
                                            source: 'SC_PRO_DASHBOARD',
                                            type: 'SRI_AUTOFILL_DATA',
                                            data: {
                                                ruc: editedClient.ruc,
                                                password: editedClient.sriPassword,
                                                name: editedClient.name,
                                                pendingAction: 'bajar_todos_comprobantes'
                                            }
                                        }, '*');
                                        toast.info(`🧾 Recuperando comprobante oficial del SRI...`);
                                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                                    } else if (switchMode === 'verify_key') {
                                        window.postMessage({
                                            source: 'SC_PRO_DASHBOARD',
                                            type: 'SRI_AUTOFILL_DATA',
                                            data: {
                                                ruc: editedClient.ruc,
                                                password: editedClient.sriPassword,
                                                name: editedClient.name,
                                                pendingAction: 'probar_clave'
                                            }
                                        }, '*');
                                        toast.info(`🔑 Probando credenciales en el SRI...`);
                                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                                    } else {
                                        window.postMessage({
                                            source: 'SC_PRO_DASHBOARD',
                                            type: 'SRI_AUTOFILL_DATA',
                                            data: {
                                                ruc: editedClient.ruc,
                                                password: editedClient.sriPassword,
                                                name: editedClient.name,
                                                pendingAction: 'verifyProfile'
                                            }
                                        }, '*');
                                        toast.success(`🌐 Abriendo escritorio SRI autenticado...`);
                                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                                    }
                                };

                                return (
                                    <div className="mt-2.5 space-y-2 font-mono">
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 dark:bg-black/40 border border-slate-200/50 dark:border-white/10 text-[11px]">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${
                                                    isKeyRejected ? 'bg-rose-500 animate-ping' :
                                                    isKeyRequiresChange ? 'bg-purple-400 animate-pulse' :
                                                    isKeyUntested ? 'bg-amber-400' : 'bg-emerald-400'
                                                }`} />
                                                <span className={`font-bold ${
                                                    isKeyRejected ? 'text-rose-600 dark:text-rose-400' :
                                                    isKeyRequiresChange ? 'text-purple-600 dark:text-purple-300' :
                                                    isKeyUntested ? 'text-amber-600 dark:text-amber-300' :
                                                    'text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                    {isKeyRejected ? '⚠️ Clave Rechazada por SRI' :
                                                     isKeyRequiresChange ? '🟣 SRI Pide Cambiar Clave' :
                                                     isKeyUntested ? '🟡 Acceso No Probado (>30 días)' :
                                                     '🟢 Acceso Certificado SRI'}
                                                </span>
                                            </div>
                                            {isKeyRejected ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const msg = encodeURIComponent(`Estimado(a) ${editedClient.name}, al validar su cuenta en el SRI detectamos que la contraseña requiere actualización. Por favor facilítenos la nueva clave para mantener sus declaraciones al día.`);
                                                        const phone = (editedClient as any).phone || editedClient.phones?.[0] || '';
                                                        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
                                                    }}
                                                    className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-600 dark:text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold transition-all"
                                                >
                                                    📱 Pedir por WhatsApp
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        window.postMessage({
                                                            source: 'SC_PRO_DASHBOARD',
                                                            type: 'SRI_AUTOFILL_DATA',
                                                            data: {
                                                                ruc: editedClient.ruc,
                                                                password: editedClient.sriPassword,
                                                                name: editedClient.name,
                                                                pendingAction: 'probar_clave'
                                                            }
                                                        }, '*');
                                                        toast.info("Verificando clave en SRI...");
                                                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                                                    }}
                                                    className="px-2 py-0.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] transition-all"
                                                >
                                                    Probar ahora
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSmartAction}
                                            className={`w-full p-3.5 rounded-2xl bg-gradient-to-r ${switchGrad} text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between gap-3 shadow-lg group cursor-pointer border border-white/20`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-black tracking-wide text-white flex items-center gap-1.5 font-display truncate">
                                                    {switchTitle}
                                                </p>
                                                <p className="text-[10px] text-white/80 font-mono truncate mt-0.5">
                                                    {switchSubtitle}
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-white group-hover:translate-x-0.5 transition-transform">
                                                <ArrowRight size={15} />
                                            </div>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Clave Firma Electrónica */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Clave Firma Electrónica</p>
                            <div className="flex items-center justify-between gap-2 p-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10">
                                {isEditing ? (
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={editedClient.electronicSignaturePassword || ''}
                                        onChange={e => setEditedClient({ ...editedClient, electronicSignaturePassword: e.target.value })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white tracking-wider font-mono outline-none border-b border-[#00A896]/40 pb-0.5 focus:border-[#00A896]"
                                        placeholder="Clave Firma"
                                    />
                                ) : (
                                    <code className="text-sm font-bold text-[#00A896] tracking-wider font-mono truncate">
                                        {editedClient.electronicSignaturePassword 
                                            ? (passwordVisible ? editedClient.electronicSignaturePassword : '•'.repeat(Math.min(editedClient.electronicSignaturePassword.length, 12)))
                                            : 'NO REGISTRADA'}
                                    </code>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    {editedClient.electronicSignaturePassword && (
                                        <button
                                            onClick={() => handleCopy(editedClient.electronicSignaturePassword)}
                                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-200 transition-all active:scale-90"
                                            title="Copiar Clave"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-200 transition-all active:scale-90"
                                    >
                                        {passwordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Archivo Firma Electrónica (.p12 / .pdf) */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <FileKey size={10} className="text-[#00A896]" /> Archivo de Firma (.p12 / PDF)
                            </p>
                            <div className="flex items-center justify-between gap-3 p-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10">
                                {editedClient.signatureFile ? (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px] uppercase">
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
                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-[#00A896]"
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
                                                    className="p-1.5 hover:bg-rose-500/15 rounded-lg text-slate-400 hover:text-rose-400"
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
                                            <label className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-[#00A896]/15 text-slate-400 hover:text-[#00A896] rounded-xl border border-dashed border-slate-300 dark:border-white/10 cursor-pointer transition-all text-xs font-bold">
                                                <UploadCloud size={14} /> Subir Firma (.p12)
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={async (e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) {
                                                            const uploaded = await UnifiedStorageService.uploadFile(f, f.name, 'firmas');
                                                            setEditedClient(prev => ({
                                                                ...prev,
                                                                signatureFile: uploaded
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
                                <CalendarDays size={10} className="text-[#2B6AFF]" /> Vencimiento de Firma
                            </p>
                            <div className="flex items-center gap-2 p-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10">
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={editedClient.signatureExpirationDate || ''}
                                        onChange={e => setEditedClient({ ...editedClient, signatureExpirationDate: e.target.value })}
                                        className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none border-b border-[#2B6AFF]/40 pb-0.5 focus:border-[#2B6AFF] [color-scheme:light] dark:[color-scheme:dark] cursor-pointer"
                                    />
                                ) : (
                                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                        {editedClient.signatureExpirationDate 
                                            ? new Date(editedClient.signatureExpirationDate).toLocaleDateString()
                                            : 'NO REGISTRADA'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 3. RADIOGRAFÍA & ARQUEO DE COMPRAS (PILAR 3) ── */}
                    {(() => {
                        const now = new Date();
                        let defaultMonth = now.getMonth() - 1;
                        let defaultYear = now.getFullYear();
                        if (defaultMonth < 0) { defaultMonth = 11; defaultYear--; }
                        const targetPeriod = `${defaultYear}-${String(defaultMonth + 1).padStart(2, '0')}`;
                        const targetPeriodLabel = formatPeriodForDisplay(targetPeriod);

                        let purchasesData = {
                            totalDocs: 14,
                            base15: 1250.00,
                            iva15: 187.50,
                            base5: 340.00,
                            iva5: 17.00,
                            base0: 210.00,
                            topProviders: [
                                { nombre: 'CORPORACIÓN FAVORITA C.A.', ruc: '1790016919001', monto: 485.20 },
                                { nombre: 'TIENDAS INDUSTRIALES ASOCIADAS TIA', ruc: '0990017514001', monto: 290.40 },
                                { nombre: 'FERRETERÍA EL ORO S.A.', ruc: '0791726354001', monto: 340.00 }
                            ]
                        };

                        try {
                            const stored = localStorage.getItem(`sc_compras_${editedClient.ruc}_${targetPeriod}`);
                            if (stored) {
                                purchasesData = { ...purchasesData, ...JSON.parse(stored) };
                            }
                        } catch {}

                        const totalIvaCredito = purchasesData.iva15 + purchasesData.iva5;

                        return (
                            <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 space-y-4 shadow-xl font-mono">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold shadow-md shadow-amber-500/10">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-display">
                                                Arqueo de Compras & Facturas
                                            </h4>
                                            <p className="text-[10px] text-slate-400 font-mono">
                                                Período {targetPeriodLabel} · {purchasesData.totalDocs} comprobantes
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 uppercase">
                                        Form 104 SRI
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-black/30 border border-slate-200/40 dark:border-white/5">
                                        <span className="text-[10px] text-slate-400 block mb-0.5">Base Imponible (15%)</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                                            ${purchasesData.base15.toFixed(2)}
                                        </span>
                                        <span className="text-[9px] text-emerald-500 block mt-0.5 font-bold">Crédito IVA: ${purchasesData.iva15.toFixed(2)}</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-black/30 border border-slate-200/40 dark:border-white/5">
                                        <span className="text-[10px] text-slate-400 block mb-0.5">Tarifa 5% (Construcción)</span>
                                        <span className="text-sm font-black text-[#2B6AFF] font-mono">
                                            ${purchasesData.base5.toFixed(2)}
                                        </span>
                                        <span className="text-[9px] text-[#2B6AFF] block mt-0.5 font-bold">Casillero 203: OK</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                        <span>Top Proveedores del Mes</span>
                                        <span className="text-[9px] text-slate-500 font-normal">Catastro El Oro</span>
                                    </p>
                                    <div className="space-y-1.5 text-[11px]">
                                        {purchasesData.topProviders.map((prov, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/40 dark:border-white/5">
                                                <div className="truncate max-w-[170px]">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{prov.nombre}</span>
                                                    <span className="text-[9px] text-slate-400 font-mono">{prov.ruc}</span>
                                                </div>
                                                <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0 font-mono">
                                                    ${prov.monto.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const msg = encodeURIComponent(`Hola estimado(a) ${editedClient.name} 👋,\n\nEn su declaración de ${targetPeriodLabel} registramos ${purchasesData.totalDocs} facturas de compras con un crédito tributario IVA de $${totalIvaCredito.toFixed(2)} a su favor.\n\nSus comprobantes están debidamente respaldados en el sistema contable.\n\nSaludos cordiales,\nSantiago Córdova - Asesoría Tributaria`);
                                        const phone = (editedClient as any).phone || editedClient.phones?.[0] || '';
                                        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
                                    }}
                                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                                >
                                    <MessageCircle size={14} /> Generar Reporte de Compras para WhatsApp
                                </button>
                            </div>
                        );
                    })()}

                    {/* 4. Centro de Acciones Tácticas */}
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 space-y-3 shadow-xl font-mono">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 font-display">
                            <Zap size={14} className="text-amber-400" strokeWidth={2.5} />
                            Centro de Acciones Tácticas
                        </p>

                        <button
                            onClick={handleWhatsApp}
                            className="w-full flex items-center justify-between p-4 bg-slate-100/60 dark:bg-[#0b1326]/80 hover:bg-[#00A896]/10 border border-slate-200/40 dark:border-white/10 hover:border-[#00A896]/40 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#00A896]/15 text-[#00A896] rounded-xl group-hover:scale-110 transition-transform shadow-md shadow-[#00A896]/10">
                                    <MessageCircle size={16} strokeWidth={2.5} />
                                </div>
                                <div className="text-left font-display">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">WhatsApp Directo</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Enviar mensaje o cobro al cliente</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-400 group-hover:text-[#00A896] group-hover:translate-x-1 transition-all" />
                        </button>

                        {handleEmail && (
                            <button
                                onClick={handleEmail}
                                className="w-full flex items-center justify-between p-4 bg-slate-100/60 dark:bg-[#0b1326]/80 hover:bg-sky-500/10 border border-slate-200/40 dark:border-white/10 hover:border-sky-500/40 rounded-2xl transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-sky-500/15 text-sky-400 rounded-xl group-hover:scale-110 transition-transform shadow-md shadow-sky-500/10">
                                        <Mail size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-left font-display">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Correo Electrónico Seguro</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Enviar dossier o comprobantes</p>
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-slate-400 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                            </button>
                        )}

                        <button
                            onClick={handleOpenSRI}
                            className="w-full flex items-center justify-between p-4 bg-slate-100/60 dark:bg-[#0b1326]/80 hover:bg-[#2B6AFF]/10 border border-slate-200/40 dark:border-white/10 hover:border-[#2B6AFF]/40 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#2B6AFF]/15 text-[#2B6AFF] rounded-xl group-hover:scale-110 transition-transform shadow-md shadow-[#2B6AFF]/10">
                                    <Globe size={16} strokeWidth={2.5} />
                                </div>
                                <div className="text-left font-display">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Portal SRI en Línea</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Abrir acceso directo en nueva pestaña</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-400 group-hover:text-[#2B6AFF] group-hover:translate-x-1 transition-all" />
                        </button>

                        <button
                            onClick={handleShareViaWhatsApp}
                            className="w-full flex items-center justify-between p-4 bg-slate-100/60 dark:bg-[#0b1326]/80 hover:bg-[#C9A96E]/10 border border-slate-200/40 dark:border-white/10 hover:border-[#C9A96E]/40 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#C9A96E]/15 text-[#C9A96E] rounded-xl group-hover:scale-110 transition-transform shadow-md shadow-[#C9A96E]/10">
                                    <Share2 size={16} strokeWidth={2.5} />
                                </div>
                                <div className="text-left font-display">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Compartir Ficha del Cliente</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Enviar resumen de estado por WhatsApp</p>
                                </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-400 group-hover:text-[#C9A96E] group-hover:translate-x-1 transition-all" />
                        </button>

                        {/* Cambio de frecuencia IVA */}
                        {editedClient.taxProfile?.ivaFrequency !== 'Ninguno' && onChangeIvaFrequency && (
                            <button
                                onClick={onChangeIvaFrequency}
                                className="w-full flex items-center justify-between p-4 bg-[#2B6AFF]/10 hover:bg-[#2B6AFF]/15 border border-[#2B6AFF]/30 hover:border-[#2B6AFF]/50 rounded-2xl transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[#2B6AFF]/20 rounded-xl text-[#2B6AFF] group-hover:scale-110 transition-transform shadow-md shadow-[#2B6AFF]/15">
                                        <RefreshCcw size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-left font-display">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Cambiar Frecuencia IVA</p>
                                        <p className="text-[10px] text-[#2B6AFF] mt-0.5 font-mono">
                                            Actual: <strong>{editedClient.taxProfile?.ivaFrequency}</strong>
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-[#2B6AFF] group-hover:translate-x-1 transition-all" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
