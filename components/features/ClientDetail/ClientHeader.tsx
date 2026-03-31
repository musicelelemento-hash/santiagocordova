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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-5">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 px-8 py-4 bg-white rounded-2xl border border-slate-200 text-slate-600 font-premium font-black text-[10px] uppercase tracking-[0.25em] hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-sm hover:shadow-md"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" strokeWidth={3} />
                        VOLVER
                    </button>
                    
                    <div className="h-8 w-[1px] bg-slate-100 hidden md:block"></div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onToggleEdit}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl transition-all font-premium font-black text-[10px] uppercase tracking-[0.25em] active:scale-95 border ${isEditing ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm hover:shadow-md'}`}
                        >
                            {isEditing ? <Save size={16} strokeWidth={3} /> : <Edit size={16} strokeWidth={3} />}
                            {isEditing ? 'GUARDAR' : 'EDITAR'}
                        </button>

                        <button
                            onClick={onWhatsApp}
                            className="p-4 bg-white text-slate-600 rounded-2xl border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-all active:scale-95 shadow-sm hover:shadow-md"
                            title="Comunicación vía WhatsApp"
                        >
                            <MessageCircle size={20} strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={onOpenSRI}
                            className="p-4 bg-white text-slate-600 rounded-2xl border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-95 shadow-sm hover:shadow-md"
                            title="Abrir SRI en línea"
                        >
                             <ExternalLink size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-4 px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] shadow-sm">
                        <Smartphone size={16} className="text-blue-600" />
                        ID <span className="text-blue-600 font-mono ml-2 text-sm font-black">{client.ruc}</span>
                    </div>
                    
                    <div className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] font-premium shadow-xl">
                        PERFIL CONTRIBUYENTE
                    </div>
                </div>
            </div>

            {/* Profile Hero Card - THE PRISTINE CORE */}
            <div className="bg-white rounded-[4rem] p-10 sm:p-20 relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] border border-slate-100 group">
                {/* Refined Ambient Depth */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-50/50 rounded-full blur-[120px] pointer-events-none group-hover:bg-blue-100/50 transition-all duration-1000 translate-x-1/4 -translate-y-1/4"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-50/50 rounded-full blur-[120px] pointer-events-none group-hover:bg-emerald-100/50 transition-all duration-1000 -translate-x-1/4 translate-y-1/4"></div>
                
                <div className="flex flex-col lg:flex-row gap-12 sm:gap-20 relative z-10 items-center lg:items-start text-center lg:text-left">
                    <div className="flex-shrink-0">
                        <div className="relative group/avatar">
                            {/* Layered Pristine Avatar Frame */}
                            <div className="w-48 h-48 md:w-64 md:h-64 bg-white rounded-[3.5rem] border border-slate-100 p-4 shadow-sm transition-all duration-700 group-hover/avatar:shadow-xl group-hover/avatar:scale-[1.02] flex items-center justify-center relative overflow-hidden">
                                <div className="w-full h-full bg-slate-50 rounded-[2.5rem] flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 to-transparent"></div>
                                    <User size={100} strokeWidth={1} className="text-slate-200 group-hover/avatar:text-blue-200 group-hover/avatar:scale-110 transition-all duration-1000" />
                                </div>
                                
                                {/* Orbital Tech Line */}
                                <div className="absolute inset-0 border-2 border-dashed border-blue-100/30 rounded-[3.5rem] animate-[spin_40s_linear_infinite]"></div>
                            </div>
                            
                            {/* Vital Status Indicator */}
                            <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl border-4 border-white transition-all duration-700 ${isFullyPaid ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'}`}>
                                {isFullyPaid ? <ShieldCheck size={40} strokeWidth={1.5} /> : <AlertTriangle size={40} strokeWidth={1.5} />}
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
                                    <div className="px-5 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-black uppercase tracking-widest font-premium">
                                        {client.regime}
                                    </div>
                                    <div className="w-2 h-2 bg-slate-200 rounded-full"></div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-premium">OPERACIÓN ACTIVA</span>
                                    </div>
                                </div>
                                <h1 className="text-4xl sm:text-6xl md:text-7xl font-premium font-black text-slate-900 tracking-tight leading-[1.05] break-words uppercase">
                                    {client.name}
                                </h1>
                                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] font-premium mt-2">CONTABILIDAD ESTRATÉGICA • SANTIAGO CORDOVA</p>
                            </div>
                        )}

                        {/* Tactical Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 pt-12 mt-12 border-t border-slate-100">
                            <div className="space-y-2 group/item">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium group-hover:text-blue-600 transition-colors">VENCIMIENTO</p>
                                <p className="text-lg sm:text-xl font-black text-slate-900 font-premium">
                                    {nextDeadline ? safeFormat(nextDeadline, 'dd MMM, yy') : 'N/A'}
                                </p>
                            </div>
                            <div className="space-y-2 group/item">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium group-hover:text-blue-600 transition-colors">DÍAS RESTANTES</p>
                                <p className={`text-lg sm:text-xl font-black font-premium ${nextDeadline && getDaysUntilDue(nextDeadline) < 5 ? 'text-rose-500' : 'text-slate-900'}`}>
                                    {nextDeadline ? `${getDaysUntilDue(nextDeadline)} DÍAS` : '--'}
                                </p>
                            </div>
                            <div className="space-y-2 group/item">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium group-hover:text-blue-600 transition-colors">ESTADO FISCAL</p>
                                <div className="flex items-center gap-2 justify-center lg:justify-start">
                                    <div className={`w-3 h-3 rounded-full ${isFullyDeclared ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                    <p className="text-lg font-black text-slate-900 font-premium uppercase tracking-tighter">
                                        {isFullyDeclared ? 'AL DÍA' : 'PENDIENTE'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2 lg:pl-10 lg:border-l lg:border-slate-100">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest font-premium">DEUDA TOTAL</p>
                                <p className={`text-3xl sm:text-5xl font-black font-premium tracking-tighter ${totalDebt > 0 ? 'text-blue-600' : 'text-slate-100'}`}>
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
