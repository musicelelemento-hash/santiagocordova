import React from 'react';
import { ExternalLink, User, Lock, Calendar, FileText, Coins, Eye, EyeOff, Sparkles, Globe, FilePlus, ShieldCheck } from 'lucide-react';
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
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-primary/10 flex items-center justify-center text-blue-600 dark:text-primary-low group-hover:scale-110 transition-transform shadow-sm">
                            <Sparkles className="animate-pulse" size={24} />
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight uppercase font-premium">
                            0FACTURADOR PANEL
                        </h3>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-4 font-premium">INFRAESTRUCTURA DE EMISIÓN ELECTRÓNICA</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {config.url && (
                        <a 
                            href={config.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-primary text-slate-900 dark:text-white hover:bg-blue-600 dark:hover:bg-primary-low rounded-2xl transition-all shadow-sm border border-slate-100 dark:border-white/5 group/link text-[10px] font-black uppercase tracking-widest font-premium"
                        >
                            <span>ACCEDER</span>
                            <ExternalLink size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </a>
                    )}
                    <div className="hidden sm:flex items-center gap-3 px-6 py-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={14} strokeWidth={3} />
                        <span className="text-[9px] font-black uppercase tracking-widest font-premium">SISTEMA VALIDADO</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {/* Programa Selector */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Globe size={13} className="text-blue-500" strokeWidth={3} />
                        SERVICIO
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
                                className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm font-premium"
                            >
                                <option value="0facturador">0facturador</option>
                                <option value="Otra">Otra Plataforma</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        {config.programName !== '0facturador' && (
                            <input
                                type="text"
                                value={config.programName || ''}
                                onChange={(e) => handleFieldChange('programName', e.target.value)}
                                disabled={!isEditing}
                                placeholder="Especifique plataforma..."
                                className="w-full px-6 py-3 bg-white dark:bg-surface-low border border-slate-100 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none animate-in slide-in-from-top-2 duration-300 font-premium shadow-sm"
                            />
                        )}
                    </div>
                </div>

                {/* URL */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <ExternalLink size={13} className="text-blue-500" strokeWidth={3} />
                        URL ACCESO
                    </label>
                    <input
                        type="text"
                        value={config.url || ''}
                        onChange={(e) => handleFieldChange('url', e.target.value)}
                        disabled={!isEditing}
                        placeholder="https://app.0facturador.com"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                    />
                </div>

                {/* Usuario */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <User size={13} className="text-blue-500" strokeWidth={3} />
                        USUARIO
                    </label>
                    <input
                        type="text"
                        value={config.username || ''}
                        onChange={(e) => handleFieldChange('username', e.target.value)}
                        disabled={!isEditing}
                        placeholder="ID Acceso"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                    />
                </div>

                {/* Contraseña */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Lock size={13} className="text-emerald-500" strokeWidth={3} />
                        CONTRASEÑA
                    </label>
                    <div className="relative group/passwd">
                        <input
                            type={passwordVisible ? "text" : "password"}
                            value={config.password || ''}
                            onChange={(e) => handleFieldChange('password', e.target.value)}
                            disabled={!isEditing}
                            autoComplete="new-password"
                            placeholder="********"
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                        />
                        <button 
                            type="button"
                            onClick={() => setPasswordVisible(!passwordVisible)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-600 transition-colors"
                        >
                            {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {/* Caducidad */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Calendar size={13} className="text-amber-500" strokeWidth={3} />
                        VENCIMIENTO
                    </label>
                    <input
                        type="date"
                        value={config.expirationDate || ''}
                        onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>

                {/* Estatus Documentos */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <FileText size={13} className="text-rose-500" strokeWidth={3} />
                        ESTADO PLAN
                    </label>
                    <div className="relative">
                        <select
                            value={config.documentStatus || ''}
                            onChange={(e) => handleFieldChange('documentStatus', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm font-premium"
                        >
                            <option value="">Seleccionar</option>
                            <option value="Ilimitado">Ilimitado</option>
                            <option value="Prepago">Prepago</option>
                            <option value="Vencido">Vencido</option>
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 dark:text-slate-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                {/* Cantidad Documentos */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <FilePlus size={13} className="text-cyan-500" strokeWidth={3} />
                        VOLUMEN DOCS
                    </label>
                    <input
                        type="number"
                        value={config.documentCount || ''}
                        onChange={(e) => handleFieldChange('documentCount', parseInt(e.target.value))}
                        disabled={!isEditing}
                        placeholder="0"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                    />
                </div>

                {/* Precio */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Coins size={13} className="text-sky-500" strokeWidth={3} />
                        PRECIO SERVICIO
                    </label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-600 dark:text-sky-400 font-black font-premium text-xs">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={config.price || ''}
                            onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                            disabled={!isEditing}
                            placeholder="0.00"
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-sky-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

