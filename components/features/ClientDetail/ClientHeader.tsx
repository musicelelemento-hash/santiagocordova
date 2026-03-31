import React from 'react';
import { ArrowLeft, User, Crown, TrendingUp, Landmark, ShieldCheck, AlertTriangle, Clock, MapPin, Building, Briefcase, Info, Copy, Activity, Share2, ExternalLink, MessageCircle, Edit, Save, Smartphone, X } from 'lucide-react';
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
    nextDeadline: Date | null;
}

// Modular Sub-components are styled with the Analytical Architect design system
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
    nextDeadline
}) => {
    return (
        <div className="relative mb-8 sm:mb-16">
            {/* Top Action Bar - Minimalist Navigation following Architectural precision */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8 mb-8 sm:mb-12 overflow-x-auto no-scrollbar pb-2">
                <div className="flex items-center gap-3 sm:gap-5">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2.5 sm:gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-surface-low rounded-2xl border-0 text-on-surface-variant font-premium font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.2em] hover:bg-surface-lowest hover:text-on-surface transition-all active:scale-95 shadow-architect"
                    >
                        <ArrowLeft size={14} className="sm:w-[16px] sm:h-[16px] group-hover:-translate-x-1 transition-transform" strokeWidth={2.5} />
                        VOLVER
                    </button>
                    
                    <div className="h-6 w-[1px] bg-on-surface-variant/10 hidden md:block"></div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={onToggleEdit}
                            className={`flex items-center gap-2.5 sm:gap-3 px-5 py-3 sm:px-6 sm:py-4 rounded-2xl transition-all font-premium font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.2em] active:scale-95 shadow-architect ${isEditing ? 'bg-primary text-white' : 'bg-surface-low text-on-surface-variant hover:bg-surface-lowest hover:text-on-surface'}`}
                        >
                            {isEditing ? <Save size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /> : <Edit size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />}
                            {isEditing ? 'GUARDAR' : 'EDITAR'}
                        </button>

                        <button
                            onClick={onWhatsApp}
                            className="p-3 sm:p-4 bg-surface-low text-on-surface-variant rounded-2xl border-0 hover:bg-surface-lowest hover:text-primary transition-all active:scale-95 shadow-architect"
                            title="WhatsApp"
                        >
                            <MessageCircle size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={onOpenSRI}
                            className="p-3 sm:p-4 bg-surface-low text-on-surface-variant rounded-2xl border-0 hover:bg-surface-lowest hover:text-primary transition-all active:scale-95 shadow-architect"
                            title="Abrir SRI"
                        >
                            <ExternalLink size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={onShare}
                            className="p-3 sm:p-4 bg-surface-low text-on-surface-variant rounded-2xl border-0 hover:bg-surface-lowest hover:text-primary transition-all active:scale-95 shadow-architect"
                            title="Compartir Bóveda"
                        >
                            <Share2 size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2.5} />
                        </button>
                    </div>

                </div>

                <div className="flex items-center gap-3 sm:gap-5">
                    <div className="relative group/vip">
                        {/* VIP Badge with Primary Fixed Tones */}
                        <div className="relative flex items-center gap-2.5 sm:gap-3 px-5 py-3 sm:px-7 sm:py-4 bg-primary-fixed text-on-primary-fixed rounded-2xl border-0 shadow-architect overflow-hidden">
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/vip:opacity-100 transition-opacity"></div>
                            <Crown size={14} className="sm:w-[16px] sm:h-[16px] animate-pulse" fill="currentColor" />
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] font-premium whitespace-nowrap">EXTRACTO VIP</span>
                        </div>
                    </div>
                    
                    {/* Identification Chip with Tonal Background */}
                    <div className="px-5 py-3 sm:px-7 sm:py-4 bg-surface-low text-on-surface-variant/80 rounded-2xl border-0 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] shadow-architect whitespace-nowrap">
                        RUC <span className="text-primary font-mono ml-2 sm:ml-3 text-xs sm:text-sm">{client.ruc}</span>
                    </div>
                </div>
            </div>

            {/* Profile Portfolio Card - THE EDITORIAL HERO */}
            <div className="bg-surface-lowest rounded-[2rem] sm:rounded-[4rem] p-5 sm:p-16 relative overflow-hidden shadow-architect">
                {/* Asymmetric Ambient Accents */}
                <div className="absolute top-0 right-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-primary/5 rounded-full -mr-24 md:-mr-48 -mt-24 md:-mt-48 blur-[80px] md:blur-[120px] pointer-events-none opacity-40"></div>
                <div className="absolute bottom-0 left-0 w-[150px] md:w-[300px] h-[150px] md:h-[300px] bg-tertiary-fixed/10 rounded-full -ml-12 md:-ml-24 -mb-12 md:-mb-24 blur-[40px] md:blur-[80px] pointer-events-none opacity-30"></div>
                
                <div className="flex flex-col lg:flex-row gap-8 sm:gap-16 relative z-10">
                    <div className="flex-shrink-0 flex justify-center sm:justify-start">
                        <div className="relative">
                            {/* Larger Architect Avatar */}
                            <div className="w-28 h-28 sm:w-32 md:w-56 md:h-56 bg-surface-low rounded-[2.5rem] sm:rounded-[3.5rem] border-0 flex items-center justify-center text-on-surface-variant/20 shadow-2xl relative overflow-hidden group/avatar">
                                <div className="absolute inset-0 bg-surface-dim opacity-0 group-hover/avatar:opacity-10 transition-opacity"></div>
                                <User size={48} className="sm:hidden" strokeWidth={1.5} />
                                <User size={88} strokeWidth={1} className="hidden sm:block group-hover:scale-110 transition-transform duration-1000 group-hover:text-primary/40" />
                            </div>
                            
                            {/* Compliance Status Shield */}
                            <div className={`absolute -bottom-2 -right-2 sm:-bottom-4 sm:-right-4 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center shadow-2xl border-0 backdrop-blur-xl ${isFullyPaid ? 'bg-tertiary-fixed text-on-tertiary-fixed shadow-tertiary-fixed/20' : 'bg-primary text-on-primary shadow-primary/20 animate-heartbeat'}`}>
                                {isFullyPaid ? <ShieldCheck size={24} className="sm:hidden" /> : <AlertTriangle size={24} className="sm:hidden" />}
                                {isFullyPaid ? <ShieldCheck size={32} strokeWidth={2} className="hidden sm:block" /> : <AlertTriangle size={32} strokeWidth={2} className="hidden sm:block" />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col justify-center">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.25em] ml-2 font-premium">RAZÓN SOCIAL</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-8 py-5 bg-surface-low border-0 rounded-2xl text-base font-bold text-on-surface focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-architect ring-1 ring-on-surface-variant/5"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.25em] ml-2 font-premium">IDENTIFICACIÓN RUC</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={editedClient.ruc}
                                            onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                            className="w-full px-8 py-5 bg-surface-low border-0 rounded-2xl text-base font-bold text-primary focus:ring-4 focus:ring-primary/10 outline-none pr-16 transition-all font-mono tracking-wider shadow-architect ring-1 ring-on-surface-variant/5"
                                        />
                                        {onCopy && (
                                            <button onClick={() => onCopy(editedClient.ruc)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 transition-all">
                                                <Copy size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 text-center sm:text-left">
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-5">
                                    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-2.5 bg-surface-low text-on-surface-variant rounded-xl border-0 shadow-architect">
                                        <Landmark size={14} className="text-primary sm:w-[16px] sm:h-[16px]" />
                                        <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.2em] font-premium">{client.regime}</span>
                                    </div>
                                    <div className="hidden sm:block w-1 h-1 bg-primary/20 rounded-full"></div>
                                    <span className="text-[9px] sm:text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-[0.2em] sm:tracking-[0.35em] font-premium">ESTRUCTURA TRIBUTARIA CONSOLIDADA</span>
                                </div>
                                <h1 className="text-3xl sm:text-5xl md:text-6xl font-premium font-extrabold text-on-surface tracking-tight leading-[1.1] max-w-5xl break-words pb-4">
                                    {client.name}
                                </h1>
                            </div>
                        )}

                        {/* Minimalist Executive KPI Grid */}
                        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-12 pt-8 sm:pt-14 mt-6 border-t border-on-surface-variant/5">
                            <div className="space-y-2 sm:space-y-3 p-4 sm:p-0 bg-surface-low/50 sm:bg-transparent rounded-2xl">
                                <p className="text-[9px] sm:text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] font-premium">PRÓXIMO VENCIMIENTO</p>
                                <p className="text-lg sm:text-xl font-extrabold text-on-surface tracking-tight uppercase font-premium">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd MMM, yyyy') : '-- / -- / --'}
                                </p>
                                {nextDeadline && (
                                    <div className="flex items-center gap-2">
                                        <Clock size={12} className="text-primary/40" />
                                        <span className="text-[9px] sm:text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] font-premium">{getDaysUntilDue(nextDeadline)} DÍAS RESTANTES</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2 sm:space-y-3 p-4 sm:p-0 bg-surface-low/50 sm:bg-transparent rounded-2xl">
                                <p className="text-[9px] sm:text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] font-premium">ESTADO FISCAL</p>
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full ${isFullyDeclared ? 'bg-tertiary shadow-[0_0_15px_rgba(var(--tertiary-rgb),0.6)]' : 'bg-primary animate-pulse shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)]'}`}></div>
                                    <p className={`text-[11px] sm:text-[13px] font-black uppercase tracking-[0.2em] font-premium ${isFullyDeclared ? 'text-on-surface' : 'text-primary'}`}>
                                        {isFullyDeclared ? 'CUMPLIMIENTO TOTAL' : 'GESTIÓN EN CURSO'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2 sm:space-y-3 p-4 sm:p-0 bg-surface-low/50 sm:bg-transparent rounded-2xl">
                                <p className="text-[9px] sm:text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] font-premium">ÚLTIMA GESTIÓN</p>
                                <p className="text-lg sm:text-xl font-extrabold text-on-surface tracking-tight font-premium">
                                    {complianceStats?.iva.lastDate ? safeFormat(complianceStats.iva.lastDate, 'dd/MM/yy') : '-- / -- / --'}
                                </p>
                            </div>
                            <div className="space-y-2 sm:space-y-3 p-4 sm:p-8 bg-primary/5 sm:bg-transparent border border-primary/10 sm:border-0 rounded-[2rem] sm:border-l sm:border-on-surface-variant/5 sm:pl-16">
                                <p className="text-[9px] sm:text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] font-premium">PASIVO PENDIENTE</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-lg sm:text-xl font-black mb-1 ${totalDebt > 0 ? 'text-primary' : 'text-tertiary'}`}>$</span>
                                    <p className={`text-5xl sm:text-7xl font-extrabold font-premium tracking-tighter leading-none ${totalDebt > 0 ? 'text-primary' : 'text-on-surface-variant/20'}`}>
                                        {totalDebt.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
