import { supabase } from './supabase';

/**
 * Bucle remoto: la web (celular) encola un trabajo y el "runner"
 * (una PC con Chrome + la extensión Nueva Luz) lo ejecuta.
 *
 * La tabla vive en Supabase (`bucle_remoto`). La extensión del runner la
 * consulta cada 30 s; acá sólo se crea el trabajo y se lee el avance.
 * Si la tabla no existe todavía, el error lo dice y la app sigue funcionando.
 */

export type EstadoBucleRemoto = 'pendiente' | 'corriendo' | 'hecho' | 'error' | 'cancelado';

export interface BucleRemotoJob {
    id: string;
    runner_id?: string | null;
    periodo: string;
    clientes: Array<{ ruc: string; name?: string }>;
    modo: 'declarar' | 'solo_perfil';
    estado: EstadoBucleRemoto;
    progreso?: { hecho?: number; total?: number; actual?: string; mensaje?: string } | null;
    mensaje?: string | null;
    created_at?: string;
    started_at?: string | null;
    finished_at?: string | null;
    heartbeat_at?: string | null;
}

const TABLA = 'bucle_remoto';

export async function crearTrabajoBucle(params: {
    periodo: string;
    clientes: Array<{ ruc: string; name?: string }>;
    modo?: 'declarar' | 'solo_perfil';
    requestedBy?: string;
}): Promise<BucleRemotoJob> {
    const { periodo, clientes, modo = 'declarar', requestedBy } = params;
    if (!/^\d{4}-\d{2}$/.test(String(periodo))) throw new Error('Período inválido (YYYY-MM).');
    if (!clientes?.length) throw new Error('No hay clientes para enviar.');

    const { data, error } = await supabase
        .from(TABLA)
        .insert({
            periodo,
            clientes: clientes.map((c) => ({ ruc: String(c.ruc).replace(/\D/g, ''), name: c.name || '' })),
            modo,
            estado: 'pendiente',
            requested_by: requestedBy || null,
        })
        .select()
        .maybeSingle();

    if (error) {
        const falta = /relation .* does not exist|42P01/i.test(error.message || '');
        throw new Error(falta
            ? 'Falta la tabla `bucle_remoto` en Supabase. Corré el SQL de docs/BUCLE_REMOTO.md.'
            : error.message);
    }
    return data as BucleRemotoJob;
}

export async function listarTrabajosBucle(limit = 6): Promise<BucleRemotoJob[]> {
    const { data, error } = await supabase
        .from(TABLA)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        if (/relation .* does not exist|42P01/i.test(error.message || '')) return [];
        throw new Error(error.message);
    }
    return (data || []) as BucleRemotoJob[];
}

/** Minutos sin señal para considerar muerto un trabajo en curso. */
export const MINUTOS_SIN_SENAL = 6;

/** ¿El runner dejó de dar señal? (heartbeat viejo o inexistente). */
export function trabajoSinSenal(job: BucleRemotoJob, ahora = Date.now()): boolean {
    if (!job || job.estado !== 'corriendo') return false;
    const ultimo = new Date(job.heartbeat_at || job.started_at || job.created_at || 0).getTime();
    if (!Number.isFinite(ultimo) || ultimo <= 0) return false;
    return ahora - ultimo > MINUTOS_SIN_SENAL * 60 * 1000;
}

/** Devuelve un trabajo muerto a la cola para que otro runner (o el mismo) lo tome. */
export async function reencolarTrabajoBucle(id: string): Promise<void> {
    const { error } = await supabase
        .from(TABLA)
        .update({
            estado: 'pendiente',
            runner_id: null,
            started_at: null,
            heartbeat_at: null,
            mensaje: 'Re-encolado: el runner no dio señal',
        })
        .eq('id', id);
    if (error) {
        const falta = /function|does not exist/i.test(error.message || '');
        throw new Error(falta ? error.message : error.message);
    }
}

export async function cancelarTrabajoBucle(id: string): Promise<void> {
    const { error } = await supabase.from(TABLA).update({ estado: 'cancelado', finished_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
}

/** Texto del estado para la tarjeta. */
export const ETIQUETA_ESTADO: Record<EstadoBucleRemoto, string> = {
    pendiente: 'Esperando al runner',
    corriendo: 'Corriendo',
    hecho: 'Terminado',
    error: 'Error',
    cancelado: 'Cancelado',
};
