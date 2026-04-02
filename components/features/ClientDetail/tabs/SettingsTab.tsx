import React from 'react';
import { Client, TaxRegime } from '../../../../types';
import * as LucideIcons from 'lucide-react';
import { ExtraObligationsCheckboxes } from '../ExtraObligationsCheckboxes';

interface SettingsTabProps {
    client: Client;
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    isEditing: boolean;
}

const TaxProfileField: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    isEditing: boolean;
    onChange: (val: string) => void;
    type?: string;
    options?: { value: string; label: string }[];
}> = ({ label, value, icon: Icon, isEditing, onChange, type = 'text', options }) => (
    <div className="space-y-4 group/field animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-3">
            <Icon size={14} className="text-primary/40 group-hover/field:text-primary transition-colors" />
            <span className="text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.2em] font-premium">{label}</span>
        </div>
        {isEditing ? (
            type === 'select' ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-surface dark:bg-white/5 border border-surface-low dark:border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer font-premium"
                >
                    {options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-surface dark:bg-white/5 border border-surface-low dark:border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-premium"
                />
            )
        ) : (
            <div className="px-6 py-4 bg-surface-lowest dark:bg-white/5 rounded-2xl border border-surface-low dark:border-white/5 text-xs font-black text-on-surface dark:text-slate-200 tracking-wide font-premium shadow-sm">
                {options?.find(o => o.value === value)?.label || value || '---'}
            </div>
        )}
    </div>
);

export const SettingsTab: React.FC<SettingsTabProps> = ({
    client,
    editedClient,
    setEditedClient,
    isEditing
}) => {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
            {/* Grid for Technical Parameters */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                
                {/* Left Column: Core Identity & Tax Profile */}
                <div className="lg:col-span-8 space-y-12">
                    <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-surface-low dark:border-white/10 shadow-architect relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-40 transition-all duration-1000 group-hover:scale-110">
                            <LucideIcons.ShieldCheck size={48} className="text-primary" />
                        </div>
                        
                        <div className="flex items-center gap-4 mb-12 relative z-10">
                            <h3 className="text-xl font-extrabold text-on-surface dark:text-slate-100 tracking-tight uppercase flex items-center gap-4 font-premium">
                                <LucideIcons.User className="text-primary" size={24} />
                                Identificación y Perfil Fiscal
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <TaxProfileField 
                                label="Número de RUC" 
                                value={editedClient.ruc} 
                                icon={LucideIcons.Hash} 
                                isEditing={isEditing} 
                                onChange={(val) => setEditedClient({ ...editedClient, ruc: val })} 
                            />
                            <TaxProfileField 
                                label="Nombre Legal / Razón Social" 
                                value={editedClient.name} 
                                icon={LucideIcons.Building2} 
                                isEditing={isEditing} 
                                onChange={(val) => setEditedClient({ ...editedClient, name: val })} 
                            />
                            <TaxProfileField 
                                label="Correo Electrónico" 
                                value={editedClient.email} 
                                icon={LucideIcons.Mail} 
                                isEditing={isEditing} 
                                onChange={(val) => setEditedClient({ ...editedClient, email: val })} 
                            />
                            <TaxProfileField 
                                label="Teléfono / WhatsApp" 
                                value={editedClient.phones?.[0] || ''} 
                                icon={LucideIcons.Phone} 
                                isEditing={isEditing} 
                                onChange={(val) => setEditedClient({ ...editedClient, phones: [val] })} 
                            />
                            <div className="md:col-span-2">
                                <TaxProfileField 
                                    label="Dirección de Facturación" 
                                    value={editedClient.address || ''} 
                                    icon={LucideIcons.MapPin} 
                                    isEditing={isEditing} 
                                    onChange={(val) => setEditedClient({ ...editedClient, address: val })} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-surface-low dark:border-white/10 shadow-architect relative overflow-hidden group">
                        <div className="flex items-center gap-4 mb-12">
                            <h3 className="text-xl font-extrabold text-on-surface dark:text-slate-100 tracking-tight uppercase flex items-center gap-4 font-premium">
                                <LucideIcons.GanttChartSquare className="text-tertiary" size={24} />
                                Configuración de Obligaciones
                            </h3>
                        </div>
                        <ExtraObligationsCheckboxes editedClient={editedClient} setEditedClient={setEditedClient} disabled={!isEditing} />
                    </div>
                </div>

                {/* Right Column: Technical Stats & Meta */}
                <div className="lg:col-span-4 space-y-12">
                    <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-surface-low dark:border-white/10 shadow-architect group">
                        <div className="flex items-center gap-4 mb-10">
                            <h3 className="text-xs font-black text-on-surface-variant dark:text-slate-300 uppercase tracking-[0.3em] font-premium">PARÁMETROS DEL SISTEMA</h3>
                        </div>
                        
                        <div className="space-y-8">
                            <TaxProfileField 
                                label="Régimen Impositivo" 
                                value={editedClient.regime} 
                                icon={LucideIcons.Globe} 
                                isEditing={isEditing} 
                                type="select"
                                options={[
                                    { value: 'RIMPE_NEGOCIO_POPULAR', label: 'RIMPE Negocio Popular' },
                                    { value: 'RIMPE_EMPRENDEDOR', label: 'RIMPE Emprendedor' },
                                    { value: 'REGIMEN_GENERAL', label: 'Régimen General' }
                                ]}
                                onChange={(val) => setEditedClient({ ...editedClient, regime: val as TaxRegime })} 
                            />
                            
                            <div className="p-8 bg-surface dark:bg-white/5 rounded-[2rem] border border-surface-low dark:border-white/5 space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-widest font-premium">ACTA DE CREACIÓN</span>
                                    <span className="text-[10px] font-mono text-primary font-bold">{new Date(client.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-widest font-premium">ÚLTIMO ACCESO</span>
                                    <span className="text-[10px] font-mono text-on-surface dark:text-slate-200 font-bold">HOY 14:32</span>
                                </div>
                                <div className="pt-6 border-t border-surface-low dark:border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <LucideIcons.ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-on-surface dark:text-slate-200 uppercase tracking-widest font-premium">ESTADO DEL PERFIL</div>
                                            <div className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-1 font-premium">ENCRIPTADO Y SEGURO</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full p-8 bg-error/10 hover:bg-error/20 rounded-[2rem] border border-error/20 transition-all group/btn flex items-center justify-between shadow-sm active:scale-95">
                                <div className="flex items-center gap-5">
                                    <LucideIcons.AlertTriangle size={20} className="text-error group-hover/btn:scale-110 transition-transform" />
                                    <div className="text-left">
                                        <div className="text-[10px] font-black text-error uppercase tracking-widest font-premium">ZONA DE PELIGRO</div>
                                        <div className="text-[8px] font-bold text-error/60 uppercase tracking-widest mt-1 font-premium">GESTIÓN DE BAJA DE CLIENTE</div>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight size={16} className="text-error opacity-40 group-hover/btn:translate-x-2 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
