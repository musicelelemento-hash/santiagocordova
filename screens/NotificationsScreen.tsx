import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Mail, MessageCircle, Send, CalendarClock, StickyNote, RefreshCw, Check, X, Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import {
    type Notificacion,
    type CanalNotificacion,
    type TipoNotificacion,
    listarNotificaciones,
    crearNotificacion,
    actualizarEstado,
    plantilla,
    nombrePeriodo,
    faltanPorNotificar,
    estadoColor,
} from '../services/notifications';

/**
 * Notificaciones: correo, WhatsApp y notas.
 *
 * Tres vistas: lo que falta avisar, la bandeja de lo enviado/en cola y el
 * compositor (con plantillas por tipo y programación). El envío real lo hace
 * el bot; acá se arma, se encola y se registra — nunca se marca enviado solo.
 */

interface Props {
    navigate: (screen: string) => void;
}

const CANALES: { id: CanalNotificacion; etiqueta: string; icono: React.ReactNode }[] = [
    { id: 'email', etiqueta: 'Correo', icono: <Mail size={13} /> },
    { id: 'whatsapp', etiqueta: 'WhatsApp', icono: <MessageCircle size={13} /> },
    { id: 'nota', etiqueta: 'Nota', icono: <StickyNote size={13} /> },
];

const TIPOS: { id: TipoNotificacion; etiqueta: string }[] = [
    { id: 'declaracion', etiqueta: 'Declaración presentada' },
    { id: 'recordatorio', etiqueta: 'Recordatorio' },
    { id: 'pago', etiqueta: 'Valor a pagar' },
    { id: 'cobro', etiqueta: 'Cobro de servicios' },
    { id: 'bienvenida', etiqueta: 'Bienvenida' },
    { id: 'libre', etiqueta: 'Mensaje libre' },
];

const NotificationsScreen: React.FC<Props> = ({ navigate }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();
    const [tab, setTab] = useState<'faltan' | 'bandeja' | 'componer'>('faltan');
    const [periodo] = useState(() => {
        const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    });
    const [notifs, setNotifs] = useState<Notificacion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [errorTabla, setErrorTabla] = useState('');

    const [clienteRuc, setClienteRuc] = useState('');
    const [canal, setCanal] = useState<CanalNotificacion>('email');
    const [tipo, setTipo] = useState<TipoNotificacion>('declaracion');
    const [asunto, setAsunto] = useState('');
    const [cuerpo, setCuerpo] = useState('');
    const [programada, setProgramada] = useState('');
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const lista = await listarNotificaciones(200);
            setNotifs(lista);
            setErrorTabla('');
        } catch (e: any) {
            setErrorTabla(String(e?.message || e));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    const cliente = useMemo(() => clients.find((c) => c.ruc === clienteRuc) || null, [clients, clienteRuc]);
    const faltan = useMemo(() => faltanPorNotificar(clients, periodo, notifs), [clients, periodo, notifs]);
    const conteo = useMemo(() => ({
        pendiente: notifs.filter((n) => n.estado === 'pendiente').length,
        programado: notifs.filter((n) => n.estado === 'programado').length,
        enviado: notifs.filter((n) => n.estado === 'enviado').length,
        fallido: notifs.filter((n) => n.estado === 'fallido').length,
    }), [notifs]);

    const aplicarPlantilla = (t: TipoNotificacion, c = cliente) => {
        if (!c) return;
        const p = plantilla(t, c, periodo);
        setTipo(t);
        setAsunto(p.asunto);
        setCuerpo(p.cuerpo);
    };

    const guardar = async (c = cliente, enviarAhora = false) => {
        if (!c) { toast.error('Elegí un cliente.'); return; }
        if (!asunto.trim() && canal === 'email') { toast.error('Falta el asunto del correo.'); return; }
        if (!cuerpo.trim()) { toast.error('Falta el mensaje.'); return; }
        setGuardando(true);
        try {
            await crearNotificacion({
                ruc: c.ruc,
                cliente_nombre: c.name,
                canal,
                tipo,
                destinatario: canal === 'email' ? String((c as any).email || '') : String((c as any).whatsapp || (c as any).phone || ''),
                asunto,
                cuerpo,
                periodo,
                programada_para: enviarAhora ? null : (programada ? new Date(programada).toISOString() : null),
            });
            toast.success(programada && !enviarAhora ? 'Programada.' : 'En cola de envío.');
            setAsunto('');
            setCuerpo('');
            setProgramada('');
            await cargar();
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    const notificarFaltante = (ruc: string) => {
        const c = clients.find((x) => x.ruc === ruc);
        if (!c) return;
        setClienteRuc(ruc);
        const p = plantilla('declaracion', c, periodo);
        setTipo('declaracion');
        setCanal('email');
        setAsunto(p.asunto);
        setCuerpo(p.cuerpo);
        setTab('componer');
    };

    return (
        <div className="mx-auto w-full max-w-6xl p-4 text-slate-200 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 font-display text-2xl font-black text-white">
                        <Bell size={22} className="text-[#C9A96E]" /> Notificaciones
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Correo, WhatsApp y notas · período <b className="text-slate-200">{nombrePeriodo(periodo)}</b>
                    </p>
                </div>
                <button type="button" onClick={() => void cargar()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
                    <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
                </button>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    ['Pendientes', conteo.pendiente, 'text-amber-300'],
                    ['Programadas', conteo.programado, 'text-sky-300'],
                    ['Enviadas', conteo.enviado, 'text-emerald-300'],
                    ['Con error', conteo.fallido, 'text-rose-300'],
                ].map(([etiqueta, valor, color]) => (
                    <div key={String(etiqueta)} className="rounded-xl border border-white/10 bg-[#051424]/70 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-widest text-slate-500">{etiqueta}</p>
                        <p className={`font-mono text-lg font-black ${color}`}>{valor}</p>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex gap-1">
                {([['faltan', 'Faltan por avisar'], ['bandeja', 'Bandeja'], ['componer', 'Componer']] as const).map(([id, etiqueta]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${tab === id
                            ? 'border-[#C9A96E]/45 bg-[#C9A96E]/12 text-[#e6d3ab]'
                            : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                    >
                        {etiqueta}
                        {id === 'faltan' && faltan.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-amber-300">{faltan.length}</span>}
                    </button>
                ))}
            </div>

            {errorTabla && (
                <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                    No se pudo leer la tabla <code>notifications</code>: {errorTabla}. ¿Corriste <code>database/notifications.sql</code>?
                </p>
            )}

            {tab === 'faltan' && (
                <section className="mt-3 rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                    <p className="text-[11px] text-slate-400">
                        Clientes con declaración y comprobante en {nombrePeriodo(periodo)} a los que todavía no se les avisó.
                    </p>
                    {faltan.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                            ✅ No falta avisar a nadie en este período.
                        </p>
                    ) : (
                        <div className="mt-3 divide-y divide-white/5">
                            {faltan.map((c) => (
                                <div key={c.ruc} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-[12px] font-semibold text-slate-100">{c.name}</p>
                                        <p className="font-mono text-[10px] text-slate-500">{c.ruc}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => notificarFaltante(c.ruc)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#00A896]/40 bg-[#00A896]/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4edea3]"
                                    >
                                        <Send size={12} /> Notificar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {tab === 'bandeja' && (
                <section className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#051424]/70">
                    <table className="w-full text-left text-[11px]">
                        <thead className="bg-black/30 text-[9px] uppercase tracking-widest text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Cliente</th>
                                <th className="px-3 py-2">Canal</th>
                                <th className="px-3 py-2">Tipo</th>
                                <th className="px-3 py-2">Asunto</th>
                                <th className="px-3 py-2">Estado</th>
                                <th className="px-3 py-2">Cuándo</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {notifs.length === 0 && (
                                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Nada todavía. Componé el primero.</td></tr>
                            )}
                            {notifs.map((n) => (
                                <tr key={n.id} className="hover:bg-white/[0.03]">
                                    <td className="max-w-[180px] truncate px-3 py-1.5 font-semibold text-slate-100">{n.cliente_nombre || n.ruc}</td>
                                    <td className="px-3 py-1.5 text-slate-400">{n.canal}</td>
                                    <td className="px-3 py-1.5 text-slate-400">{n.tipo}</td>
                                    <td className="max-w-[240px] truncate px-3 py-1.5 text-slate-300">{n.asunto || n.cuerpo.slice(0, 40)}</td>
                                    <td className="px-3 py-1.5">
                                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${estadoColor(n.estado)}`}>{n.estado}</span>
                                    </td>
                                    <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">
                                        {new Date(n.enviada_en || n.programada_para || n.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                        {n.estado !== 'enviado' && n.estado !== 'cancelado' && (
                                            <div className="inline-flex gap-1">
                                                <button type="button" title="Marcar enviada" onClick={async () => { await actualizarEstado(n.id, 'enviado'); void cargar(); }} className="rounded-md border border-emerald-500/30 p-1 text-emerald-300 hover:bg-emerald-500/10"><Check size={11} /></button>
                                                <button type="button" title="Cancelar" onClick={async () => { await actualizarEstado(n.id, 'cancelado'); void cargar(); }} className="rounded-md border border-white/10 p-1 text-slate-400 hover:bg-white/5"><X size={11} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {tab === 'componer' && (
                <section className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                        <label className="text-[9px] uppercase tracking-widest text-slate-500">Cliente</label>
                        <select
                            value={clienteRuc}
                            onChange={(e) => { setClienteRuc(e.target.value); const c = clients.find((x) => x.ruc === e.target.value); if (c) aplicarPlantilla(tipo, c); }}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100"
                        >
                            <option value="">Elegí un cliente…</option>
                            {clients.map((c) => <option key={c.ruc} value={c.ruc}>{c.name} · {c.ruc}</option>)}
                        </select>

                        <label className="mt-3 block text-[9px] uppercase tracking-widest text-slate-500">Canal</label>
                        <div className="mt-1 flex gap-1.5">
                            {CANALES.map((c) => (
                                <button key={c.id} type="button" onClick={() => setCanal(c.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${canal === c.id ? 'border-[#00A896]/45 bg-[#00A896]/12 text-[#4edea3]' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                                    {c.icono} {c.etiqueta}
                                </button>
                            ))}
                        </div>

                        <label className="mt-3 block text-[9px] uppercase tracking-widest text-slate-500">Tipo</label>
                        <select value={tipo} onChange={(e) => { const t = e.target.value as TipoNotificacion; setTipo(t); if (cliente) aplicarPlantilla(t); }}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100">
                            {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
                        </select>

                        <label className="mt-3 block text-[9px] uppercase tracking-widest text-slate-500">Programar (opcional)</label>
                        <input type="datetime-local" value={programada} onChange={(e) => setProgramada(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-slate-100" />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                        <label className="text-[9px] uppercase tracking-widest text-slate-500">Asunto</label>
                        <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del correo"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100" />
                        <label className="mt-3 block text-[9px] uppercase tracking-widest text-slate-500">Mensaje</label>
                        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={9} placeholder="Escribí el mensaje…"
                            className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100" />
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" disabled={guardando} onClick={() => void guardar()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50">
                                <Send size={13} /> {programada ? 'Programar' : 'Poner en cola'}
                            </button>
                            <button type="button" onClick={() => navigate('ajustes')} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
                                <CalendarClock size={13} /> Cómo se envía
                            </button>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">
                            El envío lo hace el bot. Acá queda en cola y se registra: nunca se marca enviado solo.
                        </p>
                    </div>
                </section>
            )}
        </div>
    );
};

export default NotificationsScreen;
