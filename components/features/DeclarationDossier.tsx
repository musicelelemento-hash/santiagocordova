import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, BadgeCheck, Building2, ChevronDown, ChevronUp,
  CircleDollarSign, FileText, Info, Receipt, ShieldCheck, Sparkles, AlertTriangle
} from 'lucide-react';
import type { Client, Declaration } from '../../types';
import {
  SupplierCatalogService,
  type ClientProviderSummary,
  type PurchaseInvoiceItem
} from '../../services/supplierCatalogService';

/**
 * DeclarationDossier — el expediente del mes de UN cliente.
 *
 * El contador ya tenía las facturas en el portal del SRI; lo que no tenía era
 * una sola pantalla que dijera, en plata y en castellano:
 *
 *   1. qué se vende (y con qué IVA)             → casilleros 401…499
 *   2. qué se compra, PROVEEDOR POR PROVEEDOR   → con o sin crédito tributario
 *   3. qué queda en el Formulario 104           → 500/510/520 · 502/512/522 ·
 *      540/550/560 · 507/517 · 564 · 601 · 620
 *
 * Dos reglas que no se rompen:
 *   · Nada se inventa. Si no hay facturas o no hay ventas, se dice y se explica
 *     de dónde saldrían.
 *   · Todo número que sea una PROYECCIÓN va marcado como tal. El 104 oficial lo
 *     calcula el SRI con saldos anteriores y retenciones que acá no tenemos.
 */

export interface Preview104 {
  // Ventas
  ventas15Bruto: number;
  ventas15Neto: number;
  ivaVentas: number;
  ventas0: number;
  ventas5Bruto: number;
  ivaVentas5: number;
  totalVentas: number;
  hayVentas: boolean;
  // Compras
  compras15CreditoBase: number;
  compras15CreditoIva: number;
  compras15SinCreditoBase: number;
  compras15SinCreditoIva: number;
  compras5Base: number;
  compras5Iva: number;
  compras0Base: number;
  totalComprasBase: number;
  totalComprasIva: number;
  hayCompras: boolean;
  // Resumen
  creditoAplicable: number;
  impuestoCausado: number;
  estimadoAPagar: number;
  docsCompras: number;
  proveedores: number;
  sinClasificar: number;
}

interface DossierProps {
  client: Client;
  periodo: string;
  /** Compacto = dentro de un panel angosto (sin tabla completa de casilleros). */
  compacto?: boolean;
  onVerFicha?: () => void;
}

const money = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Los metadatos de una declaración pueden venir en tres formas distintas. */
function metaDe(d: Declaration | undefined): Record<string, any> {
  if (!d) return {};
  const anyD = d as any;
  const pf = anyD.proof_file;
  return {
    ...(anyD.cifras || {}),
    ...(anyD.metadata || {}),
    ...((pf && pf.metadata) || {})
  };
}

/** Arma la vista previa del 104 con lo que la web realmente tiene. */
export function construirPreview104(
  client: Client,
  periodo: string,
  declaracion?: Declaration
): Preview104 {
  const meta = metaDe(declaracion);

  const ventas15Bruto = Number(meta.ventas15 || 0);
  const ventas0 = Number(meta.ventas0 || 0);
  const ventas5Bruto = Number(meta.ventas5 || 0);
  const ivaVentas = Number(meta.montoIvaVentas || Math.round(ventas15Bruto * 0.15 * 100) / 100);
  const ivaVentas5 = Math.round(ventas5Bruto * 0.05 * 100) / 100;

  const display = SupplierCatalogService.getClientPurchasesSummary(client, periodo);
  const audit = SupplierCatalogService.getClientPurchases(client, periodo);
  const perfil = SupplierCatalogService.getClientProviders(client, periodo);

  const compras15CreditoBase = Number(display.base15 || 0);
  const compras15CreditoIva = Number(display.iva15 || 0);
  const compras15SinCreditoBase = Number(display.base15SinCredito || 0);
  const compras15SinCreditoIva = Number(display.iva15SinCredito || 0);
  const compras5Base = Number(display.base5 || 0);
  const compras5Iva = Number(display.iva5 || 0);
  const compras0Base = Number(display.base0 || 0);

  const totalComprasBase = Math.round((compras15CreditoBase + compras15SinCreditoBase + compras5Base + compras0Base) * 100) / 100;
  const totalComprasIva = Math.round((compras15CreditoIva + compras15SinCreditoIva + compras5Iva) * 100) / 100;

  // Sin factor de proporcionalidad (casillero 563) lo honesto es tomar el IVA
  // de lo marcado con derecho a crédito, no repartir a ojo.
  const creditoAplicable = Math.round((compras15CreditoIva + compras5Iva) * 100) / 100;
  const impuestoCausado = Math.max(0, Math.round((ivaVentas + ivaVentas5) * 100) / 100);
  const estimadoAPagar = Math.max(0, Math.round((impuestoCausado - creditoAplicable) * 100) / 100);

  const proveedores = perfil?.proveedores || [];
  const sinClasificar = proveedores.filter((p) => !p.decision || p.decision.deducible === null).length;

  return {
    ventas15Bruto,
    ventas15Neto: Number(meta.ventas15Neto || ventas15Bruto),
    ivaVentas,
    ventas0,
    ventas5Bruto,
    ivaVentas5,
    totalVentas: Math.round((ventas15Bruto + ventas0 + ventas5Bruto) * 100) / 100,
    hayVentas: ventas15Bruto > 0 || ventas0 > 0 || ventas5Bruto > 0 || ivaVentas > 0,
    compras15CreditoBase,
    compras15CreditoIva,
    compras15SinCreditoBase,
    compras15SinCreditoIva,
    compras5Base,
    compras5Iva,
    compras0Base,
    totalComprasBase,
    totalComprasIva,
    hayCompras: audit.invoices.length > 0 || totalComprasBase > 0 || (display.totalDocs || 0) > 0,
    creditoAplicable,
    impuestoCausado,
    estimadoAPagar,
    docsCompras: audit.invoices.length || display.totalDocs || 0,
    proveedores: proveedores.length,
    sinClasificar
  };
}

/** Una fila de casillero del 104: número grande, concepto chico, montos a la derecha. */
const Casillero: React.FC<{
  nro: string;
  label: string;
  bruto?: number;
  neto?: number;
  impuesto?: number;
  tono?: 'venta' | 'compra' | 'neutro' | 'total';
}> = ({ nro, label, bruto, neto, impuesto, tono = 'neutro' }) => {
  const color = {
    venta: 'text-sky-600 dark:text-sky-400',
    compra: 'text-emerald-600 dark:text-emerald-400',
    total: 'text-slate-900 dark:text-white',
    neutro: 'text-slate-600 dark:text-slate-300'
  }[tono];
  const celda = (valor: number | undefined, extra = '') =>
    valor === undefined
      ? <span className="w-20 text-right text-slate-300 dark:text-slate-600">·</span>
      : <span className={`w-20 text-right tabular-nums ${extra}`}>{money(valor)}</span>;

  return (
    <div className={`grid grid-cols-[46px_1fr_auto] items-center gap-3 px-3 py-1.5 rounded-xl border border-transparent hover:border-slate-200/70 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors ${tono === 'total' ? 'bg-slate-50/80 dark:bg-white/[0.04] border-slate-200/60 dark:border-white/10' : ''}`}>
      <span className={`font-mono text-[11px] font-bold tabular-nums ${color} opacity-80`}>{nro}</span>
      <span className="text-[11.5px] leading-tight text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex items-center gap-3 font-mono text-[11.5px]">
        {celda(bruto, 'text-slate-400 dark:text-slate-500')}
        {celda(neto, 'text-slate-500 dark:text-slate-400')}
        {celda(impuesto, `font-semibold ${color}`)}
      </span>
    </div>
  );
};

const ChipCredito: React.FC<{ conCredito: boolean | null; tarifa: number }> = ({ conCredito, tarifa }) => {
  if (tarifa === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wide bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
        0% · 507
      </span>
    );
  }
  if (tarifa === 5) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
        5% · 540
      </span>
    );
  }
  if (conCredito === true) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
        <ShieldCheck size={9} /> Crédito · 500
      </span>
    );
  }
  if (conCredito === false) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wide bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
        <AlertTriangle size={9} /> Sin crédito · 502
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wide bg-slate-400/10 text-slate-500 dark:text-slate-400 border border-slate-400/25 border-dashed">
      Por clasificar
    </span>
  );
};

/** Barra apilada: cuánto del gasto es crédito, cuánto no, cuánto es 0%. */
const BarraCompras: React.FC<{ credito: number; sinCredito: number; cinco: number; cero: number }> = ({
  credito, sinCredito, cinco, cero
}) => {
  const total = credito + sinCredito + cinco + cero;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
      <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${pct(credito)}%` }} title={`Con crédito ${money(credito)}`} />
      <div className="bg-rose-500/80 transition-all duration-700" style={{ width: `${pct(sinCredito)}%` }} title={`Sin crédito ${money(sinCredito)}`} />
      <div className="bg-amber-500/80 transition-all duration-700" style={{ width: `${pct(cinco)}%` }} title={`5% ${money(cinco)}`} />
      <div className="bg-slate-400/70 transition-all duration-700" style={{ width: `${pct(cero)}%` }} title={`0% ${money(cero)}`} />
    </div>
  );
};

const FilaProveedor: React.FC<{ prov: ClientProviderSummary }> = ({ prov }) => {
  const decision = prov.decision?.deducible;
  const tarifas = prov.tarifas || {};
  const tarifaPrincipal = Number(Object.keys(tarifas).sort((a, b) => Number(tarifas[b]) - Number(tarifas[a]))[0] || 15);
  const base = prov.enPeriodo ? prov.basePeriodo : prov.base;
  const ivaMonto = prov.enPeriodo ? prov.ivaPeriodo : prov.iva;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
      <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex items-center justify-center">
        <Building2 size={12} className="text-slate-400 dark:text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-200 truncate">{prov.nombre || prov.ruc}</span>
          {prov.enPeriodo && (
            <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wide px-1 py-px rounded bg-[#00A896]/10 text-[#00A896] border border-[#00A896]/20">
              este mes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[9.5px] text-slate-400 dark:text-slate-500">{prov.ruc}</span>
          <span className="text-[9.5px] text-slate-400 dark:text-slate-500">{prov.veces || 0}×</span>
          <ChipCredito conCredito={decision === undefined ? null : decision} tarifa={tarifaPrincipal} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[11.5px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{money(base || 0)}</div>
        <div className="font-mono text-[9.5px] tabular-nums text-slate-400 dark:text-slate-500">IVA {money(ivaMonto || 0)}</div>
      </div>
    </div>
  );
};

export const DeclarationDossier: React.FC<DossierProps> = ({ client, periodo, compacto = false, onVerFicha }) => {
  const [verTodos, setVerTodos] = useState(false);
  const [verCasilleros, setVerCasilleros] = useState(!compacto);

  const declaracion = useMemo(() => {
    const lista = Array.isArray(client.declarations) ? client.declarations : [];
    return lista.find((d) => String(d.period || '').split(':')[0].trim() === periodo);
  }, [client, periodo]);

  const preview = useMemo(() => construirPreview104(client, periodo, declaracion), [client, periodo, declaracion]);

  const proveedores: ClientProviderSummary[] = useMemo(() => {
    const perfil = SupplierCatalogService.getClientProviders(client, periodo);
    const lista = [...(perfil?.proveedores || [])];
    return lista.sort((a, b) => {
      if (a.enPeriodo !== b.enPeriodo) return a.enPeriodo ? -1 : 1;
      const ma = a.enPeriodo ? a.basePeriodo : a.base;
      const mb = b.enPeriodo ? b.basePeriodo : b.base;
      return (mb || 0) - (ma || 0);
    });
  }, [client, periodo]);

  const facturas: PurchaseInvoiceItem[] = useMemo(
    () => SupplierCatalogService.getClientPurchases(client, periodo).invoices.slice(0, 60),
    [client, periodo]
  );

  const visibles = verTodos ? proveedores : proveedores.slice(0, 6);
  const docsEmitidos = Number(metaDe(declaracion).docsVentas || metaDe(declaracion).totalComprobantesVentas || 0);
  const saldoFavor = Number(metaDe(declaracion).saldoFavor || 0);
  const totalPagarOficial = Number(metaDe(declaracion).totalPagar || 0);

  const vacio = !preview.hayCompras && !preview.hayVentas && proveedores.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cabecera: de quién es el mes ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-[#00A896] shrink-0" />
            <h4 className="text-[13px] font-black font-display tracking-tight text-slate-800 dark:text-white truncate">
              {client.tradeName || client.name}
            </h4>
          </div>
          <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {client.ruc} · {periodo}
            {declaracion?.status ? ` · ${declaracion.status}` : ''}
          </p>
        </div>
        {onVerFicha && (
          <button
            onClick={onVerFicha}
            className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-[#00A896] hover:border-[#00A896]/40 transition-colors"
          >
            Expediente
          </button>
        )}
      </div>

      {/* ── Los dos números que importan de un vistazo ── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-3">
          <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
            <ArrowUpRight size={11} />
            <span className="text-[9px] font-black uppercase tracking-[0.12em]">IVA en ventas</span>
          </div>
          <div className="font-mono text-lg font-black tabular-nums text-slate-800 dark:text-white mt-1">
            {preview.hayVentas ? money(preview.ivaVentas + preview.ivaVentas5) : '—'}
          </div>
          <div className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            {preview.hayVentas
              ? `Sobre ${money(preview.totalVentas)} declarados`
              : 'Aparece al llenar el formulario'}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ArrowDownRight size={11} />
            <span className="text-[9px] font-black uppercase tracking-[0.12em]">Crédito en compras</span>
          </div>
          <div className="font-mono text-lg font-black tabular-nums text-slate-800 dark:text-white mt-1">
            {preview.hayCompras ? money(preview.creditoAplicable) : '—'}
          </div>
          <div className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            {preview.hayCompras
              ? `${preview.docsCompras} comprobante${preview.docsCompras === 1 ? '' : 's'}`
              : 'Sin facturas de compra del mes'}
          </div>
        </div>
      </div>

      {/* ── Resultado estimado ── */}
      <div className={`rounded-2xl border p-3 ${preview.estimadoAPagar > 0
        ? 'border-amber-500/30 bg-amber-500/[0.07]'
        : 'border-[#00A896]/25 bg-[#00A896]/[0.07]'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {preview.estimadoAPagar > 0 ? 'Estimado a pagar' : 'Estimado a favor / cero'}
          </span>
          <CircleDollarSign size={12} className={preview.estimadoAPagar > 0 ? 'text-amber-500' : 'text-[#00A896]'} />
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className={`font-mono text-xl font-black tabular-nums ${preview.estimadoAPagar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#00A896]'}`}>
            {money(preview.estimadoAPagar > 0 ? preview.estimadoAPagar : Math.max(0, preview.creditoAplicable - preview.impuestoCausado))}
          </span>
          <span className="text-[9.5px] text-slate-400 dark:text-slate-500">
            {preview.estimadoAPagar > 0 ? 'revisión manual antes de enviar' : 'a favor o sin saldo'}
          </span>
        </div>
        {totalPagarOficial > 0 && (
          <div className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
            El SRI calculó {money(totalPagarOficial)} en el borrador.
          </div>
        )}
        {saldoFavor > 0 && (
          <div className="mt-1.5 text-[10px] text-[#00A896] font-semibold">
            Saldo a favor registrado: {money(saldoFavor)}.
          </div>
        )}
      </div>

      {/* ── Compras: quién, cuánto y con qué derecho a crédito ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Receipt size={12} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Compras por proveedor
            </span>
          </div>
          {preview.sinClasificar > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              {preview.sinClasificar} por clasificar
            </span>
          )}
        </div>

        {preview.hayCompras || proveedores.length > 0 ? (
          <>
            <BarraCompras
              credito={preview.compras15CreditoBase}
              sinCredito={preview.compras15SinCreditoBase}
              cinco={preview.compras5Base}
              cero={preview.compras0Base}
            />
            <div className="flex items-center gap-3 mt-1.5 mb-2 text-[9px] font-mono text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{money(preview.compras15CreditoBase)}</span>
              <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-rose-500/80 inline-block" />{money(preview.compras15SinCreditoBase)}</span>
              {preview.compras5Base > 0 && <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-amber-500/80 inline-block" />{money(preview.compras5Base)}</span>}
              {preview.compras0Base > 0 && <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-slate-400/70 inline-block" />{money(preview.compras0Base)}</span>}
            </div>

            {proveedores.length > 0 ? (
              <div className="space-y-0.5 animate-fade-in">
                {visibles.map((p) => <FilaProveedor key={p.ruc || p.nombre} prov={p} />)}
                {proveedores.length > 6 && (
                  <button
                    onClick={() => setVerTodos((v) => !v)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-[#00A896] transition-colors"
                  >
                    {verTodos ? <>Ver menos <ChevronUp size={11} /></> : <>Ver los {proveedores.length} proveedores <ChevronDown size={11} /></>}
                  </button>
                )}
              </div>
            ) : facturas.length > 0 ? (
              <div className="space-y-0.5">
                {facturas.slice(0, 8).map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-bold text-slate-700 dark:text-slate-200 truncate">{f.razonSocial}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[9.5px] text-slate-400">{f.rucEmisor}</span>
                        <ChipCredito conCredito={f.tieneCreditoTributario} tarifa={f.tarifaIva ?? 15} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[11.5px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{money(f.valorSinImpuestos)}</div>
                      <div className="font-mono text-[9.5px] text-slate-400">IVA {money(f.iva)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 px-3 py-4 text-center">
            <FileText size={16} className="mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
              Todavía no hay facturas de compra de este mes.<br />
              Corré el bucle y vuelven clasificadas.
            </p>
          </div>
        )}
      </div>

      {/* ── Vista previa del Formulario 104 ── */}
      <div>
        <button
          onClick={() => setVerCasilleros((v) => !v)}
          className="w-full flex items-center justify-between gap-2 py-1 group"
        >
          <span className="flex items-center gap-1.5">
            <FileText size={12} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Formulario 104 · vista previa
            </span>
          </span>
          {verCasilleros ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
        </button>

        {verCasilleros && (
          <div className="mt-1.5 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-black/20 p-1.5 animate-fade-in">
            <div className="grid grid-cols-[46px_1fr_auto] gap-3 px-3 py-1 text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              <span>Cas.</span><span>Concepto</span>
              <span className="flex gap-3">
                <span className="w-20 text-right">Bruto</span>
                <span className="w-20 text-right">Neto</span>
                <span className="w-20 text-right">Impuesto</span>
              </span>
            </div>
            <div className="h-px bg-slate-200/70 dark:bg-white/10 my-1" />

            <div className="px-1 pt-1 pb-0.5 text-[8.5px] font-black uppercase tracking-[0.14em] text-sky-500/80">Ventas</div>
            <Casillero nro="401" label="Ventas locales gravadas tarifa ≠ 0" bruto={preview.ventas15Bruto} neto={preview.ventas15Neto} impuesto={preview.ivaVentas} tono="venta" />
            {preview.ventas5Bruto > 0 && <Casillero nro="425" label="Ventas locales gravadas tarifa 5%" bruto={preview.ventas5Bruto} neto={preview.ventas5Bruto} impuesto={preview.ivaVentas5} tono="venta" />}
            {preview.ventas0 > 0 && <Casillero nro="403" label="Ventas locales tarifa 0% (sin derecho a crédito)" bruto={preview.ventas0} neto={preview.ventas0} tono="venta" />}
            <Casillero nro="499" label="Total impuesto a liquidar en este mes" impuesto={preview.impuestoCausado} tono="total" />

            <div className="px-1 pt-2 pb-0.5 text-[8.5px] font-black uppercase tracking-[0.14em] text-emerald-500/80">Compras</div>
            <Casillero nro="500" label="Adquisiciones gravadas ≠ 0 con derecho a crédito" bruto={preview.compras15CreditoBase} neto={preview.compras15CreditoBase} impuesto={preview.compras15CreditoIva} tono="compra" />
            <Casillero nro="502" label="Adquisiciones gravadas ≠ 0 sin derecho a crédito" bruto={preview.compras15SinCreditoBase} neto={preview.compras15SinCreditoBase} impuesto={preview.compras15SinCreditoIva} tono="compra" />
            {preview.compras5Base > 0 && <Casillero nro="540" label="Adquisiciones gravadas tarifa 5%" bruto={preview.compras5Base} neto={preview.compras5Base} impuesto={preview.compras5Iva} tono="compra" />}
            {preview.compras0Base > 0 && <Casillero nro="507" label="Adquisiciones y pagos tarifa 0%" bruto={preview.compras0Base} neto={preview.compras0Base} tono="compra" />}
            <Casillero nro="509" label="Total adquisiciones y pagos" bruto={preview.totalComprasBase} neto={preview.totalComprasBase} impuesto={preview.totalComprasIva} tono="total" />

            <div className="px-1 pt-2 pb-0.5 text-[8.5px] font-black uppercase tracking-[0.14em] text-slate-400">Resumen impositivo</div>
            <Casillero nro="564" label="Crédito tributario aplicable (estimado)" impuesto={preview.creditoAplicable} />
            <Casillero nro="601" label="Impuesto causado (499 − 564)" impuesto={preview.impuestoCausado} tono="total" />
            <Casillero nro="620" label="Estimado a pagar" impuesto={preview.estimadoAPagar} tono="total" />

            <div className="flex items-start gap-1.5 mt-2 px-3 pb-1.5">
              <Info size={10} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[9px] leading-snug text-slate-400 dark:text-slate-500">
                Vista previa armada con las facturas del cliente. El 104 oficial agrega saldos anteriores,
                retenciones y el factor de proporcionalidad del SRI.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Estado vacío honesto ── */}
      {vacio && (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 dark:border-white/15 px-3 py-2.5">
          <BadgeCheck size={13} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Este cliente no tiene movimientos guardados de {periodo}. Si ya fue declarado,
            el comprobante está en su expediente; si no, el bucle los trae del SRI.
          </p>
        </div>
      )}

      {docsEmitidos > 0 && (
        <div className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500">
          {docsEmitidos} comprobante{docsEmitidos === 1 ? '' : 's'} de venta emitido{docsEmitidos === 1 ? '' : 's'} · casillero 111
        </div>
      )}
    </div>
  );
};

export default DeclarationDossier;
