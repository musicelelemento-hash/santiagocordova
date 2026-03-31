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
            {/* Top Action Bar - Dynamic & Precise */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 px-6 py-3 bg-surface-low rounded-2xl border border-white/5 text-on-surface-variant font-premium font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-surface-lowest hover:text-on-surface transition-all active:scale-95 shadow-architect"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" strokeWidth={2.5} />
                        BACK
                    </button>
                    
                    <div className="h-6 w-[1px] bg-white/5 hidden md:block"></div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={onToggleEdit}
                            className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl transition-all font-premium font-bold text-[10px] uppercase tracking-[0.2em] active:scale-95 border ${isEditing ? 'bg-primary border-primary text-white glow-azure' : 'bg-surface-low border-white/5 text-on-surface-variant hover:bg-surface-lowest hover:text-on-surface shadow-architect'}`}
                        >
                            {isEditing ? <Save size={16} strokeWidth={2.5} /> : <Edit size={16} strokeWidth={2.5} />}
                            {isEditing ? 'SAVE' : 'EDIT'}
                        </button>

                        <button
                            onClick={onWhatsApp}
                            className="p-3 bg-surface-low text-on-surface-variant rounded-2xl border border-white/5 hover:bg-surface-lowest hover:text-primary transition-all active:scale-95 shadow-architect"
                        >
                            <MessageCircle size={18} strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={onOpenSRI}
                            className="p-3 bg-surface-low text-on-surface-variant rounded-2xl border border-white/5 hover:bg-surface-lowest hover:text-primary transition-all active:scale-95 shadow-architect"
                        >
                             <ExternalLink size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 px-6 py-3 bg-surface-low border border-white/5 text-on-surface-variant/80 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-architect">
                        <Smartphone size={14} className="text-primary/60" />
                        ID <span className="text-primary font-mono ml-2 text-xs">{client.ruc}</span>
                    </div>
                    
                    <div className="px-6 py-3 bg-indigo-500/10 text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] font-premium shadow-architect glow-azure">
                        ELITE ASSET
                    </div>
                </div>
            </div>

            {/* Profile Portfolio Card - THE OBSIDIAN HERO */}
            <div className="bg-surface-lowest rounded-[3rem] p-8 sm:p-14 relative overflow-hidden shadow-2xl border border-white/5 group">
                {/* Cinematic Ambient Lighting */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/30 transition-all duration-1000"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-tertiary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-tertiary/20 transition-all duration-1000"></div>
                
                <div className="flex flex-col lg:flex-row gap-10 sm:gap-16 relative z-10 items-center lg:items-start text-center lg:text-left">
                    <div className="flex-shrink-0">
                        <div className="relative">
                            {/* Holographic Avatar Frame */}
                            <div className="w-40 h-40 md:w-52 md:h-52 bg-surface-lowest rounded-[3rem] border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl group/avatar">
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-30"></div>
                                
                                {/* Animated Tech Ring */}
                                <div className="absolute inset-4 border border-primary/5 rounded-full animate-[spin_15s_linear_infinite]">
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary/40 rounded-full blur-[1px]"></div>
                                </div>
                                
                                <User size={80} strokeWidth={0.5} className="text-primary/40 group-hover:scale-105 transition-transform duration-1000 group-hover:text-primary/60" />
                                
                                {/* Scan Line Effect */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-1/2 w-full animate-scan pointer-events-none opacity-40"></div>
                            </div>
                            
                            {/* Vital Status Badge */}
                            <div className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl border border-white/10 backdrop-blur-3xl transition-all duration-700 ${isFullyPaid ? 'bg-tertiary/10 text-tertiary glow-emerald' : 'bg-primary/10 text-primary animate-heartbeat glow-azure'}`}>
                                {isFullyPaid ? <ShieldCheck size={32} strokeWidth={1.5} /> : <AlertTriangle size={32} strokeWidth={1.5} />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col justify-center min-w-0 w-full">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] font-premium">NOMINACIÓN FISCAL</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-6 py-4 bg-surface rounded-xl border border-white/10 text-on-surface focus:border-primary/50 outline-none transition-all font-premium font-bold"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] font-premium">IDENTIFICADOR RUC</label>
                                    <input
                                        type="text"
                                        value={editedClient.ruc}
                                        onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                        className="w-full px-6 py-4 bg-surface rounded-xl border border-white/10 text-primary focus:border-primary/50 outline-none transition-all font-mono font-bold tracking-widest"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                                    <div className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest font-premium">
                                        {client.regime}
                                    </div>
                                    <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                                    <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-[0.3em] font-premium">OPERACIÓN ACTIVA</span>
                                </div>
                                <h1 className="text-3xl sm:text-5xl md:text-6xl font-premium font-black text-on-surface tracking-tight leading-[1.05] break-words uppercase">
                                    {client.name}
                                </h1>
                                <p className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-[0.4em] font-premium">SANTIAGO CORDOVA • PLATINUM MANAGEMENT</p>
                            </div>
                        )}

                        {/* High-Density Info Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 mt-10 border-t border-white/5">
                            <div className="space-y-1 group/item">
                                <p className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest font-premium group-hover:text-primary/60 transition-colors">VENCIMIENTO</p>
                                <p className="text-sm sm:text-base font-black text-on-surface font-premium">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd MMM, yy') : 'N/A'}
                                </p>
                            </div>
                            <div className="space-y-1 group/item">
                                <p className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest font-premium group-hover:text-primary/60 transition-colors">DÍAS RESTANTES</p>
                                <p className={`text-sm sm:text-base font-black font-premium ${nextDeadline && getDaysUntilDue(nextDeadline) < 5 ? 'text-primary' : 'text-on-surface'}`}>
                                    {nextDeadline ? `${getDaysUntilDue(nextDeadline)} DÍAS` : '--'}
                                </p>
                            </div>
                            <div className="space-y-1 group/item">
                                <p className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest font-premium group-hover:text-primary/60 transition-colors">CUMPLIMIENTO</p>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isFullyDeclared ? 'bg-tertiary glow-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-primary animate-pulse glow-azure shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}></div>
                                    <p className="text-sm font-black text-on-surface font-premium uppercase">
                                        {isFullyDeclared ? 'AL DÍA' : 'PENDIENTE'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1 lg:pl-10 lg:border-l lg:border-white/5">
                                <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest font-premium">HONORARIOS</p>
                                <p className={`text-2xl sm:text-4xl font-black font-premium tracking-tighter ${totalDebt > 0 ? 'text-primary drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'text-on-surface/10'}`}>
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
