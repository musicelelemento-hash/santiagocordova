import { supabase } from './supabase';
import type { Client } from '../types';

/**
 * Gestión de la clave SRI del cliente: leer de la nube, hidratar y guardar.
 *
 * Por qué existe: el "no hay clave" del bucle casi nunca significaba que no
 * hubiera clave, sino que el **store** de la web no la tenía (caché vieja) y el
 * bucle sólo corre a los que están en `listos`. Y cuando se guardaba una clave,
 * no se verificaba que hubiera llegado a la nube.
 */

const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** FNV-1a: sirve para comparar sin guardar la clave. */
export const hashClave = (clave: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < clave.length; i++) {
        h ^= clave.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'h' + h.toString(36);
};

/** La clave tal como está en `clients.sri_password` (null si no hay). */
export async function leerClaveEnNube(ruc: string): Promise<string | null> {
    const r = soloDigitos(ruc);
    if (r.length !== 13) return null;
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('sri_password')
            .eq('ruc', r)
            .maybeSingle();
        if (error) return null;
        const clave = (data as any)?.sri_password;
        return typeof clave === 'string' && clave.length > 0 ? clave : null;
    } catch {
        return null;
    }
}

/**
 * Rellena `sriPassword` en los clientes que no lo tienen, leyéndolo de la nube.
 * Devuelve cuántos se hidrataron. Se llama al entrar al Bucle.
 */
export async function hidratarClavesFaltantes(
    clients: Client[],
    update: (id: string, updates: Partial<Client>) => Promise<void>,
): Promise<number> {
    const faltan = (clients || []).filter((c) => c && c.ruc && !String(c.sriPassword || '').trim());
    if (faltan.length === 0) return 0;
    let hidratados = 0;
    for (const c of faltan.slice(0, 40)) {
        const clave = await leerClaveEnNube(c.ruc);
        if (!clave) continue;
        try {
            await update(c.id, { sriPassword: clave });
            hidratados++;
        } catch { /* siguiente */ }
    }
    return hidratados;
}

export interface ResultadoGuardarClave {
    ok: boolean;
    enNube: boolean;
    motivo?: string;
    aviso?: string;
}

/**
 * Guarda la clave con **historial y reglas de choque**.
 *
 * - `origen: 'csv'` no pisa una clave que ya está **verificada** (la extensión
 *   entró con ella) salvo `forzar: true`; así un CSV viejo no rompe el acceso.
 * - Guarda sólo hashes en el historial, nunca claves en claro.
 * - Verifica que la nube tenga la clave que se acaba de guardar.
 */
export async function guardarClaveCliente(
    client: Client,
    clave: string,
    update: (id: string, updates: Partial<Client>) => Promise<void>,
    opts: { origen?: 'manual' | 'csv' | 'sistema'; forzar?: boolean } = {},
): Promise<ResultadoGuardarClave> {
    const limpia = String(clave || '');
    if (limpia.length < 4) return { ok: false, enNube: false, motivo: 'La clave es demasiado corta.' };

    const tp: any = (client as any).taxProfile || {};
    const cred: any = tp.sriCredencial || {};
    // «Verificada» = la extensión ya entró OK al SRI con esta clave. Un CSV
    // viejo no la pisa salvo que el usuario lo fuerce explícitamente.
    const yaVerificada = cred.estado === 'ok' && Boolean(cred.ultimo_ingreso);
    if (!opts.forzar && opts.origen === 'csv' && yaVerificada) {
        return {
            ok: false,
            enNube: false,
            aviso: 'La clave actual ya fue verificada por la extensión; el CSV no la sobreescribe.',
        };
    }

    const cuando = new Date().toISOString();
    const historial = [
        ...(Array.isArray(cred.historial) ? cred.historial : []),
        {
            hash: hashClave(limpia),
            origen: opts.origen || 'manual',
            cuando,
            verificado: false,
            // Sólo se audita como «forzado» el choque real: el CSV pisó una
            // clave que ya había entrado OK al SRI por decisión del usuario.
            ...(opts.forzar && opts.origen === 'csv' && yaVerificada ? { forzado: true } : {}),
        },
    ].slice(-10);
    // Guardar una clave NUEVA borra los bloqueos/rechazos viejos: si no,
    // el popup y el bucle siguen viendo «bloqueada» y no dejan entrar.
    const sriCredencial = {
        ...cred,
        estado: 'ok',
        motivo: 'Clave actualizada (se limpian bloqueos y rechazos previos)',
        claveActualizadaEn: cuando,
        origenClave: opts.origen || 'manual',
        hashClave: hashClave(limpia),
        historial,
    };
    delete (sriCredencial as any).intentos;
    delete (sriCredencial as any).bloqueadaHasta;
    delete (sriCredencial as any).rechazada;
    delete (sriCredencial as any).ultimo_error;

    try {
        await update(client.id, { sriPassword: limpia, taxProfile: { ...tp, sriCredencial } } as any);
    } catch (e: any) {
        return { ok: false, enNube: false, motivo: e?.message || 'No se pudo guardar en la web.' };
    }

    const enNube = (await leerClaveEnNube(client.ruc)) === limpia;
    return {
        ok: true,
        enNube,
        motivo: enNube ? undefined : 'Se guardó en este navegador, pero la nube no lo confirmó.',
    };
}

/** Clave utilizable para este cliente: del store o de la nube. */
export async function asegurarClaveCliente(client: Client): Promise<{ clave: string | null; desdeNube: boolean }> {
    const propia = String(client.sriPassword || '').trim();
    if (propia) return { clave: propia, desdeNube: false };
    const nube = await leerClaveEnNube(client.ruc);
    return { clave: nube, desdeNube: !!nube };
}
