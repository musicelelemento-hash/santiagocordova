import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileDown, Sparkles } from 'lucide-react';
import type { Client } from '../../types';
import { extractDeclarationCifras } from '../../utils/declarationFormatter';

/**
 * Vista “cliente”: el mes explicado como se lo contarías a alguien que no sabe
 * de impuestos. Sin casilleros ni códigos: estado, cuánto vendió, cuánto
 * compró, cuánto le toca pagar y el comprobante a mano.
 */

interface Props {
    client: Client;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const nombrePeriodo = (p: string, largo = false) => {
    const [y, m] = String(p).split('-').map(Number);
    if (!y || !m) return p;
    return largo ? `${MESES[m - 1]} ${y}` : `${MESES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
};

const dinero = (v: number) => `$${Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ClientMonthView: React.FC<Props> = ({ client }) => {
    const declaraciones = useMemo(
        () => (client.declarations || []).filter((d) => d && d.period).sort((a, b) => String(b.period).localeCompare(String(a.period))),
        [client.declarations],
    );
    const [periodo, setPeriodo] = useState<string>(declaraciones[0]?.period || '');

    const decl = declaraciones.find((d) => d.period === periodo) || null;
    const cifras = useMemo(() => extractDeclarationCifras(decl), [decl]);

    const ventas = cifras.ventas15 + cifras.ventas0;
    const compras = cifras.compras15 + cifras.compras5 + cifras.compras0;
    const aPagar = Number(cifras.totalPagar || 0);
    const aFavor = Number(cifras.saldoFavor || 0);
    const presentada = Boolean(decl && (decl.status === 'Enviada' || decl.status === 'Pagada' || Boolean(decl.proof_file)));
    const comprobante = cifras.pdfUrl || (decl?.proof_file as any)?.url || '';

    if (!declaraciones.length) {
        return (
            <div className="p-8 text-center text-slate-300">
                <Sparkles className="mx-auto mb-3 text-[#C9A96E]" size={28} />
                <p className="text-sm font-bold">Todavía no hay declaraciones de este cliente.</p>
                <p className="mt-1 text-xs text-slate-500">Cuando se declare el primer mes, acá va a aparecer explicado en simple.</p>
            </div>
        );
    }

    return (
        <div className="p-5 text-slate-200">
            <div className="mb-4 flex flex-wrap gap-1">
                {declaraciones.slice(0, 6).map((d) => (
                    <button
                        key={d.period}
                        type="button"
                        onClick={() => setPeriodo(d.period)}
                        className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${d.period === periodo
                            ? 'border-[#C9A96E]/45 bg-[#C9A96E]/12 text-[#e6d3ab]'
                            : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                    >
                        {nombrePeriodo(d.period)}
                    </button>
                ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0b1c2e] to-[#051424] p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Declaración de IVA</p>
                        <h3 className="font-display text-xl font-black text-white">{nombrePeriodo(periodo, true)}</h3>
                        <p className="mt-0.5 text-xs text-slate-400">{client.name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${presentada
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/35 bg-amber-500/10 text-amber-300'}`}>
                        {presentada ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                        {presentada ? 'Presentada' : 'Pendiente'}
                    </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-slate-500">Vendiste</p>
                        <p className="font-mono text-lg font-black text-slate-100">{dinero(ventas)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
                        <p className="text-[9px] uppercase tracking-widest text-slate-500">Compraste</p>
                        <p className="font-mono text-lg font-black text-slate-100">{dinero(compras)}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-3 ${aPagar > 0 ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
                        <p className="text-[9px] uppercase tracking-widest text-slate-500">{aPagar > 0 ? 'Te toca pagar' : aFavor > 0 ? 'Saldo a favor' : 'Sin pago'}</p>
                        <p className={`font-mono text-lg font-black ${aPagar > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                            {aPagar > 0 ? dinero(aPagar) : aFavor > 0 ? dinero(aFavor) : '$0,00'}
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
                    <p>IVA de tus ventas: <b className="font-mono text-slate-200">{dinero(cifras.montoIvaVentas)}</b></p>
                    <p>IVA de tus compras: <b className="font-mono text-slate-200">{dinero(cifras.montoIvaCompras)}</b></p>
                    <p>Retenciones de IVA: <b className="font-mono text-slate-200">{dinero(cifras.retIva)}</b></p>
                    <p className="flex items-center gap-1"><CalendarDays size={11} /> {presentada ? 'Comprobante disponible en tu bóveda' : 'Se presenta este mes'}</p>
                </div>

                {comprobante && (
                    <a
                        href={comprobante}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-950"
                    >
                        <FileDown size={13} /> Ver mi comprobante
                    </a>
                )}
            </div>

            <p className="mt-3 text-center text-[10px] text-slate-500">
                Si algo no coincide con lo que te dijo tu contador, avisale antes de pagar.
            </p>
        </div>
    );
};

export default ClientMonthView;
