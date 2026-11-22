import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, CalendarClock, Wallet, Check, Plus, Clock, LayoutGrid, Users, BarChart, LayoutDashboard, Bot, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Screen, Task, TaskStatus } from '../types';
import { getClientsOverdue, getClientsExpiringInDays, getClientDebtSummary } from '../services/complianceEngine';
import { isCourtesyClient } from '../services/clientService';
import { venceEn, diasHastaViernes, textoCuando, estaVencido, ordenarAbiertos, partesEc } from '../services/pendientes';
import { db } from '../services/db';
import { mockClients } from '../constants';

/**
 * «Hoy» (22-nov-2026): el inicio tranquilo del panel. Pedido de Santiago: «soy
 * una sola persona, el dashboard tiene muchas cosas». Muestra sólo:
 *   1. lo del SRI que pide atención (vencidos, esta semana, por cobrar),
 *   2. sus pendientes (los mismos que anota Baku por Telegram),
 *   3. cuatro atajos.
 * El panel completo sigue a un clic («Panel completo»).
 */

type Cuando = 'hoy' | 'manana' | 'semana';

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dinero = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const HoyScreen: React.FC<{ navigate: (s: Screen, o?: any) => void }> = ({ navigate }) => {
    const clients = useAppStore(s => s.clients);
    const tasks = useAppStore(s => s.tasks);
    const setTasks = useAppStore(s => s.setTasks);
    const serviceFees = useAppStore(s => s.serviceFees);

    // Traer los pendientes que Baku anotó por Telegram (misma tabla), al entrar y cada minuto.
    useEffect(() => {
        let vivo = true;
        const traer = async () => {
            try {
                const { SupabaseService } = await import('../services/supabaseClientService');
                const nube = await SupabaseService.getTasks();
                if (!vivo || !Array.isArray(nube)) return;
                const actuales = useAppStore.getState().tasks || [];
                const porId = new Map<string, Task>();
                nube.forEach(t => t?.id && porId.set(t.id, t));
                actuales.forEach(t => t?.id && !porId.has(t.id) && porId.set(t.id, t));
                const unidas = Array.from(porId.values());
                useAppStore.setState({ tasks: unidas });
                db.setLocal('tasks', unidas);
            } catch { /* sin red: se queda con lo local */ }
        };
        traer();
        const id = window.setInterval(traer, 60000);
        return () => { vivo = false; window.clearInterval(id); };
    }, []);

    const ahora = new Date();
    const pe = partesEc(ahora);
    const saludo = pe.h < 12 ? 'Buenos días' : pe.h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const fechaLarga = `${DIAS_LARGOS[pe.dow]} ${pe.d} de ${MESES_LARGOS[pe.m]}`;

    const sri = useMemo(() => {
        const hoy = new Date();
        const activos = clients.filter(c => !c.isDeleted && c.isActive);
        const vencidos = getClientsOverdue(activos, hoy).length;
        const semana = getClientsExpiringInDays(activos, 7, hoy).length;
        let porCobrar = 0;
        let deudores = 0;
        for (const c of activos) {
            if (isCourtesyClient(c)) continue;
            const d = getClientDebtSummary(c, serviceFees, hoy);
            if (d.totalDebt > 0) { porCobrar += d.totalDebt; deudores++; }
        }
        return { vencidos, semana, porCobrar, deudores };
    }, [clients, serviceFees]);

    // Sin clientes todavía = la nube no respondió (en un navegador nuevo tarda ~30 s).
    // Mejor «cargando» que un 0 que parece «todo al día».
    // Si la nube no respondió, el store rellena con clientes de EJEMPLO (mockClients):
    // sus números no son los de Santiago, así que tampoco se muestran.
    const isLoaded = useAppStore(s => s.isLoaded);
    const deEjemplo = clients === mockClients;
    const cargando = clients.length === 0 || deEjemplo;
    const abiertos = useMemo(() => ordenarAbiertos(tasks || []), [tasks]);
    const atencion = cargando ? -1 : (sri.vencidos > 0 ? 1 : 0) + (sri.semana > 0 ? 1 : 0) + abiertos.filter(t => estaVencido(t.dueDate) || textoCuando(t.dueDate).startsWith('hoy')).length;

    // ── Anotar ──
    const [texto, setTexto] = useState('');
    const [cuando, setCuando] = useState<Cuando>('hoy');
    const [conHora, setConHora] = useState(false);
    const [hora, setHora] = useState('09:00');
    const [recien, setRecien] = useState<string | null>(null);
    const [hechos, setHechos] = useState<Set<string>>(new Set());
    const entrada = useRef<HTMLInputElement>(null);

    const anotar = (e: React.FormEvent) => {
        e.preventDefault();
        const titulo = texto.trim();
        if (!titulo) { entrada.current?.focus(); return; }
        const dias = cuando === 'hoy' ? 0 : cuando === 'manana' ? 1 : diasHastaViernes();
        const nueva: Task = {
            id: uuidv4(),
            title: titulo.slice(0, 200),
            description: 'Anotado en Hoy',
            dueDate: venceEn(dias, conHora ? hora : undefined),
            status: TaskStatus.Pendiente,
        };
        setTasks(prev => [...prev, nueva]);
        setTexto('');
        setRecien(nueva.id);
        window.setTimeout(() => setRecien(r => (r === nueva.id ? null : r)), 1600);
        entrada.current?.focus();
    };

    const completar = (id: string) => {
        setHechos(prev => new Set(prev).add(id));
        // Se ve el ✓ un momento y después se va de la lista.
        window.setTimeout(() => {
            setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: TaskStatus.Completada } : t)));
            setHechos(prev => { const n = new Set(prev); n.delete(id); return n; });
        }, 700);
    };

    const visibles = abiertos.slice(0, 8);

    return (
        <div className="hoy max-w-[880px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 sm:gap-10">
            {/* Saludo */}
            <header className="panel-cascada flex flex-col gap-1.5">
                <p className="text-[13px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 first-letter:uppercase">{fechaLarga}</p>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif', textWrap: 'balance' as any }}>
                    {saludo}, Santiago
                </h1>
                <p className="text-[15px] text-slate-600 dark:text-slate-300">
                    {atencion < 0 ? (deEjemplo && isLoaded ? 'No pude traer tus clientes de la nube todavía; los números aparecen cuando lleguen.' : 'Trayendo tus clientes…') : atencion === 0 ? 'Todo tranquilo por ahora. Nada urgente.' : atencion === 1 ? 'Hay una cosa que mirar hoy.' : `Hay ${atencion} cosas que mirar hoy.`}
                </p>
            </header>

            {/* Lo del SRI */}
            <section aria-labelledby="hoy-sri" className="flex flex-col gap-3">
                <h2 id="hoy-sri" className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">SRI y cobros</h2>
                <div className="panel-cascada grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Tarjeta
                        icono={AlertTriangle}
                        tono={!cargando && sri.vencidos > 0 ? 'rojo' : 'calmo'}
                        numero={cargando ? '…' : String(sri.vencidos)}
                        texto={sri.vencidos === 1 ? 'cliente con declaración vencida' : 'clientes con declaraciones vencidas'}
                        accion="Ver declaraciones"
                        onClick={() => navigate('declaraciones')}
                    />
                    <Tarjeta
                        icono={CalendarClock}
                        tono={!cargando && sri.semana > 0 ? 'ambar' : 'calmo'}
                        numero={cargando ? '…' : String(sri.semana)}
                        texto={sri.semana === 1 ? 'cliente vence en los próximos 7 días' : 'clientes vencen en los próximos 7 días'}
                        accion="Ver declaraciones"
                        onClick={() => navigate('declaraciones')}
                    />
                    <Tarjeta
                        icono={Wallet}
                        tono={!cargando && sri.porCobrar > 0 ? 'verde' : 'calmo'}
                        numero={cargando ? '…' : dinero(sri.porCobrar)}
                        texto={cargando ? 'por cobrar' : `por cobrar · ${sri.deudores} ${sri.deudores === 1 ? 'cliente' : 'clientes'} ya declarados`}
                        accion="Ir a cobranza"
                        onClick={() => navigate('cobranza')}
                    />
                </div>
            </section>

            {/* Pendientes */}
            <section aria-labelledby="hoy-pend" className="panel-tarjeta-plana rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 p-4 sm:p-6 flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 id="hoy-pend" className="text-lg font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                        Tus pendientes {abiertos.length > 0 && <span className="text-slate-400 font-semibold">({abiertos.length})</span>}
                    </h2>
                    {abiertos.length > visibles.length && (
                        <button type="button" onClick={() => navigate('tasks')} className="text-[13px] font-semibold text-[#2B6AFF] hover:underline">Ver todos</button>
                    )}
                </div>

                <form onSubmit={anotar} className="flex flex-col gap-2.5">
                    <div className="flex gap-2">
                        <label htmlFor="hoy-texto" className="sr-only">Qué hay que hacer</label>
                        <input
                            id="hoy-texto"
                            ref={entrada}
                            value={texto}
                            onChange={e => setTexto(e.target.value)}
                            placeholder="Anotar algo… (ej.: llamar al SRI por la firma de Pérez)"
                            autoComplete="off"
                            className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2B6AFF] focus:ring-2 focus:ring-[#2B6AFF]/25 transition"
                        />
                        <button type="submit" className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-[#2B6AFF] hover:bg-[#1f58e0] active:scale-[0.97] px-4 py-3 text-[14px] font-bold text-white transition">
                            <Plus size={16} /> <span className="hidden sm:inline">Anotar</span>
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Para cuándo">
                        {([['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Esta semana']] as [Cuando, string][]).map(([v, l]) => (
                            <button
                                key={v}
                                type="button"
                                aria-pressed={cuando === v}
                                onClick={() => setCuando(v)}
                                className={`rounded-full px-3 py-1 text-[13px] font-semibold border transition ${cuando === v ? 'bg-[#2B6AFF]/10 border-[#2B6AFF] text-[#2B6AFF]' : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'}`}
                            >{l}</button>
                        ))}
                        <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
                        <button
                            type="button"
                            aria-pressed={conHora}
                            onClick={() => setConHora(v => !v)}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold border transition ${conHora ? 'bg-[#04B17B]/10 border-[#04B17B] text-[#04B17B]' : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}`}
                        ><Clock size={13} /> {conHora ? 'Con aviso a las' : 'Avisarme a una hora'}</button>
                        {conHora && (
                            <>
                                <label htmlFor="hoy-hora" className="sr-only">Hora del aviso</label>
                                <input id="hoy-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2 py-1 text-[13px] font-mono text-slate-900 dark:text-white" />
                            </>
                        )}
                    </div>
                    {conHora && <p className="text-[12px] text-slate-500 dark:text-slate-400">Baku te escribe por Telegram a esa hora y te pregunta si ya lo hiciste.</p>}
                </form>

                {visibles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 px-4 py-6 text-center">
                        <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">No tienes nada anotado.</p>
                        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">También puedes escribirle a Baku en Telegram: <span className="italic">«recuérdame mañana a las 10 llamar al SRI»</span>.</p>
                    </div>
                ) : (
                    <ul className="flex flex-col">
                        {visibles.map((t, i) => {
                            const hecho = hechos.has(t.id);
                            const vencido = estaVencido(t.dueDate);
                            return (
                                <li
                                    key={t.id}
                                    className={`hoy-item flex items-center gap-3 py-2.5 border-t first:border-t-0 border-slate-100 dark:border-white/5 ${recien === t.id ? 'hoy-nuevo' : ''} ${hecho ? 'hoy-hecho' : ''}`}
                                    style={{ ['--i' as any]: i }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => completar(t.id)}
                                        disabled={hecho}
                                        aria-label={`Marcar como hecho: ${t.title}`}
                                        className={`grid place-items-center h-6 w-6 shrink-0 rounded-full border-2 transition ${hecho ? 'bg-[#04B17B] border-[#04B17B] text-white' : 'border-slate-300 dark:border-white/25 text-transparent hover:border-[#04B17B] hover:text-[#04B17B]'}`}
                                    >
                                        <Check size={14} strokeWidth={3} />
                                    </button>
                                    <span className={`flex-1 min-w-0 text-[15px] text-slate-800 dark:text-slate-100 ${hecho ? 'line-through opacity-60' : ''}`} style={{ overflowWrap: 'anywhere' }}>{t.title}</span>
                                    <span className={`shrink-0 text-[12px] font-mono ${vencido ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{textoCuando(t.dueDate)}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* Atajos */}
            <section aria-labelledby="hoy-ir" className="flex flex-col gap-3">
                <h2 id="hoy-ir" className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Ir a</h2>
                <div className="panel-cascada grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Atajo icono={LayoutGrid} texto="Declaraciones" onClick={() => navigate('declaraciones')} />
                    <Atajo icono={Users} texto="Clientes" onClick={() => navigate('clients')} />
                    <Atajo icono={BarChart} texto="Cobranza" onClick={() => navigate('cobranza')} />
                    <Atajo icono={Bot} texto="Baku" onClick={() => navigate('telegram_bot')} />
                </div>
                <button type="button" onClick={() => navigate('home')} className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#2B6AFF] transition">
                    <LayoutDashboard size={14} /> Abrir el panel completo <ArrowRight size={13} />
                </button>
            </section>
        </div>
    );
};

const TONOS = {
    rojo: { borde: 'border-rose-200 dark:border-rose-500/30', icono: 'text-rose-500 bg-rose-500/10', numero: 'text-rose-600 dark:text-rose-400' },
    ambar: { borde: 'border-amber-200 dark:border-amber-500/30', icono: 'text-amber-500 bg-amber-500/10', numero: 'text-amber-600 dark:text-amber-400' },
    verde: { borde: 'border-emerald-200 dark:border-[#04B17B]/30', icono: 'text-[#04B17B] bg-[#04B17B]/10', numero: 'text-[#04B17B]' },
    calmo: { borde: 'border-slate-200 dark:border-white/10', icono: 'text-slate-400 bg-slate-500/10', numero: 'text-slate-700 dark:text-slate-200' },
};

const Tarjeta: React.FC<{ icono: React.ElementType; tono: keyof typeof TONOS; numero: string; texto: string; accion: string; onClick: () => void }> = ({ icono: Icono, tono, numero, texto, accion, onClick }) => {
    const t = TONOS[tono];
    return (
        <button
            type="button"
            onClick={onClick}
            className={`panel-tarjeta group text-left rounded-2xl sm:rounded-3xl border ${t.borde} bg-white dark:bg-[#051424]/80 px-4 py-3 sm:p-5 flex flex-row sm:flex-col items-center sm:items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF]`}
        >
            <span className={`grid place-items-center h-9 w-9 shrink-0 rounded-xl ${t.icono}`}><Icono size={18} /></span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${t.numero}`} style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>{numero}</span>
                <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-300">{texto}</span>
            </span>
            <span className="sm:mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-slate-400 group-hover:text-[#2B6AFF] transition"><span className="hidden sm:inline">{accion}</span> <ArrowRight size={14} aria-hidden="true" /><span className="sr-only sm:hidden">{accion}</span></span>
        </button>
    );
};

const Atajo: React.FC<{ icono: React.ElementType; texto: string; onClick: () => void }> = ({ icono: Icono, texto, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="panel-tarjeta rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 px-4 py-4 flex items-center gap-3 text-[14px] font-bold text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF]"
    >
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-[#2B6AFF]/10 text-[#2B6AFF]"><Icono size={18} /></span>
        {texto}
    </button>
);

export default HoyScreen;
