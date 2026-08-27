import React, { useState } from 'react';
import { ArrowLeft, User, ShieldCheck, AlertTriangle, Clock, Copy, Check, Activity, Share2, ExternalLink, MessageCircle, Edit, Save, Smartphone, X, Trash2, FileText, CalendarDays, BadgePercent, FileX, Key } from 'lucide-react';
import { Client, DeclarationStatus, TaxRegime } from '../../../types';
import { safeFormat, getDaysUntilDue, isSriPasswordUpdated } from '../../../services/sri';

interface ClientHeaderProps {
    client: Client;
    onBack: () => void;
    totalDebt: number;
    isFullyPaid: boolean;
    isFullyDeclared: boolean;
    complianceStats: any;
    isEditing?: boolean;
    onToggleEdit?: () => void;
    editedClient?: Client;
    setEditedClient?: (client: Client) => void;
    onCopy?: (text: string) => void;
    onWhatsApp?: () => void;
    onOpenSRI?: () => void;
    onOpenAnulacionSRI?: () => void;
    onShare?: () => void;
    onDelete?: () => void;
    nextDeadline: Date | null;
}

// Botón reutilizable de copiar con feedback visual
const CopyClipButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            type="button"
            className={className || "px-2 py-1 rounded-lg bg-surface-container-low hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all active:scale-95 border border-outline-variant/10 flex items-center gap-1 text-[10px] font-bold"}
            title={copied ? "¡Copiado!" : `Copiar ${label || text}`}
        >
            {copied ? (
                <>
                    <Check size={12} className="text-emerald-500" strokeWidth={3} />
                    <span className="text-[9px] font-bold text-emerald-500">¡Copiado!</span>
                </>
            ) : (
                <>
                    <Copy size={11} strokeWidth={2} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">{label || 'Copiar'}</span>
                </>
            )}
        </button>
    );
};

// Badge visual para el régimen fiscal
const RegimeBadge = ({ regime }: { regime: TaxRegime }) => {
    const config: Record<TaxRegime, { label: string; cls: string; icon: React.ReactNode }> = {
        [TaxRegime.RimpeNegocioPopular]: {
            label: 'RIMPE Negocio Popular',
            cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
            icon: <FileText size={12} strokeWidth={2.5} />
        },
        [TaxRegime.RimpeEmprendedor]: {
            label: 'RIMPE Emprendedor',
            cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-primary/10 dark:text-primary-low dark:border-primary/30',
            icon: <Activity size={12} strokeWidth={2.5} />
        },
        [TaxRegime.General]: {
            label: 'Régimen General',
            cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
            icon: <BadgePercent size={12} strokeWidth={2.5} />
        },
    };
    const { label, cls, icon } = config[regime] || config[TaxRegime.General];
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border ${cls}`}>
            {icon}
            {label}
        </span>
    );
};

export const ClientHeader: React.FC<ClientHeaderProps> = ({
    client,
    onBack,
    totalDebt,
    isFullyPaid,
    isFullyDeclared,
    complianceStats,
    isEditing,
    onToggleEdit,
    editedClient,
    setEditedClient,
    onCopy,
    onWhatsApp,
    onOpenSRI,
    onOpenAnulacionSRI,
    onShare,
    onDelete,
    nextDeadline
}) => {
    return (
        <div className="relative mb-6">
            {/* ── Barra de Acción y Navegación Minimalista ───────────────────── */}
            <div className="flex flex-col gap-3 mb-5 pb-5 border-b border-slate-200/40 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-[#051424]/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/10">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 hover:bg-white/10"
                        >
                            <ArrowLeft size={13} strokeWidth={2.5} />
                            Volver
                        </button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />
                        <button
                            onClick={onToggleEdit}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2B6AFF]/10 text-[#2B6AFF] dark:text-[#bfc6e0] hover:bg-[#2B6AFF] hover:text-white rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95 border border-[#2B6AFF]/20 shadow-sm"
                        >
                            <Edit size={13} strokeWidth={2.5} />
                            Editar Expediente
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {onOpenAnulacionSRI && (
                            <button
                                onClick={onOpenAnulacionSRI}
                                className="px-3 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl border border-rose-500/20 transition-all active:scale-95 flex items-center gap-1.5 font-mono shadow-sm"
                                title="Anular Comprobantes SRI para este cliente (Carga Credenciales)"
                            >
                                <FileX size={15} strokeWidth={2} />
                                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Anulación PDF</span>
                            </button>
                        )}
                        <button
                            onClick={onWhatsApp}
                            className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-[#00A896]/15 hover:text-[#00A896] hover:border-[#00A896]/30 rounded-xl border border-slate-200 dark:border-white/10 transition-all active:scale-95 shadow-sm"
                            title="Abrir WhatsApp Directo"
                        >
                            <MessageCircle size={16} strokeWidth={2} />
                        </button>
                        <button
                            onClick={onOpenSRI}
                            className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-[#2B6AFF]/15 hover:text-[#2B6AFF] hover:border-[#2B6AFF]/30 rounded-xl border border-slate-200 dark:border-white/10 transition-all active:scale-95 shadow-sm"
                            title="Portal SRI en Línea (Carga Credenciales)"
                        >
                            <ExternalLink size={16} strokeWidth={2} />
                        </button>
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                title="Enviar a papelera"
                                className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 rounded-xl border border-slate-200 dark:border-white/10 transition-all active:scale-95 shadow-sm"
                            >
                                <Trash2 size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Barra Express de Credenciales (High-Tech Terminals) ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/70 dark:bg-[#051424]/90 rounded-2xl border border-slate-200/60 dark:border-white/10 text-xs font-mono min-w-0 shadow-sm">
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-[#00A896] shadow-[0_0_6px_#00A896]"></span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">RUC</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <span className="font-mono font-black text-slate-900 dark:text-white tracking-wider text-xs sm:text-sm truncate">{client.ruc}</span>
                            <CopyClipButton text={client.ruc} label="RUC" />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/70 dark:bg-[#051424]/90 rounded-2xl border border-slate-200/60 dark:border-white/10 text-xs font-mono min-w-0 shadow-sm">
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-[#2B6AFF] shadow-[0_0_6px_#2B6AFF]"></span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CLAVE SRI</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{client.sriPassword || '—'}</span>
                            {client.sriPassword && <CopyClipButton text={client.sriPassword} label="SRI" />}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/70 dark:bg-[#051424]/90 rounded-2xl border border-slate-200/60 dark:border-white/10 text-xs font-mono min-w-0 shadow-sm">
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-[#C9A96E] shadow-[0_0_6px_#C9A96E]"></span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CLAVE FIRMA</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{client.electronicSignaturePassword || '—'}</span>
                            {client.electronicSignaturePassword && <CopyClipButton text={client.electronicSignaturePassword} label="Firma" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Executive Hero del Cliente (Stitch Obsidian Surface) ───────────────────────────── */}
            <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 dark:border-t-white/20 relative overflow-hidden shadow-xl">
                {/* Radial ambient glow */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#2B6AFF]/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col items-center gap-5 text-center relative z-10">
                    {/* Avatar con VIP Badge y Estado SRI Live */}
                    <div className="relative">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-[#0b1326] rounded-2xl border border-slate-200 dark:border-white/15 flex items-center justify-center relative overflow-hidden shadow-inner">
                            <User size={36} strokeWidth={1.2} className="text-slate-400 dark:text-slate-400" />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-xl flex items-center justify-center border-2 border-white dark:border-[#051424] shadow-md ${
                            isFullyPaid ? 'bg-[#00A896] text-white shadow-[0_0_8px_#00A896]' : 'bg-amber-500 text-white shadow-[0_0_8px_#f59e0b]'
                        }`} title={isFullyPaid ? "VIP: Al día con honorarios" : "Cobro Pendiente"}>
                            {isFullyPaid ? <ShieldCheck size={14} strokeWidth={2.5} /> : <AlertTriangle size={14} strokeWidth={2.5} />}
                        </div>
                    </div>

                    {/* Datos principales */}
                    <div className="space-y-2.5 w-full">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <RegimeBadge regime={client.regime} />
                            
                            {/* SRI LIVE BADGE */}
                            <span className="px-3 py-1 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 font-mono text-[10px] font-bold text-[#00A896] flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,168,150,0.15)]">
                                <span className="w-1.5 h-1.5 bg-[#00A896] rounded-full animate-pulse shadow-[0_0_6px_#00A896]"></span>
                                SRI LIVE
                            </span>

                            {(client.requiresDeclarations === false || client.clientType === 'solo_plan') && (
                                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-[#2B6AFF]/15 text-[#2B6AFF] dark:text-[#bfc6e0] uppercase tracking-wider border border-[#2B6AFF]/30 flex items-center gap-1.5 shadow-sm">
                                    <Activity size={13} className="text-[#2B6AFF]" />
                                    <span>⚡ Solo Registro Plan & Firma</span>
                                </span>
                            )}
                            
                            {/* Doble Marca: SRI y Facturador Sincronizado */}
                            {(() => {
                                const statusInfo = isSriPasswordUpdated(client);
                                if (!client.sriPassword) return null;
                                return statusInfo.isUpdated ? (
                                    <span title={statusInfo.tooltip} className="px-3 py-1 rounded-full text-[9px] font-mono font-bold bg-[#00A896]/15 text-[#00A896] uppercase tracking-wider border border-[#00A896]/30 flex items-center gap-1 shadow-sm">
                                        <Check size={12} className="text-[#00A896]" strokeWidth={3} />
                                        <span>✓ {statusInfo.label} (Renovada)</span>
                                    </span>
                                ) : (
                                    <span title={statusInfo.tooltip} className="px-3 py-1 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 text-amber-500 uppercase tracking-wider border border-amber-500/30 flex items-center gap-1">
                                        <Key size={12} className="text-amber-500 animate-pulse" />
                                        <span>🔑 Clave SRI Pendiente (*)</span>
                                    </span>
                                );
                            })()}

                            {(client.sriPassword?.endsWith('@') && (client.facturadorConfig?.password?.endsWith('@') || client.facturadorConfig?.programName === 'ECUAFACT')) && (
                                <span className="px-3 py-1 rounded-full text-[9px] font-mono font-bold bg-[#00A896]/15 text-[#00A896] uppercase tracking-wider border border-[#00A896]/30 flex items-center gap-1 shadow-sm">
                                    <Check size={12} className="text-[#00A896]" strokeWidth={3} />
                                    <Check size={12} className="-ml-2 text-[#00A896]" strokeWidth={3} />
                                    <span>✓✓ Facturador Sincronizado</span>
                                </span>
                            )}

                            {client.isCourtesy && (
                                <span className="px-3 py-1 rounded-full text-[9px] font-mono font-bold bg-sky-500/10 text-sky-500 dark:text-sky-400 uppercase tracking-wider border border-sky-500/20">
                                    Cortesía
                                </span>
                            )}

                            {client.signatureFile ? (() => {
                                const expDate = client.signatureExpirationDate ? new Date(client.signatureExpirationDate) : null;
                                const today = new Date();
                                let daysLeft = null;
                                if (expDate) {
                                    expDate.setHours(0, 0, 0, 0);
                                    today.setHours(0, 0, 0, 0);
                                    daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                }
                                const isNearExpiry = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
                                const isExpired = daysLeft !== null && daysLeft <= 0;

                                return (
                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider
                                        ${isExpired
                                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                            : isNearExpiry
                                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                                                : 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full 
                                            ${isExpired
                                                ? 'bg-rose-500'
                                                : isNearExpiry
                                                    ? 'bg-amber-500'
                                                    : 'bg-[#00A896]'
                                            }`} 
                                        />
                                        <span>
                                            Firma: {client.signatureExpirationDate 
                                                ? `Vence ${new Date(client.signatureExpirationDate + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                : 'Cargada'}
                                        </span>
                                    </div>
                                );
                            })() : (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400">
                                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full" />
                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider">Sin Firma</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <h1 className="text-2xl sm:text-3xl font-black font-display text-slate-900 dark:text-white tracking-tight">
                                {client.name}
                            </h1>
                            <CopyClipButton text={client.name} label="Nombre" />
                        </div>

                        {client.tradeName && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{client.tradeName}</p>
                        )}
                    </div>

                    {/* Micro-cuadrícula de Métricas Clave (Stitch Telemetry Cards) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-2 border-t border-slate-200/40 dark:border-white/10 w-full">
                        <div className="p-3.5 bg-slate-100/70 dark:bg-[#0b1326]/60 rounded-2xl text-center border border-slate-200/60 dark:border-white/5">
                            <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Vencimiento</p>
                            <p className="text-xs font-mono font-black text-slate-900 dark:text-white mt-1">
                                {nextDeadline ? safeFormat(nextDeadline, 'dd/MM/yy') : '—'}
                            </p>
                        </div>

                        <div className="p-3.5 bg-slate-100/70 dark:bg-[#0b1326]/60 rounded-2xl text-center border border-slate-200/60 dark:border-white/5">
                            <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Días Restantes</p>
                            <p className={`text-xs font-mono font-black mt-1 ${nextDeadline && getDaysUntilDue(nextDeadline)! < 5 ? 'text-rose-500 font-bold' : 'text-slate-900 dark:text-white'}`}>
                                {nextDeadline ? `${getDaysUntilDue(nextDeadline)}d` : '—'}
                            </p>
                        </div>

                        <div className="p-3.5 bg-slate-100/70 dark:bg-[#0b1326]/60 rounded-2xl text-center border border-slate-200/60 dark:border-white/5">
                            <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Estado Fiscal</p>
                            <div className="flex items-center gap-1.5 justify-center mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${isFullyDeclared ? 'bg-[#00A896] shadow-[0_0_6px_#00A896]' : 'bg-rose-500 animate-pulse shadow-[0_0_6px_#f43f5e]'}`} />
                                <p className={`text-xs font-mono font-black ${isFullyDeclared ? 'text-[#00A896]' : 'text-rose-400'}`}>
                                    {isFullyDeclared ? 'Al Día' : 'Pendiente'}
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-100/70 dark:bg-[#0b1326]/60 rounded-2xl text-center border border-slate-200/60 dark:border-white/5">
                            <p className="text-[9px] font-mono font-bold text-[#2B6AFF] uppercase tracking-widest">Deuda Honorarios</p>
                            <p className={`text-sm font-mono font-black mt-1 ${totalDebt > 0 ? 'text-rose-500' : 'text-[#00A896]'}`}>
                                ${totalDebt.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
