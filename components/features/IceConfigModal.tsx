import React, { useState } from 'react';
import { Flame, Save, X } from 'lucide-react';
import type { Client } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';

/**
 * Configuración del anexo ICE de un cliente.
 *
 * Es lo que no cambia mes a mes: el código de producto ICE, quién compra, el
 * tipo de venta y la forma de importe. Las ventas de cada mes llegan aparte
 * (las publica la extensión al preparar el anexo).
 */
interface Props {
    client: Client;
    onClose: () => void;
}

export interface IceConfig {
    codProdICE: string;
    tipoIdCliente: string;
    idCliente: string;
    tipoVentaICE: string;
    actImport: string;
}

const porDefecto = (client: Client, actual?: IceConfig | null): IceConfig => ({
    codProdICE: actual?.codProdICE || '',
    tipoIdCliente: actual?.tipoIdCliente || 'F',
    idCliente: actual?.idCliente || '9999999999999',
    tipoVentaICE: actual?.tipoVentaICE || '1',
    actImport: actual?.actImport || '02',
});

const IceConfigModal: React.FC<Props> = ({ client, onClose }) => {
    const { updateClient } = useAppStore();
    const { toast } = useToast();
    const [cfg, setCfg] = useState<IceConfig>(() => porDefecto(client, (client.taxProfile as any)?.ice_config));
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        if (!/^\d{3,5}-\d{3}-\d{6}-\d{3}-\d{6}-\d{2}-\d{3}-\d{6}$/.test(cfg.codProdICE.trim())) {
            toast.error('El código de producto ICE no tiene el formato del SRI (ej. 3031-053-…).');
            return;
        }
        setGuardando(true);
        try {
            const tp = (client.taxProfile as any) || {};
            await updateClient(client.id, {
                taxProfile: {
                    ...tp,
                    ice_config: {
                        codProdICE: cfg.codProdICE.trim(),
                        tipoIdCliente: cfg.tipoIdCliente,
                        idCliente: cfg.idCliente.trim() || '9999999999999',
                        tipoVentaICE: cfg.tipoVentaICE,
                        actImport: cfg.actImport,
                    },
                },
            } as any);
            toast.success('Configuración ICE guardada.');
            onClose();
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-[#C9A96E]/30 bg-[#051424] p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A96E]/15 text-[#C9A96E]">
                            <Flame size={16} />
                        </span>
                        <div>
                            <h3 className="font-display text-lg font-black text-white">Anexo ICE</h3>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500">{client.name}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5">
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500">Código de producto ICE</label>
                        <input
                            value={cfg.codProdICE}
                            onChange={(e) => setCfg({ ...cfg, codProdICE: e.target.value })}
                            placeholder="3031-053-049147-013-000750-66-593-000012"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-slate-100 outline-none focus:border-[#C9A96E]/50"
                        />
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                            33 dígitos sin guiones: <b className="text-slate-300">3031</b> impuesto ·{' '}
                            <b className="text-slate-300">053</b> clasificación · <b className="text-slate-300">049147</b> marca ·{' '}
                            <b className="text-slate-300">013</b> presentación · <b className="text-slate-300">000750</b> capacidad ·{' '}
                            <b className="text-slate-300">66</b> unidad · <b className="text-slate-300">593</b> país ·{' '}
                            <b className="text-slate-300">000012</b> grado.
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                            Vino tinto/rosado nacional: 3031. Variantes: vino de frutas 54/55, vino espumoso 56.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[9px] uppercase tracking-widest text-slate-500">Tipo ID</label>
                            <select
                                value={cfg.tipoIdCliente}
                                onChange={(e) => setCfg({ ...cfg, tipoIdCliente: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-[11px] text-slate-100 outline-none"
                            >
                                <option value="F">F · consumidor final</option>
                                <option value="C">C · cédula</option>
                                <option value="R">R · RUC</option>
                                <option value="P">P · pasaporte</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] uppercase tracking-widest text-slate-500">Tipo venta</label>
                            <input
                                value={cfg.tipoVentaICE}
                                onChange={(e) => setCfg({ ...cfg, tipoVentaICE: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 font-mono text-[11px] text-slate-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] uppercase tracking-widest text-slate-500">Importe</label>
                            <select
                                value={cfg.actImport}
                                onChange={(e) => setCfg({ ...cfg, actImport: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-[11px] text-slate-100 outline-none"
                            >
                                <option value="01">01 · mensual</option>
                                <option value="02">02 · normal</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500">Identificación del cliente</label>
                        <input
                            value={cfg.idCliente}
                            onChange={(e) => setCfg({ ...cfg, idCliente: e.target.value })}
                            placeholder="9999999999999"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-slate-100 outline-none focus:border-[#C9A96E]/50"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">9999999999999 = consumidor final (cuando no se identifica al comprador).</p>
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={guardando}
                        onClick={() => void guardar()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50"
                    >
                        <Save size={12} /> {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IceConfigModal;
