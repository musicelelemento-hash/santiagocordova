import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, TaxRegime } from '../../../types';

interface ExtraObligationsCheckboxesProps {
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    disabled?: boolean;
}

export const ExtraObligationsCheckboxes: React.FC<ExtraObligationsCheckboxesProps> = ({ editedClient, setEditedClient, disabled = false }) => {
    return (
        <div className="space-y-12">
            {/* Primary Annual Protocols Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.3em]">
                        ANNUAL_PROTOCOLS // SPECIAL_PROCEDURES
                    </label>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {/* Annual Renta Checkbox */}
                    <label className={`group flex items-center p-6 rounded-2xl border transition-all duration-500 relative overflow-hidden ${editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'cursor-not-allowed bg-slate-50/50 opacity-60 border-slate-200' : 'cursor-pointer hover:border-blue-500/30 hover:bg-blue-50/10'} ${editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'border-blue-500/20 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
                        <div className="relative flex items-center justify-center mr-6 z-10">
                            <input
                                type="checkbox"
                                disabled={disabled || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular}
                                checked={editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnnualRenta: e.target.checked } })}
                                className="h-6 w-6 appearance-none border border-slate-300 rounded-lg checked:bg-slate-900 checked:border-transparent transition-all cursor-pointer disabled:cursor-not-allowed shadow-inner"
                            />
                            {(editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular) && (
                                <LucideIcons.Check size={14} className="absolute text-blue-400 pointer-events-none" strokeWidth={4} />
                            )}
                        </div>
                        <div className="flex-1 flex justify-between items-center z-10">
                            <div className="flex flex-col">
                                <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'text-slate-900' : 'text-slate-500'}`}>
                                    Corporate/Personal Income Tax
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 mt-0.5">IMPUESTO_A_LA_RENTA_ANUAL</span>
                            </div>
                            
                            {(editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular) && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <LucideIcons.AlertCircle size={10} className="text-amber-600" />
                                    <span className="text-[8px] text-amber-700 font-mono font-black uppercase tracking-wider">MANDATORY::{editedClient.regime}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Interactive Glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </label>

                    {/* Anexos Gastos Checkbox */}
                    <label className={`group flex items-center p-6 rounded-2xl border cursor-pointer transition-all duration-500 relative overflow-hidden ${editedClient.taxProfile?.requiresAnexosGastos ? 'border-indigo-500/20 bg-indigo-50/30' : 'border-slate-200 bg-white hover:border-indigo-500/30 hover:bg-slate-50/30'}`}>
                        <div className="relative flex items-center justify-center mr-6 z-10">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresAnexosGastos || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnexosGastos: e.target.checked } })}
                                className="h-6 w-6 appearance-none border border-slate-300 rounded-lg checked:bg-slate-900 checked:border-transparent transition-all cursor-pointer shadow-inner"
                            />
                            {editedClient.taxProfile?.requiresAnexosGastos && <LucideIcons.Check size={14} className="absolute text-indigo-400 pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex flex-col z-10">
                            <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${editedClient.taxProfile?.requiresAnexosGastos ? 'text-slate-900' : 'text-slate-500'}`}>
                                Personal Expense Annex (Inflexibility)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 mt-0.5">ANEXO_GASTOS_PERSONALES</span>
                        </div>
                    </label>

                    {/* Devolución IVA Checkbox */}
                    <label className={`group flex items-center p-6 rounded-2xl border cursor-pointer transition-all duration-500 relative overflow-hidden ${editedClient.taxProfile?.hasActiveDevolucionIva ? 'border-emerald-500/20 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-emerald-500/30 hover:bg-slate-50/30'}`}>
                        <div className="relative flex items-center justify-center mr-6 z-10">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.hasActiveDevolucionIva || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), hasActiveDevolucionIva: e.target.checked } })}
                                className="h-6 w-6 appearance-none border border-slate-300 rounded-lg checked:bg-slate-900 checked:border-transparent transition-all cursor-pointer shadow-inner"
                            />
                            {editedClient.taxProfile?.hasActiveDevolucionIva && <LucideIcons.Check size={14} className="absolute text-emerald-400 pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex flex-col z-10">
                            <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${editedClient.taxProfile?.hasActiveDevolucionIva ? 'text-slate-900' : 'text-slate-500'}`}>
                                Return Cycle: IVA/Income Refund
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 mt-0.5">CICLO_DE_RETORNO_FISCAL</span>
                        </div>
                    </label>

                    {/* Elderly Devolución Checkbox */}
                    <label className={`group flex items-center p-6 rounded-2xl border cursor-pointer transition-all duration-500 relative overflow-hidden ${editedClient.taxProfile?.hasActiveElderlyDevolucionIva ? 'border-rose-500/20 bg-rose-50/30' : 'border-slate-200 bg-white hover:border-rose-500/30 hover:bg-slate-50/30'}`}>
                        <div className="relative flex items-center justify-center mr-6 z-10">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.hasActiveElderlyDevolucionIva || false}
                                onChange={e => setEditedClient({ 
                                    ...editedClient, 
                                    hasElderlyDevolucionIva: e.target.checked,
                                    elderlyDevolucionIvaStatus: e.target.checked ? (editedClient.elderlyDevolucionIvaStatus || 'Pendiente') : undefined,
                                    taxProfile: { 
                                        ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), 
                                        hasActiveElderlyDevolucionIva: e.target.checked 
                                    } 
                                })}
                                className="h-6 w-6 appearance-none border border-slate-300 rounded-lg checked:bg-slate-900 checked:border-transparent transition-all cursor-pointer shadow-inner"
                            />
                            {editedClient.taxProfile?.hasActiveElderlyDevolucionIva && <LucideIcons.Check size={14} className="absolute text-rose-400 pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex flex-col z-10">
                            <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${editedClient.taxProfile?.hasActiveElderlyDevolucionIva ? 'text-slate-900' : 'text-slate-500'}`}>
                                Elderly IVA Refund ($5/mo Service)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 mt-0.5">DEVOLUCION_IVA_TERCERA_EDAD</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Consumption Control Section */}
            <div className="pt-10 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-4 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.3em]">
                        CONSUMPTION_CONTROL // ICE_PVP_VIGILANCE
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ICE Checkbox */}
                    <label className={`group flex items-center p-6 rounded-2xl border cursor-pointer transition-all duration-500 relative overflow-hidden ${editedClient.taxProfile?.requiresIce ? 'border-amber-500/20 bg-amber-50/30' : 'border-slate-200 bg-white hover:border-amber-500/30 hover:bg-slate-50/30'}`}>
                        <div className="relative flex items-center justify-center mr-6 z-10">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresIce || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresIce: e.target.checked } })}
                                className="h-6 w-6 appearance-none border border-slate-300 rounded-lg checked:bg-slate-900 checked:border-transparent transition-all cursor-pointer shadow-inner"
                            />
                            {editedClient.taxProfile?.requiresIce && <LucideIcons.Check size={14} className="absolute text-amber-400 pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex flex-col z-10">
                            <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${editedClient.taxProfile?.requiresIce ? 'text-slate-900' : 'text-slate-500'}`}>
                                ICE Vector (Intermittent)
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">VIGILANCIA_ICE_V1</span>
                        </div>
                    </label>

                    {/* PVP Checkbox */}
                    <label className={`group flex items-center p-6 rounded-2xl border cursor-pointer transition-all duration-500 relative overflow-hidden ${editedClient.taxProfile?.requiresAnexoPvp ? 'border-rose-500/20 bg-rose-50/30' : 'border-slate-200 bg-white hover:border-rose-500/30 hover:bg-slate-50/30'}`}>
                        <div className="relative flex items-center justify-center mr-6 z-10">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresAnexoPvp || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnexoPvp: e.target.checked } })}
                                className="h-6 w-6 appearance-none border border-slate-300 rounded-lg checked:bg-slate-900 checked:border-transparent transition-all cursor-pointer shadow-inner"
                            />
                            {editedClient.taxProfile?.requiresAnexoPvp && <LucideIcons.Check size={14} className="absolute text-rose-400 pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex flex-col z-10">
                            <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${editedClient.taxProfile?.requiresAnexoPvp ? 'text-slate-900' : 'text-slate-500'}`}>
                                PVP Module (Annual External)
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">CONTROL_PRECIOS_VENTA</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};
