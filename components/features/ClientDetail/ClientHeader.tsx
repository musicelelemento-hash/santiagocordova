import React from 'react';
import { ArrowLeft, User, ShieldCheck, AlertTriangle, Clock, Copy, Activity, Share2, ExternalLink, MessageCircle, Edit, Save, Smartphone, X, Trash2, FileText, CalendarDays, BadgePercent } from 'lucide-react';
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
        <div className="relative mb-10 sm:mb-16">
            {/* ── Barra de acción superior ───────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-outline-variant/10">
                {/* Izquierda: Navegación + edición */}
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2 px-4 py-2.5 bg-surface-container-low/50 backdrop-blur-md rounded-xl border border-outline-variant/10 text-on-surface-variant text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-95"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" strokeWidth={2.5} />
                        Volver
                    </button>

                    <div className="h-5 w-px bg-outline-variant/20 hidden md:block" />

                    <button
                        onClick={onToggleEdit}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-xs font-bold uppercase tracking-wider active:scale-95 border ${
                            isEditing
                                ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20'
                                : 'bg-surface-container-low/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                        }`}
                    >
                        {isEditing ? <Save size={14} strokeWidth={2.5} /> : <Edit size={14} strokeWidth={2.5} />}
                        {isEditing ? 'Guardar' : 'Editar'}
                    </button>

                    <button
                        onClick={onWhatsApp}
                        className="p-2.5 bg-surface-container-low/50 text-on-surface-variant rounded-xl border border-outline-variant/10 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all active:scale-95"
                        title="Abrir WhatsApp"
                    >
                        <MessageCircle size={16} strokeWidth={2} />
                    </button>

                    <button
                        onClick={onOpenSRI}
                        className="p-2.5 bg-surface-container-low/50 text-on-surface-variant rounded-xl border border-outline-variant/10 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                        title="Acceder al SRI"
                    >
                        <ExternalLink size={16} strokeWidth={2} />
                    </button>
                </div>

                {/* Derecha: RUC + Papelera */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-highest/30 backdrop-blur-xl border border-outline-variant/20 text-on-surface-variant rounded-xl text-xs font-mono font-bold">
                        <Smartphone size={12} className="text-primary/60" strokeWidth={2.5} />
                        <span className="text-on-surface font-black">{client.ruc}</span>
                    </div>

                    {onDelete && (
                        <button
                            onClick={onDelete}
                            title="Enviar a papelera"
                            className="p-2.5 bg-surface-container-low/50 text-slate-400 rounded-xl border border-outline-variant/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-500/30 transition-all active:scale-95 group"
                        >
                            <Trash2 size={16} strokeWidth={2} className="group-hover:animate-bounce" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Hero del cliente ───────────────────────────── */}
            <div className="bg-surface-container-lowest/30 backdrop-blur-3xl rounded-3xl p-8 sm:p-12 relative overflow-hidden border border-outline-variant/10 group shadow-sm">
                {/* Fondo ambiental sutil */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/8 transition-all duration-1000 translate-x-1/4 -translate-y-1/4" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none -translate-x-1/4 translate-y-1/4" />

                <div className="flex flex-col lg:flex-row gap-8 sm:gap-10 relative z-10 items-center lg:items-start text-center lg:text-left">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        <div className="relative">
                            <div className="w-28 h-28 sm:w-36 sm:h-36 bg-surface-container-low/50 backdrop-blur-md rounded-3xl border border-outline-variant/10 flex items-center justify-center relative overflow-hidden shadow-inner">
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent" />
                                <User size={56} strokeWidth={1} className="text-on-surface-variant/20 group-hover:text-primary/30 group-hover:scale-110 transition-all duration-700" />
                            </div>
                            {/* Badge de estado de pago */}
                            <div className={`absolute -bottom-3 -right-3 w-12 h-12 rounded-2xl flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-xl transition-all duration-700 ${
                                isFullyPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                            }`}>
                                {isFullyPaid
                                    ? <ShieldCheck size={22} strokeWidth={1.5} />
                                    : <AlertTriangle size={22} strokeWidth={1.5} />
                                }
                            </div>
                        </div>
                    </div>

                    {/* Datos del cliente */}
                    <div className="flex-grow flex flex-col justify-center min-w-0 w-full">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre / Razón Social</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-5 py-3 bg-slate-50 dark:bg-surface-low/50 rounded-2xl border border-slate-100 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all font-bold text-base shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">RUC / Cédula</label>
                                    <input
                                        type="text"
                                        value={editedClient.ruc}
                                        onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                        className="w-full px-5 py-3 bg-slate-50 dark:bg-surface-low/50 rounded-2xl border border-slate-100 dark:border-white/10 text-primary font-mono font-bold tracking-widest focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all text-base shadow-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                                    <RegimeBadge regime={client.regime} />
                                    {client.isActive === false && (
                                        <span className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/10">
                                            Inactivo
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activo</span>
                                    </div>
                                </div>

                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-on-surface tracking-tight leading-tight break-words">
                                    {client.name}
                                </h1>
                                {client.tradeName && (
                                    <p className="text-sm text-slate-400 font-medium">{client.tradeName}</p>
                                )}
                            </div>
                        )}

                        {/* Métricas clave */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 mt-8 border-t border-outline-variant/10">
                            <div className="space-y-1 text-center lg:text-left">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Próximo Vencimiento</p>
                                <p className="text-base font-mono font-black text-on-surface">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd/MM/yy') : '—'}
                                </p>
                            </div>
                            <div className="space-y-1 text-center lg:text-left">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Días Restantes</p>
                                <p className={`text-base font-mono font-black ${nextDeadline && getDaysUntilDue(nextDeadline) < 5 ? 'text-rose-500' : 'text-on-surface'}`}>
                                    {nextDeadline ? `${getDaysUntilDue(nextDeadline)}d` : '—'}
                                </p>
                            </div>
                            <div className="space-y-1 text-center lg:text-left">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estado Fiscal</p>
                                <div className="flex items-center gap-2 justify-center lg:justify-start">
                                    <div className={`w-2 h-2 rounded-full ${isFullyDeclared ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                                    <p className="text-sm font-bold text-on-surface">
                                        {isFullyDeclared ? 'Al Día' : 'Pendiente'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1 lg:pl-6 lg:border-l lg:border-outline-variant/10 text-center lg:text-left">
                                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Deuda Servicios</p>
                                <p className={`text-3xl font-mono font-black ${totalDebt > 0 ? 'text-primary' : 'text-slate-300 dark:text-slate-600'}`}>
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
