/**
 * Pestaña «Estado» de la pantalla del bot: datos REALES de Baku.
 *
 * - Baku: lee GET /estado del bot en Render (sin secretos): en línea, versión,
 *   correo configurado, modelo de IA y agenda con próxima/última ejecución.
 * - Bandeja: cuenta la tabla `notifications` de Supabase por estado y lista
 *   los últimos fallidos con su motivo.
 *
 * Reemplaza al indicador «en línea» decorativo que tenía la pantalla.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Mail, RefreshCw, Bot, XCircle, Inbox } from 'lucide-react';
import { supabase } from '../../services/supabase';

const BOT_URL = ((import.meta as any).env?.VITE_BOT_URL as string | undefined) || 'https://santiagocordova.onrender.com';

interface TareaAgenda { id: string; nombre: string; cuando: string; proxima: string | null; ultima: string | null }
interface EstadoBaku {
    version: string | null;
    enLineaDesde: string;
    minutosEnLinea: number;
    correo: { tokenConfigurado: boolean };
    ia: { gemini: string | null };
    agenda: TareaAgenda[];
}
interface Fallido { id: string; canal: string; destinatario: string; error: string | null; created_at: string; cliente_nombre: string | null }

const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const duracion = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / 1440)} días`);

const Tarjeta: React.FC<{ titulo: string; icono: React.ReactNode; children: React.ReactNode }> = ({ titulo, icono, children }) => (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl p-5 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">{icono}{titulo}</h3>
        {children}
    </div>
);

const Dato: React.FC<{ ok: boolean | null; texto: string; detalle?: string }> = ({ ok, texto, detalle }) => (
    <div className="flex items-start gap-2 text-sm">
        {ok === null ? <Activity size={16} className="text-slate-400 mt-0.5 shrink-0" />
            : ok ? <CheckCircle2 size={16} className="text-[#04B17B] mt-0.5 shrink-0" />
                : <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />}
        <div>
            <div className="text-slate-200">{texto}</div>
            {detalle && <div className="text-xs text-slate-400">{detalle}</div>}
        </div>
    </div>
);

export const BakuEstadoPanel: React.FC = () => {
    const [estado, setEstado] = useState<EstadoBaku | null>(null);
    const [errorBot, setErrorBot] = useState<string | null>(null);
    const [conteo, setConteo] = useState<Record<string, number> | null>(null);
    const [fallidos, setFallidos] = useState<Fallido[]>([]);
    const [errorBandeja, setErrorBandeja] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorBot(null);
        setErrorBandeja(null);
        const controller = new AbortController();
        const corte = setTimeout(() => controller.abort(), 15000);
        try {
            const r = await fetch(`${BOT_URL}/estado`, { signal: controller.signal, headers: { Accept: 'application/json' } });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setEstado(await r.json());
        } catch (e: any) {
            setEstado(null);
            setErrorBot(e?.name === 'AbortError' ? 'No respondió en 15 s (puede estar despertando en Render).' : `No se pudo consultar: ${e?.message || e}`);
        } finally {
            clearTimeout(corte);
        }
        try {
            const { data, error } = await supabase.from('notifications').select('estado').limit(5000);
            if (error) throw error;
            const c: Record<string, number> = {};
            (data || []).forEach((n: any) => { c[n.estado] = (c[n.estado] || 0) + 1; });
            setConteo(c);
            const f = await supabase.from('notifications')
                .select('id, canal, destinatario, error, created_at, cliente_nombre')
                .eq('estado', 'fallido').order('created_at', { ascending: false }).limit(5);
            setFallidos((f.data || []) as Fallido[]);
        } catch (e: any) {
            setConteo(null);
            setErrorBandeja(`No se pudo leer la bandeja: ${e?.message || e}`);
        }
        setCargando(false);
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    const enLinea = estado !== null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-400">Datos reales de Baku (Render) y de la bandeja de notificaciones (Supabase).</p>
                <button onClick={() => void cargar()} disabled={cargando}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#2B6AFF]/15 text-[#7ea2ff] border border-[#2B6AFF]/30 hover:bg-[#2B6AFF]/25 disabled:opacity-50">
                    <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
                </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Baku" icono={<Bot size={16} className="text-[#2B6AFF]" />}>
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${enLinea ? 'bg-[#04B17B] animate-pulse' : 'bg-rose-500'}`} />
                        <span className={`font-mono text-sm font-bold ${enLinea ? 'text-[#04B17B]' : 'text-rose-400'}`}>
                            {cargando && !estado ? 'Consultando…' : enLinea ? 'EN LÍNEA' : 'SIN RESPUESTA'}
                        </span>
                    </div>
                    {errorBot && <Dato ok={false} texto={errorBot} />}
                    {estado && (
                        <div className="space-y-2">
                            <Dato ok texto={`En línea hace ${duracion(estado.minutosEnLinea)}`} detalle={`Desde ${fecha(estado.enLineaDesde)}${estado.version ? ` · versión ${estado.version}` : ''}`} />
                            <Dato ok={estado.correo.tokenConfigurado} texto={estado.correo.tokenConfigurado ? 'Copia por correo configurada' : 'Falta EMAIL_ROUTE_TOKEN en Render'}
                                detalle={estado.correo.tokenConfigurado ? 'Debe coincidir con «Token del servicio» de la extensión.' : 'La copia del comprobante por correo no sale.'} />
                            <Dato ok={!!estado.ia.gemini} texto={estado.ia.gemini ? `IA: ${estado.ia.gemini}` : 'IA sin configurar'} />
                        </div>
                    )}
                </Tarjeta>

                <Tarjeta titulo="Bandeja de notificaciones" icono={<Inbox size={16} className="text-[#2B6AFF]" />}>
                    {errorBandeja && <Dato ok={false} texto={errorBandeja} />}
                    {conteo && (
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {[['pendiente', 'Pendientes', 'text-slate-200'], ['programado', 'Programadas', 'text-[#7ea2ff]'], ['enviado', 'Enviadas', 'text-[#04B17B]'], ['fallido', 'Fallidas', 'text-rose-400']].map(([k, label, color]) => (
                                <div key={k} className="rounded-xl bg-white/5 border border-white/5 py-3">
                                    <div className={`font-mono text-xl font-bold ${color}`}>{conteo[k] || 0}</div>
                                    <div className="text-[11px] text-slate-400">{label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {fallidos.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-rose-300">Últimas fallidas</div>
                            {fallidos.map((f) => (
                                <div key={f.id} className="flex items-start gap-2 text-xs">
                                    <XCircle size={14} className="text-rose-400 mt-0.5 shrink-0" />
                                    <div className="text-slate-300">
                                        <span className="font-semibold">{f.cliente_nombre || f.destinatario || '—'}</span> · {f.canal} · {fecha(f.created_at)}
                                        {f.error && <div className="text-slate-500">{f.error}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {conteo && Object.keys(conteo).length === 0 && <div className="text-xs text-slate-500 flex items-center gap-2"><Mail size={14} /> Todavía no hay notificaciones.</div>}
                </Tarjeta>
            </div>

            <Tarjeta titulo="Agenda automática" icono={<CalendarClock size={16} className="text-[#2B6AFF]" />}>
                {!estado && <div className="text-xs text-slate-500">Se muestra cuando Baku responde.</div>}
                {estado && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="py-2 pr-3">Tarea</th><th className="py-2 pr-3">Cuándo</th><th className="py-2 pr-3">Próxima</th><th className="py-2">Última</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estado.agenda.map((t) => (
                                    <tr key={t.id} className="border-t border-white/5">
                                        <td className="py-2 pr-3 text-slate-200">{t.nombre}</td>
                                        <td className="py-2 pr-3 text-slate-400">{t.cuando}</td>
                                        <td className="py-2 pr-3 font-mono text-[#7ea2ff]">{fecha(t.proxima)}</td>
                                        <td className="py-2 font-mono text-slate-400">{t.ultima ? fecha(t.ultima) : 'aún no (desde el último reinicio)'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Tarjeta>
        </div>
    );
};
