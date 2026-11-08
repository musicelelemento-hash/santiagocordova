/**
 * Despachador de notificaciones.
 *
 * La web arma y encola en `notifications`; este módulo las toma y las manda:
 *  - email    → Gmail ya autorizado del bot (con el PDF adjunto si es una
 *               declaración y el comprobante está en `declaration_history`).
 *  - whatsapp → el gateway configurado por variables de entorno
 *               (WHATSAPP_API_URL + WHATSAPP_TOKEN). Un solo número manda a
 *               todos: cada fila trae su destinatario.
 *  - nota     → no se envía; queda como registro interno.
 *
 * Nunca inventa un envío: si el canal no está configurado, deja la fila como
 * está y avisa en el log. Cuando el servicio responde bien, marca `enviado`.
 */

import { supabase } from './supabase';
import { sendEmailWithAttachment } from './gmail';

const GMAIL_CHAT = String(process.env.EMAIL_CHAT_ID || '').trim();
const RESEND_KEY = String(process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM = String(process.env.RESEND_FROM || 'Soluciones Contables Pro <facturacion@santiagocordova.com>').trim();
const RESEND_REPLY_TO = String(process.env.RESEND_REPLY_TO || 'santiagocordova@gmail.com').trim();
// Mientras el dominio no esté verificado, Resend acepta este remitente de prueba.
const RESEND_FROM_FALLBACK = String(process.env.RESEND_FROM_FALLBACK || '').trim();
const WA_PROVIDER = String(process.env.WHATSAPP_PROVIDER || 'generic').trim().toLowerCase();
const WA_PHONE_ID = String(process.env.WHATSAPP_PHONE_ID || '').trim();
const WA_INSTANCE = String(process.env.WHATSAPP_INSTANCE || '').trim();
const WA_URL = String(process.env.WHATSAPP_API_URL || '').trim();
const WA_TOKEN = String(process.env.WHATSAPP_TOKEN || '').trim();

type Notificacion = {
    id: string;
    ruc: string;
    cliente_nombre: string | null;
    canal: 'email' | 'whatsapp' | 'nota';
    tipo: string;
    destinatario: string;
    asunto: string;
    cuerpo: string;
    estado: string;
    periodo: string | null;
};

type Adjunto = { filename: string; contentBase64: string; mimeType: string } | null;

/** Baja el comprobante del período desde `declaration_history`, si existe. */
async function adjuntoDeDeclaracion(ruc: string, periodo: string | null): Promise<Adjunto> {
    if (!periodo) return null;
    try {
        const { data } = await supabase
            .from('clients')
            .select('declaration_history')
            .eq('ruc', ruc)
            .maybeSingle();
        const hist = Array.isArray(data?.declaration_history) ? data.declaration_history : [];
        const decl = hist.find((d: any) => String(d?.period || '') === String(periodo));
        const url = decl?.proof_file?.url || decl?.proofFile?.url || decl?.pdfUrl || '';
        if (!url) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
            filename: `Declaracion_IVA_${ruc}_${periodo}.pdf`,
            contentBase64: buffer.toString('base64'),
            mimeType: 'application/pdf',
        };
    } catch (e) {
        console.warn('[NOTIF] No se pudo bajar el comprobante:', (e as Error)?.message);
        return null;
    }
}

/** Envío por Resend: sirve aunque el bot no tenga Gmail autorizado. */
async function enviarEmailResend(to: string, subject: string, text: string, adjunto: Adjunto, from: string = RESEND_FROM): Promise<void> {
    if (!RESEND_KEY) throw new Error('Resend no configurado (RESEND_API_KEY)');
    const cuerpo: Record<string, unknown> = {
        from,
        to: [to],
        subject,
        text,
        reply_to: RESEND_REPLY_TO,
    };
    if (adjunto && adjunto.contentBase64) {
        cuerpo.attachments = [{ filename: adjunto.filename, content: adjunto.contentBase64 }];
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
    });
    if (!res.ok) {
        const detalle = await res.text().catch(() => '');
        throw new Error(`Resend respondió ${res.status}: ${detalle.slice(0, 160)}`);
    }
}

async function enviarWhatsApp(destino: string, mensaje: string): Promise<void> {
    // Meta Cloud API (oficial y gratis hasta 1.000 conversaciones/mes).
    if (WA_PROVIDER === 'meta') {
        if (!WA_TOKEN || !WA_PHONE_ID) throw new Error('Meta: faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_ID');
        const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: destino.replace(/^\+/, ''),
                type: 'text',
                text: { body: mensaje },
            }),
        });
        if (!res.ok) throw new Error(`Meta respondió ${res.status}: ${(await res.text()).slice(0, 120)}`);
        return;
    }

    // UltraMsg: la vía más simple (instancia + token).
    if (WA_PROVIDER === 'ultramsg') {
        if (!WA_INSTANCE || !WA_TOKEN) throw new Error('UltraMsg: faltan WHATSAPP_INSTANCE / WHATSAPP_TOKEN');
        const res = await fetch(`https://api.ultramsg.com/${WA_INSTANCE}/messages/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: WA_TOKEN, to: destino, body: mensaje }),
        });
        if (!res.ok) throw new Error(`UltraMsg respondió ${res.status}`);
        return;
    }

    // Contrato genérico: POST { to, message } con Bearer.
    if (!WA_URL) throw new Error('WhatsApp no configurado (WHATSAPP_API_URL)');
    const res = await fetch(WA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(WA_TOKEN ? { Authorization: `Bearer ${WA_TOKEN}` } : {}),
        },
        body: JSON.stringify({ to: destino, message: mensaje }),
    });
    if (!res.ok) throw new Error(`WhatsApp respondió ${res.status}`);
}

async function marcar(id: string, estado: 'enviado' | 'fallido', error?: string): Promise<void> {
    const parche: Record<string, unknown> = { estado };
    if (estado === 'enviado') parche.enviada_en = new Date().toISOString();
    if (error) parche.error = String(error).slice(0, 300);
    await supabase.from('notifications').update(parche).eq('id', id);
}

/** Un paso del despachador: toma hasta 50 pendientes/programadas vencidas. */
export async function despacharNotificaciones(): Promise<{ enviadas: number; fallidas: number; saltadas: number }> {
    const ahora = new Date().toISOString();
    const { data, error } = await supabase
        .from('notifications')
        .select('id,ruc,cliente_nombre,canal,tipo,destinatario,asunto,cuerpo,estado,periodo')
        .or(`estado.eq.pendiente,and(estado.eq.programado,programada_para.lte.${ahora})`)
        .order('created_at', { ascending: true })
        .limit(50);

    if (error) {
        console.warn('[NOTIF] No se pudo leer la bandeja:', error.message);
        return { enviadas: 0, fallidas: 0, saltadas: 0 };
    }

    let enviadas = 0;
    let fallidas = 0;
    let saltadas = 0;

    for (const n of (data || []) as Notificacion[]) {
        try {
            if (n.canal === 'nota') {
                saltadas += 1;
                continue;
            }

            if (n.canal === 'email') {
                const asunto = n.asunto || `Notificación · ${n.cliente_nombre || n.ruc}`;
                if (!n.destinatario) throw new Error('sin correo del cliente');
                const adjunto = n.tipo === 'declaracion' ? await adjuntoDeDeclaracion(n.ruc, n.periodo) : null;

                if (RESEND_KEY) {
                    try {
                        await enviarEmailResend(n.destinatario, asunto, n.cuerpo || '', adjunto);
                    } catch (primerError) {
                        if (RESEND_FROM_FALLBACK && RESEND_FROM_FALLBACK !== RESEND_FROM) {
                            console.warn('[NOTIF] Dominio propio sin verificar; reintento con remitente de prueba.');
                            await enviarEmailResend(n.destinatario, asunto, n.cuerpo || '', adjunto, RESEND_FROM_FALLBACK);
                        } else {
                            throw primerError;
                        }
                    }
                } else if (GMAIL_CHAT) {
                    const adj = adjunto || {
                        filename: 'notificacion.txt',
                        contentBase64: Buffer.from(n.cuerpo || '').toString('base64'),
                        mimeType: 'text/plain',
                    };
                    await sendEmailWithAttachment(GMAIL_CHAT, n.destinatario, asunto, n.cuerpo || '', adj);
                } else {
                    console.warn('[NOTIF] Email pendiente: falta RESEND_API_KEY o EMAIL_CHAT_ID.');
                    saltadas += 1;
                    continue;
                }
                await marcar(n.id, 'enviado');
                enviadas += 1;
                continue;
            }

            if (n.canal === 'whatsapp') {
                if (!WA_URL) {
                    console.warn('[NOTIF] WhatsApp pendiente: falta WHATSAPP_API_URL en el bot.');
                    saltadas += 1;
                    continue;
                }
                const destino = String(n.destinatario || '').replace(/[^\d+]/g, '');
                if (destino.length < 9) throw new Error('sin teléfono válido');
                await enviarWhatsApp(destino, n.cuerpo || '');
                await supabase.from('clients').update({
                    is_notified_whatsapp: true,
                    notified_whatsapp_at: new Date().toISOString(),
                }).eq('ruc', n.ruc);
                await marcar(n.id, 'enviado');
                enviadas += 1;
            }
        } catch (e) {
            fallidas += 1;
            console.warn(`[NOTIF] Falló ${n.canal} para ${n.cliente_nombre || n.ruc}:`, (e as Error)?.message);
            await marcar(n.id, 'fallido', (e as Error)?.message || 'error');
        }
    }

    if (enviadas || fallidas) {
        console.log(`[NOTIF] Despacho: ${enviadas} enviada(s), ${fallidas} fallida(s), ${saltadas} pendiente(s) por configurar.`);
    }
    return { enviadas, fallidas, saltadas };
}

/** Arranca el despacho periódico (cada minuto). */
export function iniciarDespachador(intervaloMs = 60_000): NodeJS.Timeout {
    const timer = setInterval(() => {
        despacharNotificaciones().catch((e) => console.warn('[NOTIF] Error en el despacho:', e?.message));
    }, intervaloMs);
    console.log(`[NOTIF] Despachador activo cada ${Math.round(intervaloMs / 1000)}s.`);
    return timer;
}

/** Estado de los canales, sin secretos: sirve para la pantalla de Ajustes. */
export async function estadoCanales(): Promise<any> {
    let resend: any = { configurado: Boolean(RESEND_KEY), dominio: null, estado: 'sin configurar' };
    if (RESEND_KEY) {
        try {
            const res = await fetch('https://api.resend.com/domains', {
                headers: { Authorization: `Bearer ${RESEND_KEY}` },
            });
            if (res.ok) {
                const data: any = await res.json();
                const dominio = Array.isArray(data?.data) && data.data.length ? data.data[0] : null;
                resend = {
                    configurado: true,
                    dominio: dominio?.name || null,
                    estado: dominio?.status || 'sin dominio',
                };
            } else {
                resend.estado = `http ${res.status}`;
            }
        } catch (e) {
            resend.estado = 'error de red';
        }
    }
    return {
        resend,
        whatsapp: {
            proveedor: WA_PROVIDER,
            configurado: WA_PROVIDER === 'meta' ? Boolean(WA_TOKEN && WA_PHONE_ID)
                : WA_PROVIDER === 'ultramsg' ? Boolean(WA_TOKEN && WA_INSTANCE)
                : Boolean(WA_URL),
        },
        despachador: process.env.NOTIF_DISPATCHER !== 'off',
        gmail: Boolean(GMAIL_CHAT),
    };
}
