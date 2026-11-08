import React, { useMemo, useState } from 'react';
import type {
    AnnulmentCharge,
    AnnulmentPolicy,
    CobroPendiente,
    MesDeCobro,
    PoliticaResuelta,
} from '../../types/annulment';
import {
    aplicarCupo,
    facturarSeleccion,
    marcarExonerada,
    mesesDePlan,
    recordatorioDeCobro,
    resolverPolitica,
} from '../../services/annulmentBilling';

/**
 * Panel de cobro de anulaciones — listo para la Bóveda del cliente y para
 * Cobranza.
 *
 * Es "tonto" a propósito: recibe el registro, la política y los meses, y
 * devuelve la decisión por callbacks. No lee Supabase ni storage, así se puede
 * montar en la Bóveda, en Cobranza o en el detalle del cliente sin duplicar la
 * lógica de cobro (que vive en services/annulmentBilling.ts y está probada).
 */

interface Props {
    cliente: { ruc: string; nombre?: string };
    annulments: AnnulmentCharge[];
    policy?: AnnulmentPolicy | null;
    /** Política global ($2 sin cupo) si se quiere cambiar desde afuera. */
    globalPolicy?: Partial<PoliticaResuelta>;
    /** Meses del plan mensual. Si no se pasan, se calculan desde el plan. */
    meses?: MesDeCobro[];
    plan?: { inicio?: string; hasta?: string; cuotaMensual?: number; registros?: any };
    /** Se llama con las anulaciones tildadas. El padre decide si factura o no. */
    onFacturar?: (seleccion: AnnulmentCharge[], resumen: CobroPendiente) => void;
    /** Deja todo como está (la factura sale sólo con la declaración). */
    onDejarPendiente?: () => void;
    onExonerar?: (consecutivo: string) => void;
    onEditarPolitica?: () => void;
    /** 'ver' = sólo estado (Bóveda). 'cobrar' = con selección y botones. */
    modo?: 'ver' | 'cobrar';
}

const COLOR_MES: Record<string, string> = {
    pagado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    facturado: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    pendiente: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    cortesia: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const ETIQUETA_MES: Record<string, string> = {
    pagado: 'pagado',
    facturado: 'facturado',
    pendiente: 'sin facturar',
    cortesia: 'cortesía',
};

function money(n: number): string {
    return `$${Number(n || 0).toFixed(2)}`;
}

function nombrePeriodo(periodo: string): string {
    const [y, m] = String(periodo).split('-').map(Number);
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (!y || !m || m < 1 || m > 12) return periodo;
    return `${meses[m - 1]} ${String(y).slice(2)}`;
}

const AnnulmentsBillingPanel: React.FC<Props> = ({
    cliente,
    annulments,
    policy,
    globalPolicy,
    meses,
    plan,
    onFacturar,
    onDejarPendiente,
    onExonerar,
    onEditarPolitica,
    modo = 'cobrar',
}) => {
    const politica = useMemo(() => resolverPolitica(policy, globalPolicy), [policy, globalPolicy]);
    const cupo = useMemo(() => aplicarCupo(annulments, politica), [annulments, politica]);

    const mesesCalc = useMemo(() => {
        if (meses) return meses;
        if (!plan) return [];
        return mesesDePlan({
            inicio: plan.inicio,
            hasta: plan.hasta,
            cuotaMensual: plan.cuotaMensual,
            registros: plan.registros,
        });
    }, [meses, plan]);

    const resumen = useMemo(
        () => recordatorioDeCobro({ ruc: cliente.ruc, cliente: cliente.nombre, annulments, politica, meses: mesesCalc }),
        [cliente, annulments, politica, mesesCalc],
    );

    // Por defecto se factura todo lo cobrable; destildar deja ese cobro pendiente.
    const [seleccion, setSeleccion] = useState<string[]>(() => cupo.cobrables.map((c) => c.consecutivo));
    const seleccionadas = cupo.cobrables.filter((c) => seleccion.includes(c.consecutivo));
    const totalSeleccion = seleccionadas.reduce((s) => s + politica.precio, 0);
    const quedaPendiente = resumen.total - totalSeleccion;

    const alternar = (consecutivo: string) => {
        setSeleccion((prev) =>
            prev.includes(consecutivo) ? prev.filter((x) => x !== consecutivo) : [...prev, consecutivo]);
    };

    const resumenSeleccion = useMemo(
        () => recordatorioDeCobro({ ruc: cliente.ruc, cliente: cliente.nombre, annulments, politica, meses: mesesCalc }),
        [cliente, annulments, politica, mesesCalc]);

    const etiquetaPolitica = politica.gratis
        ? 'Gratis para este cliente'
        : politica.cupo > 0
            ? `Cupo ${politica.cupo} por período · ${money(politica.precio)} c/u`
            : `${money(politica.precio)} por anulación`;

    return (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-200">
            <header className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-amber-300">Cobro de anulaciones</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                        {cliente.nombre || cliente.ruc} · {etiquetaPolitica}
                        {politica.origen === 'cliente' && <span className="ml-1 text-emerald-400">(personalizada)</span>}
                    </p>
                </div>
                {onEditarPolitica && (
                    <button
                        type="button"
                        onClick={onEditarPolitica}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
                    >
                        Cambiar
                    </button>
                )}
            </header>

            {mesesCalc.length > 0 && (
                <div className="mt-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Meses del plan
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {mesesCalc.map((m) => (
                            <span
                                key={m.periodo}
                                title={m.facturaRef ? `Factura ${m.facturaRef}` : ETIQUETA_MES[m.estado]}
                                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${COLOR_MES[m.estado] || COLOR_MES.pendiente}`}
                            >
                                {nombrePeriodo(m.periodo)} · {ETIQUETA_MES[m.estado]}
                            </span>
                        ))}
                    </div>
                    {resumen.mesesPendientes > 0 && (
                        <p className="mt-2 text-[11px] text-amber-300">
                            {resumen.mesesPendientes} mes(es) sin facturar: {resumen.meses.filter((m) => m.estado === 'pendiente').map((m) => nombrePeriodo(m.periodo)).join(', ')}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <span>Anulaciones pendientes</span>
                    <span>{resumen.anulaciones.incluidas} en cupo · {resumen.anulaciones.cantidad} cobrables</span>
                </div>

                {cupo.incluidas.length + cupo.cobrables.length === 0 ? (
                    <p className="rounded-xl border border-white/5 bg-black/20 px-3 py-4 text-center text-[11px] text-slate-500">
                        Sin anulaciones pendientes de cobro.
                    </p>
                ) : (
                    <ul className="divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20">
                        {[...cupo.incluidas, ...cupo.cobrables].map((c) => {
                            const dentroDelCupo = cupo.incluidas.includes(c);
                            const marcada = seleccion.includes(c.consecutivo);
                            return (
                                <li key={c.consecutivo} className="flex items-center gap-3 px-3 py-2">
                                    {modo === 'cobrar' ? (
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-amber-400"
                                            checked={!dentroDelCupo && marcada}
                                            disabled={dentroDelCupo}
                                            onChange={() => alternar(c.consecutivo)}
                                            aria-label={`Incluir ${c.consecutivo} en la factura`}
                                        />
                                    ) : (
                                        <span className={`h-2 w-2 rounded-full ${dentroDelCupo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[11.5px] font-bold text-slate-100">
                                            {c.consecutivo} · {c.factura || c.clave.slice(-8)}
                                        </div>
                                        <div className="truncate text-[10px] text-slate-500">
                                            {nombrePeriodo(c.periodo)} · {c.tipo || 'comprobante'} · RUC {c.ruc}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-[11.5px] font-black ${dentroDelCupo ? 'text-emerald-300' : 'text-slate-100'}`}>
                                            {dentroDelCupo ? 'incluida' : money(politica.precio)}
                                        </div>
                                        {onExonerar && (
                                            <button
                                                type="button"
                                                onClick={() => onExonerar(c.consecutivo)}
                                                className="text-[10px] text-slate-500 hover:text-rose-300"
                                            >
                                                exonerar
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-3">
                <div>
                    <div className="text-[9.5px] uppercase tracking-widest text-slate-500">A facturar ahora</div>
                    <div className="text-lg font-black text-emerald-300">{money(totalSeleccion)}</div>
                </div>
                <div>
                    <div className="text-[9.5px] uppercase tracking-widest text-slate-500">Queda pendiente</div>
                    <div className="text-lg font-black text-amber-300">{money(quedaPendiente)}</div>
                </div>
                <div>
                    <div className="text-[9.5px] uppercase tracking-widest text-slate-500">Total del cliente</div>
                    <div className="text-lg font-black text-slate-100">{money(resumen.total)}</div>
                </div>
            </div>

            <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">{resumen.texto}</p>

            {modo === 'cobrar' && (
            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={totalSeleccion <= 0}
                    onClick={() => onFacturar?.(seleccionadas, resumenSeleccion)}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Agregar a la factura ({money(totalSeleccion)})
                </button>
                <button
                    type="button"
                    onClick={onDejarPendiente}
                    className="rounded-xl border border-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
                >
                    Sólo la declaración · dejar pendiente
                </button>
            </div>
            )}
        </section>
    );
};

export default AnnulmentsBillingPanel;

// Helpers expuestos para el que conecte el panel (Bóveda / Cobranza) sin
// duplicar la regla: facturar sólo la selección y exonerar sin borrar.
export const accionesCobro = { facturarSeleccion, marcarExonerada };
