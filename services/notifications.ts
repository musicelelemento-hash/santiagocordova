/**
 * Notificaciones: correo, WhatsApp y notas para el cliente.
 *
 * El envío real lo hace el bot (Gmail ya autorizado / WhatsApp). Esta capa
 * arma, encola y registra; si el servicio no está configurado, el mensaje
 * queda en `pendiente` y se ve en la bandeja — nunca se marca como enviado sin
 * que alguien lo haya enviado.
 */

import { supabase } from './supabase';
import type { Client } from '../types/client';

export type CanalNotificacion = 'email' | 'whatsapp' | 'nota';
export type TipoNotificacion = 'declaracion' | 'recordatorio' | 'pago' | 'cobro' | 'anulacion' | 'bienvenida' | 'libre';
export type EstadoNotificacion = 'pendiente' | 'programado' | 'enviado' | 'fallido' | 'cancelado';

export interface Notificacion {
    id: string;
    ruc: string;
    cliente_nombre: string | null;
    canal: CanalNotificacion;
    tipo: TipoNotificacion;
    destinatario: string;
    asunto: string;
    cuerpo: string;
    estado: EstadoNotificacion;
    programada_para: string | null;
    enviada_en: string | null;
    error: string | null;
    periodo: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface NuevaNotificacion {
    ruc: string;
    cliente_nombre?: string;
    canal: CanalNotificacion;
    tipo: TipoNotificacion;
    destinatario?: string;
    asunto?: string;
    cuerpo?: string;
    periodo?: string;
    programada_para?: string | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const nombrePeriodo = (periodo: string): string => {
    const [y, m] = String(periodo || '').split('-').map(Number);
    return y && m ? `${MESES[m - 1]} ${y}` : String(periodo || '');
};

/** Plantillas listas para editar. Devuelven asunto y cuerpo. */
export function plantilla(tipo: TipoNotificacion, client: Pick<Client, 'name'>, periodo: string): { asunto: string; cuerpo: string } {
    const nombre = client?.name || 'estimado/a cliente';
    const mes = nombrePeriodo(periodo);
    switch (tipo) {
        case 'declaracion':
            return {
                asunto: `Declaración de IVA de ${mes} presentada`,
                cuerpo: `Estimado/a ${nombre}:\n\nLe informamos que su declaración de IVA correspondiente a ${mes} fue presentada correctamente ante el SRI.\n\nAdjuntamos una copia del comprobante en PDF para su archivo.\nSi necesita una copia física o tiene alguna consulta, puede responder a este correo.\n\nSaludos cordiales,\nSoluciones Contables Pro`,
            };
        case 'recordatorio':
            return {
                asunto: `Recordatorio: declaración de ${mes}`,
                cuerpo: `Estimado/a ${nombre}:\n\nLe recordamos que la declaración de IVA de ${mes} está pendiente de presentación.\n\nSi ya nos envió la información, por favor confírmelo respondiendo a este mensaje.\n\nSaludos cordiales,\nSoluciones Contables Pro`,
            };
        case 'pago':
            return {
                asunto: `Valor a pagar de la declaración de ${mes}`,
                cuerpo: `Estimado/a ${nombre}:\n\nSu declaración de IVA de ${mes} quedó presentada con un valor a pagar.\n\nPor favor, revise el comprobante y confírmenos para coordinar el pago antes del vencimiento.\n\nSaludos cordiales,\nSoluciones Contables Pro`,
            };
        case 'cobro':
            return {
                asunto: `Cobro de servicios contables · ${mes}`,
                cuerpo: `Estimado/a ${nombre}:\n\nAdjuntamos el detalle de los servicios contables de ${mes}.\n\nQuedamos atentos a cualquier consulta.\n\nSaludos cordiales,\nSoluciones Contables Pro`,
            };
        case 'bienvenida':
            return {
                asunto: 'Bienvenido/a a Soluciones Contables Pro',
                cuerpo: `Estimado/a ${nombre}:\n\nLe damos la bienvenida. En breve le compartiremos el calendario de obligaciones y la lista de documentos que necesitamos cada mes.\n\nSaludos cordiales,\nSoluciones Contables Pro`,
            };
        default:
            return { asunto: '', cuerpo: '' };
    }
}

export async function listarNotificaciones(limite = 100): Promise<Notificacion[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite);
    if (error) throw error;
    return (data || []) as Notificacion[];
}

export async function crearNotificacion(n: NuevaNotificacion): Promise<Notificacion> {
    const estado: EstadoNotificacion = n.programada_para ? 'programado' : 'pendiente';
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            ruc: n.ruc,
            cliente_nombre: n.cliente_nombre || null,
            canal: n.canal,
            tipo: n.tipo,
            destinatario: n.destinatario || '',
            asunto: n.asunto || '',
            cuerpo: n.cuerpo || '',
            periodo: n.periodo || null,
            programada_para: n.programada_para || null,
            estado,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Notificacion;
}

export async function actualizarEstado(id: string, estado: EstadoNotificacion, detalle?: { error?: string }): Promise<void> {
    const parche: Record<string, unknown> = { estado };
    if (estado === 'enviado') parche.enviada_en = new Date().toISOString();
    if (detalle?.error) parche.error = detalle.error;
    const { error } = await supabase.from('notifications').update(parche).eq('id', id);
    if (error) throw error;
}

/**
 * Quién falta notificar: clientes con declaración en el período que no tienen
 * una notificación de tipo `declaracion` enviada.
 */
export function faltanPorNotificar(
    clientes: Client[],
    periodo: string,
    notificaciones: Notificacion[],
): Client[] {
    const notificados = new Set(
        notificaciones
            .filter((n) => n.tipo === 'declaracion' && n.periodo === periodo && n.estado === 'enviado')
            .map((n) => n.ruc),
    );
    return clientes.filter((c) => {
        const decl = (c.declarations || []).find((d) => d.period === periodo);
        return Boolean(decl && decl.proof_file) && !notificados.has(c.ruc);
    });
}

export function estadoColor(estado: EstadoNotificacion): string {
    switch (estado) {
        case 'enviado': return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300';
        case 'programado': return 'border-sky-500/35 bg-sky-500/10 text-sky-300';
        case 'fallido': return 'border-rose-500/35 bg-rose-500/10 text-rose-300';
        case 'cancelado': return 'border-slate-500/35 bg-slate-500/10 text-slate-400';
        default: return 'border-amber-500/35 bg-amber-500/10 text-amber-300';
    }
}
