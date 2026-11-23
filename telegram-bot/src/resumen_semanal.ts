import { supabase } from './supabase';
import { esc, nombreCorto } from './reporte_diario';

/**
 * Resumen del domingo (23-nov-2026, idea aprobada por Santiago): UN mensaje a la
 * semana con lo que se movió — cobros, declaraciones, clientes nuevos, prospectos
 * del CRM por código de anuncio (lo que mide «Crecer») y pendientes cerrados.
 * Sólo le escribe a Santiago. `/semana` lo pide a mano.
 */

export interface DatosSemana {
    desde: Date;
    hasta: Date;
    cobros: number;
    declaraciones: number;
    clientesNuevos: { name: string }[];
    prospectos: { codigoCampana?: string; etapa: string; nombre?: string }[];
    pendientesHechos: number;
    /** Clientes de IVA mensual activos (para el avance a la meta de 3.000). */
    mensualesActivos: number;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()]}`;
const META = 3000;

export function armarResumenSemanal(d: DatosSemana): string {
    const lineas: string[] = [`🗓️ <b>Tu semana · ${fecha(d.desde)} – ${fecha(d.hasta)}</b>`];

    lineas.push([
        `💳 Cobros registrados: <b>${d.cobros}</b>`,
        `🧾 Declaraciones registradas: <b>${d.declaraciones}</b>`,
        `✅ Pendientes tuyos cerrados: <b>${d.pendientesHechos}</b>`,
    ].join('\n'));

    const nuevos = d.clientesNuevos.length;
    lineas.push(nuevos
        ? `👥 <b>Clientes nuevos: ${nuevos}</b> — ${d.clientesNuevos.slice(0, 5).map(c => esc(nombreCorto(c.name))).join(', ')}${nuevos > 5 ? ` y ${nuevos - 5} más` : ''}`
        : '👥 Clientes nuevos: <b>0</b>');

    if (d.prospectos.length) {
        const porCodigo = new Map<string, { total: number; ganados: number }>();
        for (const p of d.prospectos) {
            const k = (p.codigoCampana || '').trim().toUpperCase() || 'sin código';
            const e = porCodigo.get(k) || { total: 0, ganados: 0 };
            e.total++;
            if (p.etapa === 'ganado') e.ganados++;
            porCodigo.set(k, e);
        }
        const filas = Array.from(porCodigo.entries())
            .sort((a, b) => (a[0] === 'sin código' ? 1 : b[0] === 'sin código' ? -1 : b[1].total - a[1].total))
            .slice(0, 5)
            .map(([k, v]) => `• ${k === 'sin código' ? 'Sin código' : `<code>${esc(k)}</code>`}: ${v.total} prospecto${v.total === 1 ? '' : 's'}${v.ganados ? `, ${v.ganados} cliente${v.ganados === 1 ? '' : 's'}` : ''}`);
        lineas.push(`📣 <b>Prospectos nuevos: ${d.prospectos.length}</b> (por anuncio)\n${filas.join('\n')}`);
    } else {
        lineas.push('📣 Prospectos nuevos en el CRM: <b>0</b>. Si pusiste anuncios, anota en el CRM el código que trae cada mensaje.');
    }

    const avance = Math.min(100, (d.mensualesActivos / META) * 100);
    lineas.push(`🎯 Meta: <b>${d.mensualesActivos}</b> de ${META.toLocaleString('es-EC')} clientes de IVA mensual (${avance.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %).`);

    return lineas.join('\n\n');
}

/** Junta los datos de los últimos 7 días. Cada fuente que falle cuenta como 0. */
export async function datosSemana(hasta: Date = new Date()): Promise<DatosSemana> {
    const desde = new Date(hasta.getTime() - 7 * 86400000);
    const desdeIso = desde.toISOString();

    const contar = async (q: PromiseLike<{ count: number | null; error: any }>) => {
        try { const r = await q; return r.error ? 0 : r.count || 0; } catch { return 0; }
    };

    const [cobros, declaraciones, pendientesHechos, nuevos, mensuales, crm] = await Promise.all([
        contar(supabase.from('sri_declaraciones').select('id', { count: 'exact', head: true }).eq('is_paid', true).gte('paid_at', desdeIso)),
        contar(supabase.from('sri_declaraciones').select('id', { count: 'exact', head: true }).in('status', ['Enviada', 'Pagada', 'completado']).gte('created_at', desdeIso)),
        contar(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'Completada').gte('updated_at', desdeIso)),
        supabase.from('clients').select('name, created_at').eq('is_deleted', false).gte('created_at', desdeIso).then(r => r.data || [], () => []),
        supabase.from('clients').select('regime, tax_profile, is_active').eq('is_deleted', false).then(r => r.data || [], () => []),
        supabase.from('files').select('content').eq('id', 'config_sc_crm_leads_history').maybeSingle().then(r => r.data?.content || null, () => null),
    ]);

    let prospectos: DatosSemana['prospectos'] = [];
    try {
        const lista = crm ? JSON.parse(crm) : [];
        if (Array.isArray(lista)) {
            prospectos = lista
                .filter((l: any) => l && Date.parse(l.createdAt) >= desde.getTime())
                .map((l: any) => ({ codigoCampana: l.codigoCampana, etapa: l.etapa, nombre: l.nombre }));
        }
    } catch { /* CRM ilegible: sin prospectos */ }

    const mensualesActivos = (mensuales as any[]).filter(c => {
        // «Solo plan» vive en tax_profile (no hay columna client_type en la base).
        if (c.is_active === false || c.tax_profile?.clientType === 'solo_plan' || c.tax_profile?.requiresDeclarations === false) return false;
        const f = c.tax_profile?.ivaFrequency;
        if (f) return f === 'Mensual';
        const r = String(c.regime || '').toLowerCase();
        return !r.includes('rimpe');
    }).length;

    return { desde, hasta, cobros, declaraciones, pendientesHechos, clientesNuevos: nuevos as any[], prospectos, mensualesActivos };
}

export async function enviarResumenSemanal(api: { sendMessage: (chatId: string | number, text: string, other?: any) => Promise<any> }, chatId: string | number): Promise<void> {
    const d = await datosSemana();
    await api.sendMessage(chatId, armarResumenSemanal(d), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
}
