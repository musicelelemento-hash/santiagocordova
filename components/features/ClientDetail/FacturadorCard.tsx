import React from 'react';
import * as LucideIcons from 'lucide-react';
import { FacturadorConfig } from '../../../types/client';

interface FacturadorCardProps {
    config?: FacturadorConfig;
    isEditing: boolean;
    onChange: (config: FacturadorConfig) => void;
}

export const FacturadorCard: React.FC<FacturadorCardProps> = ({ config = {}, isEditing, onChange }) => {
    const [passwordVisible, setPasswordVisible] = React.useState(false);

    const handleFieldChange = (field: keyof FacturadorConfig, value: any) => {
        onChange({ ...config, [field]: value });
    };

    return (
        <div className="bg-white dark:bg-surface/40 backdrop-blur-3xl rounded-[3rem] p-10 shadow-architect hover:shadow-2xl relative overflow-hidden group border border-slate-100 dark:border-white/10 transition-all duration-700">
            {/* Architectural Depth - Subtle Gradient Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 dark:bg-primary/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-100/50 dark:group-hover:bg-primary/10 transition-all duration-1000 -mr-32 -mt-32"></div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 relative z-10 gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50/50 dark:bg-primary/10 flex items-center justify-center text-blue-600 dark:text-primary-low group-hover:scale-110 transition-transform border border-blue-100 dark:border-primary/20">
                            <LucideIcons.Sparkles className="animate-pulse" size={24} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tighter uppercase font-premium">
                            0FACTURADOR_v3.1
                        </h3>
                    </div>
                    <p className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-4">ELECTRONIC_INFRASTRUCTURE</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {config.url && (
                        <a 
                            href={config.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-6 py-3 bg-slate-900 dark:bg-primary text-white hover:bg-slate-800 dark:hover:bg-primary-low rounded-2xl transition-all shadow-sm group/link text-[9px] font-mono font-bold uppercase tracking-widest"
                        >
                            <span>CMD_OPEN</span>
                            <LucideIcons.ExternalLink size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </a>
                    )}
                    <div className="hidden sm:flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <LucideIcons.ShieldCheck size={14} strokeWidth={3} />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest">VALIDATED_SYS</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {/* Programa Selector */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.Globe size={13} className="text-blue-500" strokeWidth={3} />
                        SRV_PLATFORM
                    </label>
                    <div className="space-y-3">
                        <div className="relative group/select">
                            <select
                                value={config.programName === '0facturador' ? '0facturador' : 'Otra'}
                                onChange={(e) => {
                                    if (e.target.value === '0facturador') {
                                        handleFieldChange('programName', '0facturador');
                                    } else {
                                        handleFieldChange('programName', '');
                                    }
                                }}
                                disabled={!isEditing}
                                className="w-full px-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm"
                            >
                                <option value="0facturador">0facturador.os</option>
                                <option value="Otra">Custom_Ext</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* URL */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.ExternalLink size={13} className="text-blue-500" strokeWidth={3} />
                        ACCESS_ENDPOINT
                    </label>
                    <input
                        type="text"
                        value={config.url || ''}
                        onChange={(e) => handleFieldChange('url', e.target.value)}
                        disabled={!isEditing}
                        placeholder="https://app.0facturador.com"
                        className="w-full px-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm"
                    />
                </div>

                {/* Usuario */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.User size={13} className="text-blue-500" strokeWidth={3} />
                        AUTH_IDENTITY
                    </label>
                    <input
                        type="text"
                        value={config.username || ''}
                        onChange={(e) => handleFieldChange('username', e.target.value)}
                        disabled={!isEditing}
                        placeholder="ID"
                        className="w-full px-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm"
                    />
                </div>

                {/* Contraseña */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.Lock size={13} className="text-emerald-500" strokeWidth={3} />
                        AUTH_SECRET
                    </label>
                    <div className="relative group/passwd">
                        <input
                            type={passwordVisible ? "text" : "password"}
                            value={config.password || ''}
                            onChange={(e) => handleFieldChange('password', e.target.value)}
                            disabled={!isEditing}
                            autoComplete="new-password"
                            placeholder="********"
                            className="w-full px-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm"
                        />
                        <button 
                            type="button"
                            onClick={() => setPasswordVisible(!passwordVisible)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-600 transition-colors"
                        >
                            {passwordVisible ? <LucideIcons.EyeOff size={16} /> : <LucideIcons.Eye size={16} />}
                        </button>
                    </div>
                </div>

                {/* Caducidad */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.Calendar size={13} className="text-amber-500" strokeWidth={3} />
                        EXP_DATE
                    </label>
                    <input
                        type="date"
                        value={config.expirationDate || ''}
                        onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-6 py-3.5 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>

                {/* Estatus Documentos */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.FileText size={13} className="text-rose-500" strokeWidth={3} />
                        LICENSE_TYPE
                    </label>
                    <div className="relative">
                        <select
                            value={config.documentStatus || ''}
                            onChange={(e) => handleFieldChange('documentStatus', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm"
                        >
                            <option value="">UNCERTAIN</option>
                            <option value="Ilimitado">UNLIMITED</option>
                            <option value="Prepago">PREPAID</option>
                            <option value="Vencido">EXPIRED</option>
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 dark:text-slate-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                {/* Cantidad Documentos */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.FilePlus size={13} className="text-cyan-500" strokeWidth={3} />
                        VOL_METRICS
                    </label>
                    <input
                        type="number"
                        value={config.documentCount || ''}
                        onChange={(e) => handleFieldChange('documentCount', parseInt(e.target.value))}
                        disabled={!isEditing}
                        placeholder="0"
                        className="w-full px-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm"
                    />
                </div>

                {/* Precio */}
                <div className="space-y-4">
                    <label className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <LucideIcons.Coins size={13} className="text-sky-500" strokeWidth={3} />
                        RECURRING_COST
                    </label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-600 dark:text-sky-400 font-mono font-bold text-xs">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={config.price || ''}
                            onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                            disabled={!isEditing}
                            placeholder="0.00"
                            className="w-full pl-12 pr-6 py-4 bg-white dark:bg-surface-low/30 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-sky-500/20 transition-all disabled:opacity-40 outline-none shadow-sm"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

