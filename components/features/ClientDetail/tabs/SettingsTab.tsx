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
    onDeactivateClient?: () => void;
    onDeleteClient?: () => void;
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
    <div className="space-y-2 group/field animate-in fade-in slide-in-from-bottom-2 duration-500 font-mono">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon size={13} className="text-[#00A896] group-hover/field:text-[#00A896] transition-colors" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            {(!isEditing && onStartEdit) && (
                <button
                    type="button"
                    onClick={onStartEdit}
                    className="text-[9px] text-[#2B6AFF] hover:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity"
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
                    className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all appearance-none cursor-pointer"
                >
                    {options?.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">{opt.label}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all"
                />
            )
        ) : (
            <div 
                onClick={onStartEdit}
                className={`px-4 py-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide shadow-sm flex items-center justify-between ${onStartEdit ? 'cursor-pointer hover:border-[#00A896]/40 hover:bg-slate-200/50 dark:hover:bg-[#0b1326] transition-all' : ''}`}
            >
                <span>{options?.find(o => o.value === value)?.label || value || <span className="text-slate-500 font-normal italic">—</span>}</span>
                {onStartEdit && <LucideIcons.Lock size={10} className="text-slate-400 opacity-60 group-hover/field:opacity-100 transition-opacity" />}
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
    onStartEdit,
    onDeactivateClient,
    onDeleteClient
}) => {
    const { toast } = useToast();
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
            {/* Grid for Technical Parameters */}
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-8">
                
                {/* Left Column: Core Identity & Tax Profile */}
                <div className="2xl:col-span-8 space-y-8">
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 shadow-xl relative overflow-hidden group transition-all duration-500">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all duration-1000 group-hover:scale-110 pointer-events-none">
                            <LucideIcons.ShieldCheck size={96} className="text-[#00A896]" />
                        </div>
                        
                        <h3 className="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3 mb-8 relative z-10">
                            <div className="p-3 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-2xl">
                                <LucideIcons.User size={22} />
                            </div>
                            Identificación y Perfil Fiscal
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
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
                            <div className="space-y-2 group/field animate-in fade-in slide-in-from-bottom-2 duration-500 font-mono">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.Phone size={13} className="text-[#00A896] group-hover/field:text-[#00A896] transition-colors" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfonos / WhatsApp</span>
                                    </div>
                                    {isEditing && (
                                        <button
                                             type="button"
                                             onClick={() => setEditedClient(prev => ({ ...prev, phones: [...(prev.phones || ['']), ''] }))}
                                             className="text-[9px] text-[#00A896] hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1"
                                         >
                                             <LucideIcons.Plus size={10} strokeWidth={3} /> Añadir Número
                                         </button>
                                     )}
                                 </div>

                                 {isEditing ? (
                                     <div className="space-y-2">
                                         {(editedClient.phones || ['']).map((phone, idx) => (
                                             <div key={idx} className="flex gap-2 items-center animate-in fade-in duration-300">
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
                                                         className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all"
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
                                                         className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl transition-all border border-rose-500/20 active:scale-95"
                                                     >
                                                         <LucideIcons.Trash2 size={14} />
                                                     </button>
                                                 )}
                                             </div>
                                         ))}
                                     </div>
                                 ) : (
                                     <div 
                                         onClick={onStartEdit}
                                         className={`space-y-2 ${onStartEdit ? 'cursor-pointer' : ''}`}
                                     >
                                         {(client.phones || []).length > 0 ? (
                                             (client.phones || []).map((phone, idx) => {
                                                 const cleanPhone = phone.replace(/\D/g, '');
                                                 const ecuadorianPhone = cleanPhone.startsWith('0') ? '593' + cleanPhone.substring(1) : cleanPhone;
                                                 return (
                                                     <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-sm group/phone hover:border-[#00A896]/40 hover:bg-slate-200/50 dark:hover:bg-[#0b1326] transition-all">
                                                         <div className="flex items-center gap-3">
                                                             <LucideIcons.Smartphone size={14} className="text-[#00A896]" />
                                                             <span className="font-mono tracking-wider">{phone}</span>
                                                         </div>
                                                         <div className="flex gap-1.5 opacity-60 group-hover/phone:opacity-100 transition-opacity">
                                                             <button
                                                                 type="button"
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     navigator.clipboard.writeText(phone);
                                                                     toast.success("Teléfono copiado al portapapeles.");
                                                                 }}
                                                                 className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
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
                                                                     className="p-1.5 hover:bg-emerald-500/15 hover:text-[#00A896] rounded-xl text-slate-400 transition-colors flex items-center justify-center"
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
                                             <div className="px-4 py-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10 text-xs font-bold text-slate-500 italic shadow-sm flex items-center justify-between hover:border-[#00A896]/40 hover:bg-slate-200/50 dark:hover:bg-[#0b1326] transition-all">
                                                 <span>Sin números telefónicos registrados</span>
                                                 <LucideIcons.Lock size={10} className="text-slate-400 opacity-60" />
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

                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 shadow-xl relative overflow-hidden transition-all duration-500">
                        <h3 className="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3 mb-8">
                            <div className="p-3 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-2xl">
                                <LucideIcons.GanttChartSquare size={22} />
                            </div>
                            Configuración de Obligaciones
                        </h3>
                        <ExtraObligationsCheckboxes editedClient={editedClient} setEditedClient={setEditedClient} disabled={!isEditing} />
                    </div>
                </div>

                {/* Right Column: Technical Stats & Meta */}
                <div className="2xl:col-span-4 space-y-8">
                    <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-slate-200/60 dark:border-white/10 dark:border-t-white/20 shadow-xl transition-all duration-500">
                        <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-6">Parámetros del Sistema</h3>
                        
                        <div className="space-y-6">
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
                                <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-sky-400 font-mono font-medium">
                                    <LucideIcons.Info size={16} className="flex-shrink-0" />
                                    <span>Cliente de Cortesía ($0): Declaraciones marcadas AL DÍA sin cuentas por cobrar.</span>
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

                            <div className="space-y-2 group/field animate-in fade-in slide-in-from-bottom-2 duration-500 font-mono">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.CalendarRange size={13} className="text-[#00A896] group-hover/field:text-[#00A896] transition-colors" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inicio de Obligaciones</span>
                                    </div>
                                    {(!isEditing && onStartEdit) && (
                                        <button
                                            type="button"
                                            onClick={onStartEdit}
                                            className="text-[9px] text-[#2B6AFF] hover:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                        >
                                            <LucideIcons.Edit3 size={10} /> Editar
                                        </button>
                                    )}
                                </div>
                                {isEditing ? (
                                    editedClient.taxProfile?.ivaFrequency === 'Semestral' ? (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <div className="flex-1 relative">
                                                    <select
                                                        value={editedClient.clientStartPeriod?.split('-')[0] || new Date().getFullYear().toString()}
                                                        onChange={(e) => {
                                                            const year = e.target.value;
                                                            const sem = editedClient.clientStartPeriod?.split('-')[1] || 'S1';
                                                            setEditedClient({ ...editedClient, clientStartPeriod: `${year}-${sem}` });
                                                        }}
                                                        className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all appearance-none cursor-pointer"
                                                    >
                                                        {Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - 3 + i).toString()).map(y => (
                                                            <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
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
                                                        className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="S1" className="bg-slate-900 text-white">1er Semestre (S1)</option>
                                                        <option value="S2" className="bg-slate-900 text-white">2do Semestre (S2)</option>
                                                    </select>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <LucideIcons.ChevronDown size={14} />
                                                    </div>
                                                </div>
                                            </div>
                                            {editedClient.clientStartPeriod?.endsWith('-S2') && (
                                                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                                    <LucideIcons.Info size={12} strokeWidth={2.5} />
                                                    <span>Ciclo S2 activo: Cerrará en diciembre y se declarará en enero.</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
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
                                                    className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all appearance-none cursor-pointer"
                                                >
                                                    {Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - 3 + i).toString()).map(y => (
                                                        <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
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
                                                    className="w-full bg-slate-100/80 dark:bg-[#0b1326]/80 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00A896] transition-all appearance-none cursor-pointer"
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
                                                        <option key={m.val} value={m.val} className="bg-slate-900 text-white">{m.label}</option>
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
                                        className={`px-4 py-3 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white tracking-wide shadow-sm flex items-center justify-between ${onStartEdit ? 'cursor-pointer hover:border-[#00A896]/40 hover:bg-slate-200/50 dark:hover:bg-[#0b1326] transition-all' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <LucideIcons.CalendarDays size={14} className="text-[#00A896]" />
                                            <span className="font-mono text-[#00A896] font-bold uppercase">
                                                {(() => {
                                                    const val = editedClient.clientStartPeriod;
                                                    if (!val) return <span className="text-slate-500 font-sans font-normal">Sin fecha configurada</span>;
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
                                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-xl font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                                                    Espera en Enero
                                                </span>
                                            )}
                                            {onStartEdit && <LucideIcons.Pencil size={12} className="text-slate-400 hover:text-[#00A896] transition-colors" />}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-5 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10 space-y-4 font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Creado</span>
                                    <span className="text-[10px] font-mono text-[#00A896] font-bold">
                                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'No Registrada'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Último Acceso</span>
                                    <span className="text-[10px] font-mono text-slate-300 font-bold">Hoy</span>
                                </div>
                                <div className="pt-4 border-t border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-[#00A896]/15 border border-[#00A896]/30 flex items-center justify-center text-[#00A896] shadow-sm">
                                            <LucideIcons.ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-white uppercase tracking-widest font-display">Estado del Perfil</div>
                                            <div className="text-[9px] font-bold text-[#00A896] uppercase tracking-widest mt-0.5">Seguro y Encriptado</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Zona Táctica de Estado y Peligro */}
                            <div className="p-5 bg-slate-100/60 dark:bg-[#0b1326]/80 rounded-2xl border border-slate-200/40 dark:border-white/10 space-y-4 font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado Contable</span>
                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono ${
                                        (editedClient.isActive ?? true)
                                            ? 'bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30'
                                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    }`}>
                                        {(editedClient.isActive ?? true) ? '● Activo en Matriz' : '○ Dado de Baja'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Creado</span>
                                    <span className="text-[10px] font-mono text-[#00A896] font-bold">
                                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'No Registrada'}
                                    </span>
                                </div>
                            </div>

                            {/* Botón de Dar de Baja / Reactivar */}
                            <button 
                                type="button"
                                onClick={onDeactivateClient}
                                className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group/btn shadow-sm active:scale-95 cursor-pointer font-mono ${
                                    (editedClient.isActive ?? true)
                                        ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/25 hover:border-amber-500/40 text-amber-300'
                                        : 'bg-[#00A896]/10 hover:bg-[#00A896]/15 border-[#00A896]/25 hover:border-[#00A896]/40 text-[#00A896]'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${
                                        (editedClient.isActive ?? true) ? 'bg-amber-500/20 text-amber-400' : 'bg-[#00A896]/20 text-[#00A896]'
                                    }`}>
                                        <LucideIcons.Power size={16} />
                                    </div>
                                    <div className="text-left font-display">
                                        <div className="text-[10px] font-bold uppercase tracking-widest">
                                            {(editedClient.isActive ?? true) ? 'Dar de Baja Cliente' : 'Reactivar Cliente'}
                                        </div>
                                        <div className="text-[9px] font-normal text-slate-400 mt-0.5 font-mono">
                                            {(editedClient.isActive ?? true) ? 'Pausar declaraciones automáticas' : 'Restablecer en matriz activa'}
                                        </div>
                                    </div>
                                </div>
                                <LucideIcons.ArrowRightLeft size={16} className="opacity-60 group-hover/btn:translate-x-1 transition-all" />
                            </button>

                            {/* Botón de Eliminar a la Papelera */}
                            <button 
                                type="button"
                                onClick={onDeleteClient}
                                className="w-full p-4 bg-rose-500/10 hover:bg-rose-500/15 rounded-2xl border border-rose-500/25 hover:border-rose-500/40 text-rose-400 transition-all group/del flex items-center justify-between shadow-sm active:scale-95 cursor-pointer font-mono"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
                                        <LucideIcons.Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                                    </div>
                                    <div className="text-left font-display">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Enviar a Papelera</div>
                                        <div className="text-[9px] font-normal text-slate-400 mt-0.5 font-mono">Borrado seguro recuperable</div>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight size={16} className="text-rose-400 opacity-60 group-hover/del:translate-x-1 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
