import React from 'react';
import { Check } from 'lucide-react';
import { Client, TaxRegime } from '../../../types';

interface ExtraObligationsCheckboxesProps {
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    disabled?: boolean;
}

export const ExtraObligationsCheckboxes: React.FC<ExtraObligationsCheckboxesProps> = ({ editedClient, setEditedClient, disabled = false }) => {
    return (
        <div className="space-y-10">
            <div className="space-y-6">
                <label className="text-[10px] font-black text-slate-400 block uppercase tracking-[0.3em] ml-1 font-premium">PROTOCOLOS ANUALES / TRÁMITES ESPECIALES</label>
                <div className="grid grid-cols-1 gap-4">
                    <label className={`flex items-center p-6 rounded-[1.5rem] border transition-all duration-700 ${editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'cursor-not-allowed bg-slate-50 opacity-60 border-slate-100' : 'cursor-pointer shadow-sm hover:shadow-md'} ${editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'border-blue-200 bg-blue-50/50 shadow-blue-100' : 'border-slate-100 bg-white hover:border-blue-100'}`}>
                        <div className="relative flex items-center justify-center mr-5">
                            <input
                                type="checkbox"
                                disabled={disabled || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular}
                                checked={editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnnualRenta: e.target.checked } })}
                                className="h-7 w-7 appearance-none border-2 border-slate-200 rounded-xl checked:bg-blue-600 checked:border-transparent transition-all cursor-pointer disabled:cursor-not-allowed bg-white shadow-sm"
                            />
                            {(editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular) && <Check size={16} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                            <span className={`text-[12px] font-black uppercase tracking-widest font-premium ${editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'text-slate-900' : 'text-slate-500'}`}>Impuesto a la Renta Corporativa/Personal</span>
                            {(editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular) && (
                                <span className="text-[10px] text-amber-700 font-black bg-amber-50 border border-amber-100 px-4 py-1.5 rounded-xl ml-4 uppercase tracking-widest font-premium">OBLIGATORIO: {editedClient.regime}</span>
                            )}
                        </div>
                    </label>

                    <label className={`flex items-center p-6 rounded-[1.5rem] border cursor-pointer transition-all duration-700 shadow-sm hover:shadow-md ${editedClient.taxProfile?.requiresAnexosGastos ? 'border-blue-200 bg-blue-50/50 shadow-blue-100' : 'border-slate-100 bg-white hover:border-blue-100'}`}>
                        <div className="relative flex items-center justify-center mr-5">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresAnexosGastos || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnexosGastos: e.target.checked } })}
                                className="h-7 w-7 appearance-none border-2 border-slate-200 rounded-xl checked:bg-blue-600 checked:border-transparent transition-all cursor-pointer bg-white shadow-sm"
                            />
                            {editedClient.taxProfile?.requiresAnexosGastos && <Check size={16} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[12px] font-black uppercase tracking-widest font-premium ${editedClient.taxProfile?.requiresAnexosGastos ? 'text-slate-900' : 'text-slate-500'}`}>Anexo Gastos Personales (Inflexibilidad)</span>
                    </label>

                    <label className={`flex items-center p-6 rounded-[1.5rem] border cursor-pointer transition-all duration-700 shadow-sm hover:shadow-md ${editedClient.taxProfile?.hasActiveDevolucionIva ? 'border-emerald-200 bg-emerald-50/50 shadow-emerald-100' : 'border-slate-100 bg-white hover:border-emerald-100'}`}>
                        <div className="relative flex items-center justify-center mr-5">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.hasActiveDevolucionIva || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), hasActiveDevolucionIva: e.target.checked } })}
                                className="h-7 w-7 appearance-none border-2 border-slate-200 rounded-xl checked:bg-emerald-600 checked:border-transparent transition-all cursor-pointer bg-white shadow-sm"
                            />
                            {editedClient.taxProfile?.hasActiveDevolucionIva && <Check size={16} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[12px] font-black uppercase tracking-widest font-premium ${editedClient.taxProfile?.hasActiveDevolucionIva ? 'text-emerald-900' : 'text-slate-500'}`}>Ciclo de Retorno: Devolución IVA/Renta</span>
                    </label>

                    <label className={`flex items-center p-6 rounded-[1.5rem] border cursor-pointer transition-all duration-700 shadow-sm hover:shadow-md ${editedClient.taxProfile?.hasActiveElderlyDevolucionIva ? 'border-rose-200 bg-rose-50/50 shadow-rose-100' : 'border-slate-100 bg-white hover:border-rose-100'}`}>
                        <div className="relative flex items-center justify-center mr-5">
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
                                className="h-7 w-7 appearance-none border-2 border-slate-200 rounded-xl checked:bg-rose-600 checked:border-transparent transition-all cursor-pointer bg-white shadow-sm"
                            />
                            {editedClient.taxProfile?.hasActiveElderlyDevolucionIva && <Check size={16} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[12px] font-black uppercase tracking-widest font-premium ${editedClient.taxProfile?.hasActiveElderlyDevolucionIva ? 'text-rose-900' : 'text-slate-500'}`}>Devolución IVA Tercera Edad ($5/mes)</span>
                    </label>
                </div>
            </div>

            <div className="pt-10 border-t border-slate-50">
                <label className="text-[10px] font-black text-slate-400 block uppercase tracking-[0.3em] mb-6 ml-1 font-premium">VIGILANCIA ICE / PVP (CONTROL DE CONSUMO)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`flex items-center p-6 rounded-[1.5rem] border cursor-pointer transition-all duration-700 shadow-sm hover:shadow-md ${editedClient.taxProfile?.requiresIce ? 'border-amber-200 bg-amber-50/50 shadow-amber-100' : 'border-slate-100 bg-white hover:border-amber-100'}`}>
                        <div className="relative flex items-center justify-center mr-5">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresIce || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresIce: e.target.checked } })}
                                className="h-7 w-7 appearance-none border-2 border-slate-200 rounded-xl checked:bg-amber-600 checked:border-transparent transition-all cursor-pointer bg-white shadow-sm"
                            />
                            {editedClient.taxProfile?.requiresIce && <Check size={16} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-widest font-premium ${editedClient.taxProfile?.requiresIce ? 'text-amber-900' : 'text-slate-500'}`}>Vector ICE (Intermitente)</span>
                    </label>
                    <label className={`flex items-center p-6 rounded-[1.5rem] border cursor-pointer transition-all duration-700 shadow-sm hover:shadow-md ${editedClient.taxProfile?.requiresAnexoPvp ? 'border-rose-200 bg-rose-50/50 shadow-rose-100' : 'border-slate-100 bg-white hover:border-rose-100'}`}>
                        <div className="relative flex items-center justify-center mr-5">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresAnexoPvp || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnexoPvp: e.target.checked } })}
                                className="h-7 w-7 appearance-none border-2 border-slate-200 rounded-xl checked:bg-rose-600 checked:border-transparent transition-all cursor-pointer bg-white shadow-sm"
                            />
                            {editedClient.taxProfile?.requiresAnexoPvp && <Check size={16} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-widest font-premium ${editedClient.taxProfile?.requiresAnexoPvp ? 'text-rose-900' : 'text-slate-500'}`}>Módulo PVP (Anual Externo)</span>
                    </label>
                </div>
            </div>
        </div>
    );
};
