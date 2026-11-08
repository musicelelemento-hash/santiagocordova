/**
 * Facturación de anulaciones de comprobantes.
 *
 * Funciones puras: reciben el registro (el que escribe la extensión 04) y
 * devuelven lo que hay que cobrar, cómo se agrupa y cómo se convierte en una
 * línea de factura. Sin efectos, sin red, sin storage: así se puede probar y
 * usar desde la Bóveda, desde Cobranza o desde el cierre mensual.
 *
 * Reglas que no se negocian:
 *  1. Una clave de acceso = un cobro. Nunca se cobra dos veces el mismo
 *     comprobante, aunque se haya reintentado diez veces.
 *  2. Nada se borra: se cambia de estado. Un cobro mal hecho se pasa a
 *     "exonerado" (o se compensa), no se elimina.
 *  3. Sólo se cobra lo que el SRI confirmó: estado 'pendiente' o superior,
 *     resultado 'success'. Un rechazo queda como 'no_cobrable'.
 */

import type {
    AnnulmentBillingLine,
    AnnulmentCharge,
    AnnulmentPolicy,
    AnnulmentStatus,
    AnnulmentSummary,
    CobroPendiente,
    EstadoMesCobro,
    MesDeCobro,
    PoliticaResuelta,
    ResultadoCupo,
} from '../types/annulment';

const ORDEN_ESTADO: Record<AnnulmentStatus, number> = {
    no_cobrable: 0,
    exonerado: 1,
    pendiente: 2,
    facturado: 3,
    pagado: 4,
};

/** Normaliza y deduplica por clave. Si hay dos versiones, gana la más avanzada. */
export function normalizar(registro: AnnulmentCharge[] | undefined): AnnulmentCharge[] {
    const porClave = new Map<string, AnnulmentCharge>();
    for (const c of registro || []) {
        if (!c || !c.clave) continue;
        const previo = porClave.get(c.clave);
        if (!previo) {
            porClave.set(c.clave, { ...c });
            continue;
        }
        const avance = ORDEN_ESTADO[c.estado] >= ORDEN_ESTADO[previo.estado] ? c : previo;
        porClave.set(c.clave, {
            ...previo,
            ...avance,
            intentos: Math.max(previo.intentos || 1, c.intentos || 1),
        });
    }
    return [...porClave.values()].sort((a, b) =>
        String(a.consecutivo).localeCompare(String(b.consecutivo)));
}

export interface FiltroCobro {
    ruc?: string;
    /** YYYY-MM */
    periodo?: string;
    lote?: string;
}

export function pendientes(
    registro: AnnulmentCharge[] | undefined,
    filtro: FiltroCobro = {},
): AnnulmentCharge[] {
    return normalizar(registro).filter((c) => {
        if (c.estado !== 'pendiente') return false;
        if (filtro.ruc && c.ruc !== filtro.ruc) return false;
        if (filtro.periodo && c.periodo !== filtro.periodo) return false;
        if (filtro.lote && c.lote !== filtro.lote) return false;
        return true;
    });
}

export function resumen(registro: AnnulmentCharge[] | undefined, filtro: FiltroCobro = {}): AnnulmentSummary {
    const lista = pendientes(registro, filtro);
    return {
        cantidad: lista.length,
        total: redondear(lista.reduce((s, c) => s + Number(c.precio || 0), 0)),
        clientes: new Set(lista.map((c) => c.ruc)).size,
        periodos: [...new Set(lista.map((c) => c.periodo))].sort(),
    };
}

/**
 * Convierte un conjunto de cobros en la línea que va en la factura.
 * Agrupa por precio unitario: si un cliente tiene tarifas distintas (caso
 * raro pero real), salen dos líneas en vez de una con un promedio falso.
 */
export function lineasDeFactura(registro: AnnulmentCharge[] | undefined, filtro: FiltroCobro = {}): AnnulmentBillingLine[] {
    const lista = pendientes(registro, filtro);
    const grupos = new Map<string, AnnulmentCharge[]>();
    for (const c of lista) {
        const clave = String(Number(c.precio || 0));
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave)!.push(c);
    }
    return [...grupos.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([precio, items]) => ({
            concepto: `Servicio de anulación de comprobantes (${items.length} × $${Number(precio).toFixed(2)})`,
            cantidad: items.length,
            precioUnitario: Number(precio),
            total: redondear(items.length * Number(precio)),
            claves: items.map((c) => c.clave),
        }));
}

/** Marca como facturadas las claves indicadas. Devuelve un registro nuevo. */
export function marcarFacturadas(
    registro: AnnulmentCharge[] | undefined,
    claves: string[],
    facturaRef: string,
): AnnulmentCharge[] {
    const set = new Set(claves);
    return normalizar(registro).map((c) => {
        if (!set.has(c.clave) || c.estado !== 'pendiente') return c;
        return { ...c, estado: 'facturado' as AnnulmentStatus, facturaRef };
    });
}

/** Pasa de 'facturado' a 'pagado' cuando entra el pago. */
export function marcarPagadas(registro: AnnulmentCharge[] | undefined, facturaRef: string): AnnulmentCharge[] {
    return normalizar(registro).map((c) =>
        c.estado === 'facturado' && c.facturaRef === facturaRef
            ? { ...c, estado: 'pagado' as AnnulmentStatus }
            : c);
}

/**
 * Importa el CSV que exporta el popup del 04 ("Cobros de anulaciones").
 * Separador `;`, primera columna Consecutivo. Tolerante: si una fila no tiene
 * clave, se ignora en lugar de romper toda la importación.
 */
export function importarCsv(texto: string): AnnulmentCharge[] {
    const lineas = String(texto || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (!lineas.length) return [];
    const cabecera = partirFila(lineas[0]);
    const idx = (nombre: string) => cabecera.findIndex((h) => h.toLowerCase().startsWith(nombre.toLowerCase()));
    const iConsec = idx('Consecutivo');
    const iFecha = idx('Fecha');
    const iPeriodo = idx('Periodo');
    const iLote = idx('Lote');
    const iRuc = idx('RUC Emisor');
    const iCliente = idx('Cliente');
    const iTipo = idx('Tipo');
    const iFactura = idx('No. Factura');
    const iClave = idx('Clave');
    const iPrecio = idx('Precio');
    const iEstado = idx('Estado Cobro');
    const iResultado = idx('Resultado');
    const iDetalle = idx('Detalle');

    const salida: AnnulmentCharge[] = [];
    for (const linea of lineas.slice(1)) {
        const f = partirFila(linea);
        const clave = (f[iClave] || '').trim();
        if (!clave) continue;
        salida.push({
            consecutivo: (f[iConsec] || '').trim(),
            clave,
            ruc: (f[iRuc] || '').trim(),
            cliente: (f[iCliente] || '').trim() || undefined,
            tipo: (f[iTipo] || '').trim() || undefined,
            factura: (f[iFactura] || '').trim() || undefined,
            fecha: fechaIso(f[iFecha]),
            periodo: (f[iPeriodo] || '').trim() || fechaIso(f[iFecha]).slice(0, 7),
            lote: (f[iLote] || '').trim() || undefined,
            precio: Number(String(f[iPrecio] || '0').replace(',', '.')) || 0,
            estado: normalizarEstado(f[iEstado]),
            resultado: (f[iResultado] || '').trim() === 'success' ? 'success' : 'error',
            detalle: (f[iDetalle] || '').trim() || undefined,
        });
    }
    return normalizar(salida);
}

function normalizarEstado(valor: string | undefined): AnnulmentStatus {
    const v = String(valor || '').trim().toLowerCase();
    if (v === 'facturado') return 'facturado';
    if (v === 'pagado') return 'pagado';
    if (v === 'exonerado') return 'exonerado';
    if (v === 'no_cobrable' || v === 'no cobrable') return 'no_cobrable';
    return 'pendiente';
}

function partirFila(linea: string): string[] {
    const salida: string[] = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
        const ch = linea[i];
        if (ch === '"') {
            if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; }
            else entreComillas = !entreComillas;
        } else if (ch === ';' && !entreComillas) {
            salida.push(actual); actual = '';
        } else {
            actual += ch;
        }
    }
    salida.push(actual);
    return salida.map((s) => s.trim());
}

function fechaIso(valor: string | undefined): string {
    const v = String(valor || '').trim();
    const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
        const [, d, m, y] = dmy;
        return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
    }
    const iso = Date.parse(v);
    return Number.isFinite(iso) ? new Date(iso).toISOString() : new Date().toISOString();
}

function redondear(n: number): number {
    return Math.round(n * 100) / 100;
}

// ── Política de cobro ───────────────────────────────────────────────────────

/** Política global por defecto: $2 por anulación, sin cupo. */
export const POLITICA_POR_DEFECTO: PoliticaResuelta = {
    precio: 2,
    cupo: 0,
    gratis: false,
    origen: 'global',
};

/**
 * Resuelve la política del cliente. Precedencia:
 *  1. gratis   → nunca se cobra (cliente VIP, cortesía)
 *  2. cupo     → N incluidas por período y el resto al precio
 *  3. fijo     → precio propio, sin cupo
 *  4. heredado → la global ($2)
 */
export function resolverPolitica(cliente?: AnnulmentPolicy | null, global?: Partial<PoliticaResuelta>): PoliticaResuelta {
    const base: PoliticaResuelta = { ...POLITICA_POR_DEFECTO, ...(global || {}) };
    if (!cliente || !cliente.modo || cliente.modo === 'heredado') return base;

    const precio = Number.isFinite(Number(cliente.precio)) ? Number(cliente.precio) : base.precio;
    const cupo = Number.isFinite(Number(cliente.cupoPorPeriodo)) ? Math.max(0, Number(cliente.cupoPorPeriodo)) : 0;

    if (cliente.modo === 'gratis') return { precio: 0, cupo: 0, gratis: true, origen: 'cliente' };
    if (cliente.modo === 'fijo') return { precio: Math.max(0, precio), cupo: 0, gratis: false, origen: 'cliente' };
    return { precio: Math.max(0, precio), cupo, gratis: false, origen: 'cliente' };
}

/**
 * Aplica el cupo por período: dentro de cada período, las primeras N
 * anulaciones (en orden de consecutivo) no se cobran; el resto sí.
 * Es determinista: recalcular con otro cupo no reescribe la historia.
 */
export function aplicarCupo(
    registro: AnnulmentCharge[] | undefined,
    politica: PoliticaResuelta = POLITICA_POR_DEFECTO,
): ResultadoCupo {
    const pendientesCobrables = normalizar(registro)
        .filter((c) => c.estado === 'pendiente')
        .sort((a, b) => String(a.consecutivo).localeCompare(String(b.consecutivo)));

    if (politica.gratis) {
        return { incluidas: pendientesCobrables, cobrables: [], total: 0, cupo: 0, precio: 0, gratis: true };
    }

    const usadasPorPeriodo = new Map<string, number>();
    const incluidas: AnnulmentCharge[] = [];
    const cobrables: AnnulmentCharge[] = [];
    for (const c of pendientesCobrables) {
        const usadas = usadasPorPeriodo.get(c.periodo) || 0;
        if (usadas < politica.cupo) {
            incluidas.push(c);
            usadasPorPeriodo.set(c.periodo, usadas + 1);
        } else {
            cobrables.push(c);
        }
    }
    const total = redondear(cobrables.length * politica.precio);
    return { incluidas, cobrables, total, cupo: politica.cupo, precio: politica.precio, gratis: false };
}

// ── Meses de cobro del plan mensual ─────────────────────────────────────────

/**
 * Meses que el cliente debería tener facturados, desde el inicio del plan
 * hasta el mes de corte (por defecto, el actual). Es la lista predecible que
 * hoy no está clara: un mes por cada período, ni más ni menos.
 */
export function mesesDePlan(args: {
    /** YYYY-MM del primer mes a cobrar. */
    inicio?: string;
    /** YYYY-MM del último mes (incluido). Por defecto, el mes actual. */
    hasta?: string;
    cuotaMensual?: number;
    /** Registros del plan por período (`billingPlan.monthlyRecords`). */
    registros?: Record<string, { isPaid?: boolean; totalFee?: number; sriInvoiceSecuencial?: string; isCourtesy?: boolean }>;
}): MesDeCobro[] {
    const { inicio, registros = {}, cuotaMensual = 0 } = args || {};
    if (!inicio || !/^\d{4}-\d{2}$/.test(inicio)) return [];

    const ahora = new Date();
    const hasta = args.hasta && /^\d{4}-\d{2}$/.test(args.hasta)
        ? args.hasta
        : `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

    const [yi, mi] = inicio.split('-').map(Number);
    const [yf, mf] = hasta.split('-').map(Number);
    if (!yi || !mi || !yf || !mf) return [];

    const salida: MesDeCobro[] = [];
    let y = yi;
    let m = mi;
    let guarda = 0;
    while ((y < yf || (y === yf && m <= mf)) && guarda++ < 60) {
        const periodo = `${y}-${String(m).padStart(2, '0')}`;
        const r = registros[periodo];
        const estado: EstadoMesCobro = !r
            ? 'pendiente'
            : r.isCourtesy
                ? 'cortesia'
                : r.isPaid
                    ? 'pagado'
                    : 'facturado';
        salida.push({
            periodo,
            estado,
            monto: estado === 'pendiente' ? Number(cuotaMensual) || 0 : Number(r?.totalFee ?? 0) || 0,
            facturaRef: r?.sriInvoiceSecuencial,
        });
        m += 1;
        if (m > 12) { m = 1; y += 1; }
    }
    return salida;
}

// ── Recordatorio de cobro ───────────────────────────────────────────────────

/**
 * Junta todo lo que hay para cobrar de un cliente: anulaciones pendientes (con
 * cupo aplicado) y meses sin facturar, y devuelve la frase lista para mostrar
 * o mandar. Es lo que usa Cobranza y lo que contesta el bot.
 */
export function recordatorioDeCobro(args: {
    ruc: string;
    cliente?: string;
    annulments?: AnnulmentCharge[];
    politica?: PoliticaResuelta;
    meses?: MesDeCobro[];
}): CobroPendiente {
    const { ruc, cliente } = args;
    const politica = args.politica || POLITICA_POR_DEFECTO;
    const cupo = aplicarCupo(args.annulments, politica);
    const meses = (args.meses || []).filter((m) => m.estado !== 'cortesia');
    const pendientes = meses.filter((m) => m.estado === 'pendiente');
    const totalMeses = pendientes.reduce((s, m) => s + Number(m.monto || 0), 0);
    const total = redondear(cupo.total + totalMeses);

    const partes: string[] = [];
    if (cupo.cobrables.length) partes.push(`${cupo.cobrables.length} anulación(es) $${cupo.total.toFixed(2)}`);
    if (cupo.incluidas.length) partes.push(`${cupo.incluidas.length} incluida(s) en el cupo`);
    if (pendientes.length) partes.push(`${pendientes.length} mes(es) sin facturar (${pendientes.map((m) => m.periodo).join(', ')})`);

    const texto = partes.length
        ? `${cliente || ruc}: ${partes.join(' · ')} · Total $${total.toFixed(2)}`
        : `${cliente || ruc}: al día`;

    return {
        ruc,
        cliente,
        anulaciones: { cantidad: cupo.cobrables.length, total: cupo.total, incluidas: cupo.incluidas.length },
        meses,
        mesesPendientes: pendientes.length,
        total,
        texto,
    };
}

// ── Acciones sobre el registro ──────────────────────────────────────────────

/** Exonera un cobro por decisión comercial. No se borra: cambia de estado. */
export function marcarExonerada(registro: AnnulmentCharge[] | undefined, consecutivo: string, motivo?: string): AnnulmentCharge[] {
    return normalizar(registro).map((c) =>
        c.consecutivo === consecutivo
            ? { ...c, estado: 'exonerado' as AnnulmentStatus, detalle: motivo || c.detalle }
            : c);
}

/** Factura sólo las seleccionadas (el resto queda pendiente, a la vista). */
export function facturarSeleccion(
    registro: AnnulmentCharge[] | undefined,
    consecutivos: string[],
    facturaRef: string,
): AnnulmentCharge[] {
    const set = new Set(consecutivos);
    return normalizar(registro).map((c) =>
        set.has(c.consecutivo) && c.estado === 'pendiente'
            ? { ...c, estado: 'facturado' as AnnulmentStatus, facturaRef }
            : c);
}