import React from 'react';
import { ArrowLeft, User, Crown, TrendingUp, Landmark, ShieldCheck, AlertTriangle, Clock, MapPin, Building, Briefcase, Info, Copy, Activity, Share2, ExternalLink, MessageCircle, Edit, Save, Smartphone, X } from 'lucide-react';
import { Client, DeclarationStatus, TaxRegime } from '../../../types';
import { safeFormat } from '../../../services/sri';

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
        <div className="relative mb-12">
            {/* Top Action Bar - Minimalist Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 overflow-x-auto no-scrollbar pb-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 px-6 py-3 bg-surface-low/60 backdrop-blur-xl rounded-2xl border-0 text-on-surface-variant font-premium font-bold text-[10px] uppercase tracking-widest hover:bg-surface-lowest hover:text-on-surface transition-all active:scale-95 whitespace-nowrap shadow-sm"
                    >
                        <ArrowLeft size={16} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
                        VOLVER
                    </button>
                    
                    <div className="h-4 w-[1px] bg-on-surface-variant/10 hidden md:block"></div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={onToggleEdit}
                            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all font-premium font-bold text-[10px] uppercase tracking-widest active:scale-95 shadow-sm ${isEditing ? 'bg-primary text-white' : 'bg-surface-low text-on-surface-variant hover:bg-surface-lowest hover:text-on-surface'}`}
                        >
                            {isEditing ? <Save size={16} strokeWidth={2.5} /> : <Edit size={16} strokeWidth={2.5} />}
                            {isEditing ? 'GUARDAR' : 'EDITAR'}
                        </button>

                        <button
                            onClick={onWhatsApp}
                            className="p-3 bg-surface-low text-on-surface-variant rounded-2xl border-0 hover:bg-tertiary/10 hover:text-tertiary transition-all active:scale-95 shadow-sm"
                            title="WhatsApp"
                        >
                            <MessageCircle size={18} strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={onOpenSRI}
                            className="p-3 bg-surface-low text-on-surface-variant rounded-2xl border-0 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 shadow-sm"
                            title="Abrir SRI"
                        >
                            <ExternalLink size={18} strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={onShare}
                            className="p-3 bg-surface-low text-on-surface-variant rounded-2xl border-0 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 shadow-sm"
                            title="Compartir Bóveda"
                        >
                            <Share2 size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group/vip">
                        <div className="relative flex items-center gap-2.5 px-6 py-3 bg-primary/5 text-primary rounded-2xl border-0 shadow-sm ring-1 ring-primary/10">
                            <Crown size={14} fill="currentColor" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-premium">SOCIO VIP EXCLUSIVE</span>
                        </div>
                    </div>
                    
                    <div className="px-6 py-3 bg-surface-low text-on-surface-variant/60 rounded-2xl border-0 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                        RUC <span className="text-primary font-mono ml-2">{client.ruc}</span>
                    </div>
                </div>
            </div>

            {/* Profile Portfolio Card */}
            <div className="bg-surface-lowest rounded-[3rem] p-10 sm:p-12 relative overflow-hidden shadow-architect">
                {/* Subtle Ambient Light */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full -mr-32 -mt-32 blur-[100px] pointer-events-none opacity-50"></div>
                
                <div className="flex flex-col md:flex-row gap-10 sm:gap-14 relative z-10">
                    <div className="flex-shrink-0 flex justify-center">
                        <div className="relative">
                            <div className="w-28 h-28 md:w-40 md:h-40 bg-surface-low rounded-[2.5rem] border-0 flex items-center justify-center text-on-surface-variant shadow-2xl relative overflow-hidden group/avatar">
                                <User size={56} strokeWidth={1.5} className="text-on-surface-variant/40 group-hover:text-primary transition-colors duration-700" />
                            </div>
                            
                            <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border-0 backdrop-blur-md ${isFullyPaid ? 'bg-tertiary text-white shadow-tertiary/20' : 'bg-primary text-white shadow-primary/20 animate-pulse'}`}>
                                {isFullyPaid ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">RAZÓN SOCIAL</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-6 py-4 bg-surface-low border-0 rounded-2xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">IDENTIFICACIÓN RUC</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={editedClient.ruc}
                                            onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                            className="w-full px-6 py-4 bg-surface-low border-0 rounded-2xl text-sm font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none pr-14 transition-all font-mono tracking-tight shadow-sm"
                                        />
                                        {onCopy && (
                                            <button onClick={() => onCopy(editedClient.ruc)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 transition-all">
                                                <Copy size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-surface-low text-on-surface-variant rounded-xl border-0 shadow-sm">
                                        <Landmark size={14} className="text-primary/70" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest font-premium">{client.regime}</span>
                                    </div>
                                    <div className="w-1.5 h-1.5 bg-on-surface-variant/10 rounded-full"></div>
                                    <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em] font-premium">ESTRUCTURA TRIBUTARIA CONSOLIDADA</span>
                                </div>
                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-premium font-bold text-on-surface mb-8 tracking-tight leading-tight max-w-4xl break-words">
                                    {client.name}
                                </h1>
                            </>
                        )}

                        {/* Minimalist KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-10 border-t border-on-surface-variant/5">
                            <div className="space-y-2">
                                <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] font-premium">VENCIMIENTO</p>
                                <p className="text-sm font-bold text-on-surface uppercase tracking-tight">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd MMM, YY') : '-- / -- / --'}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] font-premium">ESTADO FISCAL</p>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${isFullyDeclared ? 'bg-tertiary' : 'bg-primary animate-pulse'}`}></div>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest font-premium ${isFullyDeclared ? 'text-tertiary' : 'text-primary'}`}>
                                        {isFullyDeclared ? 'CUMPLIMIENTO TOTAL' : 'GESTIÓN EN CURSO'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] font-premium">ÚLTIMA GESTIÓN</p>
                                <p className="text-sm font-bold text-on-surface uppercase tracking-tight">
                                    {complianceStats?.iva.lastDate ? safeFormat(complianceStats.iva.lastDate, 'dd/MM/yy') : '--/--/--'}
                                </p>
                            </div>
                            <div className="space-y-2 lg:border-l lg:border-on-surface-variant/5 lg:pl-10">
                                <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] font-premium">PASIVO PENDIENTE</p>
                                <p className={`text-2xl font-bold font-mono tracking-tighter leading-none ${totalDebt > 0 ? 'text-primary' : 'text-tertiary'}`}>
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
