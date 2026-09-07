import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { Client, Declaration, DeclarationStatus, TaxObligationType } from '../../types';
import { formatPeriodForDisplay } from '../../services/sri';
import { linkDelComprobante, DIAS_QUE_VIVE_UN_LINK } from '../../services/fileService';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';

/**
 * La sala de envío: los comprobantes salen de a uno, no en veintisiete
 * pestañas.
 *
 * **Por qué existe.** El envío masivo llamaba a `window.open` una vez por
 * cliente en el mismo tick. El navegador deja pasar dos o tres y bloquea el
 * resto — sin avisar, y marcando a todos como notificados igual. Por eso el
 * trabajo se venía haciendo a mano.
 *
 * Acá se atiende a uno por vez, con el mensaje a la vista y editable. Son dos
 * teclas por cliente, así que veintisiete salen en un par de minutos, y en el
 * camino se ve exactamente qué se le manda a cada uno.
 *
 * **Abrir WhatsApp no es haber enviado.** El código anterior marcaba
 * `isNotifiedWhatsApp` en el mismo momento en que abría la pestaña, aunque
 * nadie llegara a pulsar enviar. Eso registra como hecho algo que no se hizo,
 * y después nadie vuelve a mirar a ese cliente. Acá el paso de «abrí» a
 * «mandé» lo confirma la persona.
 */

/** Un contribuyente en la cola, con todo lo que hace falta para atenderlo. */
interface EnLaCola {
    client: Client;
    decl: Declaration;
    telefono: string;
    /** El link firmado del comprobante, o null si no hay uno compartible. */
    link: string | null;
    /** Por qué no se puede mandar todavía. Vacío = se puede. */
    traba: string;
}

interface Props {
    clients: Client[];
    /** El período que se está notificando, ej. '2026-08'. */
    period: string;
    obType: string;
    onClose: () => void;
}

/** El saludo que corresponde a la hora. */
function saludoDeLaHora(): string {
    const h = new Date().getHours();
    if (h >= 12 && h < 19) return 'Buenas tardes';
    if (h >= 19 || h < 5) return 'Buenas noches';
    return 'Buenos días';
}

/**
 * El número en formato internacional, tal como lo quiere `wa.me`.
 *
 * Es la misma lógica que ya usaba la matriz, extraída para poder mirarla.
 */
export function normalizarTelefono(bruto: string): string {
    if (!bruto) return '';
    if (bruto.includes('+')) return bruto.replace(/[^0-9]/g, '');
    let n = bruto.replace(/\D/g, '');
    if (n.startsWith('593')) return n;
    if (n.startsWith('0')) return '593' + n.substring(1);
    if (n.length === 9) return '593' + n;
    return n ? '593' + n : '';
}

/**
 * El mensaje que se le manda a un contribuyente.
 *
 * La etapa la decide `notificationCount`: primero llega el comprobante,
 * después el recordatorio de cobro, y a partir de ahí el seguimiento. Esa
 * cuenta se guarda en Supabase desde el 07-sep-2026 — antes se reseteaba al
 * recargar y todos volvían a recibir el mensaje de bienvenida.
 *
 * @param link El link del comprobante. Si es `null`, el mensaje **no** promete
 *   un comprobante que no va a llegar.
 */
export function armarMensaje(
    client: Client,
    decl: Declaration | undefined,
    period: string,
    obType: string,
    link: string | null,
    honorario: number
): string {
    const saludo = saludoDeLaHora();
    const nombre = client.tradeName || client.name || '';
    const cuando = formatPeriodForDisplay(period);
    const veces = decl?.notificationCount || 0;
    const pagado = decl?.status === DeclarationStatus.Pagada || !!decl?.is_paid || !!client.isCourtesy;

    // Primera vez: llega el comprobante.
    if (veces === 0 || !decl?.isNotifiedWhatsApp) {
        let m = `${saludo} ${nombre}. Le confirmo que su declaración de ${obType} ` +
                `del período ${cuando} ya fue presentada en el SRI.`;
        // Se promete un comprobante SÓLO si de verdad hay uno que abrir.
        if (link) {
            m += `\n\nAquí puede descargar el comprobante oficial:\n${link}`;
            m += `\n\n(El enlace está disponible por ${DIAS_QUE_VIVE_UN_LINK} días.)`;
        }
        if (!pagado && honorario > 0) {
            m += `\n\nLos honorarios de este trámite son $${honorario.toFixed(2)}.`;
        }
        return m + '\n\nSaludos, Soluciones Contables Pro.';
    }

    // Ya recibió el comprobante y todavía debe.
    if (!pagado && veces === 1) {
        let m = `${saludo} ${nombre}. Le recuerdo que quedan pendientes los honorarios ` +
                `de su declaración de ${obType} (${cuando}), por $${honorario.toFixed(2)}.`;
        if (link) m += `\n\nSu comprobante sigue disponible acá:\n${link}`;
        return m + '\n\nQuedo atento. Saludos, Soluciones Contables Pro.';
    }

    // Ya se le insistió. Se nota, y se evita repetir la misma frase.
    let m = `${saludo} ${nombre}. Le escribo para dar seguimiento al saldo de ` +
            `$${honorario.toFixed(2)} por su declaración de ${obType} (${cuando}).`;
    if (link) m += `\n\nComprobante:\n${link}`;
    return m + '\n\nGracias por su colaboración. Soluciones Contables Pro.';
}

export const SalaDeEnvio: React.FC<Props> = ({ clients, period, obType, onClose }) => {
    const { toast } = useToast();
    const updateClient = useAppStore((s) => s.updateClient);

    const [cola, setCola] = useState<EnLaCola[]>([]);
    const [cargando, setCargando] = useState(true);
    const [i, setI] = useState(0);
    const [texto, setTexto] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [enviados, setEnviados] = useState<string[]>([]);
    const [salteados, setSalteados] = useState<string[]>([]);
    const areaRef = useRef<HTMLTextAreaElement>(null);

    // ── Armar la cola ────────────────────────────────────────────────────
    // Firmar los links cuesta una petición por comprobante, así que se hace
    // una sola vez al abrir y no en cada render.
    useEffect(() => {
        let vivo = true;
        (async () => {
            const filas: EnLaCola[] = [];
            for (const c of clients) {
                const decl = (c.declarations || []).find(
                    (d) => d.period === period &&
                           (d.type === obType || (!d.type && obType === 'IVA'))
                );
                if (!decl) continue;
                if (decl.isNotifiedWhatsApp && (decl.notificationCount || 0) > 0) continue;

                const telefono = normalizarTelefono((c.phones && c.phones[0]) || '');
                let link: string | null = null;
                try {
                    link = await linkDelComprobante(decl.proof_file);
                } catch { link = null; }

                // Las trabas se dicen, no se esconden: un cliente que no
                // aparece en la lista es un cliente que nadie vuelve a mirar.
                let traba = '';
                if (!telefono) traba = 'no tiene teléfono cargado';
                else if (!decl.proof_file) traba = 'todavía no tiene el comprobante';
                else if (!link) traba = 'el comprobante no tiene un enlace que se pueda compartir';

                filas.push({ client: c, decl, telefono, link, traba });
            }
            if (!vivo) return;
            // Los que se pueden mandar, primero. Los trabados quedan abajo,
            // visibles, con el motivo escrito.
            filas.sort((a, b) => (a.traba ? 1 : 0) - (b.traba ? 1 : 0));
            setCola(filas);
            setCargando(false);
        })();
        return () => { vivo = false; };
    }, [clients, period, obType]);

    const actual = cola[i];

    const honorario = useMemo(() => {
        if (!actual) return 0;
        return actual.client.fee_structure?.monthly || actual.client.customServiceFee || 15;
    }, [actual]);

    // El mensaje se rearma al cambiar de cliente, y desde ahí es editable.
    useEffect(() => {
        if (!actual) return;
        setTexto(armarMensaje(actual.client, actual.decl, period, obType, actual.link, honorario));
        setAbierto(false);
    }, [actual, period, obType, honorario]);

    const listos = cola.filter((f) => !f.traba).length;
    const trabados = cola.length - listos;

    const avanzar = () => {
        if (i + 1 < cola.length) setI(i + 1);
        else toast.success(`Terminaste: ${enviados.length} enviados de ${listos} que se podían.`);
    };

    const abrirWhatsApp = () => {
        if (!actual || actual.traba) return;
        // UNA pestaña. Ésta es toda la diferencia con el envío masivo viejo:
        // veintisiete `window.open` en el mismo tick los bloquea el navegador.
        window.open(`https://wa.me/${actual.telefono}?text=${encodeURIComponent(texto)}`, '_blank');
        setAbierto(true);
    };

    /** Lo mandó de verdad: recién ahí se anota. */
    const confirmarEnviado = () => {
        if (!actual) return;
        const ahora = new Date().toISOString();
        const previas = actual.client.declarations || [];
        const nuevas = previas.map((d) =>
            (d.period === period && (d.type === obType || (!d.type && obType === 'IVA')))
                ? {
                    ...d,
                    isNotifiedWhatsApp: true,
                    notifiedWhatsAppAt: ahora,
                    notificationCount: (d.notificationCount || 0) + 1,
                    updatedAt: ahora
                }
                : d
        );
        updateClient(actual.client.id, { declarations: nuevas });
        setEnviados((e) => [...e, actual.client.id]);
        avanzar();
    };

    const saltar = () => {
        if (!actual) return;
        setSalteados((s) => [...s, actual.client.id]);
        avanzar();
    };

    // ── Teclado ──────────────────────────────────────────────────────────
    // Dos teclas por cliente. Sin esto la sala no ahorra nada frente a hacerlo
    // a mano, que era el punto.
    useEffect(() => {
        const alTeclado = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') { onClose(); return; }
            // Mientras se edita el mensaje, las teclas son del texto.
            if (document.activeElement === areaRef.current) return;
            if (ev.key === 'Enter') {
                ev.preventDefault();
                if (abierto) confirmarEnviado(); else abrirWhatsApp();
            }
            if (ev.key === 'ArrowRight' || ev.key.toLowerCase() === 's') saltar();
        };
        window.addEventListener('keydown', alTeclado);
        return () => window.removeEventListener('keydown', alTeclado);
    }, [abierto, actual, texto, i, cola]);

    const marco = 'bg-[#051424]/95 backdrop-blur-2xl border border-white/10 rounded-3xl';

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#020617]/90 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={onClose}>
            <div className={`${marco} w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl`}
                 onClick={(e) => e.stopPropagation()}>

                {/* Cabecera */}
                <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <LucideIcons.Send size={18} className="text-[#04B17B]" />
                            Sala de envío
                        </h2>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {obType} · {formatPeriodForDisplay(period)}
                        </p>
                    </div>
                    <button onClick={onClose}
                            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                            aria-label="Cerrar la sala de envío">
                        <LucideIcons.X size={18} />
                    </button>
                </div>

                {cargando && (
                    <div className="p-10 text-center text-slate-400 text-sm">
                        Preparando los enlaces de cada comprobante…
                    </div>
                )}

                {!cargando && cola.length === 0 && (
                    <div className="p-10 text-center">
                        <LucideIcons.CheckCheck size={32} className="text-[#04B17B] mx-auto mb-3" />
                        <p className="text-white font-bold">No queda nadie por avisar.</p>
                        <p className="text-slate-400 text-xs mt-1">
                            Todos los de este período ya recibieron su comprobante.
                        </p>
                    </div>
                )}

                {!cargando && actual && (
                    <>
                        {/* Progreso */}
                        <div className="px-5 pt-4">
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                                <span>{i + 1} de {cola.length}</span>
                                <span>
                                    <b className="text-[#04B17B]">{enviados.length}</b> enviados
                                    {salteados.length > 0 && <> · {salteados.length} salteados</>}
                                </span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-[#2B6AFF] transition-all duration-300"
                                     style={{ width: `${((i) / cola.length) * 100}%` }} />
                            </div>
                        </div>

                        {/* Quién */}
                        <div className="p-5">
                            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                <h3 className="text-xl font-black text-white">
                                    {actual.client.tradeName || actual.client.name}
                                </h3>
                                <span className="font-mono text-xs text-slate-400">
                                    {actual.telefono ? `+${actual.telefono}` : 'sin teléfono'}
                                </span>
                            </div>

                            {/* Qué etapa: importa, porque cambia el tono del mensaje. */}
                            <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px] font-bold">
                                {(actual.decl.notificationCount || 0) === 0 ? (
                                    <span className="px-2 py-1 rounded-lg bg-[#2B6AFF]/20 text-[#7dabff]">
                                        1er aviso · va el comprobante
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300">
                                        aviso {(actual.decl.notificationCount || 0) + 1} · recordatorio de cobro
                                    </span>
                                )}
                                {actual.link && (
                                    <span className="px-2 py-1 rounded-lg bg-[#04B17B]/20 text-[#5eead4]">
                                        con enlace al comprobante
                                    </span>
                                )}
                            </div>

                            {/* La traba, si la hay, con el motivo escrito */}
                            {actual.traba && (
                                <div className="mt-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3
                                                text-[12px] text-amber-200 leading-relaxed">
                                    <b>No se le puede mandar todavía:</b> {actual.traba}.
                                    {actual.traba.includes('enlace') && (
                                        <> El PDF existe pero está guardado como archivo suelto, sin dirección
                                           web. Volvé a subirlo desde la matriz para que quede en la nube.</>
                                    )}
                                </div>
                            )}

                            {/* El mensaje, editable */}
                            <label className="block mt-4">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Mensaje
                                </span>
                                <textarea
                                    ref={areaRef}
                                    value={texto}
                                    onChange={(e) => setTexto(e.target.value)}
                                    rows={9}
                                    className="mt-1.5 w-full bg-[#020617] border border-white/12 rounded-2xl p-3.5
                                               text-[13px] text-slate-100 leading-relaxed resize-y
                                               focus:outline-none focus:border-[#2B6AFF]/60"
                                />
                            </label>
                            <p className="text-[10px] text-slate-500 mt-1.5">
                                Podés editarlo antes de mandarlo. Lo que cambies vale sólo para este contribuyente.
                            </p>
                        </div>

                        {/* Botonera */}
                        <div className="px-5 pb-5 flex flex-wrap gap-2.5">
                            {!abierto ? (
                                <button
                                    onClick={abrirWhatsApp}
                                    disabled={!!actual.traba}
                                    className="flex-1 min-w-[200px] py-3 rounded-2xl font-black text-sm
                                               bg-[#04B17B]/20 text-[#5eead4] border border-[#04B17B]/35
                                               hover:bg-[#04B17B]/30 transition disabled:opacity-35
                                               disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    <LucideIcons.MessageCircle size={16} />
                                    Abrir WhatsApp
                                    <kbd className="ml-1 text-[10px] opacity-60 font-mono">Enter</kbd>
                                </button>
                            ) : (
                                <>
                                    {/* Abrir la pestaña no es haber enviado. Lo confirma quien lo hizo. */}
                                    <button
                                        onClick={confirmarEnviado}
                                        className="flex-1 min-w-[180px] py-3 rounded-2xl font-black text-sm
                                                   bg-[#04B17B]/25 text-[#5eead4] border border-[#04B17B]/40
                                                   hover:bg-[#04B17B]/35 transition flex items-center justify-center gap-2">
                                        <LucideIcons.Check size={16} />
                                        Lo mandé · siguiente
                                        <kbd className="ml-1 text-[10px] opacity-60 font-mono">Enter</kbd>
                                    </button>
                                    <button
                                        onClick={() => setAbierto(false)}
                                        className="py-3 px-4 rounded-2xl font-bold text-sm bg-white/5
                                                   text-slate-300 hover:bg-white/10 transition">
                                        No lo mandé
                                    </button>
                                </>
                            )}
                            <button
                                onClick={saltar}
                                className="py-3 px-4 rounded-2xl font-bold text-sm bg-white/5
                                           text-slate-400 hover:bg-white/10 transition flex items-center gap-1.5">
                                Saltar
                                <kbd className="text-[10px] opacity-60 font-mono">S</kbd>
                            </button>
                        </div>

                        {/* Lo que falta, dicho de una */}
                        {trabados > 0 && (
                            <div className="px-5 pb-5">
                                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-3.5">
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        <b className="text-amber-300">{trabados}</b> de {cola.length} no se pueden
                                        mandar todavía. Están al final de la cola con el motivo escrito, no
                                        escondidos: un contribuyente que desaparece de la lista es uno que
                                        nadie vuelve a mirar.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default SalaDeEnvio;
