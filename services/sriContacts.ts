/**
 * Bóveda de contactos SRI: claves que NO son clientes.
 *
 * Sólo se usan para dos cosas: autocompletar la clave al crear un cliente con
 * ese RUC y responder consultas del bot. Nunca entran al lote ni se notifican.
 */

import { supabase } from './supabase';

export interface SriContact {
    ruc: string;
    name: string;
    sri_password: string;
}

const soloDigitos = (ruc: string): string => String(ruc || '').replace(/\D/g, '');

/** Clave guardada para un RUC que no es cliente. `null` si no está. */
export async function buscarClaveContacto(ruc: string): Promise<SriContact | null> {
    const limpio = soloDigitos(ruc);
    if (limpio.length !== 13) return null;
    const { data, error } = await supabase
        .from('sri_contacts')
        .select('ruc,name,sri_password')
        .eq('ruc', limpio)
        .maybeSingle();
    if (error) return null;
    return (data as SriContact) || null;
}

/** Guarda o actualiza claves que no pertenecen a ningún cliente. */
export async function guardarContactos(
    entradas: Array<{ ruc: string; name?: string; sri_password: string }>,
): Promise<number> {
    const filas = entradas
        .map((e) => ({ ruc: soloDigitos(e.ruc), name: e.name || '', sri_password: e.sri_password }))
        .filter((e) => e.ruc.length === 13 && Boolean(e.sri_password));
    if (!filas.length) return 0;
    const { error } = await supabase.from('sri_contacts').upsert(filas, { onConflict: 'ruc' });
    if (error) throw error;
    return filas.length;
}
