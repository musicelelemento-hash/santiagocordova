import React, { useState } from 'react';
import { ArrowLeft, User, ShieldCheck, AlertTriangle, Clock, Copy, Check, Activity, Share2, ExternalLink, MessageCircle, Edit, Save, Smartphone, X, Trash2, FileText, CalendarDays, BadgePercent } from 'lucide-react';
import { Client, DeclarationStatus, TaxRegime } from '../../../types';
import { safeFormat, getDaysUntilDue } from '../../../services/sri';

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
    onShare,
    onDelete,
    nextDeadline
}) => {
    return (
        <div className="relative mb-6 sm:mb-8">
            {/* ── Barra de acción superior ───────────────────── */}
            <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-outline-variant/10">
                {/* Botones principales */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-1.5 px-3 py-2 bg-surface-container-low/50 backdrop-blur-md rounded-xl border border-outline-variant/10 text-on-surface-variant text-[10px] font-bold uppercase tracking-wider hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-95 animate-in fade-in duration-300"
                    >
                        <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" strokeWidth={2.5} />
                        Volver
                    </button>

                    <button
                        onClick={onToggleEdit}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider active:scale-95 border ${
                            isEditing
                                ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20 animate-pulse'
                                : 'bg-surface-container-low/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                        }`}
                    >
                        {isEditing ? <Save size={12} strokeWidth={2.5} /> : <Edit size={12} strokeWidth={2.5} />}
                        {isEditing ? 'Guardar' : 'Editar'}
                    </button>

                    <button
                        onClick={onWhatsApp}
                        className="p-2 bg-surface-container-low/50 text-on-surface-variant rounded-xl border border-outline-variant/10 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all active:scale-95"
                        title="Abrir WhatsApp"
                    >
                        <MessageCircle size={14} strokeWidth={2} />
                    </button>

                    <button
                        onClick={onOpenSRI}
                        className="p-2 bg-surface-container-low/50 text-on-surface-variant rounded-xl border border-outline-variant/10 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                        title="Acceder al SRI"
                    >
                        <ExternalLink size={14} strokeWidth={2} />
                    </button>
                </div>

                {/* Barra Express de Credenciales: RUC, Clave SRI, Clave Firma */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 flex items-center justify-between px-3.5 py-2 bg-surface-container-highest/30 backdrop-blur-xl border border-outline-variant/20 text-on-surface-variant rounded-xl text-[11px] font-mono font-bold">
                            <span className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[8px] font-sans">RUC / CÉDULA</span>
                            <div className="flex items-center gap-2">
                                <span className="text-on-surface font-black tracking-wider">{client.ruc}</span>
                                <CopyClipButton text={client.ruc} label="RUC" />
                            </div>
                        </div>

                        {onDelete && (
                            <button
                                onClick={onDelete}
                                title="Enviar a papelera"
                                className="p-2.5 bg-surface-container-low/50 text-slate-400 rounded-xl border border-outline-variant/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-500/30 transition-all active:scale-95 group"
                            >
                                <Trash2 size={14} strokeWidth={2} className="group-hover:animate-bounce" />
                            </button>
                        )}
                    </div>

                    {/* Clave SRI & Clave Firma Express */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-low/40 rounded-xl border border-outline-variant/10 text-[10px] font-mono">
                            <span className="text-slate-400 font-sans text-[8px] uppercase tracking-wider font-bold">CLAVE SRI</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {client.sriPassword || '—'}
                                </span>
                                {client.sriPassword && <CopyClipButton text={client.sriPassword} label="SRI" />}
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-low/40 rounded-xl border border-outline-variant/10 text-[10px] font-mono">
                            <span className="text-slate-400 font-sans text-[8px] uppercase tracking-wider font-bold">CLAVE FIRMA</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {client.electronicSignaturePassword || '—'}
                                </span>
                                {client.electronicSignaturePassword && <CopyClipButton text={client.electronicSignaturePassword} label="Firma" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Hero del cliente ───────────────────────────── */}
            <div className="bg-surface-container-lowest/30 backdrop-blur-3xl rounded-[2rem] p-6 relative overflow-hidden border border-outline-variant/10 group shadow-sm">
                {/* Fondo ambiental sutil */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-primary/8 transition-all duration-1000 translate-x-1/4 -translate-y-1/4" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[50px] pointer-events-none -translate-x-1/4 translate-y-1/4" />

                <div className="flex flex-col items-center gap-6 relative z-10 w-full text-center">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        <div className="relative">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-surface-container-low/50 backdrop-blur-md rounded-[2rem] border border-outline-variant/10 flex items-center justify-center relative overflow-hidden shadow-inner">
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent" />
                                <User size={48} strokeWidth={1} className="text-on-surface-variant/20 group-hover:text-primary/30 group-hover:scale-105 transition-all duration-700" />
                            </div>
                            {/* Badge de estado de pago */}
                            <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-xl flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-xl transition-all duration-700 ${
                                isFullyPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                            }`}>
                                {isFullyPaid
                                    ? <ShieldCheck size={18} strokeWidth={1.5} />
                                    : <AlertTriangle size={18} strokeWidth={1.5} />
                                }
                            </div>
                        </div>
                    </div>

                    {/* Datos del cliente */}
                    <div className="flex-grow flex flex-col justify-center min-w-0 w-full">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 gap-4 w-full text-left">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre / Razón Social</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-surface-low/50 rounded-xl border border-slate-100 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all font-bold text-sm shadow-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">RUC / Cédula</label>
                                    <input
                                        type="text"
                                        value={editedClient.ruc}
                                        onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-surface-low/50 rounded-xl border border-slate-100 dark:border-white/10 text-primary font-mono font-bold tracking-widest focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all text-sm shadow-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <RegimeBadge regime={client.regime} />

                                    {/* Badge de Inicio de Obligaciones */}
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border bg-purple-500/10 text-purple-300 dark:text-purple-300 border-purple-500/30 font-mono shadow-sm">
                                        <CalendarDays size={12} strokeWidth={2.5} className="text-purple-400" />
                                        Inicio: {(() => {
                                            const val = client.clientStartPeriod;
                                            if (!val) return 'Automático';
                                            if (val.includes('-S1')) return `${val.split('-')[0]} 1er Semestre (Ene-Jun)`;
                                            if (val.includes('-S2')) return `${val.split('-')[0]} 2do Semestre (Jul-Dic)`;
                                            const parts = val.split('-');
                                            if (parts.length === 2) {
                                                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                                const idx = parseInt(parts[1], 10) - 1;
                                                if (idx >= 0 && idx < 12) return `${months[idx]} ${parts[0]}`;
                                            }
                                            return val;
                                        })()}
                                    </span>

                                    {client.isCourtesy && (
                                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20 uppercase tracking-wider">
                                            Cortesía
                                        </span>
                                    )}
                                    {client.isActive === false && (
                                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-slate-100 text-slate-400 border border-slate-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/10 uppercase tracking-wider">
                                            Inactivo
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Activo</span>
                                    </div>
                                </div>

                                {/* Nombre del Cliente + Botón de Copiar Nombre */}
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <h1 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight leading-snug break-words text-center">
                                        {client.name}
                                    </h1>
                                    <CopyClipButton text={client.name} label="Nombre" />
                                </div>

                                {client.tradeName && (
                                    <p className="text-xs text-slate-400 font-medium text-center">{client.tradeName}</p>
                                )}
                            </div>
                        )}

                        {/* Métricas clave */}
                        <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-outline-variant/10 w-full">
                            <div className="space-y-1 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vencimiento</p>
                                <p className="text-xs font-mono font-black text-on-surface">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd/MM/yy') : '—'}
                                </p>
                            </div>
                            <div className="space-y-1 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Días Restantes</p>
                                <p className={`text-xs font-mono font-black ${nextDeadline && getDaysUntilDue(nextDeadline) < 5 ? 'text-rose-500' : 'text-on-surface'}`}>
                                    {nextDeadline ? `${getDaysUntilDue(nextDeadline)}d` : '—'}
                                </p>
                            </div>
                            <div className="space-y-1 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estado Fiscal</p>
                                <div className="flex items-center gap-1.5 justify-center">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isFullyDeclared ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                                    <p className="text-xs font-bold text-on-surface">
                                        {isFullyDeclared ? 'Al Día' : 'Pendiente'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1 text-center">
                                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Deuda Honorarios</p>
                                <p className={`text-lg font-mono font-black ${totalDebt > 0 ? 'text-primary' : 'text-slate-300 dark:text-slate-600'}`}>
                                    ${totalDebt.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
