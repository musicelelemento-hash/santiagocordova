import { ArrowLeft, User, Crown, TrendingUp, Landmark, ShieldCheck, AlertTriangle, Clock, MapPin, Building, Briefcase, Info, Copy, Activity } from 'lucide-react';
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
    editedClient?: Client;
    setEditedClient?: (client: Client) => void;
    onCopy?: (text: string) => void;
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
    editedClient,
    setEditedClient,
    onCopy,
    nextDeadline
}) => {
    return (
        <div className="relative mb-12">
            {/* Top Action Bar - Command Center Style */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="group flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-950/60 backdrop-blur-md rounded-xl border border-white/10 text-slate-400 font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] hover:border-cyan-500/50 hover:text-cyan-400 transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95 w-fit"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform sm:w-4 sm:h-4" />
                    Protocolo de Salida
                </button>

                <div className="flex items-center gap-3 sm:gap-4">
                    {true && (
                        <div className="relative group/vip">
                            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 blur-md rounded-xl opacity-50 group-hover/vip:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-950/80 backdrop-blur-md text-amber-400 rounded-xl border border-amber-500/30 shadow-lg">
                                <Crown size={14} fill="currentColor" className="animate-pulse" />
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">SOCIO ELITE</span>
                            </div>
                        </div>
                    )}
                    <div className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-950/60 backdrop-blur-md text-cyan-400 rounded-xl border border-cyan-500/30 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] shadow-lg">
                        MODALIDAD: {client.regime?.replace('Rimpe', 'R.')}
                    </div>
                </div>
            </div>

            {/* Profile Tactical Dossier Card */}
            <div className="glass-elite rounded-3xl p-6 sm:p-8 md:p-10 relative overflow-hidden group aurora-premium">
                {/* Tactical HUD accents */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-cyan-500/10 transition-colors duration-1000"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full -ml-32 -mb-32 blur-3xl group-hover:bg-amber-500/10 transition-colors duration-1000"></div>
                
                {/* Internal HUD borders */}
                <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-white/5 rounded-tl-2xl"></div>
                <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-white/5 rounded-br-2xl"></div>

                <div className="flex flex-col md:flex-row gap-6 sm:gap-10 relative z-10">
                    <div className="flex-shrink-0 flex justify-center">
                        <div className="relative">
                            {/* High-End Profile Ring */}
                            <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-500/30 via-transparent to-amber-500/30 rounded-3xl blur-[2px]"></div>
                            <div className="w-24 h-24 md:w-36 md:h-36 bg-slate-950 rounded-3xl border border-white/10 flex items-center justify-center text-white shadow-2xl relative overflow-hidden group/avatar">
                                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/15 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity"></div>
                                <User size={56} className="text-slate-800 group-hover:text-cyan-400 transition-colors duration-700" />
                                
                                {/* Compliance Scan Line Effect */}
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-500/40 blur-[2px] animate-scan opacity-0 group-hover/avatar:opacity-100 hidden sm:block"></div>
                            </div>
                            
                            <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 backdrop-blur-md ${isFullyPaid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse'}`}>
                                {isFullyPaid ? <ShieldCheck size={24} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> : <AlertTriangle size={24} className="drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow">
                        {isEditing && editedClient && setEditedClient ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-premium font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Razón Social</label>
                                    <input
                                        type="text"
                                        value={editedClient.name}
                                        onChange={e => setEditedClient({ ...editedClient, name: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-950/60 border border-white/10 rounded-[1.5rem] text-sm font-black text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-premium font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nombre Comercial</label>
                                    <input
                                        type="text"
                                        value={editedClient.tradeName || ''}
                                        onChange={e => setEditedClient({ ...editedClient, tradeName: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-950/60 border border-white/10 rounded-[1.5rem] text-sm font-black text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all shadow-inner"
                                        placeholder="Nombre del negocio"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-premium font-black text-slate-500 uppercase tracking-[0.2em] ml-1">RUC / ID Personal</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={editedClient.ruc}
                                            onChange={e => setEditedClient({ ...editedClient, ruc: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-950/60 border border-white/10 rounded-[1.5rem] text-sm font-black text-cyan-400 focus:ring-2 focus:ring-cyan-500/50 outline-none pr-14 transition-all shadow-inner font-mono tracking-widest"
                                        />
                                        {onCopy && (
                                            <button 
                                                onClick={() => onCopy(editedClient.ruc)} 
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/20 transition-all"
                                            >
                                                <Copy size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                    <button 
                                        onClick={() => onCopy && onCopy(client.ruc)}
                                        className="group/ruc flex items-center gap-3 px-5 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl hover:border-cyan-500/50 hover:bg-slate-900 transition-all shadow-xl active:scale-95"
                                    >
                                        <span className="text-cyan-400 font-mono text-sm font-black tracking-[0.2em]">{client.ruc}</span>
                                        <Copy size={14} className="text-slate-600 group-hover/ruc:text-cyan-400 transition-colors" />
                                    </button>
                                    <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                                        <Landmark size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">EXPEDIENTE ACTIVO</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/30">
                                        <ShieldCheck size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">SISTEMA SEGURO</span>
                                    </div>
                                </div>
                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-premium font-black text-white mb-6 tracking-tight leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:via-white group-hover:to-cyan-400 transition-all duration-1000 max-w-3xl break-words">
                                    {client.name}
                                </h1>
                            </>
                        )}

                        {/* Tactical KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 pt-6 sm:pt-8 border-t border-white/10">
                            <div className="space-y-1.5 sm:space-y-2">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">PRÓXIMO HIT</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center text-cyan-400 shadow-inner">
                                        <Clock size={14} />
                                    </div>
                                    <p className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
                                        {nextDeadline ? safeFormat(nextDeadline, 'dd MMM, YY') : '-- / -- / --'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">ESTADO FISCAL</p>
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center shadow-inner ${isFullyDeclared ? 'text-emerald-400' : 'text-amber-500'}`}>
                                        <Landmark size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isFullyDeclared ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse'}`}></div>
                                            <p className={`text-[9px] sm:text-xs font-black uppercase tracking-widest ${isFullyDeclared ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {isFullyDeclared ? 'SYNC' : 'PEND'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">OPERATIVIDAD</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center text-purple-400 shadow-inner">
                                        <Activity size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-xs sm:text-sm font-black text-white tracking-tighter">
                                            {complianceStats?.iva.lastDate ? safeFormat(complianceStats.iva.lastDate, 'dd/MM/yy') : '00/00/00'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2 lg:border-l lg:border-white/10 lg:pl-8">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">PASIVO TOTAL</p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-xl sm:text-3xl font-black font-mono leading-none tracking-tighter ${totalDebt > 0 ? 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]'}`}>
                                        ${totalDebt.toFixed(2)}
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

