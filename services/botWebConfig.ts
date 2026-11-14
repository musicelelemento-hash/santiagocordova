import { supabase } from './supabase';

// Ajustes de Baku que se editan desde la web. Tabla: database/bot_web_config.sql.

const TABLA = 'bot_web_config';
const ID_BOTONES = 'custom_buttons';

/** Los botones guardados para Baku, o null si todavía no se guardó ninguno. Lanza si Supabase no responde. */
export async function cargarBotonesBaku<T>(): Promise<T[] | null> {
    const { data, error } = await supabase.from(TABLA).select('data').eq('id', ID_BOTONES).maybeSingle();
    if (error) throw error;
    return data && Array.isArray(data.data) ? (data.data as T[]) : null;
}

export async function guardarBotonesBaku<T>(botones: T[]): Promise<void> {
    const { error } = await supabase
        .from(TABLA)
        .upsert({ id: ID_BOTONES, data: botones, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
}

/** Qué hacer, dicho en una línea, a partir del error de Supabase. */
export function motivoDeSupabase(e: unknown): string {
    const err = e as { code?: string; message?: string } | null;
    const code = err?.code || '';
    if (code === 'PGRST205' || code === '42P01') return 'Falta crear la tabla: corré database/bot_web_config.sql en Supabase.';
    if (code === '42501') return 'Supabase no dio permiso. Revisá que la sesión esté iniciada.';
    return err?.message || 'Supabase no respondió.';
}
