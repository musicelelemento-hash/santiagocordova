import React, { Suspense, useMemo, useState } from 'react';
import { Target, Megaphone, CalendarDays, CreditCard, Users, MessageCircle, Wallet, Building2, Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getClientIvaFrequency } from '../services/sri';
import { calcularCamino, SUPUESTOS_INICIALES, Supuestos } from '../services/marketing';
import { mockClients } from '../constants';

const AnunciosYVideos = React.lazy(() => import('../components/marketing/AnunciosYVideos').then(m => ({ default: m.AnunciosYVideos })));
const CalendarioContenidos = React.lazy(() => import('../components/marketing/CalendarioContenidos').then(m => ({ default: m.CalendarioContenidos })));
const Responder = React.lazy(() => import('../components/marketing/Responder').then(m => ({ default: m.Responder })));
const PiezasImprimibles = React.lazy(() => import('../components/marketing/PiezasImprimibles').then(m => ({ default: m.PiezasImprimibles })));

/**
 * «Crecer» (22-nov-2026): el espacio de marketing. Pedido de Santiago: tarjetas,
 * volantes, anuncios y videos para Meta, con la meta de 3.000 clientes de IVA
 * mensual. La lógica está en services/marketing.ts (con pruebas).
 */

type Pestana = 'meta' | 'anuncios' | 'responder' | 'calendario' | 'piezas';

const PESTANAS: { id: Pestana; texto: string; icono: React.ElementType }[] = [
    { id: 'meta', texto: 'Meta 3.000', icono: Target },
    { id: 'anuncios', texto: 'Anuncios y videos', icono: Megaphone },
    { id: 'responder', texto: 'Responder', icono: MessageCircle },
    { id: 'calendario', texto: 'Qué publicar', icono: CalendarDays },
    { id: 'piezas', texto: 'Tarjetas y volantes', icono: CreditCard },
];

const num = (n: number) => n.toLocaleString('es-EC', { maximumFractionDigits: 0 });
const usd = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const CrecerScreen: React.FC = () => {
    const [pestana, setPestana] = useLocalStorage<Pestana>('sc_crecer_pestana', 'meta');

    return (
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
            <header className="panel-cascada flex flex-col gap-1.5">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>Crecer</h1>
                <p className="text-[15px] text-slate-600 dark:text-slate-300 max-w-[62ch]">
                    Todo para conseguir clientes nuevos: la meta medida, anuncios y videos para Meta, respuestas rápidas para WhatsApp, qué publicar cada día y tus tarjetas y volantes.
                </p>
            </header>

            <nav aria-label="Secciones de Crecer" className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                {PESTANAS.map(p => {
                    const activa = pestana === p.id;
                    const Icono = p.icono;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            aria-current={activa ? 'page' : undefined}
                            onClick={() => setPestana(p.id)}
                            className={`shrink-0 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF] ${activa ? 'bg-[#2B6AFF] border-[#2B6AFF] text-white' : 'bg-white dark:bg-[#051424]/80 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'}`}
                        >
                            <Icono size={16} /> {p.texto}
                        </button>
                    );
                })}
            </nav>

            <Suspense fallback={<p className="py-10 text-center text-slate-500">Cargando…</p>}>
                {pestana === 'meta' && <MetaTresMil irA={setPestana} />}
                {pestana === 'anuncios' && <AnunciosYVideos />}
                {pestana === 'responder' && <Responder />}
                {pestana === 'calendario' && <CalendarioContenidos />}
                {pestana === 'piezas' && <PiezasImprimibles />}
            </Suspense>
        </div>
    );
};

// ── Meta 3.000 ──────────────────────────────────────────────────────────────

type Editables = Omit<Supuestos, 'actuales'>;

const MetaTresMil: React.FC<{ irA: (p: Pestana) => void }> = ({ irA }) => {
    const clients = useAppStore(s => s.clients);
    const serviceFees = useAppStore(s => s.serviceFees);
    const deEjemplo = clients === mockClients || clients.length === 0;

    const base = useMemo(() => {
        let mensual = 0, semestral = 0;
        for (const c of clients) {
            if (c.isDeleted || !c.isActive || c.clientType === 'solo_plan' || c.requiresDeclarations === false) continue;
            const f = getClientIvaFrequency(c);
            if (f === 'Mensual') mensual++;
            else if (f === 'Semestral') semestral++;
        }
        return { mensual, semestral };
    }, [clients]);

    const [s, setS] = useLocalStorage<Editables>('sc_meta_supuestos', {
        ...SUPUESTOS_INICIALES,
        honorario: serviceFees?.ivaMensual || 15,
    });
    const r = calcularCamino({ ...s, actuales: base.mensual });
    const cambiar = (k: keyof Editables, v: number) => setS(prev => ({ ...prev, [k]: Number.isFinite(v) ? v : 0 }));

    const hitos = [100, 250, 500, 1000, 2000, 3000].filter(h => h <= Math.max(s.meta, 100));

    return (
        <div className="flex flex-col gap-6">
            {/* Dónde estás */}
            <section className="panel-tarjeta-plana rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 p-5 sm:p-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Clientes de IVA mensual</p>
                        <p className="mt-1 text-4xl sm:text-5xl font-extrabold tabular-nums text-slate-900 dark:text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                            {deEjemplo ? '…' : num(base.mensual)} <span className="text-xl sm:text-2xl text-slate-400 font-bold">de {num(s.meta)}</span>
                        </p>
                        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Además: {deEjemplo ? '…' : num(base.semestral)} semestrales. La meta cuenta los mensuales.</p>
                    </div>
                    <p className="text-2xl font-extrabold tabular-nums text-[#04B17B]">{deEjemplo ? '…' : `${r.avance.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`}</p>
                </div>
                <div className="relative pt-5" aria-hidden="true">
                    <div className="h-3 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#2B6AFF] to-[#04B17B] transition-[width] duration-700" style={{ width: `${deEjemplo ? 0 : Math.max(r.avance, 0.8)}%` }} />
                    </div>
                    {hitos.map(h => (
                        <span key={h} className="absolute top-0 -translate-x-1/2 text-[10px] font-mono text-slate-400" style={{ left: `${(h / s.meta) * 100}%` }}>{h >= 1000 ? `${h / 1000}k` : h}</span>
                    ))}
                </div>
            </section>

            {/* Supuestos y resultado */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6">
                <section aria-labelledby="meta-sup" className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 p-5 sm:p-6 flex flex-col gap-4">
                    <div>
                        <h2 id="meta-sup" className="text-lg font-extrabold text-slate-900 dark:text-white">Tus supuestos</h2>
                        <p className="text-[13px] text-slate-500 dark:text-slate-400">Cámbialos por tus datos reales. El costo por conversación lo ves en el Administrador de anuncios de Meta después de la primera semana.</p>
                    </div>
                    <Campo id="m-meta" etiqueta="Meta de clientes mensuales" valor={s.meta} onCambio={v => cambiar('meta', v)} min={1} paso={100} />
                    <Campo id="m-meses" etiqueta="En cuántos meses" valor={s.meses} onCambio={v => cambiar('meses', v)} min={1} paso={1} />
                    <Campo id="m-costo" etiqueta="Costo por conversación de WhatsApp (USD)" valor={s.costoPorConversacion} onCambio={v => cambiar('costoPorConversacion', v)} min={0} paso={0.1} nota="Supuesto, no es un precio de Meta" />
                    <Campo id="m-cierre" etiqueta="De cada 100 que escriben, cuántos se vuelven clientes" valor={Math.round(s.tasaCierre * 100)} onCambio={v => cambiar('tasaCierre', v / 100)} min={1} paso={1} sufijo="%" />
                    <Campo id="m-baja" etiqueta="Clientes que se van por mes" valor={Math.round(s.bajaMensual * 1000) / 10} onCambio={v => cambiar('bajaMensual', v / 100)} min={0} paso={0.5} sufijo="%" />
                    <Campo id="m-hon" etiqueta="Honorario mensual promedio (USD)" valor={s.honorario} onCambio={v => cambiar('honorario', v)} min={0} paso={1} />
                    <Campo id="m-cap" etiqueta="Declaraciones que una persona cierra en un día de vencimiento" valor={s.capacidadPorPersonaDia} onCambio={v => cambiar('capacidadPorPersonaDia', v)} min={1} paso={5} />
                </section>

                <section aria-labelledby="meta-res" className="flex flex-col gap-4">
                    <h2 id="meta-res" className="sr-only">Lo que hace falta</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Dato icono={Users} tono="azul" valor={num(r.nuevosPorMes)} texto="clientes nuevos por mes" detalle={s.bajaMensual > 0 ? 'incluye reponer los que se van' : undefined} />
                        <Dato icono={MessageCircle} tono="violeta" valor={num(r.conversacionesPorMes)} texto="conversaciones de WhatsApp por mes" detalle={`unas ${num(r.conversacionesPorDia)} por día para responder`} />
                        <Dato icono={Wallet} tono="esmeralda" valor={usd(r.presupuestoMensual)} texto="de anuncios por mes" detalle={`${usd(r.costoPorCliente)} por cliente · se recupera en ${r.mesesParaRecuperar.toLocaleString('es-EC', { maximumFractionDigits: 1 })} meses de honorario`} />
                        <Dato icono={Building2} tono="ambar" valor={num(r.personasNecesarias)} texto={r.personasNecesarias === 1 ? 'persona para declarar al llegar' : 'personas para declarar al llegar'} detalle={`${num(r.declaracionesPorDiaVencimiento)} declaraciones por cada día de vencimiento`} />
                    </div>
                    <div className="rounded-3xl border border-[#04B17B]/30 bg-[#04B17B]/5 p-5">
                        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#04B17B]">Al llegar a la meta</p>
                        <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">{usd(r.ingresoMensualAlLlegar)} <span className="text-base font-bold text-slate-500">al mes en honorarios de IVA</span></p>
                        <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">Inversión total en anuncios en {num(s.meses)} meses: {usd(r.presupuestoTotal)}.</p>
                    </div>
                </section>
            </div>

            {/* Lo que el anuncio no resuelve */}
            <section aria-labelledby="meta-mas" className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 p-5 sm:p-6 flex flex-col gap-3">
                <h2 id="meta-mas" className="text-lg font-extrabold text-slate-900 dark:text-white">Lo que el anuncio no resuelve solo</h2>
                <ul className="flex flex-col gap-3 text-[14px] text-slate-700 dark:text-slate-200">
                    <Paso n={1} titulo="Responder rápido">Con {num(r.conversacionesPorDia)} conversaciones por día, una respuesta tardía es un cliente perdido. Ten mensajes listos para las preguntas comunes (precio, qué necesito, cuándo vence).</Paso>
                    <Paso n={2} titulo="Saber qué anuncio funciona">Cada enlace lleva un código entre corchetes (por ejemplo [IVA-M1]). Anótalo en el CRM al crear el prospecto y en un mes sabrás dónde poner el dinero.</Paso>
                    <Paso n={3} titulo="Declarar a escala">{num(r.declaracionesPorDiaVencimiento)} declaraciones en un solo día no se hacen a mano: la extensión Nueva Luz y Baku tienen que llevar el peso, y el equipo crecer al ritmo de los clientes.</Paso>
                    <Paso n={4} titulo="Que cada cliente traiga otro">El cliente más barato es el que te recomiendan. Pide una recomendación al mandar cada comprobante.</Paso>
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={() => irA('anuncios')} className="rounded-2xl bg-[#2B6AFF] hover:bg-[#1f58e0] px-4 py-2.5 text-[14px] font-bold text-white transition">Armar un anuncio</button>
                    <button type="button" onClick={() => irA('calendario')} className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-[14px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#2B6AFF] transition">Ver qué publicar este mes</button>
                </div>
            </section>

            <p className="flex items-start gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                <Info size={14} className="mt-0.5 shrink-0" />
                Es una estimación con tus supuestos, no una promesa. Revisa los números reales cada mes y ajusta.
            </p>
        </div>
    );
};

const Campo: React.FC<{ id: string; etiqueta: string; valor: number; onCambio: (v: number) => void; min?: number; paso?: number; sufijo?: string; nota?: string }> = ({ id, etiqueta, valor, onCambio, min, paso, sufijo, nota }) => (
    <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{etiqueta}</label>
        <div className="flex items-center gap-2">
            <input
                id={id}
                type="number"
                inputMode="decimal"
                value={Number.isFinite(valor) ? valor : 0}
                min={min}
                step={paso}
                onChange={e => onCambio(parseFloat(e.target.value))}
                className="w-full min-w-0 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 font-mono text-[15px] tabular-nums text-slate-900 dark:text-white outline-none focus:border-[#2B6AFF] focus:ring-2 focus:ring-[#2B6AFF]/25"
            />
            {sufijo && <span className="text-[14px] font-semibold text-slate-500">{sufijo}</span>}
        </div>
        {nota && <span className="text-[11px] text-amber-600 dark:text-amber-400">{nota}</span>}
    </div>
);

const TONO_DATO = {
    azul: 'text-[#2B6AFF] bg-[#2B6AFF]/10',
    violeta: 'text-[#6366F1] bg-[#6366F1]/10',
    esmeralda: 'text-[#04B17B] bg-[#04B17B]/10',
    ambar: 'text-amber-500 bg-amber-500/10',
};

const Dato: React.FC<{ icono: React.ElementType; tono: keyof typeof TONO_DATO; valor: string; texto: string; detalle?: string }> = ({ icono: Icono, tono, valor, texto, detalle }) => (
    <div className="panel-tarjeta rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 p-4 sm:p-5 flex flex-col gap-2">
        <span className={`grid place-items-center h-9 w-9 rounded-xl ${TONO_DATO[tono]}`}><Icono size={18} /></span>
        <p className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>{valor}</p>
        <p className="text-[13px] leading-snug text-slate-600 dark:text-slate-300">{texto}</p>
        {detalle && <p className="text-[12px] text-slate-500 dark:text-slate-400">{detalle}</p>}
    </div>
);

const Paso: React.FC<{ n: number; titulo: string; children: React.ReactNode }> = ({ n, titulo, children }) => (
    <li className="flex gap-3">
        <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-[#2B6AFF]/10 text-[13px] font-extrabold text-[#2B6AFF]">{n}</span>
        <span><b className="text-slate-900 dark:text-white">{titulo}.</b> {children}</span>
    </li>
);

export default CrecerScreen;
