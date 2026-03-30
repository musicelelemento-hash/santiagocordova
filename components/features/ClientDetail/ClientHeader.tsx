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
        <div className="relative mb-10">
            {/* Top Action Bar - Minimalist Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 overflow-x-auto no-scrollbar pb-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 px-5 py-2.5 bg-slate-900/40 backdrop-blur-xl rounded-xl border border-white/5 text-slate-400 font-medium text-[10px] uppercase tracking-widest hover:border-primary/50 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Volver
                    </button>
                    
                    <div className="h-6 w-[1px] bg-white/5 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleEdit}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all text-[10px] font-medium uppercase tracking-widest active:scale-95 ${isEditing ? 'bg-primary text-slate-950 border-primary' : 'bg-slate-900/40 text-slate-400 border-white/5 hover:border-white/10'}`}
                        >
                            {isEditing ? <Save size={14} /> : <Edit size={14} />}
                            {isEditing ? 'Guardar' : 'Editar'}
                        </button>

                        <button
                            onClick={onWhatsApp}
                            className="p-2.5 bg-emerald-400/5 text-emerald-400/70 rounded-xl border border-emerald-400/10 hover:bg-emerald-400 hover:text-slate-950 transition-all active:scale-95"
                            title="WhatsApp"
                        >
                            <MessageCircle size={16} />
                        </button>

                        <button
                            onClick={onOpenSRI}
                            className="p-2.5 bg-sky-400/5 text-sky-400/70 rounded-xl border border-sky-400/10 hover:bg-sky-400 hover:text-slate-950 transition-all active:scale-95"
                            title="Abrir SRI"
                        >
                            <ExternalLink size={16} />
                        </button>

                        <button
                            onClick={onShare}
                            className="p-2.5 bg-primary/5 text-primary rounded-xl border border-primary/10 hover:bg-primary hover:text-slate-950 transition-all active:scale-95"
                            title="Compartir Bóveda"
                        >
                            <Share2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group/vip">
                        <div className="relative flex items-center gap-2.5 px-5 py-2.5 bg-slate-900/60 backdrop-blur-xl text-primary rounded-xl border border-primary/20">
                            <Crown size={14} fill="currentColor" />
                            <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Socio Exclusive</span>
                        </div>
                    </div>
                    
                    <div className="px-5 py-2.5 bg-white/5 backdrop-blur-xl text-slate-500 rounded-xl border border-white/5 text-[9px] font-medium uppercase tracking-widest">
                        RUC: <span className="text-primary font-mono ml-1">{client.ruc}</span>
                    </div>
                </div>
            </div>

            {/* Profile Portfolio Card */}
            <div className="glass-card rounded-[2rem] p-8 sm:p-10 relative overflow-hidden group">
                {/* Subtle Ambient Light */}
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row gap-8 sm:gap-12 relative z-10">
                    <div className="flex-shrink-0 flex justify-center">
                        <div className="relative">
                            <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-950 rounded-[2rem] border border-white/5 flex items-center justify-center text-white shadow-2xl relative overflow-hidden group/avatar">
                                <User size={48} className="text-slate-700 group-hover:text-primary transition-colors duration-700" />
                            </div>
                            
                            <div className={`absolute -bottom-1 -right-1 w-10 h-10 rounded-xl flex items-center justify-center shadow-2xl border border-white/5 backdrop-blur-md ${isFullyPaid ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border-rose-400/20 animate-pulse'}`}>
                                {isFullyPaid ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest ml-1">Razón Social</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-slate-950/40 border border-white/5 rounded-xl text-sm font-medium text-white focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest ml-1">RUC / ID</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={editedClient.ruc}
                                            onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-950/40 border border-white/5 rounded-xl text-sm font-medium text-primary focus:ring-1 focus:ring-primary/50 outline-none pr-12 transition-all font-mono tracking-tight"
                                        />
                                        {onCopy && (
                                            <button onClick={() => onCopy(editedClient.ruc)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-600 hover:text-primary transition-all">
                                                <Copy size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg border border-white/5">
                                        <Landmark size={12} />
                                        <span className="text-[8px] font-medium uppercase tracking-widest">{client.regime?.replace('Rimpe', 'R.')}</span>
                                    </div>
                                    <div className="w-1 h-1 bg-slate-800 rounded-full"></div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Consolidado Fiscal</span>
                                </div>
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-slate-200 mb-6 tracking-wide leading-relaxed max-w-3xl break-words">
                                    {client.name}
                                </h1>
                            </>
                        )}

                        {/* Minimalist KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-white/5">
                            <div className="space-y-1">
                                <p className="text-[8px] font-medium text-slate-500 uppercase tracking-widest">Próxima Fecha</p>
                                <p className="text-xs font-medium text-white uppercase tracking-tight">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd MMM, YY') : '-- / -- / --'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[8px] font-medium text-slate-500 uppercase tracking-widest">Estado SRI</p>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isFullyDeclared ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></div>
                                    <p className={`text-[9px] font-medium uppercase tracking-widest ${isFullyDeclared ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {isFullyDeclared ? 'Al Día' : 'Pendiente'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[8px] font-medium text-slate-500 uppercase tracking-widest">Actividad</p>
                                <p className="text-xs font-medium text-white uppercase tracking-tight">
                                    {complianceStats?.iva.lastDate ? safeFormat(complianceStats.iva.lastDate, 'dd/MM/yy') : '--/--/--'}
                                </p>
                            </div>
                            <div className="space-y-1 lg:border-l lg:border-white/5 lg:pl-6">
                                <p className="text-[8px] font-medium text-slate-500 uppercase tracking-widest">Pasivo Pendiente</p>
                                <p className={`text-xl font-medium font-mono tracking-wide ${totalDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
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
