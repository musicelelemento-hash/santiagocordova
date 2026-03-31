import React from 'react';
import { ExternalLink, User, Lock, Calendar, FileText, Coins, Eye, EyeOff, Sparkles, Globe, FilePlus } from 'lucide-react';
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
        <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl bg-gradient-to-br from-white/5 to-transparent">
            {/* Artistic Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/20 transition-all duration-1000"></div>
            
            <div className="flex items-center justify-between mb-12 relative z-10">
                <div>
                    <h3 className="text-xl font-medium text-white tracking-tight uppercase flex items-center gap-4">
                        <Sparkles className="text-primary animate-pulse" size={24} />
                        PROGRAMA 0FACTURADOR
                    </h3>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-3">GESTIÓN INTEGRAL DE FACTURACIÓN ELECTRÓNICA</p>
                </div>
                {config.url && (
                    <a 
                        href={config.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-4 bg-white/5 border border-white/5 text-primary hover:bg-primary hover:text-slate-950 rounded-2xl transition-all shadow-lg group/link"
                    >
                        <ExternalLink size={20} className="group-hover/link:scale-110 transition-transform" />
                    </a>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
                {/* Programa Selector */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Globe size={14} className="text-primary" />
                        PROGRAMA / SERVICIO
                    </label>
                    <select
                        value={config.programName || '0facturador'}
                        onChange={(e) => handleFieldChange('programName', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none appearance-none shadow-inner"
                    >
                        <option value="0facturador">0facturador (Default)</option>
                        <option value="Otra">Otra Plataforma</option>
                    </select>
                </div>

                {/* URL */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <ExternalLink size={14} className="text-primary" />
                        URL DE ACCESO
                    </label>
                    <input
                        type="text"
                        value={config.url || ''}
                        onChange={(e) => handleFieldChange('url', e.target.value)}
                        disabled={!isEditing}
                        placeholder="https://app.0facturador.com"
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                    />
                </div>

                {/* Usuario */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <User size={14} className="text-indigo-400" />
                        USUARIO DE ACCESO
                    </label>
                    <input
                        type="text"
                        value={config.username || ''}
                        onChange={(e) => handleFieldChange('username', e.target.value)}
                        disabled={!isEditing}
                        placeholder="usuario.elite"
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                    />
                </div>

                {/* Contraseña */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Lock size={14} className="text-emerald-400" />
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
                            className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                        />
                        <button 
                            type="button"
                            onClick={() => setPasswordVisible(!passwordVisible)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-primary transition-colors"
                        >
                            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Caducidad */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Calendar size={14} className="text-amber-400" />
                        FECHA DE VENCIMIENTO
                    </label>
                    <input
                        type="date"
                        value={config.expirationDate || ''}
                        onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner [color-scheme:dark]"
                    />
                </div>

                {/* Estatus Documentos */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <FileText size={14} className="text-rose-400" />
                        ESTADO / PLAN
                    </label>
                    <select
                        value={config.documentStatus || ''}
                        onChange={(e) => handleFieldChange('documentStatus', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none appearance-none shadow-inner"
                    >
                        <option value="">Seleccionar Estado</option>
                        <option value="Ilimitado">Plan Ilimitado</option>
                        <option value="Prepago">Prepago (Por Consumo)</option>
                        <option value="Vencido">Plan Vencido</option>
                        <option value="En Revisión">En Revisión</option>
                    </select>
                </div>

                {/* Cantidad Documentos */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <FilePlus size={14} className="text-blue-400" />
                        CANTIDAD DOCUMENTOS
                    </label>
                    <div className="relative group/docs">
                        <input
                            type="number"
                            value={config.documentCount || ''}
                            onChange={(e) => handleFieldChange('documentCount', parseInt(e.target.value))}
                            disabled={!isEditing}
                            placeholder="0"
                            className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                        />
                    </div>
                </div>

                {/* Precio */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Coins size={14} className="text-cyan-400" />
                        PRECIO DEL SERVICIO
                    </label>
                    <div className="relative group/price">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-cyan-400 font-bold">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={config.price || ''}
                            onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                            disabled={!isEditing}
                            placeholder="0.00"
                            className="w-full pl-12 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-cyan-500/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
