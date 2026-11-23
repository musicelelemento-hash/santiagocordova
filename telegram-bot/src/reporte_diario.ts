/**
 * Reporte diario de Baku, versión corta (pedido de Santiago, 22-nov-2026:
 * «más claro, directo, importante y resumido, sin perder el control»).
 *
 * Regla: arriba sólo lo que pide ACCIÓN; después una línea por tema; nunca
 * listas de clientes que ya están al día. El detalle sigue en los botones
 * (claves, deudores, vencimientos) y en /cierre, /hoy, /pendientes.
 *
 * Función pura: database_ops.generateDailyOperationalReport junta los datos.
 */

export interface DatosReporte {
    hoy: Date;
    periodoIva: string;            // «2026-10»
    semestre: string;              // «2026-S1»
    proximoSemestral: string;      // «enero» | «julio»
    mensualAlDia: number;
    mensualPendientes: { name: string; ruc: string; dueDay: number | string }[];
    semestralAlDia: number;
    semestralPendientes: number;
    clavesVerificadas: number;
    clavesConProblema: { name: string; ruc: string; reason: string }[];
    proximos5: { name: string; dueDay: number; alDia: boolean }[];
    porCobrar: number;
    deudores: { name: string; debt: number }[];
    pendientesTareas: number;
    /** Fichas activas cuyo RUC no es un RUC (p. ej. una fecha guardada por error). */
    fichasRucDanado: { name: string; ruc: string }[];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** «CEDENO LUNA JOSELYN BRIGITTE» → «Cedeno Luna». Para listas cortas. */
export function nombreCorto(nombre: string): string {
    const palabras = String(nombre || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return palabras.map(p => ((p.length <= 3 || p.includes('.')) && /^[A-Z.]+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join(' ') || '(sin nombre)';
}

/** RUC de 13 dígitos terminado en 001, o cédula de 10. Lo demás es un dato dañado (p. ej. una fecha guardada como RUC). */
export function rucValido(ruc: string): boolean {
    const r = String(ruc || '').replace(/\D/g, '');
    if (r.length === 10) return true;
    return r.length === 13 && r.endsWith('001');
}

const lista = (nombres: string[], max = 4) => {
    const cortos = nombres.slice(0, max).join(', ');
    return nombres.length > max ? `${cortos} y ${nombres.length - max} más` : cortos;
};

const usd = (n: number) => `$${Math.round(n).toLocaleString('es-EC')}`;

export function armarReporteDiario(d: DatosReporte): string {
    const h = d.hoy;
    const mesIva = MESES_LARGOS[Number(d.periodoIva.slice(5, 7)) - 1] || d.periodoIva;
    const urgente: string[] = [];

    // IVA mensual sin declarar: vencido si su día ya pasó.
    if (d.mensualPendientes.length) {
        const nombres = d.mensualPendientes.map(p => {
            const venc = typeof p.dueDay === 'number' && p.dueDay < h.getDate() ? ` (venció el ${p.dueDay})` : typeof p.dueDay === 'number' ? ` (vence el ${p.dueDay})` : '';
            return `${esc(nombreCorto(p.name))}${venc}`;
        });
        urgente.push(`IVA de ${mesIva} sin declarar: <b>${d.mensualPendientes.length}</b> — ${lista(nombres, 3)}`);
    }

    urgente.push(...lineasDeDatos(d));

    const partes: string[] = [`⚡ <b>Baku · ${DIAS[h.getDay()]} ${h.getDate()} ${MESES[h.getMonth()]}</b>`];

    partes.push(urgente.length
        ? `🔴 <b>Para atender</b>\n${urgente.map(u => `• ${u}`).join('\n')}`
        : '✅ <b>Nada urgente hoy.</b>');

    partes.push(bloqueEstado(d, true));

    if (d.proximos5.length) {
        const faltan = d.proximos5.filter(p => !p.alDia);
        partes.push(faltan.length
            ? `⏰ <b>Próximos 5 días</b>: ${d.proximos5.length} vencen, <b>faltan ${faltan.length}</b>\n${faltan.slice(0, 6).map(p => `• Día ${p.dueDay}: ${esc(nombreCorto(p.name))}`).join('\n')}${faltan.length > 6 ? `\n• y ${faltan.length - 6} más` : ''}`
            : `⏰ <b>Próximos 5 días</b>: ${d.proximos5.length} vencen y <b>todos están al día</b>.`);
    }

    return partes.join('\n\n');
}

/**
 * Lo que pide acción y NO está en el parte de vencimientos: claves que no
 * entran y fichas con RUC dañado. Lo usan el reporte y el parte de la mañana.
 */
export function lineasDeDatos(d: DatosReporte): string[] {
    const out: string[] = [];
    const rechazadas = d.clavesConProblema.filter(c => /rechazada|bloqueada|caducada/i.test(c.reason));
    if (rechazadas.length) {
        const bloq = rechazadas.filter(c => /bloqueada/i.test(c.reason)).length;
        const det = bloq ? ` (${bloq} bloqueada${bloq === 1 ? '' : 's'})` : '';
        out.push(`Claves del SRI que no entran: <b>${rechazadas.length}</b>${det} — ${lista(rechazadas.map(c => esc(nombreCorto(c.name))), 3)}`);
    }
    if (d.fichasRucDanado.length) {
        out.push(`Fichas con RUC dañado: <b>${d.fichasRucDanado.length}</b> — ${lista(d.fichasRucDanado.map(c => esc(nombreCorto(c.name))), 3)}. Corrígelas en el Directorio.`);
    }
    return out;
}

/** «📊 Estado»: una línea por tema. `conPendientes` = agregar la línea de tus pendientes. */
export function bloqueEstado(d: DatosReporte, conPendientes: boolean): string {
    const mesIva = MESES_LARGOS[Number(d.periodoIva.slice(5, 7)) - 1] || d.periodoIva;
    const sinClave = d.clavesConProblema.filter(c => /sin clave/i.test(c.reason) && rucValido(c.ruc)).length;
    const totalMensual = d.mensualAlDia + d.mensualPendientes.length;
    const totalSemestral = d.semestralAlDia + d.semestralPendientes;
    const mayores = d.deudores.slice(0, 3).map(x => `${esc(nombreCorto(x.name))} ${usd(x.debt)}`).join(' · ');
    const estado = [
        `IVA mensual (${mesIva}): <b>${d.mensualAlDia}/${totalMensual}</b> al día`,
        `Semestral (${d.semestre}): <b>${d.semestralAlDia}/${totalSemestral}</b> al día · el próximo se declara en ${d.proximoSemestral}`,
        `Claves: <b>${d.clavesVerificadas}</b> verificadas${sinClave ? ` · <b>${sinClave}</b> sin clave` : ''}`,
        `Por cobrar: <b>${usd(d.porCobrar)}</b> (${d.deudores.length})${mayores ? ` · ${mayores}` : ''}`,
    ];
    if (conPendientes && d.pendientesTareas > 0) estado.push(`Tus pendientes abiertos: <b>${d.pendientesTareas}</b> (/pendientes)`);
    return `📊 <b>Estado</b>\n${estado.join('\n')}`;
}
