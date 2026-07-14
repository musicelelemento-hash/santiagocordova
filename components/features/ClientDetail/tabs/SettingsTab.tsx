import React from 'react';
import { Client, TaxRegime } from '../../../../types';
import * as LucideIcons from 'lucide-react';
import { ExtraObligationsCheckboxes } from '../ExtraObligationsCheckboxes';
import { useToast } from '../../../../context/ToastContext';

interface SettingsTabProps {
    client: Client;
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    isEditing: boolean;
    onUpdateClientDirect?: (updates: Partial<Client>) => Promise<void>;
}

const TaxProfileField: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    isEditing: boolean;
    onChange: (val: string) => void;
    type?: string;
    options?: { value: string; label: string }[];
    placeholder?: string;
}> = ({ label, value, icon: Icon, isEditing, onChange, type = 'text', options, placeholder }) => (
    <div className="space-y-3 group/field animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-2.5">
            <Icon size={13} className="text-primary/50 group-hover/field:text-primary transition-colors" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{label}</span>
        </div>
        {isEditing ? (
            type === 'select' ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all appearance-none cursor-pointer shadow-sm"
                >
                    {options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all shadow-sm"
                />
            )
        ) : (
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-slate-200 tracking-wide shadow-sm">
                {options?.find(o => o.value === value)?.label || value || <span className="text-slate-300 dark:text-slate-600">—</span>}
            </div>
        )}
    </div>
);

export const SettingsTab: React.FC<SettingsTabProps> = ({
    client,
    editedClient,
    setEditedClient,
    isEditing,
    onUpdateClientDirect
}) => {
    const { toast } = useToast();
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
            {/* Grid for Technical Parameters */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* Left Column: Core Identity & Tax Profile */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group transition-all duration-500">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all duration-1000 group-hover:scale-110 pointer-events-none">
                            <LucideIcons.ShieldCheck size={96} className="text-primary" />
                        </div>
                        
                        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-4 mb-10 relative z-10">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <LucideIcons.User className="text-primary" size={22} />
                            </div>
                            Identificación y Perfil Fiscal
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 relative z-10">
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
                            {/* Teléfonos y Canales de WhatsApp Múltiples */}
                            <div className="space-y-3 group/field animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <LucideIcons.Phone size={13} className="text-primary/50 group-hover/field:text-primary transition-colors" />
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Teléfonos / WhatsApp</span>
                                    </div>
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setEditedClient(prev => ({ ...prev, phones: [...(prev.phones || ['']), ''] }))}
                                            className="text-[9px] text-emerald-500 hover:text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <LucideIcons.Plus size={10} strokeWidth={3} /> Añadir Número
                                        </button>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="space-y-3">
                                        {(editedClient.phones || ['']).map((phone, idx) => (
                                            <div key={idx} className="flex gap-3 items-center animate-in fade-in duration-300">
                                                <div className="relative flex-1">
                                                    <LucideIcons.Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={phone}
                                                        onChange={(e) => {
                                                            const newPhones = [...(editedClient.phones || [''])];
                                                            newPhones[idx] = e.target.value;
                                                            setEditedClient({ ...editedClient, phones: newPhones });
                                                        }}
                                                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all shadow-sm"
                                                        placeholder="Ej: 0991234567"
                                                    />
                                                </div>
                                                {(editedClient.phones || []).length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newPhones = (editedClient.phones || []).filter((_, i) => i !== idx);
                                                            setEditedClient({ ...editedClient, phones: newPhones });
                                                        }}
                                                        className="p-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl transition-all border border-rose-500/10 active:scale-95"
                                                    >
                                                        <LucideIcons.Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(client.phones || []).length > 0 ? (
                                            (client.phones || []).map((phone, idx) => {
                                                const cleanPhone = phone.replace(/\D/g, '');
                                                const ecuadorianPhone = cleanPhone.startsWith('0') ? '593' + cleanPhone.substring(1) : cleanPhone;
                                                return (
                                                    <div key={idx} className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-slate-200 shadow-sm group/phone">
                                                        <div className="flex items-center gap-3">
                                                            <LucideIcons.Smartphone size={14} className="text-slate-400" />
                                                            <span className="font-mono tracking-wider">{phone}</span>
                                                        </div>
                                                        <div className="flex gap-2 opacity-60 group-hover/phone:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(phone);
                                                                    toast.success("Teléfono copiado al portapapeles.");
                                                                }}
                                                                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
                                                                title="Copiar Número"
                                                            >
                                                                <LucideIcons.Copy size={13} />
                                                            </button>
                                                            {ecuadorianPhone && (
                                                                <a
                                                                    href={`https://wa.me/${ecuadorianPhone}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="p-2 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-xl text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center"
                                                                    title="Enviar Mensaje por WhatsApp"
                                                                >
                                                                    <LucideIcons.MessageSquare size={13} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-300 dark:text-slate-600 italic shadow-sm">
                                                Sin números telefónicos registrados
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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

                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden transition-all duration-500">
                        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-4 mb-10">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                <LucideIcons.GanttChartSquare className="text-emerald-600 dark:text-emerald-400" size={22} />
                            </div>
                            Configuración de Obligaciones
                        </h3>
                        <ExtraObligationsCheckboxes editedClient={editedClient} setEditedClient={setEditedClient} disabled={!isEditing} />
                    </div>
                </div>

                {/* Right Column: Technical Stats & Meta */}
                <div className="lg:col-span-4 space-y-10">
                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-8 border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-none transition-all duration-500">
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-8">Parámetros del Sistema</h3>
                        
                        <div className="space-y-7">
                            <TaxProfileField 
                                label="Régimen Impositivo" 
                                value={editedClient.regime} 
                                icon={LucideIcons.Globe} 
                                isEditing={isEditing} 
                                type="select"
                                options={[
                                    { value: TaxRegime.RimpeNegocioPopular, label: 'RIMPE Negocio Popular' },
                                    { value: TaxRegime.RimpeEmprendedor, label: 'RIMPE Emprendedor' },
                                    { value: TaxRegime.General, label: 'Régimen General' }
                                ]}
                                onChange={(val) => {
                                    const regime = val as TaxRegime;
                                    setEditedClient(prev => ({
                                        ...prev, 
                                        regime,
                                        taxProfile: {
                                            ...(prev.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }),
                                            ivaFrequency: regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : (regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : 'Mensual'),
                                            requiresAnnualRenta: true
                                        }
                                    }));
                                }} 
                            />

                            <TaxProfileField 
                                label="Frecuencia Declaración IVA" 
                                value={editedClient.taxProfile?.ivaFrequency || 'Mensual'} 
                                icon={LucideIcons.CalendarDays} 
                                isEditing={isEditing} 
                                type="select"
                                options={[
                                    { value: 'Mensual', label: 'Mensual' },
                                    { value: 'Semestral', label: 'Semestral' },
                                    { value: 'Ninguno', label: 'Ninguno / Exento' }
                                ]}
                                onChange={(val) => setEditedClient({ 
                                    ...editedClient, 
                                    taxProfile: { 
                                        ...(editedClient.taxProfile || { requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), 
                                        ivaFrequency: val as 'Mensual' | 'Semestral' | 'Ninguno' 
                                    } 
                                })} 
                            />

                            <TaxProfileField 
                                label="Tipo de Tarifa" 
                                value={editedClient.isCourtesy ? 'CORTESIA' : (editedClient.customServiceFee !== undefined ? 'PERSONALIZADA' : 'ESTANDAR')} 
                                icon={LucideIcons.Coins} 
                                isEditing={isEditing} 
                                type="select"
                                options={[
                                    { value: 'ESTANDAR', label: 'Estándar / Regular' },
                                    { value: 'PERSONALIZADA', label: 'Tarifa Personalizada ($)' },
                                    { value: 'CORTESIA', label: 'Cortesía / Sin Costo' }
                                ]}
                                onChange={(val) => {
                                    if (val === 'CORTESIA') {
                                        setEditedClient({ 
                                            ...editedClient, 
                                            isCourtesy: true,
                                            customServiceFee: undefined
                                        });
                                    } else if (val === 'ESTANDAR') {
                                        setEditedClient({ 
                                            ...editedClient, 
                                            isCourtesy: false,
                                            customServiceFee: undefined
                                        });
                                    } else {
                                        setEditedClient({ 
                                            ...editedClient, 
                                            isCourtesy: false,
                                            customServiceFee: editedClient.customServiceFee || 20
                                        });
                                    }
                                }} 
                            />

                            {(!editedClient.isCourtesy && editedClient.customServiceFee !== undefined) && (
                                <TaxProfileField 
                                    label="Valor de Tarifa Personalizada ($)" 
                                    value={editedClient.customServiceFee?.toString() || '0'} 
                                    icon={LucideIcons.DollarSign} 
                                    isEditing={isEditing} 
                                    onChange={(val) => setEditedClient({ 
                                        ...editedClient, 
                                        customServiceFee: parseFloat(val) || 0
                                    })} 
                                />
                            )}

                            <TaxProfileField 
                                label="Inicio de Obligaciones" 
                                value={editedClient.clientStartPeriod || ''} 
                                icon={LucideIcons.CalendarRange} 
                                isEditing={isEditing} 
                                placeholder="AÑO-MES (ej: 2025-01 o 2025-S1)"
                                onChange={(val) => setEditedClient({ 
                                    ...editedClient, 
                                    clientStartPeriod: val
                                })} 
                            />
                            
                            <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Creado</span>
                                    <span className="text-[10px] font-mono text-primary font-bold">
                                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'No Registrada'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Último Acceso</span>
                                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold">Hoy</span>
                                </div>
                                <div className="pt-5 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                                            <LucideIcons.ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Estado del Perfil</div>
                                            <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Seguro y Encriptado</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full p-6 bg-rose-50/80 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 rounded-3xl border border-rose-200/80 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/30 transition-all group/btn flex items-center justify-between shadow-sm active:scale-95">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-rose-100 dark:bg-rose-500/20 rounded-xl">
                                        <LucideIcons.AlertTriangle size={18} className="text-rose-500 group-hover/btn:scale-110 transition-transform" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Zona de Peligro</div>
                                        <div className="text-[9px] font-bold text-rose-400 dark:text-rose-500 uppercase tracking-widest mt-0.5">Gestión de baja de cliente</div>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight size={16} className="text-rose-400 dark:text-rose-500 opacity-60 group-hover/btn:translate-x-1.5 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
