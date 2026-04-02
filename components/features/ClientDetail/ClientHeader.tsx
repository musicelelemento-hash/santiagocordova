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
        <div className="relative mb-12 sm:mb-20">
            {/* Top Action Bar - High Contrast & Strategic */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 pb-8 border-b border-outline-variant/10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 px-6 py-3.5 bg-surface-container-low/50 backdrop-blur-md rounded-2xl border border-outline-variant/10 text-on-surface-variant font-mono font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-95 shadow-sm"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" strokeWidth={2.5} />
                        BACK_NAV
                    </button>
                    
                    <div className="h-6 w-[1px] bg-outline-variant/20 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleEdit}
                            className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl transition-all font-mono font-bold text-[10px] uppercase tracking-[0.2em] active:scale-95 border ${isEditing ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-low/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                        >
                            {isEditing ? <Save size={14} strokeWidth={2.5} /> : <Edit size={14} strokeWidth={2.5} />}
                            {isEditing ? 'SAVE_DATA' : 'EDIT_MODE'}
                        </button>

                        <button
                            onClick={onWhatsApp}
                            className="p-3.5 bg-surface-container-low/50 text-on-surface-variant rounded-2xl border border-outline-variant/10 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all active:scale-95 shadow-sm"
                            title="Direct Sync / WhatsApp"
                        >
                            <MessageCircle size={18} strokeWidth={2} />
                        </button>

                        <button
                            onClick={onOpenSRI}
                            className="p-3.5 bg-surface-container-low/50 text-on-surface-variant rounded-2xl border border-outline-variant/10 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 shadow-sm"
                            title="External Access / SRI"
                        >
                             <ExternalLink size={18} strokeWidth={2} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container-highest/30 backdrop-blur-xl border border-outline-variant/20 text-on-surface-variant rounded-xl text-[10px] font-mono font-bold uppercase tracking-[0.2em] shadow-inner">
                        <Smartphone size={12} className="text-primary/60" strokeWidth={2.5} />
                        RUC://<span className="text-on-surface font-black ml-1">{client.ruc}</span>
                    </div>
                    
                    <div className="px-6 py-3.5 bg-on-surface text-surface rounded-2xl text-[9px] font-mono font-black uppercase tracking-[0.4em] shadow-xl">
                        TACTICAL_CORE
                    </div>
                </div>
            </div>

            {/* Profile Hero Card - THE PRISTINE CORE */}
            <div className="bg-surface-container-lowest/30 backdrop-blur-3xl rounded-[4rem] p-10 sm:p-16 relative overflow-hidden shadow-2xl border border-outline-variant/10 group">
                {/* Ambient Tactical Layers */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none group-hover:bg-primary/10 transition-all duration-1000 translate-x-1/4 -translate-y-1/4"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-1000 -translate-x-1/4 translate-y-1/4"></div>
                
                <div className="flex flex-col lg:flex-row gap-12 sm:gap-16 relative z-10 items-center lg:items-start text-center lg:text-left">
                    <div className="flex-shrink-0">
                        <div className="relative group/avatar">
                            {/* Tactical Avatar Frame */}
                            <div className="w-48 h-48 md:w-60 md:h-60 bg-surface-container-low/50 backdrop-blur-md rounded-[3.5rem] border border-outline-variant/10 p-4 shadow-inner transition-all duration-700 group-hover/avatar:shadow-2xl group-hover/avatar:scale-[1.02] flex items-center justify-center relative overflow-hidden">
                                <div className="w-full h-full bg-surface-container-high/30 rounded-[2.8rem] flex items-center justify-center relative overflow-hidden group-hover/avatar:bg-white/5 transition-colors">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
                                    <User size={90} strokeWidth={1} className="text-on-surface-variant/20 group-hover/avatar:text-primary/40 group-hover/avatar:scale-110 transition-all duration-1000" />
                                </div>
                                
                                {/* Orbital Data Ring */}
                                <div className="absolute inset-0 border-2 border-dashed border-primary/10 rounded-[3.5rem] animate-[spin_60s_linear_infinite]"></div>
                            </div>
                            
                            {/* Vital Tactical Badge */}
                            <div className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-[1.8rem] flex items-center justify-center shadow-2xl border-4 border-surface-container-lowest transition-all duration-700 ${isFullyPaid ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'}`}>
                                {isFullyPaid ? <ShieldCheck size={32} strokeWidth={1.5} /> : <AlertTriangle size={32} strokeWidth={1.5} />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col justify-center min-w-0 w-full pt-4">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-premium ml-2">NOMINACIÓN FISCAL</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-8 py-5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 outline-none transition-all font-premium font-black text-xl shadow-sm"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-premium ml-2">IDENTIFICADOR RUC</label>
                                    <input
                                        type="text"
                                        value={editedClient.ruc}
                                        onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                        className="w-full px-8 py-5 bg-slate-50 rounded-2xl border border-slate-100 text-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 outline-none transition-all font-mono font-black tracking-widest text-xl shadow-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                    <div className="px-4 py-1.5 bg-primary/5 text-primary border border-primary/20 rounded-full text-[9px] font-mono font-black uppercase tracking-widest">
                                        SYSTEM_{client.regime.toUpperCase()}
                                    </div>
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-[10px] font-mono font-bold text-on-surface-variant/60 uppercase tracking-[0.2em]">CORE_ENGINE_ACTIVE</span>
                                </div>
                                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-on-surface tracking-tight leading-[1.05] break-words uppercase font-premium">
                                    {client.name}
                                </h1>
                                <p className="text-[10px] font-mono font-bold text-on-surface-variant/40 uppercase tracking-[0.6em] mt-2">ACCOUNTING_STRATEGY // SANTIAGO CORDOVA</p>
                            </div>
                        )}

                        {/* Tactical Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-12 mt-12 border-t border-outline-variant/10">
                            <div className="space-y-1.5 group/item cursor-default">
                                <p className="text-[9px] font-mono font-bold text-on-surface-variant/50 uppercase tracking-[0.2em] group-hover:text-primary transition-colors">DUE_DATE</p>
                                <p className="text-lg font-mono font-black text-on-surface tracking-tighter">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd/MM/yy') : '00/00/00'}
                                </p>
                            </div>
                            <div className="space-y-1.5 group/item cursor-default">
                                <p className="text-[9px] font-mono font-bold text-on-surface-variant/50 uppercase tracking-[0.2em] group-hover:text-primary transition-colors">T_REMAINING</p>
                                <p className={`text-lg font-mono font-black tracking-tighter ${nextDeadline && getDaysUntilDue(nextDeadline) < 5 ? 'text-rose-500' : 'text-on-surface'}`}>
                                    {nextDeadline ? `${getDaysUntilDue(nextDeadline)}d` : '--'}
                                </p>
                            </div>
                            <div className="space-y-1.5 group/item cursor-default">
                                <p className="text-[9px] font-mono font-bold text-on-surface-variant/50 uppercase tracking-[0.2em] group-hover:text-primary transition-colors">COMPLIANCE_STATUS</p>
                                <div className="flex items-center gap-2 justify-center lg:justify-start">
                                    <div className={`w-2 h-2 rounded-full ${isFullyDeclared ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                                    <p className="text-lg font-mono font-black text-on-surface uppercase tracking-tighter">
                                        {isFullyDeclared ? 'VERIFIED' : 'PENDING'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1.5 lg:pl-10 lg:border-l lg:border-outline-variant/10 group/item cursor-default">
                                <p className="text-[9px] font-mono font-bold text-primary uppercase tracking-[0.25em]">TOTAL_DEBT</p>
                                <p className={`text-4xl font-mono font-black tracking-tighter group-hover:scale-105 transition-transform origin-left ${totalDebt > 0 ? 'text-primary' : 'text-on-surface/20'}`}>
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
