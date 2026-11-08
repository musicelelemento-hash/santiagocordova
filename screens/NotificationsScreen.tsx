import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Mail, MessageCircle, Send, CalendarClock, StickyNote, RefreshCw, Check, X, Search } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import {
    type Notificacion,
    type CanalNotificacion,
    type TipoNotificacion,
    listarNotificaciones,
    crearNotificacionesLote,
    actualizarEstado,
    plantilla,
    nombrePeriodo,
    faltanPorNotificar,
    estadoColor,
    telefonoDe,
    clientesMarcadosParaRecordatorio,
    marcarNotificadoWhatsApp,
} from '../services/notifications';

/**
 * Notificaciones: correo, WhatsApp y notas.
 *
 * Un mensaje, **muchos destinatarios**: marcás los clientes (o usás un atajo:
 * los que faltan, los marcados en Declaraciones, los que tienen WhatsApp) y
 * sale una fila por cada uno. De un solo número se avisa a varios.
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

    // Composición
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [busqueda, setBusqueda] = useState('');
    const [canal, setCanal] = useState<CanalNotificacion>('whatsapp');
    const [tipo, setTipo] = useState<TipoNotificacion>('recordatorio');
    const [asunto, setAsunto] = useState('');
    const [cuerpo, setCuerpo] = useState('');
    const [programada, setProgramada] = useState('');
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            setNotifs(await listarNotificaciones(200));
            setErrorTabla('');
        } catch (e: any) {
            setErrorTabla(String(e?.message || e));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    const faltan = useMemo(() => faltanPorNotificar(clients, periodo, notifs), [clients, periodo, notifs]);
    const conWhatsApp = useMemo(() => clients.filter((c) => telefonoDe(c).length >= 9), [clients]);
    const marcados = useMemo(() => clientesMarcadosParaRecordatorio(clients, canal === 'email' ? 'email' : 'whatsapp'), [clients, canal]);

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const base = clients.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        if (!q) return base;
        return base.filter((c) => String(c.name || '').toLowerCase().includes(q) || String(c.ruc).includes(q));
    }, [clients, busqueda]);

    const seleccionados = useMemo(() => clients.filter((c) => seleccion.has(c.ruc)), [clients, seleccion]);
    const sinTelefono = useMemo(
        () => (canal === 'whatsapp' ? seleccionados.filter((c) => telefonoDe(c).length < 9) : []),
        [canal, seleccionados],
    );

    const conteo = useMemo(() => ({
        pendiente: notifs.filter((n) => n.estado === 'pendiente').length,
        programado: notifs.filter((n) => n.estado === 'programado').length,
        enviado: notifs.filter((n) => n.estado === 'enviado').length,
        fallido: notifs.filter((n) => n.estado === 'fallido').length,
    }), [notifs]);

    const alternar = (ruc: string) => {
        setSeleccion((prev) => {
            const s = new Set(prev);
            if (s.has(ruc)) s.delete(ruc); else s.add(ruc);
            return s;
        });
    };

    const aplicarPlantilla = (t: TipoNotificacion) => {
        const ejemplo = seleccionados[0] || clients[0];
        if (!ejemplo) return;
        const p = plantilla(t, ejemplo, periodo);
        setTipo(t);
        setAsunto(p.asunto);
        setCuerpo(p.cuerpo);
    };

    const enviar = async () => {
        if (!seleccionados.length) { toast.error('Marcá al menos un cliente.'); return; }
        if (!cuerpo.trim()) { toast.error('Falta el mensaje.'); return; }
        if (canal === 'email' && !asunto.trim()) { toast.error('Falta el asunto del correo.'); return; }
        if (canal === 'whatsapp' && sinTelefono.length) {
            toast.error(`${sinTelefono.length} cliente(s) sin teléfono. Quitalos o cargá el número.`);
            return;
        }
        setGuardando(true);
        try {
            const n = await crearNotificacionesLote(
                seleccionados.map((client) => ({ client, canal })),
                { asunto, cuerpo, tipo, periodo, programada_para: programada ? new Date(programada).toISOString() : null },
            );
            if (canal === 'whatsapp' && !programada) {
                await Promise.all(seleccionados.map((c) => marcarNotificadoWhatsApp(c.ruc).catch(() => undefined)));
            }
            toast.success(programada ? `${n} mensaje(s) programados.` : `${n} mensaje(s) en cola.`);
            setSeleccion(new Set());
            setCuerpo('');
            setAsunto('');
            setProgramada('');
            await cargar();
        } catch (e: any) {
            toast.error(`No se pudo enviar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl p-4 text-slate-200 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 font-display text-2xl font-black text-white">
                        <Bell size={22} className="text-[#C9A96E]" /> Notificaciones
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Correo, WhatsApp y notas · un mensaje a varios clientes · período <b className="text-slate-200">{nombrePeriodo(periodo)}</b>
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
                    <button key={id} type="button" onClick={() => setTab(id)}
                        className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${tab === id
                            ? 'border-[#C9A96E]/45 bg-[#C9A96E]/12 text-[#e6d3ab]'
                            : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                        {etiqueta}
                        {id === 'faltan' && faltan.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-amber-300">{faltan.length}</span>}
                    </button>
                ))}
            </div>

            {errorTabla && (
                <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                    No se pudo leer <code>notifications</code>: {errorTabla}. ¿Corriste <code>database/notifications.sql</code>?
                </p>
            )}

            {tab === 'faltan' && (
                <section className="mt-3 rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                    <p className="text-[11px] text-slate-400">
                        Con declaración y comprobante en {nombrePeriodo(periodo)} a los que todavía no se les avisó.
                    </p>
                    {faltan.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                            ✅ No falta avisar a nadie en este período.
                        </p>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => { setSeleccion(new Set(faltan.map((c) => c.ruc))); setTab('componer'); aplicarPlantilla('declaracion'); }}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950"
                            >
                                <Send size={13} /> Avisar a los {faltan.length}
                            </button>
                            <div className="mt-3 divide-y divide-white/5">
                                {faltan.map((c) => (
                                    <div key={c.ruc} className="flex items-center justify-between gap-2 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-[12px] font-semibold text-slate-100">{c.name}</p>
                                            <p className="font-mono text-[10px] text-slate-500">{c.ruc}</p>
                                        </div>
                                        <button type="button" onClick={() => alternar(c.ruc)}
                                            className={`rounded-lg border px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider ${seleccion.has(c.ruc) ? 'border-[#00A896]/45 bg-[#00A896]/12 text-[#4edea3]' : 'border-white/10 text-slate-400'}`}>
                                            {seleccion.has(c.ruc) ? '✓' : '+'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
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
                                <th className="px-3 py-2">Destino</th>
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
                                    <td className="max-w-[170px] truncate px-3 py-1.5 font-semibold text-slate-100">{n.cliente_nombre || n.ruc}</td>
                                    <td className="px-3 py-1.5 text-slate-400">{n.canal}</td>
                                    <td className="max-w-[150px] truncate px-3 py-1.5 font-mono text-[10px] text-slate-400">{n.destinatario || '—'}</td>
                                    <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-300">{n.asunto || n.cuerpo.slice(0, 40)}</td>
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
                <section className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
                    {/* Destinatarios */}
                    <div className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">
                                Destinatarios · {seleccion.size}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                <button type="button" onClick={() => setSeleccion(new Set(faltan.map((c) => c.ruc)))} className="rounded-lg border border-amber-500/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/10">Faltan</button>
                                <button type="button" onClick={() => setSeleccion(new Set(marcados.map((c) => c.ruc)))} className="rounded-lg border border-sky-500/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/10">Marcados</button>
                                <button type="button" onClick={() => setSeleccion(new Set(conWhatsApp.map((c) => c.ruc)))} className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/10">Con WhatsApp</button>
                                <button type="button" onClick={() => setSeleccion(new Set())} className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Ninguno</button>
                            </div>
                        </div>

                        <div className="relative mt-2">
                            <Search size={13} className="pointer-events-none absolute left-3 top-2.5 text-slate-500" />
                            <input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar cliente o RUC…"
                                className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-[12px] text-slate-100"
                            />
                        </div>

                        <div className="mt-2 max-h-[300px] overflow-auto rounded-xl border border-white/5">
                            {filtrados.map((c) => {
                                const on = seleccion.has(c.ruc);
                                const tel = telefonoDe(c);
                                return (
                                    <button
                                        key={c.ruc}
                                        type="button"
                                        onClick={() => alternar(c.ruc)}
                                        className={`flex w-full items-center gap-2 border-b border-white/5 px-3 py-1.5 text-left text-[11px] ${on ? 'bg-[#00A896]/10' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-[#00A896] bg-[#00A896] text-slate-950' : 'border-white/20'}`}>
                                            {on && <Check size={10} />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-slate-200">{c.name}</span>
                                        <span className="font-mono text-[9px] text-slate-500">{tel || 'sin tel.'}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {canal === 'whatsapp' && sinTelefono.length > 0 && (
                            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                                {sinTelefono.length} seleccionado(s) sin teléfono. Cargá el número o quitalos.
                            </p>
                        )}
                    </div>

                    {/* Mensaje */}
                    <div className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Canal</p>
                        <div className="mt-1 flex gap-1.5">
                            {CANALES.map((c) => (
                                <button key={c.id} type="button" onClick={() => setCanal(c.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${canal === c.id ? 'border-[#00A896]/45 bg-[#00A896]/12 text-[#4edea3]' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                                    {c.icono} {c.etiqueta}
                                </button>
                            ))}
                        </div>

                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Tipo</p>
                        <select value={tipo} onChange={(e) => aplicarPlantilla(e.target.value as TipoNotificacion)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100">
                            {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
                        </select>

                        {canal === 'email' && (
                            <>
                                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Asunto</p>
                                <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del correo"
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100" />
                            </>
                        )}

                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">
                            Mensaje {canal === 'whatsapp' ? '· corto y claro' : ''}
                        </p>
                        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={canal === 'whatsapp' ? 6 : 9}
                            placeholder={canal === 'whatsapp' ? 'Hola {cliente}, le recordamos que…' : 'Escribí el mensaje…'}
                            className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100" />

                        <div className="mt-2 flex flex-wrap items-end gap-2">
                            <div className="flex-1">
                                <p className="text-[9px] uppercase tracking-widest text-slate-500">Programar (opcional)</p>
                                <input type="datetime-local" value={programada} onChange={(e) => setProgramada(e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-slate-100" />
                            </div>
                            <button type="button" disabled={guardando} onClick={() => void enviar()}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50">
                                <Send size={13} /> {programada ? 'Programar' : 'Encolar'} · {seleccion.size}
                            </button>
                        </div>

                        <p className="mt-2 text-[10px] text-slate-500">
                            Un mensaje, una fila por cliente. El envío lo hace el bot (Gmail / WhatsApp). Acá queda en cola y se registra.
                        </p>
                        <button type="button" onClick={() => navigate('ajustes')} className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200">
                            <CalendarClock size={12} /> Cómo se envía
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
};

export default NotificationsScreen;
