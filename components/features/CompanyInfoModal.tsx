import React, { useMemo, useState } from 'react';
import { Building2, Plus, Save, Trash2, X } from 'lucide-react';
import type { Client } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';

/**
 * Ficha societaria: tipo de sociedad, constitución, socios y beneficiarios.
 * Es lo que alimenta el REBEFICS (APS) y queda en taxProfile.company.
 */
interface Props {
    client: Client;
    onClose: () => void;
}

interface Persona {
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    nombres: string;
    porcentaje: number;
    esBeneficiarioFinal: boolean;
    tipoRelacionadoSociedad: string;
    fechaNacimiento: string;
    paisResidenciaFiscal: string;
}

const vacia = (): Persona => ({
    tipoIdentificacion: 'C',
    numeroIdentificacion: '',
    nombres: '',
    porcentaje: 0,
    esBeneficiarioFinal: true,
    tipoRelacionadoSociedad: '10',
    fechaNacimiento: '',
    paisResidenciaFiscal: '593',
});

const CompanyInfoModal: React.FC<Props> = ({ client, onClose }) => {
    const { updateClient } = useAppStore();
    const { toast } = useToast();

    const company: any = (client.taxProfile as any)?.company || {};
    const [tipoSociedad, setTipoSociedad] = useState<string>(company.tipoSociedad || '01');
    const [constitutionDate, setConstitutionDate] = useState<string>(company.constitutionDate || '');
    const [distribuyo, setDistribuyo] = useState<boolean>(company.distribuyoDividendos === true);
    const [activos, setActivos] = useState<string>(company.assetsTotal ? String(company.assetsTotal) : '');
    const [personas, setPersonas] = useState<Persona[]>(
        Array.isArray(company.accionistas) && company.accionistas.length ? company.accionistas : [vacia()],
    );
    const [guardando, setGuardando] = useState(false);

    const total = useMemo(
        () => personas.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0),
        [personas],
    );

    const set = (i: number, campo: keyof Persona, valor: any) => {
        setPersonas((prev) => prev.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)));
    };

    const guardar = async () => {
        if (personas.some((p) => String(p.numeroIdentificacion).replace(/\D/g, '').length < 10)) {
            toast.error('Hay identificaciones incompletas (mínimo 10 dígitos).');
            return;
        }
        if (Math.abs(total - 100) > 0.01) {
            toast.error(`Los porcentajes suman ${total.toFixed(2)}%. Deben sumar 100%.`);
            return;
        }
        setGuardando(true);
        try {
            const tp = (client.taxProfile as any) || {};
            const socios = personas.map((p, i) => ({
                ...p,
                porcentaje: Number(p.porcentaje) || 0,
                tipoRelacionadoSociedad: i === 0 ? '10' : p.tipoRelacionadoSociedad,
            }));
            await updateClient(client.id, {
                taxProfile: {
                    ...tp,
                    entity_type: 'sociedad',
                    company: {
                        ...(tp.company || {}),
                        tipoSociedad,
                        constitutionDate: constitutionDate || undefined,
                        distribuyoDividendos: distribuyo,
                        accionistas: socios,
                        beneficiarios: socios.filter((p) => p.esBeneficiarioFinal),
                    },
                },
            } as any);
            toast.success('Ficha societaria guardada.');
            onClose();
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#C9A96E]/30 bg-[#051424] p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A96E]/15 text-[#C9A96E]"><Building2 size={16} /></span>
                        <div>
                            <h3 className="font-display text-lg font-black text-white">Datos de la sociedad</h3>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500">{client.name} · {client.ruc}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"><X size={16} /></button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500">Tipo de sociedad</label>
                        <select value={tipoSociedad} onChange={(e) => setTipoSociedad(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-[11px] text-slate-100 outline-none">
                            <option value="01">01 · S.A.S.</option>
                            <option value="02">02 · Cía. Ltda.</option>
                            <option value="03">03 · S.A.</option>
                            <option value="04">04 · EP</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500">Constitución</label>
                        <input type="date" value={constitutionDate} onChange={(e) => setConstitutionDate(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-[11px] text-slate-100 outline-none" />
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-[10px] text-slate-300">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Activos totales (USD, umbral de auditoría SCVS)
                        <input
                            type="number"
                            min="0"
                            value={activos}
                            onChange={(e) => setActivos(e.target.value)}
                            placeholder="Ej. 450000"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-[#C9A96E]/50"
                        />
                    </label>
                        <input type="checkbox" checked={distribuyo} onChange={(e) => setDistribuyo(e.target.checked)} className="h-3.5 w-3.5 accent-[#C9A96E]" />
                        Reparte dividendos (activa ADI)
                    </label>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Socios / accionistas</p>
                    <span className={`font-mono text-[10px] ${Math.abs(total - 100) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>suma {total.toFixed(2)}%</span>
                </div>

                <div className="mt-2 space-y-2">
                    {personas.map((p, i) => (
                        <div key={i} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                            <div className="grid gap-2 sm:grid-cols-12">
                                <div className="sm:col-span-2">
                                    <label className="text-[8px] uppercase tracking-widest text-slate-500">Tipo</label>
                                    <select value={p.tipoIdentificacion} onChange={(e) => set(i, 'tipoIdentificacion', e.target.value)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 text-[10px] text-slate-100 outline-none">
                                        <option value="C">C · cédula</option>
                                        <option value="R">R · RUC</option>
                                        <option value="P">P · pasaporte</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="text-[8px] uppercase tracking-widest text-slate-500">Identificación</label>
                                    <input value={p.numeroIdentificacion} onChange={(e) => set(i, 'numeroIdentificacion', e.target.value.replace(/\D/g, ''))} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 font-mono text-[10px] text-slate-100 outline-none" />
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="text-[8px] uppercase tracking-widest text-slate-500">Nombres</label>
                                    <input value={p.nombres} onChange={(e) => set(i, 'nombres', e.target.value)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 text-[10px] uppercase text-slate-100 outline-none" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-[8px] uppercase tracking-widest text-slate-500">%</label>
                                    <input type="number" min={0} max={100} value={p.porcentaje} onChange={(e) => set(i, 'porcentaje', Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 font-mono text-[10px] text-slate-100 outline-none" />
                                </div>
                                <div className="flex items-end justify-between sm:col-span-1">
                                    <button type="button" onClick={() => setPersonas((prev) => prev.filter((_, k) => k !== i))} className="rounded-lg border border-rose-500/30 p-1 text-rose-300 hover:bg-rose-500/10" title="Quitar socio"><Trash2 size={12} /></button>
                                </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-1 text-[9px] text-slate-400">
                                    <input type="checkbox" checked={p.esBeneficiarioFinal} onChange={(e) => set(i, 'esBeneficiarioFinal', e.target.checked)} className="h-3 w-3 accent-[#C9A96E]" />
                                    Beneficiario final
                                </label>
                                <label className="flex items-center gap-1 text-[9px] text-slate-400">
                                    Nacimiento
                                    <input value={p.fechaNacimiento} onChange={(e) => set(i, 'fechaNacimiento', e.target.value)} placeholder="dd/mm/aaaa" className="w-24 rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[9px] text-slate-100 outline-none" />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <button type="button" onClick={() => setPersonas((prev) => [...prev, vacia()])} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
                    <Plus size={12} /> Agregar socio
                </button>

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">Cancelar</button>
                    <button type="button" disabled={guardando} onClick={() => void guardar()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50">
                        <Save size={12} /> {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyInfoModal;
