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
        <div className="space-y-8">
            <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 block uppercase tracking-[0.3em] ml-1">Protocolos Anuales / Trámites Especiales</label>
                <div className="grid grid-cols-1 gap-3">
                    <label className={`flex items-center p-5 rounded-2xl border transition-all duration-500 ${editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'cursor-not-allowed bg-slate-900/40 opacity-60 border-white/5' : 'cursor-pointer'} ${editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'border-white/5 bg-slate-950/40 hover:border-white/20'}`}>
                        <div className="relative flex items-center justify-center mr-4">
                            <input
                                type="checkbox"
                                disabled={disabled || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular}
                                checked={editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnnualRenta: e.target.checked } })}
                                className="h-6 w-6 appearance-none border-2 border-white/10 rounded-lg checked:bg-cyan-500 checked:border-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                            />
                            {(editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular) && <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                            <span className={`text-[11px] font-black uppercase tracking-widest ${editedClient.taxProfile?.requiresAnnualRenta || editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular ? 'text-white' : 'text-slate-500'}`}>Impuesto a la Renta Corporativa/Personal</span>
                            {(editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular) && (
                                <span className="text-[9px] text-amber-400 font-black bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full ml-2 uppercase tracking-tighter">Obligatorio: {editedClient.regime}</span>
                            )}
                        </div>
                    </label>

                    <label className={`flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-500 ${editedClient.taxProfile?.requiresAnexosGastos ? 'border-sky-500/50 bg-sky-500/5 shadow-[0_0_20px_rgba(14,165,233,0.1)]' : 'border-white/5 bg-slate-950/40 hover:border-white/20'}`}>
                        <div className="relative flex items-center justify-center mr-4">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresAnexosGastos || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnexosGastos: e.target.checked } })}
                                className="h-6 w-6 appearance-none border-2 border-white/10 rounded-lg checked:bg-sky-500 checked:border-transparent transition-all cursor-pointer shadow-inner"
                            />
                            {editedClient.taxProfile?.requiresAnexosGastos && <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${editedClient.taxProfile?.requiresAnexosGastos ? 'text-white' : 'text-slate-500'}`}>Anexo Gastos Personales (Inflexibilidad)</span>
                    </label>

                    <label className={`flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-500 ${editedClient.taxProfile?.hasActiveDevolucionIva ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/5 bg-slate-950/40 hover:border-white/20'}`}>
                        <div className="relative flex items-center justify-center mr-4">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.hasActiveDevolucionIva || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), hasActiveDevolucionIva: e.target.checked } })}
                                className="h-6 w-6 appearance-none border-2 border-white/10 rounded-lg checked:bg-emerald-500 checked:border-transparent transition-all cursor-pointer"
                            />
                            {editedClient.taxProfile?.hasActiveDevolucionIva && <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${editedClient.taxProfile?.hasActiveDevolucionIva ? 'text-white' : 'text-slate-500'}`}>Ciclo de Retorno: Devolución IVA/Renta</span>
                    </label>

                    <label className={`flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-500 ${editedClient.taxProfile?.hasActiveElderlyDevolucionIva ? 'border-rose-500/50 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'border-white/5 bg-slate-950/40 hover:border-white/20'}`}>
                        <div className="relative flex items-center justify-center mr-4">
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
                                className="h-6 w-6 appearance-none border-2 border-white/10 rounded-lg checked:bg-rose-500 checked:border-transparent transition-all cursor-pointer"
                            />
                            {editedClient.taxProfile?.hasActiveElderlyDevolucionIva && <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${editedClient.taxProfile?.hasActiveElderlyDevolucionIva ? 'text-white' : 'text-slate-500'}`}>Devolución IVA Tercera Edad ($5/mes)</span>
                    </label>
                </div>
            </div>

            <div className="pt-8 border-t border-white/10">
                <label className="text-[10px] font-black text-slate-500 block uppercase tracking-[0.3em] mb-4 ml-1">Vigilancia ICE / PVP (Control de Consumo)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-500 ${editedClient.taxProfile?.requiresIce ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-white/5 bg-slate-950/40 hover:border-white/20'}`}>
                        <div className="relative flex items-center justify-center mr-4">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresIce || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresIce: e.target.checked } })}
                                className="h-6 w-6 appearance-none border-2 border-white/10 rounded-lg checked:bg-amber-500 checked:border-transparent transition-all cursor-pointer"
                            />
                            {editedClient.taxProfile?.requiresIce && <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${editedClient.taxProfile?.requiresIce ? 'text-white' : 'text-slate-500'}`}>Vector ICE (Intermitente)</span>
                    </label>
                    <label className={`flex items-center p-5 rounded-2xl border cursor-pointer transition-all duration-500 ${editedClient.taxProfile?.requiresAnexoPvp ? 'border-rose-500/50 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'border-white/5 bg-slate-950/40 hover:border-white/20'}`}>
                        <div className="relative flex items-center justify-center mr-4">
                            <input
                                type="checkbox"
                                disabled={disabled}
                                checked={editedClient.taxProfile?.requiresAnexoPvp || false}
                                onChange={e => setEditedClient({ ...editedClient, taxProfile: { ...(editedClient.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: false, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), requiresAnexoPvp: e.target.checked } })}
                                className="h-6 w-6 appearance-none border-2 border-white/10 rounded-lg checked:bg-rose-500 checked:border-transparent transition-all cursor-pointer"
                            />
                            {editedClient.taxProfile?.requiresAnexoPvp && <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={4} />}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${editedClient.taxProfile?.requiresAnexoPvp ? 'text-white' : 'text-slate-500'}`}>Módulo PVP (Anual Externo)</span>
                    </label>
                </div>
            </div>
        </div>
    );
};
