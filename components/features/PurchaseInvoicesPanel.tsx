import React, { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, ReceiptText } from 'lucide-react';
import { agruparPorProveedor, dinero, type FacturaCompra } from '../../services/purchases';

/**
 * Compras del mes por proveedor, con el crédito tributario separado.
 *
 * Se alimenta del resumen que deja la extensión al declarar
 * (`taxProfile.purchaseSummary`): `{ '2026-10': FacturaCompra[] }`.
 * Si no hay datos, no se muestra: no inventa compras.
 */

interface Props {
    porPeriodo?: Record<string, FacturaCompra[]>;
}

const PurchaseInvoicesPanel: React.FC<Props> = ({ porPeriodo }) => {
    const periodos = useMemo(
        () => Object.keys(porPeriodo || {}).filter((p) => Array.isArray(porPeriodo?.[p]) && (porPeriodo?.[p] || []).length > 0).sort().reverse(),
        [porPeriodo],
    );
    const [periodo, setPeriodo] = useState<string | null>(null);
    const activo = periodo && periodos.includes(periodo) ? periodo : periodos[0];
    const resumen = useMemo(() => agruparPorProveedor(activo ? porPeriodo?.[activo] : []), [activo, porPeriodo]);

    if (!periodos.length || !resumen.proveedores.length) return null;

    const nombrePeriodo = (p: string) => {
        const [y, m] = p.split('-').map(Number);
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${meses[(m || 1) - 1]} ${String(y).slice(2)}`;
    };

    return (
        <section className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4 text-slate-200">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ReceiptText size={16} className="text-[#C9A96E]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#C9A96E]">Compras por proveedor</h3>
                </div>
                {periodos.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                        {periodos.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriodo(p)}
                                className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${p === activo
                                    ? 'border-[#C9A96E]/45 bg-[#C9A96E]/12 text-[#e6d3ab]'
                                    : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                            >
                                {nombrePeriodo(p)}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    ['Base', dinero(resumen.totalBase), 'text-slate-100'],
                    ['IVA', dinero(resumen.totalIva), 'text-slate-100'],
                    ['Crédito', dinero(resumen.totalCredito), 'text-emerald-300'],
                    ['Sin derecho', dinero(resumen.totalSinCredito), 'text-amber-300'],
                ].map(([etiqueta, valor, color]) => (
                    <div key={etiqueta} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                        <div className="text-[9px] uppercase tracking-widest text-slate-500">{etiqueta}</div>
                        <div className={`font-mono text-sm font-black ${color}`}>{valor}</div>
                    </div>
                ))}
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-black/30 text-[9px] uppercase tracking-widest text-slate-500">
                        <tr>
                            <th className="px-3 py-2">Proveedor</th>
                            <th className="px-3 py-2">RUC</th>
                            <th className="px-3 py-2 text-right">Fact.</th>
                            <th className="px-3 py-2 text-right">Base</th>
                            <th className="px-3 py-2 text-right">IVA</th>
                            <th className="px-3 py-2 text-right">Crédito</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {resumen.proveedores.map((p) => (
                            <tr key={p.ruc} className="hover:bg-white/[0.03]">
                                <td className="max-w-[220px] truncate px-3 py-1.5 font-semibold text-slate-100" title={p.razonSocial}>{p.razonSocial}</td>
                                <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">{p.ruc}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-400">{p.facturas}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-200">{dinero(p.base)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-200">{dinero(p.iva)}</td>
                                <td className="px-3 py-1.5 text-right">
                                    {p.todoSinCredito ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300">
                                            <ShieldAlert size={10} /> sin derecho
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300">
                                            <ShieldCheck size={10} /> {dinero(p.credito)}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
                {resumen.facturas} comprobante(s) · {resumen.proveedores.length} proveedor(es) · período {nombrePeriodo(activo as string)}
            </p>
        </section>
    );
};

export default PurchaseInvoicesPanel;
