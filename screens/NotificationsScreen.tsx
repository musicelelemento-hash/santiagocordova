import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Bell, Mail, MessageCircle, StickyNote, Send, RefreshCw, Check, X, Search, Copy,
    Users, Clock3, ShieldCheck, Inbox, Plus, CalendarClock, AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import { SQL_NOTIFICATIONS } from '../utils/sqlNotifications';
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
 * Notificaciones · centro de mensajes.
 *
 * Minimalismo funcional: una sola acción primaria por vista, el resto en
 * atajos. Un mensaje a varios clientes; WhatsApp primero; conectado con las
 * marcas de recordatorio de Declaraciones.
 */

interface Props {
    navigate: (screen: string) => void;
}

const CANALES: { id: CanalNotificacion; etiqueta: string; icono: React.ReactNode; color: string }[] = [
    { id: 'whatsapp', etiqueta: 'WhatsApp', icono: <MessageCircle size={14} />, color: '#4edea3' },
    { id: 'email', etiqueta: 'Correo', icono: <Mail size={14} />, color: '#7dd3fc' },
    { id: 'nota', etiqueta: 'Nota', icono: <StickyNote size={14} />, color: '#c4b5fd' },
];

const TIPOS: { id: TipoNotificacion; etiqueta: string }[] = [
    { id: 'recordatorio', etiqueta: 'Recordatorio' },
    { id: 'declaracion', etiqueta: 'Declaración presentada' },
    { id: 'pago', etiqueta: 'Valor a pagar' },
    { id: 'cobro', etiqueta: 'Cobro de servicios' },
    { id: 'bienvenida', etiqueta: 'Bienvenida' },
    { id: 'libre', etiqueta: 'Mensaje libre' },
];

const canalMeta = (c: CanalNotificacion) => CANALES.find((x) => x.id === c) || CANALES[1];

const etiquetaDia = (iso: string): string => {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (mismoDia(d, hoy)) return 'Hoy';
    if (mismoDia(d, ayer)) return 'Ayer';
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
};

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

    // Sólo clientes reales: los que ya declararon o tienen la frecuencia marcada.
    // Las claves/contactos sueltos (imprenta, consultas) no se muestran nunca.
    const clientesUtiles = useMemo(() => clients.filter((c) => (c.declarations?.length || 0) > 0
        || String((c.taxProfile as any)?.ivaFrequency || '').toLowerCase() === 'mensual'), [clients]);
    const faltan = useMemo(() => faltanPorNotificar(clients, periodo, notifs), [clients, periodo, notifs]);
    const conWhatsApp = useMemo(() => clientesUtiles.filter((c) => telefonoDe(c).length >= 9), [clientesUtiles]);
    const marcados = useMemo(() => clientesMarcadosParaRecordatorio(clients, canal === 'email' ? 'email' : 'whatsapp'), [clients, canal]);

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const base = clientesUtiles.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        if (!q) return base;
        return base.filter((c) => String(c.name || '').toLowerCase().includes(q) || String(c.ruc).includes(q));
    }, [clientesUtiles, busqueda]);


    const seleccionados = useMemo(() => clientesUtiles.filter((c) => seleccion.has(c.ruc)), [clientesUtiles, seleccion]);
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

    const porDia = useMemo(() => {
        const mapa = new Map<string, Notificacion[]>();
        for (const n of notifs) {
            const clave = etiquetaDia(n.enviada_en || n.programada_para || n.created_at);
            const lista = mapa.get(clave) || [];
            lista.push(n);
            mapa.set(clave, lista);
        }
        return Array.from(mapa.entries());
    }, [notifs]);

    const alternar = (ruc: string) => {
        setSeleccion((prev) => {
            const s = new Set(prev);
            if (s.has(ruc)) s.delete(ruc); else s.add(ruc);
            return s;
        });
    };

    const aplicarPlantilla = (t: TipoNotificacion) => {
        const ejemplo = seleccionados[0] || clientesUtiles[0];
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
            setTab('bandeja');
        } catch (e: any) {
            toast.error(`No se pudo enviar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-slate-200 sm:px-6">
            {/* Cabecera ------------------------------------------------------- */}
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C9A96E]/35 bg-[#C9A96E]/10 text-[#C9A96E]">
                        <Bell size={20} />
                    </span>
                    <div>
                        <h1 className="font-display text-2xl font-black tracking-tight text-white">Notificaciones</h1>
                        <p className="text-[11px] text-slate-400">
                            Un mensaje a varios clientes · <span className="text-slate-300">{nombrePeriodo(periodo)}</span> · correo, WhatsApp y notas
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void cargar()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                    >
                        <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => { setTab('componer'); aplicarPlantilla(tipo); }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#00A896] px-3.5 text-[10px] font-black uppercase tracking-wider text-slate-950 transition-transform hover:translate-y-[-1px]"
                    >
                        <Plus size={14} /> Componer
                    </button>
                </div>
            </header>

            {/* Indicadores ---------------------------------------------------- */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    ['Pendientes', conteo.pendiente, 'text-amber-300', <Clock3 key="c" size={13} />],
                    ['Programadas', conteo.programado, 'text-sky-300', <CalendarClock key="c" size={13} />],
                    ['Enviadas', conteo.enviado, 'text-emerald-300', <Check key="c" size={13} />],
                    ['Con error', conteo.fallido, 'text-rose-300', <AlertCircle key="c" size={13} />],
                ].map(([etiqueta, valor, color, icono]) => (
                    <div key={String(etiqueta)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#051424]/70 px-3.5 py-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 ${color}`}>{icono}</span>
                        <div>
                            <p className="text-[9px] uppercase tracking-widest text-slate-500">{etiqueta}</p>
                            <p className={`font-mono text-lg font-black leading-tight ${color}`}>{valor}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pestañas ------------------------------------------------------- */}
            <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-black/25 p-1">
                {([['faltan', 'Faltan por avisar', faltan.length], ['bandeja', 'Bandeja', null], ['componer', 'Componer', seleccion.size || null]] as const).map(([id, etiqueta, badge]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id as typeof tab)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${tab === id ? 'bg-[#C9A96E]/15 text-[#e6d3ab]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        {etiqueta}
                        {badge ? <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">{badge}</span> : null}
                    </button>
                ))}
            </div>

            {errorTabla && (
                <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-rose-200">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>
                            Falta la tabla <code className="mx-1">notifications</code>: {errorTabla}
                        </span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(SQL_NOTIFICATIONS)
                                    .then(() => toast.success('SQL copiado. Pegalo en el SQL Editor de Supabase.'))
                                    .catch(() => toast.error('No se pudo copiar: abrí database/notifications.sql'));
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-100 hover:bg-rose-500/15"
                        >
                            <Copy size={11} /> Copiar SQL
                        </button>
                        <button
                            type="button"
                            onClick={() => void cargar()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-white/5"
                        >
                            <RefreshCw size={11} /> Reintentar
                        </button>
                        <span className="text-[10px] text-rose-200/70">
                            Supabase → SQL Editor → pegar → Run. Después, Reintentar.
                        </span>
                    </div>
                </div>
            )}

            {/* FALTAN --------------------------------------------------------- */}
            {tab === 'faltan' && (
                <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#051424]/70">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                        <p className="text-[11px] text-slate-400">
                            Con declaración y comprobante en <b className="text-slate-200">{nombrePeriodo(periodo)}</b> a los que todavía no se les avisó.
                        </p>
                        {faltan.length > 0 && (
                            <button
                                type="button"
                                onClick={() => { setSeleccion(new Set(faltan.map((c) => c.ruc))); setTab('componer'); aplicarPlantilla('declaracion'); }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950"
                            >
                                <Send size={13} /> Avisar a los {faltan.length}
                            </button>
                        )}
                    </div>
                    {faltan.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                            <ShieldCheck size={26} className="text-emerald-400" />
                            <p className="text-[12px] font-semibold text-emerald-200">No falta avisar a nadie en este período.</p>
                            <button type="button" onClick={() => setTab('bandeja')} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200">
                                Ver la bandeja
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {faltan.map((c) => (
                                <div key={c.ruc} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                                    <div className="min-w-0">
                                        <p className="truncate text-[12px] font-semibold text-slate-100">{c.name}</p>
                                        <p className="font-mono text-[10px] text-slate-500">
                                            {c.ruc}
                                            {telefonoDe(c) ? <span className="ml-2 text-slate-600">· {telefonoDe(c)}</span> : <span className="ml-2 text-amber-500/70">· sin teléfono</span>}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => alternar(c.ruc)}
                                        aria-pressed={seleccion.has(c.ruc)}
                                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${seleccion.has(c.ruc) ? 'border-[#00A896]/50 bg-[#00A896]/15 text-[#4edea3]' : 'border-white/10 text-slate-500 hover:border-white/25'}`}
                                        title={seleccion.has(c.ruc) ? 'Quitar de la selección' : 'Sumar a la selección'}
                                    >
                                        {seleccion.has(c.ruc) ? <Check size={12} /> : <Plus size={12} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* BANDEJA -------------------------------------------------------- */}
            {tab === 'bandeja' && (
                <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#051424]/70">
                    {notifs.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                            <Inbox size={26} className="text-slate-500" />
                            <p className="text-[12px] font-semibold text-slate-300">La bandeja está vacía.</p>
                            <button type="button" onClick={() => setTab('componer')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950">
                                <Plus size={13} /> Componer el primero
                            </button>
                        </div>
                    ) : (
                        porDia.map(([dia, filas]) => (
                            <div key={dia}>
                                <p className="sticky top-0 z-10 border-b border-white/5 bg-[#051424]/95 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
                                    {dia} · {filas.length}
                                </p>
                                <div className="divide-y divide-white/5">
                                    {filas.map((n) => {
                                        const meta = canalMeta(n.canal);
                                        return (
                                            <div key={n.id} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                                                <span
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10"
                                                    style={{ color: meta.color, background: 'rgba(255,255,255,0.04)' }}
                                                    title={meta.etiqueta}
                                                >
                                                    {meta.icono}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[12px] font-semibold text-slate-100">{n.cliente_nombre || n.ruc}</p>
                                                    <p className="truncate text-[10.5px] text-slate-500">
                                                        {n.asunto || n.cuerpo.slice(0, 60)}
                                                    </p>
                                                </div>
                                                <span className="hidden font-mono text-[10px] text-slate-500 sm:block">{n.destinatario || '—'}</span>
                                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${estadoColor(n.estado)}`}>
                                                    {n.estado}
                                                </span>
                                                <span className="w-14 shrink-0 text-right font-mono text-[10px] text-slate-500">
                                                    {new Date(n.enviada_en || n.programada_para || n.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    {n.estado !== 'enviado' && n.estado !== 'cancelado' && (
                                                        <>
                                                            <button type="button" title="Marcar enviada" onClick={async () => { await actualizarEstado(n.id, 'enviado'); void cargar(); }} className="rounded-md border border-emerald-500/30 p-1 text-emerald-300 hover:bg-emerald-500/10">
                                                                <Check size={11} />
                                                            </button>
                                                            <button type="button" title="Cancelar" onClick={async () => { await actualizarEstado(n.id, 'cancelado'); void cargar(); }} className="rounded-md border border-white/10 p-1 text-slate-400 hover:bg-white/5">
                                                                <X size={11} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </section>
            )}

            {/* COMPONER ------------------------------------------------------- */}
            {tab === 'componer' && (
                <section className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
                    {/* Destinatarios */}
                    <div className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">
                                <Users size={13} /> Destinatarios
                                <span className="rounded-full bg-[#C9A96E]/15 px-1.5 py-0.5 font-mono text-[9px] text-[#e6d3ab]">{seleccion.size}</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {([
                                    ['Faltan', faltan.length, () => setSeleccion(new Set(faltan.map((c) => c.ruc)))],
                                    ['Marcados', marcados.length, () => setSeleccion(new Set(marcados.map((c) => c.ruc)))],
                                    ['Con WhatsApp', conWhatsApp.length, () => setSeleccion(new Set(conWhatsApp.map((c) => c.ruc)))],
                                    ['Ninguno', 0, () => setSeleccion(new Set())],
                                ] as Array<[string, number, () => void]>).map(([etiqueta, n, accion]) => (
                                    <button
                                        key={String(etiqueta)}
                                        type="button"
                                        onClick={accion as () => void}
                                        className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
                                        title={n ? `${n} cliente(s)` : undefined}
                                    >
                                        {etiqueta}{n ? ` · ${n}` : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative mt-3">
                            <Search size={13} className="pointer-events-none absolute left-3 top-2.5 text-slate-500" />
                            <input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar cliente o RUC…"
                                className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-[12px] text-slate-100 outline-none transition-colors focus:border-[#C9A96E]/50"
                            />
                        </div>

                        <div className="mt-2 max-h-[320px] overflow-auto rounded-xl border border-white/5">
                            {filtrados.map((c) => {
                                const on = seleccion.has(c.ruc);
                                const tel = telefonoDe(c);
                                return (
                                    <button
                                        key={c.ruc}
                                        type="button"
                                        onClick={() => alternar(c.ruc)}
                                        className={`flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-[11px] transition-colors ${on ? 'bg-[#00A896]/10' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${on ? 'border-[#00A896] bg-[#00A896] text-slate-950' : 'border-white/20'}`}>
                                            {on && <Check size={10} />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-slate-200">{c.name}</span>
                                        <span className={`font-mono text-[9px] ${tel ? 'text-slate-500' : 'text-amber-500/70'}`}>{tel || 'sin tel.'}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {canal === 'whatsapp' && sinTelefono.length > 0 && (
                            <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
                                <AlertCircle size={12} /> {sinTelefono.length} seleccionado(s) sin teléfono. Cargá el número o quitalos.
                            </p>
                        )}
                    </div>

                    {/* Mensaje */}
                    <div className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Canal</p>
                        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                            {CANALES.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setCanal(c.id)}
                                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${canal === c.id ? 'border-[#00A896]/45 bg-[#00A896]/12 text-[#4edea3]' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                                >
                                    {c.icono} {c.etiqueta}
                                </button>
                            ))}
                        </div>

                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Tipo</p>
                        <select
                            value={tipo}
                            onChange={(e) => aplicarPlantilla(e.target.value as TipoNotificacion)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100 outline-none"
                        >
                            {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
                        </select>

                        {canal === 'email' && (
                            <>
                                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">Asunto</p>
                                <input
                                    value={asunto}
                                    onChange={(e) => setAsunto(e.target.value)}
                                    placeholder="Asunto del correo"
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100 outline-none transition-colors focus:border-[#C9A96E]/50"
                                />
                            </>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">
                                Mensaje {canal === 'whatsapp' ? '· corto' : ''}
                            </p>
                            <span className="font-mono text-[9px] text-slate-600">{cuerpo.length} car.</span>
                        </div>
                        <textarea
                            value={cuerpo}
                            onChange={(e) => setCuerpo(e.target.value)}
                            rows={canal === 'whatsapp' ? 6 : 8}
                            placeholder={canal === 'whatsapp' ? 'Hola {cliente}, le recordamos que…' : 'Escribí el mensaje…'}
                            className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100 outline-none transition-colors focus:border-[#C9A96E]/50"
                        />

                        <div className="mt-2 flex flex-wrap items-end gap-2">
                            <div className="flex-1">
                                <p className="text-[9px] uppercase tracking-widest text-slate-500">Programar (opcional)</p>
                                <input
                                    type="datetime-local"
                                    value={programada}
                                    onChange={(e) => setProgramada(e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={() => void enviar()}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-950 transition-transform hover:translate-y-[-1px] disabled:opacity-50"
                            >
                                <Send size={13} /> {programada ? 'Programar' : 'Encolar'} · {seleccion.size}
                            </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] text-slate-500">
                                Lo envía el bot (Resend / WhatsApp). Acá queda en cola y se registra.
                            </p>
                            <button type="button" onClick={() => navigate('ajustes')} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                                <CalendarClock size={11} /> Ajustes
                            </button>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default NotificationsScreen;
