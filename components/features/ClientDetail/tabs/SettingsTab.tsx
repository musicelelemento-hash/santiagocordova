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
    onStartEdit?: () => void;
}

const TaxProfileField: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    isEditing: boolean;
    onChange: (val: string) => void;
    onStartEdit?: () => void;
    type?: string;
    options?: { value: string; label: string }[];
    placeholder?: string;
}> = ({ label, value, icon: Icon, isEditing, onChange, onStartEdit, type = 'text', options, placeholder }) => (
    <div className="space-y-3 group/field animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <Icon size={13} className="text-primary/50 group-hover/field:text-primary transition-colors" />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{label}</span>
            </div>
            {(!isEditing && onStartEdit) && (
                <button
                    type="button"
                    onClick={onStartEdit}
                    className="text-[9px] text-primary hover:text-primary-dark font-black uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity"
                >
                    <LucideIcons.Edit3 size={10} /> Editar
                </button>
            )}
        </div>
        {isEditing ? (
            type === 'select' ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full glass-card-premium rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all appearance-none cursor-pointer "
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
                    className="w-full glass-card-premium rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all "
                />
            )
        ) : (
            <div 
                onClick={onStartEdit}
                className={`px-5 py-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-slate-200 tracking-wide shadow-sm flex items-center justify-between ${onStartEdit ? 'cursor-pointer hover:border-primary/20 hover:bg-slate-100/50 dark:hover:bg-white/10 transition-all' : ''}`}
            >
                <span>{options?.find(o => o.value === value)?.label || value || <span className="text-slate-350 dark:text-slate-650 font-normal">—</span>}</span>
                {onStartEdit && <LucideIcons.Lock size={10} className="text-slate-300 dark:text-slate-650 opacity-60 group-hover/field:opacity-100 transition-opacity" />}
            </div>
        )}
    </div>
);

export const SettingsTab: React.FC<SettingsTabProps> = ({
    client,
    editedClient,
    setEditedClient,
    isEditing,
    onUpdateClientDirect,
    onStartEdit
}) => {
    const { toast } = useToast();
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
            {/* Grid for Technical Parameters */}
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-10">
                
                {/* Left Column: Core Identity & Tax Profile */}
                <div className="2xl:col-span-8 space-y-10">
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
                                onStartEdit={onStartEdit}
                                onChange={(val) => setEditedClient({ ...editedClient, ruc: val })} 
                            />
                            <TaxProfileField 
                                label="Nombre Legal / Razón Social" 
                                value={editedClient.name} 
                                icon={LucideIcons.Building2} 
                                isEditing={isEditing} 
                                onStartEdit={onStartEdit}
                                onChange={(val) => setEditedClient({ ...editedClient, name: val })} 
                            />
                            <TaxProfileField 
                                label="Correo Electrónico" 
                                value={editedClient.email} 
                                icon={LucideIcons.Mail} 
                                isEditing={isEditing} 
                                onStartEdit={onStartEdit}
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
                                                        className="w-full glass-card-premium rounded-2xl pl-11 pr-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all "
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
                                    <div 
                                        onClick={onStartEdit}
                                        className={`space-y-3 ${onStartEdit ? 'cursor-pointer' : ''}`}
                                    >
                                        {(client.phones || []).length > 0 ? (
                                            (client.phones || []).map((phone, idx) => {
                                                const cleanPhone = phone.replace(/\D/g, '');
                                                const ecuadorianPhone = cleanPhone.startsWith('0') ? '593' + cleanPhone.substring(1) : cleanPhone;
                                                return (
                                                    <div key={idx} className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-slate-200 shadow-sm group/phone hover:border-primary/20 hover:bg-slate-100/50 dark:hover:bg-white/10 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <LucideIcons.Smartphone size={14} className="text-slate-400" />
                                                            <span className="font-mono tracking-wider">{phone}</span>
                                                        </div>
                                                        <div className="flex gap-2 opacity-60 group-hover/phone:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
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
                                                                    onClick={(e) => e.stopPropagation()}
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
                                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs font-bold text-slate-300 dark:text-slate-650 italic shadow-sm flex items-center justify-between hover:border-primary/20 hover:bg-slate-100/50 dark:hover:bg-white/10 transition-all">
                                                <span>Sin números telefónicos registrados</span>
                                                <LucideIcons.Lock size={10} className="text-slate-300 dark:text-slate-650 opacity-60" />
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
                                    onStartEdit={onStartEdit}
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
                <div className="2xl:col-span-4 space-y-10">
                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-8 border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-none transition-all duration-500">
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-8">Parámetros del Sistema</h3>
                        
                        <div className="space-y-7">
                            <TaxProfileField 
                                label="Régimen Impositivo" 
                                value={editedClient.regime} 
                                icon={LucideIcons.Globe} 
                                isEditing={isEditing} 
                                onStartEdit={onStartEdit}
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
                                onStartEdit={onStartEdit}
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
                                value={editedClient.isCourtesy || editedClient.customServiceFee === 0 ? 'CORTESIA' : (editedClient.customServiceFee !== undefined ? 'PERSONALIZADA' : 'ESTANDAR')} 
                                icon={LucideIcons.Coins} 
                                isEditing={isEditing} 
                                onStartEdit={onStartEdit}
                                type="select"
                                options={[
                                    { value: 'ESTANDAR', label: 'Estándar / Regular' },
                                    { value: 'PERSONALIZADA', label: 'Tarifa Personalizada ($)' },
                                    { value: 'CORTESIA', label: 'Cortesía / Trueque / Familia ($0 - Sin Cobro)' }
                                ]}
                                onChange={(val) => {
                                    if (val === 'CORTESIA') {
                                        setEditedClient({ 
                                            ...editedClient, 
                                            isCourtesy: true,
                                            customServiceFee: 0
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

                            {(editedClient.isCourtesy || editedClient.customServiceFee === 0) && (
                                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-sky-400 font-medium">
                                    <LucideIcons.Info size={16} className="flex-shrink-0" />
                                    <span>Cliente de Cortesía / Trueque ($0): Las declaraciones se marcan automáticamente como AL DÍA (Pagadas) sin generar cuentas por cobrar.</span>
                                </div>
                            )}

                            {(!editedClient.isCourtesy && editedClient.customServiceFee !== undefined && editedClient.customServiceFee > 0) && (
                                <TaxProfileField 
                                    label="Valor de Tarifa Personalizada ($)" 
                                    value={editedClient.customServiceFee?.toString() || '0'} 
                                    icon={LucideIcons.DollarSign} 
                                    isEditing={isEditing} 
                                    onStartEdit={onStartEdit}
                                    onChange={(val) => {
                                        const num = parseFloat(val) || 0;
                                        setEditedClient({ 
                                            ...editedClient, 
                                            isCourtesy: num === 0,
                                            customServiceFee: num
                                        });
                                    }} 
                                />
                            )}

                            <div className="space-y-3 group/field animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <LucideIcons.CalendarRange size={13} className="text-primary/50 group-hover/field:text-primary transition-colors" />
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Inicio de Obligaciones</span>
                                    </div>
                                    {(!isEditing && onStartEdit) && (
                                        <button
                                            type="button"
                                            onClick={onStartEdit}
                                            className="text-[9px] text-primary hover:text-primary-dark font-black uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                        >
                                            <LucideIcons.Edit3 size={10} /> Editar
                                        </button>
                                    )}
                                </div>
                                {isEditing ? (
                                    editedClient.taxProfile?.ivaFrequency === 'Semestral' ? (
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="flex-1 relative">
                                                    <select
                                                        value={editedClient.clientStartPeriod?.split('-')[0] || new Date().getFullYear().toString()}
                                                        onChange={(e) => {
                                                            const year = e.target.value;
                                                            const sem = editedClient.clientStartPeriod?.split('-')[1] || 'S1';
                                                            setEditedClient({ ...editedClient, clientStartPeriod: `${year}-${sem}` });
                                                        }}
                                                        className="w-full glass-card-premium rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all appearance-none cursor-pointer"
                                                    >
                                                        {Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - 3 + i).toString()).map(y => (
                                                            <option key={y} value={y} className="bg-slate-900 dark:bg-slate-950 text-slate-900 dark:text-white">{y}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <LucideIcons.ChevronDown size={14} />
                                                    </div>
                                                </div>
                                                <div className="flex-1 relative">
                                                    <select
                                                        value={editedClient.clientStartPeriod?.split('-')[1] || 'S1'}
                                                        onChange={(e) => {
                                                            const sem = e.target.value;
                                                            const year = editedClient.clientStartPeriod?.split('-')[0] || new Date().getFullYear().toString();
                                                            setEditedClient({ ...editedClient, clientStartPeriod: `${year}-${sem}` });
                                                        }}
                                                        className="w-full glass-card-premium rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="S1" className="bg-slate-900 dark:bg-slate-950 text-slate-900 dark:text-white">1er Semestre (S1)</option>
                                                        <option value="S2" className="bg-slate-900 dark:bg-slate-950 text-slate-900 dark:text-white">2do Semestre (S2)</option>
                                                    </select>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <LucideIcons.ChevronDown size={14} />
                                                    </div>
                                                </div>
                                            </div>
                                            {editedClient.clientStartPeriod?.endsWith('-S2') && (
                                                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                                    <LucideIcons.Info size={12} strokeWidth={2.5} />
                                                    <span>Ciclo S2 activo: Cerrará en diciembre y se declarará en enero.</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-3">
                                            <div className="flex-1 relative">
                                                <select
                                                    value={(() => {
                                                        const parts = (editedClient.clientStartPeriod || '').split('-');
                                                        return parts[0] || new Date().getFullYear().toString();
                                                    })()}
                                                    onChange={(e) => {
                                                        const year = e.target.value;
                                                        const parts = (editedClient.clientStartPeriod || '').split('-');
                                                        let month = parts[1] || '01';
                                                        if (month.startsWith('S')) month = '01';
                                                        setEditedClient({ ...editedClient, clientStartPeriod: `${year}-${month}` });
                                                    }}
                                                    className="w-full glass-card-premium rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all appearance-none cursor-pointer"
                                                >
                                                    {Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - 3 + i).toString()).map(y => (
                                                        <option key={y} value={y} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">{y}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <LucideIcons.ChevronDown size={14} />
                                                </div>
                                            </div>
                                            <div className="flex-1 relative">
                                                <select
                                                    value={(() => {
                                                        const parts = (editedClient.clientStartPeriod || '').split('-');
                                                        let month = parts[1] || '01';
                                                        if (month.startsWith('S')) month = '01';
                                                        return month;
                                                    })()}
                                                    onChange={(e) => {
                                                        const month = e.target.value;
                                                        const parts = (editedClient.clientStartPeriod || '').split('-');
                                                        const year = parts[0] || new Date().getFullYear().toString();
                                                        setEditedClient({ ...editedClient, clientStartPeriod: `${year}-${month}` });
                                                    }}
                                                    className="w-full glass-card-premium rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all appearance-none cursor-pointer"
                                                >
                                                    {[
                                                        { val: '01', label: 'Enero' },
                                                        { val: '02', label: 'Febrero' },
                                                        { val: '03', label: 'Marzo' },
                                                        { val: '04', label: 'Abril' },
                                                        { val: '05', label: 'Mayo' },
                                                        { val: '06', label: 'Junio' },
                                                        { val: '07', label: 'Julio' },
                                                        { val: '08', label: 'Agosto' },
                                                        { val: '09', label: 'Septiembre' },
                                                        { val: '10', label: 'Octubre' },
                                                        { val: '11', label: 'Noviembre' },
                                                        { val: '12', label: 'Diciembre' }
                                                    ].map(m => (
                                                        <option key={m.val} value={m.val} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">{m.label}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <LucideIcons.ChevronDown size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div 
                                        onClick={onStartEdit}
                                        className={`px-5 py-3.5 bg-slate-100 dark:bg-white/10 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-black text-slate-900 dark:text-white tracking-wide shadow-sm flex items-center justify-between ${onStartEdit ? 'cursor-pointer hover:border-primary/40 hover:bg-slate-200/50 dark:hover:bg-white/15 transition-all' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <LucideIcons.CalendarDays size={14} className="text-primary" />
                                            <span className="font-mono text-primary font-extrabold uppercase">
                                                {(() => {
                                                    const val = editedClient.clientStartPeriod;
                                                    if (!val) return <span className="text-slate-400 dark:text-slate-400 font-sans font-normal">Sin fecha configurada (Usa valor por defecto)</span>;
                                                    if (val.includes('-S1')) return `${val.split('-')[0]} · 1er Semestre (Ene - Jun)`;
                                                    if (val.includes('-S2')) return `${val.split('-')[0]} · 2do Semestre (Jul - Dic)`;
                                                    const parts = val.split('-');
                                                    if (parts.length === 2) {
                                                        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                                                        const idx = parseInt(parts[1], 10) - 1;
                                                        if (idx >= 0 && idx < 12) return `${months[idx]} ${parts[0]}`;
                                                    }
                                                    return val;
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editedClient.taxProfile?.ivaFrequency === 'Semestral' && editedClient.clientStartPeriod?.endsWith('-S2') && (
                                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-xl font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                                                    Espera en Enero
                                                </span>
                                            )}
                                            {onStartEdit && <LucideIcons.Pencil size={12} className="text-slate-400 hover:text-primary transition-colors" />}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
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
