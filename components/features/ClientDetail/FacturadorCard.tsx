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

    // Check expiration status
    const isExpired = React.useMemo(() => {
        if (!config.expirationDate) return false;
        const exp = new Date(config.expirationDate);
        const today = new Date();
        // Reset hours for date comparison
        exp.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        return exp < today;
    }, [config.expirationDate]);

    return (
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden group transition-all duration-500 hover:shadow-primary/5">
            {/* Decorative background grid */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none -mr-32 -mt-32 opacity-100 transition-opacity duration-1000" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 relative z-10 gap-4 border-b border-slate-200/60 dark:border-white/5 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <LucideIcons.Sparkles className="animate-pulse" size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            Sistema de Facturación del Cliente
                        </h3>
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 font-premium">Plataforma externa para emisión de comprobantes</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {config.url && (
                        <a 
                            href={config.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-primary text-white hover:bg-primary dark:hover:bg-primary/80 rounded-xl transition-all shadow-md text-[9px] font-black uppercase tracking-widest font-premium"
                        >
                            <span>Abrir Sistema</span>
                            <LucideIcons.ExternalLink size={11} />
                        </a>
                    )}
                    {config.programName ? (
                        isExpired ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-500 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                <LucideIcons.AlertTriangle size={11} />
                                <span>Plan Vencido</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest">
                                <LucideIcons.ShieldCheck size={11} />
                                <span>Servicio Activo</span>
                            </div>
                        )
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-500/10 border border-slate-500/25 rounded-xl text-slate-500 text-[8px] font-black uppercase tracking-widest">
                            <LucideIcons.HelpCircle size={11} />
                            <span>No Configurado</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                {/* COLUMNA 1: Datos de Acceso */}
                <div className="space-y-5 bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200/50 dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2 font-premium">
                        <LucideIcons.Key size={12} />
                        Credenciales & Acceso
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Selector de programa */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Programa de Facturación
                            </label>
                            <div className="relative">
                                <select
                                    value={config.programName || ''}
                                    onChange={(e) => handleFieldChange('programName', e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none cursor-pointer transition-all disabled:opacity-50"
                                >
                                    <option value="">No Definido / Ninguno</option>
                                    <option value="SRI PUBLIC">Facturador Público SRI (Gratuito)</option>
                                    <option value="ZIFAC">ZIFAC</option>
                                    <option value="ECUAFACT">ECUAFACT</option>
                                    <option value="CONTIFICO">CONTÍFICO (Siigo)</option>
                                    <option value="SIIGO">SIIGO</option>
                                    <option value="Otro">Otro / Personalizado</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <LucideIcons.ChevronDown size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Enlace URL */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Dirección Web (URL)
                            </label>
                            <input
                                type="text"
                                value={config.url || ''}
                                onChange={(e) => handleFieldChange('url', e.target.value)}
                                disabled={!isEditing}
                                placeholder="https://sistema.cliente.com"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* Usuario */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Usuario / Correo de Acceso
                            </label>
                            <input
                                type="text"
                                value={config.username || ''}
                                onChange={(e) => handleFieldChange('username', e.target.value)}
                                disabled={!isEditing}
                                placeholder="RUC / Cédula / Correo"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* Contraseña */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Contraseña / Token de Acceso
                            </label>
                            <div className="relative">
                                <input
                                    type={passwordVisible ? "text" : "password"}
                                    value={config.password || ''}
                                    onChange={(e) => handleFieldChange('password', e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="Clave de facturador"
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setPasswordVisible(!passwordVisible)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                >
                                    {passwordVisible ? <LucideIcons.EyeOff size={14} /> : <LucideIcons.Eye size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 2: Detalles de Licencia */}
                <div className="space-y-5 bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200/50 dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2 font-premium">
                        <LucideIcons.CreditCard size={12} />
                        Licencia & Control de Consumo
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Modalidad de Licencia */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Modalidad del Plan
                            </label>
                            <div className="relative">
                                <select
                                    value={config.documentStatus || ''}
                                    onChange={(e) => handleFieldChange('documentStatus', e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none cursor-pointer transition-all disabled:opacity-50"
                                >
                                    <option value="">No Definido</option>
                                    <option value="Ilimitado">Plan Ilimitado</option>
                                    <option value="Prepago">Prepago (Bolsa de Documentos)</option>
                                    <option value="Mensual">Plan Mensual</option>
                                    <option value="Anual">Plan Anual</option>
                                    <option value="Vencido">Plan Vencido / Demo</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <LucideIcons.ChevronDown size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Cantidad Documentos */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Documentos Habilitados (Cupo)
                            </label>
                            <input
                                type="number"
                                value={config.documentCount === undefined ? '' : config.documentCount}
                                onChange={(e) => handleFieldChange('documentCount', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                disabled={!isEditing}
                                placeholder="Ej: 100 / Ilimitado"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* Precio */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Costo de la Licencia
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={config.price === undefined ? '' : config.price}
                                    onChange={(e) => handleFieldChange('price', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                    disabled={!isEditing}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Caducidad */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                                Fecha de Vencimiento
                            </label>
                            <input
                                type="date"
                                value={config.expirationDate || ''}
                                onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark] cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
