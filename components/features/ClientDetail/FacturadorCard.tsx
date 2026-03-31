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
        <div className="bg-surface-lowest rounded-[3rem] p-10 shadow-architect relative overflow-hidden group border border-surface-low transition-all duration-700">
            {/* Architectural Depth - Subtle Gradient Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/10 transition-all duration-1000 -mr-32 -mt-32"></div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 relative z-10 gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-architect-low">
                            <Sparkles className="animate-pulse" size={24} />
                        </div>
                        <h3 className="text-xl font-extrabold text-on-surface tracking-tight uppercase font-premium">
                            PANEL 0FACTURADOR
                        </h3>
                    </div>
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mt-4 font-premium">INFRAESTRUCTURA DE EMISIÓN ELECTRÓNICA</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {config.url && (
                        <a 
                            href={config.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-6 py-3 bg-surface hover:bg-primary hover:text-white rounded-2xl transition-all shadow-architect-low group/link text-[10px] font-black uppercase tracking-widest font-premium"
                        >
                            <span>ACCEDER</span>
                            <ExternalLink size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </a>
                    )}
                    <div className="hidden sm:flex items-center gap-3 px-6 py-3 bg-tertiary-fixed/10 rounded-2xl border border-tertiary-fixed/20 text-tertiary">
                        <ShieldCheck size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest font-premium">SISTEMA VALIDADO</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {/* Programa Selector */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Globe size={13} className="text-primary" />
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
                                className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm font-premium"
                            >
                                <option value="0facturador">0facturador</option>
                                <option value="Otra">Otra Plataforma</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant/40">
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
                                className="w-full px-6 py-3 bg-surface border border-surface-low rounded-xl text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none animate-in slide-in-from-top-2 duration-300 font-premium"
                            />
                        )}
                    </div>
                </div>

                {/* URL */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <ExternalLink size={13} className="text-primary" />
                        URL ACCESO
                    </label>
                    <input
                        type="text"
                        value={config.url || ''}
                        onChange={(e) => handleFieldChange('url', e.target.value)}
                        disabled={!isEditing}
                        placeholder="https://app.0facturador.com"
                        className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                    />
                </div>

                {/* Usuario */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <User size={13} className="text-indigo-400" />
                        USUARIO
                    </label>
                    <input
                        type="text"
                        value={config.username || ''}
                        onChange={(e) => handleFieldChange('username', e.target.value)}
                        disabled={!isEditing}
                        placeholder="ID Acceso"
                        className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                    />
                </div>

                {/* Contraseña */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Lock size={13} className="text-emerald-500" />
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
                            className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                        />
                        <button 
                            type="button"
                            onClick={() => setPasswordVisible(!passwordVisible)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                        >
                            {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {/* Caducidad */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Calendar size={13} className="text-amber-500" />
                        VENCIMIENTO
                    </label>
                    <input
                        type="date"
                        value={config.expirationDate || ''}
                        onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>

                {/* Estatus Documentos */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <FileText size={13} className="text-rose-500" />
                        ESTADO PLAN
                    </label>
                    <div className="relative">
                        <select
                            value={config.documentStatus || ''}
                            onChange={(e) => handleFieldChange('documentStatus', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm font-premium"
                        >
                            <option value="">Seleccionar</option>
                            <option value="Ilimitado">Ilimitado</option>
                            <option value="Prepago">Prepago</option>
                            <option value="Vencido">Vencido</option>
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant/40">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                {/* Cantidad Documentos */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <FilePlus size={13} className="text-blue-500" />
                        VOLUMEN DOCS
                    </label>
                    <input
                        type="number"
                        value={config.documentCount || ''}
                        onChange={(e) => handleFieldChange('documentCount', parseInt(e.target.value))}
                        disabled={!isEditing}
                        placeholder="0"
                        className="w-full px-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                    />
                </div>

                {/* Precio */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 flex items-center gap-2 font-premium">
                        <Coins size={13} className="text-cyan-500" />
                        PRECIO SERVICIO
                    </label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-cyan-500 font-black font-premium text-xs">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={config.price || ''}
                            onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                            disabled={!isEditing}
                            placeholder="0.00"
                            className="w-full pl-12 pr-6 py-4 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-cyan-500/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

