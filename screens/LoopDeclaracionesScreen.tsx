import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, CalendarClock, CheckCircle2,
  CircleDot, Clock, Eye, Gauge, Info, LayoutGrid, Maximize2, Minimize2,
  Pause, Play, Search, ShieldAlert, Sparkles, Square, Timer, TrendingUp,
  Wifi, WifiOff, X
} from 'lucide-react';
import type { Client, Screen } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { DeclarationDossier } from '../components/features/DeclarationDossier';
import {
  sendBatchDeclarationToExtension,
  sendLoopControlToExtension,
  enterSriDirect
} from '../services/extensionBridge';
import {
  clasificarCartera,
  colaParaDeclarar,
  periodoIvaMensual,
  listarPeriodos,
  periodoLegible,
  formatearDuracion,
  estadoExtension,
  leerUltimoPulso,
  leerCorridas,
  guardarCorrida,
  borrarHistorialCorridas,
  promedioPorClienteMs,
  estimarMsRestantes,
  sugerenciaDelMes,
  type LoopBucket,
  type LoopClient,
  type LoopRun,
  type LoopClientRun,
  type PulsoRpa
} from '../services/loopEngine';

interface LoopDeclaracionesScreenProps {
  navigate: (screen: Screen, options?: any) => void;
  theme?: 'light' | 'dark';
}

type ModoVista = 'cockpit' | 'limpio';
type FiltroBucket = 'todos' | LoopBucket;

const BUCKET_META: Record<LoopBucket, { label: string; tono: string; dot: string; icono: React.ElementType }> = {
  listo: {
    label: 'Por declarar',
    tono: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
    dot: 'bg-amber-500',
    icono: CircleDot
  },
  declarado: {
    label: 'Declarado',
    tono: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    dot: 'bg-emerald-500',
    icono: CheckCircle2
  },
  por_pagar: {
    label: 'Revisión manual',
    tono: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/25',
    dot: 'bg-orange-500',
    icono: ShieldAlert
  },
  no_aplica: {
    label: 'No declara IVA',
    tono: 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
    dot: 'bg-slate-400',
    icono: Pause
  },
  sin_clave: {
    label: 'Sin clave',
    tono: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25',
    dot: 'bg-rose-500',
    icono: AlertTriangle
  },
  credencial_mala: {
    label: 'Clave rechazada',
    tono: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25',
    dot: 'bg-rose-500',
    icono: X
  },
  excluido: {
    label: 'Fuera de cartera',
    tono: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    dot: 'bg-slate-300',
    icono: X
  }
};

const money = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Piezas visuales ──────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  valor: string | number;
  detalle?: string;
  tono: string;
  icono: React.ElementType;
  activo?: boolean;
  onClick?: () => void;
}> = ({ label, valor, detalle, tono, icono: Icono, activo, onClick }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`text-left rounded-2xl border px-3.5 py-3 transition-all duration-300 ${tono} ${
      onClick ? 'hover:scale-[1.02] hover:shadow-lg cursor-pointer' : 'cursor-default'
    } ${activo ? 'ring-2 ring-[#00A896]/50 ring-offset-2 ring-offset-white dark:ring-offset-[#0b1326]' : ''}`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-black uppercase tracking-[0.12em] opacity-80">{label}</span>
      <Icono size={12} className="opacity-70" />
    </div>
    <div className="font-mono text-2xl font-black tabular-nums mt-1 leading-none">{valor}</div>
    {detalle && <div className="text-[9.5px] opacity-70 mt-1 leading-tight">{detalle}</div>}
  </button>
);

const ProgressRing: React.FC<{ valor: number; size?: number; label: string; sub: string }> = ({
  valor, size = 118, label, sub
}) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={7} className="stroke-slate-200 dark:stroke-white/10" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={7} fill="none" strokeLinecap="round"
          className="stroke-[#00A896] transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-black tabular-nums text-slate-800 dark:text-white leading-none">{label}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mt-1">{sub}</span>
      </div>
    </div>
  );
};

const FilaCliente: React.FC<{
  item: LoopClient;
  ms?: number;
  activo?: boolean;
  compacto?: boolean;
  onSeleccionar: () => void;
  onDeclarar: () => void;
  onEntrar: () => void;
}> = ({ item, ms, activo, compacto, onSeleccionar, onDeclarar, onEntrar }) => {
  const meta = BUCKET_META[item.bucket];
  const Icono = meta.icono;
  const puedeDeclarar = item.bucket === 'listo';

  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${
        activo
          ? 'border-[#00A896]/40 bg-[#00A896]/[0.07]'
          : 'border-transparent hover:border-slate-200/80 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
      }`}
      onClick={onSeleccionar}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot} ${item.bucket === 'listo' ? 'animate-pulse' : ''}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11.5px] font-bold truncate text-slate-700 dark:text-slate-200">
            {item.name}
          </span>
          {item.alias && (
            <span className="shrink-0 text-[8.5px] font-bold text-[#00A896] bg-[#00A896]/10 px-1 py-px rounded">
              {item.alias}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          <span className="font-mono text-[9.5px] text-slate-400 dark:text-slate-500 shrink-0">{item.ruc}</span>
          {!compacto && (
            <span className="text-[9.5px] text-slate-400 dark:text-slate-500 truncate">{item.motivo}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {item.porPagar !== undefined && item.porPagar > 0 && (
          <span className="font-mono text-[9.5px] font-bold text-orange-600 dark:text-orange-400">{money(item.porPagar)}</span>
        )}
        {ms !== undefined && (
          <span className="font-mono text-[9.5px] text-slate-400 tabular-nums">⏱ {formatearDuracion(ms)}</span>
        )}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border ${meta.tono}`}>
          <Icono size={8} /> {compacto ? '' : meta.label}
        </span>
        {puedeDeclarar && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeclarar(); }}
            title="Declarar sólo este cliente"
            className="w-6 h-6 rounded-lg bg-[#00A896]/10 border border-[#00A896]/25 text-[#00A896] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#00A896] hover:text-white"
          >
            <Play size={10} className="fill-current" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEntrar(); }}
          title="Entrar al portal SRI con este cliente"
          className="w-6 h-6 rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#00A896] hover:border-[#00A896]/40"
        >
          <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
};

// ── Pantalla ─────────────────────────────────────────────────────────────────

export const LoopDeclaracionesScreen: React.FC<LoopDeclaracionesScreenProps> = ({ navigate }) => {
  const { clients } = useAppStore();
  const { toast } = useToast();

  const [modo, setModo] = useState<ModoVista>(() =>
    (localStorage.getItem('sc_loop_modo') as ModoVista) || 'cockpit');
  const [periodo, setPeriodo] = useState<string>(() => periodoIvaMensual());
  const [filtro, setFiltro] = useState<FiltroBucket>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionRuc, setSeleccionRuc] = useState<string | null>(null);
  const [dossierMovil, setDossierMovil] = useState(false);

  useEffect(() => { localStorage.setItem('sc_loop_modo', modo); }, [modo]);

  // ── Corrida en curso ──
  const [corriendo, setCorriendo] = useState(false);
  const [inicioRun, setInicioRun] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [pulso, setPulso] = useState<PulsoRpa | null>(() => leerUltimoPulso());
  const [bitacora, setBitacora] = useState<PulsoRpa[]>([]);
  const [tiempos, setTiempos] = useState<Record<string, { nombre: string; ms: number }>>({});
  const [historial, setHistorial] = useState<LoopRun[]>(() => leerCorridas());
  const ultimoPulsoRef = useRef<{ t: number; ruc: string } | null>(null);
  const runRef = useRef<{ inicio: number; rucs: string[]; periodo: string } | null>(null);
  /**
   * El listener de pulsos se monta una sola vez (deps `[]`) para no
   * re-suscribirse con cada hito; por eso cierra la corrida a través de un ref
   * que apunta siempre a la última versión de `cerrarCorrida`. Sin esto, cuando
   * el semáforo queda en DETENIDO se apagaba el cronómetro y el tiempo medido
   * se perdía — justo el dato que hay que conservar.
   */
  const cerrarRef = useRef<((motivo: string) => void) | null>(null);

  // ── Clasificación (memoizada por cartera + período; 2000 clientes no se recalculan al tic) ──
  const diaClave = new Date().toDateString();
  const resumen = useMemo(
    () => clasificarCartera(clients || [], periodo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, periodo, diaClave]
  );

  const sugerencia = useMemo(() => sugerenciaDelMes(resumen), [resumen]);
  const promedio = useMemo(() => promedioPorClienteMs(historial), [historial]);
  const estimadoRestante = useMemo(
    () => estimarMsRestantes(resumen.listos.length, historial),
    [resumen.listos.length, historial]
  );

  // ── Cronómetro ──
  useEffect(() => {
    if (!corriendo) return;
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [corriendo]);

  const transcurrido = corriendo && inicioRun ? ahora - inicioRun : 0;

  // ── Escucha de pulsos del robot ──
  useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== 'SC_PRO_EXTENSION') return;
      if (data.type !== 'SRI_TELEMETRY_PULSE') return;
      const p: PulsoRpa = data.data;
      if (!p || !p.t) return;

      setPulso(p);
      setBitacora((prev) => [...prev.slice(-59), p]);

      // Tiempo por cliente: el pulso trae el RUC activo; cuando cambia,
      // se cierra el reloj del anterior. Es la única medición real que
      // tenemos de cuánto tarda cada cliente en el portal.
      const previo = ultimoPulsoRef.current;
      if (p.ruc && previo && previo.ruc && previo.ruc !== p.ruc) {
        const delta = p.t - previo.t;
        if (delta > 0 && delta < 30 * 60 * 1000) {
          setTiempos((prev) => ({
            ...prev,
            [previo.ruc]: { nombre: prev[previo.ruc]?.nombre || '', ms: (prev[previo.ruc]?.ms || 0) + delta }
          }));
        }
      }
      if (p.ruc) {
        ultimoPulsoRef.current = { t: p.t, ruc: p.ruc };
        setTiempos((prev) => (prev[p.ruc!] ? prev : { ...prev, [p.ruc!]: { nombre: p.cliente || '', ms: 0 } }));
      } else {
        ultimoPulsoRef.current = { t: p.t, ruc: '' };
      }

      if (String(p.estado || '').toUpperCase() === 'DETENIDO') {
        // El robot terminó: se cierra la medición y queda el tiempo guardado.
        if (runRef.current && cerrarRef.current) cerrarRef.current('el robot terminó');
        else setCorriendo(false);
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []);

  const cerrarCorrida = useCallback((motivoCierre: string) => {
    const run = runRef.current;
    if (!run) { setCorriendo(false); return; }
    const fin = Date.now();
    const actuales = useAppStore.getState().clients || [];

    const detalle: LoopClientRun[] = run.rucs.map((ruc) => {
      const cli = actuales.find((c) => String(c.ruc).replace(/\D/g, '') === ruc);
      const medido = tiempos[ruc];
      if (!cli) {
        return { ruc, nombre: medido?.nombre || ruc, ms: medido?.ms || 0, resultado: 'sin_dato' as const, nota: motivoCierre };
      }
      const clasificado = clasificarCartera([cli], run.periodo);
      const resultado: LoopClientRun['resultado'] =
        clasificado.listos.length > 0 ? 'omitido'
          : clasificado.declarados.length > 0 ? 'declarado'
            : clasificado.porPagar.length > 0 ? 'por_pagar'
              : 'sin_dato';
      return { ruc, nombre: cli.name, ms: medido?.ms || 0, resultado, nota: motivoCierre };
    });

    const corrida: LoopRun = {
      id: `run-${run.inicio}`,
      periodo: run.periodo,
      inicio: run.inicio,
      fin,
      duracionMs: fin - run.inicio,
      total: run.rucs.length,
      declarados: detalle.filter((d) => d.resultado === 'declarado').length,
      porPagar: detalle.filter((d) => d.resultado === 'por_pagar').length,
      fallidos: detalle.filter((d) => d.resultado === 'omitido' || d.resultado === 'sin_dato').length,
      clientes: detalle
    };

    setHistorial(guardarCorrida(corrida));
    runRef.current = null;
    setCorriendo(false);
    toast.info(`Corrida cerrada: ${formatearDuracion(corrida.duracionMs)} en ${corrida.total} clientes.`);
  }, [tiempos, toast]);

  // Mantiene el ref apuntando a la versión fresca (ver comentario del ref).
  cerrarRef.current = cerrarCorrida;

  const arrancarBucle = useCallback((soloEste?: LoopClient) => {
    const cola = soloEste ? [soloEste.cliente] : colaParaDeclarar(resumen);
    if (cola.length === 0) {
      toast.info('No hay clientes por declarar en este período.');
      return;
    }
    sendBatchDeclarationToExtension(cola, 'mensual', 'declare', periodo);

    const inicio = Date.now();
    runRef.current = { inicio, rucs: cola.map((c) => String(c.ruc).replace(/\D/g, '')), periodo };
    setInicioRun(inicio);
    setAhora(inicio);
    setTiempos({});
    setBitacora([]);
    ultimoPulsoRef.current = null;
    setCorriendo(true);
    toast.success(
      soloEste
        ? `Bucle enviado para ${soloEste.name}.`
        : `Bucle enviado: ${cola.length} cliente${cola.length === 1 ? '' : 's'} de ${periodoLegible(periodo)}.`
    );
  }, [resumen, periodo, toast]);

  const controlar = (accion: 'pausar' | 'detener' | 'reanudar') => {
    sendLoopControlToExtension(accion);
    if (accion === 'detener') {
      cerrarCorrida('detenido desde la web');
    }
    toast.info(accion === 'pausar' ? 'Pausa pedida: termina el cliente actual y para.'
      : accion === 'reanudar' ? 'Reanudando el bucle…'
        : 'Bucle detenido.');
  };

  // ── Lista filtrada ──
  const listado = useMemo(() => {
    const grupos: Record<LoopBucket, LoopClient[]> = {
      listo: resumen.listos,
      declarado: resumen.declarados,
      por_pagar: resumen.porPagar,
      no_aplica: resumen.noAplica,
      sin_clave: resumen.sinClave,
      credencial_mala: resumen.credencialMala,
      excluido: resumen.excluidos
    };
    let items = filtro === 'todos'
      ? [...grupos.listo, ...grupos.por_pagar, ...grupos.sin_clave, ...grupos.credencial_mala, ...grupos.declarado, ...grupos.no_aplica]
      : grupos[filtro];

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) || i.ruc.includes(q.replace(/\D/g, '')) || (i.alias || '').toLowerCase().includes(q));
    }
    return items;
  }, [resumen, filtro, busqueda]);

  const seleccionado = useMemo(
    () => listado.find((i) => i.ruc === seleccionRuc)
      || [...resumen.listos, ...resumen.declarados, ...resumen.porPagar].find((i) => i.ruc === seleccionRuc)
      || null,
    [listado, seleccionRuc, resumen]
  );

  useEffect(() => {
    if (!seleccionRuc && resumen.listos.length > 0) setSeleccionRuc(resumen.listos[0].ruc);
  }, [resumen.listos, seleccionRuc]);

  const conSenal = estadoExtension(pulso);
  const enPausa = String(pulso?.estado || '').toUpperCase().includes('PAUS');
  const restantes = resumen.listos.length;
  const filasVisibles = listado.slice(0, 200);

  const abrirFicha = (cliente: Client) => navigate('clients', { clientIdToView: cliente.id });

  // ── Encabezado ──
  const encabezado = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00A896] to-sky-500 p-[1.5px] shrink-0">
            <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#0b1326] flex items-center justify-center">
              <Activity size={14} className="text-[#00A896]" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black font-display tracking-tight text-slate-900 dark:text-white leading-none">
              Bucle mensual
            </h2>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-1">
              IVA de {periodoLegible(periodo)} · {resumen.sujetos} contribuyentes en el período
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide ${
          conSenal === 'en_linea'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : conSenal === 'inactiva'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'border-slate-300 dark:border-white/10 bg-slate-500/5 text-slate-400'
        }`}>
          {conSenal === 'en_linea' ? <Wifi size={10} /> : <WifiOff size={10} />}
          {conSenal === 'en_linea' ? 'Robot en línea' : conSenal === 'inactiva' ? 'Robot inactivo' : 'Sin señal'}
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 p-0.5 bg-white/60 dark:bg-white/5">
          <button
            onClick={() => setModo('cockpit')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
              modo === 'cockpit' ? 'bg-[#00A896] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={10} /> Cockpit
          </button>
          <button
            onClick={() => setModo('limpio')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
              modo === 'limpio' ? 'bg-[#00A896] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Minimize2 size={10} /> Limpio
          </button>
        </div>
      </div>
    </div>
  );

  // ── Selector de período ──
  const periodos = useMemo(() => listarPeriodos(6), []);
  const selectorPeriodo = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {periodos.map((p) => (
        <button
          key={p}
          onClick={() => setPeriodo(p)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
            periodo === p
              ? 'border-[#00A896]/50 bg-[#00A896]/10 text-[#00A896]'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          {periodoLegible(p).replace(' 20', " '")}
        </button>
      ))}
    </div>
  );

  // ── Panel de corrida ──
  const panelCorrida = (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 md:p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <ProgressRing
          valor={resumen.avance}
          label={`${resumen.avance}%`}
          sub="del mes"
        />

        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-3xl font-black tabular-nums leading-none ${corriendo ? 'text-[#00A896]' : 'text-slate-800 dark:text-white'}`}>
              {corriendo ? formatearDuracion(transcurrido) : (historial[0] ? formatearDuracion(historial[0].duracionMs) : '—')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {corriendo ? 'corriendo' : historial[0] ? 'última corrida' : 'sin corridas'}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono flex-wrap">
            <span>{resumen.declarados.length}/{resumen.sujetos} resueltos</span>
            {promedio > 0 && <span>· {formatearDuracion(promedio)}/cliente</span>}
            {restantes > 0 && estimadoRestante > 0 && (
              <span className="text-amber-500">· faltan ≈ {formatearDuracion(estimadoRestante)}</span>
            )}
          </div>

          {pulso && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-black/20 px-3 py-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${corriendo ? 'bg-[#00A896] animate-pulse' : 'bg-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 truncate">
                  {pulso.cliente || 'Robot'} {pulso.paso ? <span className="font-mono text-slate-400"> · {pulso.paso}</span> : null}
                </div>
                <div className="text-[9.5px] text-slate-400 dark:text-slate-500 truncate">
                  {pulso.evento}{pulso.fase ? ` · ${pulso.fase}` : ''}{pulso.detalle ? ` · ${pulso.detalle}` : ''}
                </div>
              </div>
              <span className="font-mono text-[9px] text-slate-400 shrink-0">
                {pulso.t ? new Date(pulso.t).toLocaleTimeString('es-EC', { hour12: false }) : ''}
              </span>
            </div>
          )}

          {corriendo && bitacora.length === 0 && transcurrido > 45000 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-snug text-amber-700 dark:text-amber-300">
                La extensión todavía no reportó ningún hito. Revisá que Nueva Luz 3.0 esté
                instalada y que la pestaña del portal del SRI esté abierta.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {!corriendo ? (
              <button
                onClick={() => arrancarBucle()}
                disabled={restantes === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A896] to-emerald-500 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-[#00A896]/25 hover:shadow-xl hover:shadow-[#00A896]/35 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Play size={13} className="fill-current" />
                {restantes === 0 ? 'Nada por declarar' : `Ejecutar bucle · ${restantes}`}
              </button>
            ) : (
              <>
                <button
                  onClick={() => controlar(enPausa ? 'reanudar' : 'pausar')}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all active:scale-95"
                >
                  {enPausa ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
                  {enPausa ? 'Reanudar' : 'Pausar'}
                </button>
                <button
                  onClick={() => controlar('detener')}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-wider hover:bg-rose-500/20 transition-all active:scale-95"
                >
                  <Square size={11} className="fill-current" /> Detener
                </button>
                <button
                  onClick={() => cerrarCorrida('cerrada a mano')}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wide hover:text-slate-600 dark:hover:text-slate-200"
                  title="Cierra la medición y guarda el tiempo en el histórico"
                >
                  Guardar métricas
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mini bitácora: "ver cómo se ejecuta" */}
      {modo === 'cockpit' && bitacora.length > 0 && (
        <div className="mt-4 border-t border-slate-200/70 dark:border-white/10 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Ejecución en vivo</span>
            <span className="font-mono text-[9px] text-slate-400">{bitacora.length} hitos</span>
          </div>
          <div className="max-h-32 overflow-y-auto no-scrollbar space-y-px font-mono text-[9.5px]">
            {[...bitacora].reverse().map((b, i) => (
              <div key={`${b.t}-${i}`} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                <span className="text-slate-300 dark:text-slate-600 shrink-0">
                  {new Date(b.t).toLocaleTimeString('es-EC', { hour12: false })}
                </span>
                <span className={`shrink-0 ${b.estado === 'CORRIENDO' ? 'text-[#00A896]' : 'text-slate-400'}`}>{b.paso || '·'}</span>
                <span className="text-slate-500 dark:text-slate-400 truncate">{b.evento}</span>
                <span className="text-slate-400 dark:text-slate-500 truncate ml-auto">{b.cliente}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Filtros ──
  const chips: Array<{ key: FiltroBucket; label: string; n: number }> = [
    { key: 'todos', label: 'Todos', n: resumen.listos.length + resumen.porPagar.length + resumen.sinClave.length + resumen.credencialMala.length + resumen.declarados.length + resumen.noAplica.length },
    { key: 'listo', label: 'Por declarar', n: resumen.listos.length },
    { key: 'por_pagar', label: 'Revisión', n: resumen.porPagar.length },
    { key: 'declarado', label: 'Declarados', n: resumen.declarados.length },
    { key: 'sin_clave', label: 'Sin clave', n: resumen.sinClave.length },
    { key: 'no_aplica', label: 'No aplica', n: resumen.noAplica.length }
  ];

  const listaUI = (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      <div className="flex flex-col gap-2 p-3 border-b border-slate-200/70 dark:border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFiltro(c.key)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                filtro === c.key
                  ? 'border-[#00A896]/50 bg-[#00A896]/10 text-[#00A896]'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {c.label}
              <span className="font-mono opacity-60">{c.n}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente por nombre o RUC…"
            className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-100/80 dark:bg-black/30 border border-transparent focus:border-[#00A896]/40 text-[11px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none transition-all"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="p-1.5">
        {filasVisibles.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 size={22} className="mx-auto text-emerald-500/60 mb-2" />
            <p className="text-[11px] text-slate-400">Nada en este filtro.</p>
          </div>
        ) : (
          <div className="space-y-px">
            {filasVisibles.map((item) => (
              <FilaCliente
                key={item.id + item.bucket}
                item={item}
                ms={tiempos[item.ruc]?.ms || undefined}
                activo={seleccionado?.ruc === item.ruc}
                compacto={modo === 'limpio'}
                onSeleccionar={() => { setSeleccionRuc(item.ruc); if (modo === 'limpio') setDossierMovil(true); }}
                onDeclarar={() => arrancarBucle(item)}
                onEntrar={() => { enterSriDirect(item.cliente); toast.info(`Abriendo el portal SRI de ${item.name}…`); }}
              />
            ))}
          </div>
        )}
      </div>

      {listado.length > filasVisibles.length && (
        <div className="px-3 py-2 border-t border-slate-200/70 dark:border-white/10 text-[9.5px] text-slate-400 text-center">
          Mostrando {filasVisibles.length} de {listado.length}. Usá el buscador para llegar al resto.
        </div>
      )}
    </div>
  );

  // ── Histórico de corridas ──
  const historicoUI = (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Timer size={12} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Cuánto tarda el bucle
          </span>
        </div>
        {historial.length > 0 && (
          <button
            onClick={() => { borrarHistorialCorridas(); setHistorial([]); toast.info('Histórico de tiempos borrado.'); }}
            className="text-[9px] font-bold uppercase tracking-wide text-slate-400 hover:text-rose-500 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {historial.length === 0 ? (
        <p className="text-[10.5px] text-slate-400 leading-snug py-2">
          Todavía no hay corridas medidas. La primera vez que ejecutes el bucle,
          acá queda cuánto tardó, cliente por cliente.
        </p>
      ) : (
        <div className="space-y-1">
          {historial.slice(0, 5).map((r) => {
            const pct = r.total > 0 ? Math.round((r.declarados / r.total) * 100) : 0;
            return (
              <div key={r.id} className="rounded-xl border border-slate-200/60 dark:border-white/10 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(r.inicio).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                    {' · '}{periodoLegible(r.periodo).split(' ')[0]}
                  </span>
                  <span className="font-mono text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                    {formatearDuracion(r.duracionMs)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-slate-400 shrink-0">
                    {r.declarados}/{r.total} · {r.total > 0 ? formatearDuracion(Math.round(r.duracionMs / r.total)) : '—'}/u
                  </span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 pt-1 text-[9.5px] text-slate-400">
            <TrendingUp size={10} />
            Promedio histórico: <span className="font-mono font-bold text-slate-500 dark:text-slate-300">{formatearDuracion(promedio)}</span> por cliente
          </div>
        </div>
      )}
    </div>
  );

  // ── Dossier lateral ──
  const dossierUI = seleccionado ? (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4">
      <DeclarationDossier
        client={seleccionado.cliente}
        periodo={periodo}
        compacto
        onVerFicha={() => abrirFicha(seleccionado.cliente)}
      />
    </div>
  ) : (
    <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/15 p-6 text-center">
      <Eye size={18} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
      <p className="text-[10.5px] text-slate-400 leading-snug">
        Elegí un cliente de la lista para ver su mes: ventas, compras por proveedor
        y la vista previa del formulario 104.
      </p>
    </div>
  );

  // ── Modo limpio: pantalla sin adornos ──
  if (modo === 'limpio') {
    return (
      <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto flex flex-col gap-4">
        {encabezado}
        <div className="flex items-center justify-between gap-2">
          {selectorPeriodo}
          {sugerencia && (
            <span className="hidden md:flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
              <Sparkles size={11} /> {restantes} por declarar
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-2xl font-black tabular-nums text-slate-800 dark:text-white leading-none">
              {corriendo ? formatearDuracion(transcurrido) : (historial[0] ? formatearDuracion(historial[0].duracionMs) : '—')}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {corriendo ? (pulso?.cliente || 'corriendo') : `${resumen.declarados.length} de ${resumen.sujetos} del mes resueltos`}
            </div>
          </div>
          {!corriendo ? (
            <button
              onClick={() => arrancarBucle()}
              disabled={restantes === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A896] text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-[#00A896]/25 active:scale-95 transition-all disabled:opacity-40"
            >
              <Play size={13} className="fill-current" /> {restantes === 0 ? 'Al día' : `Ejecutar ${restantes}`}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => controlar(enPausa ? 'reanudar' : 'pausar')} className="w-9 h-9 rounded-xl border border-amber-500/40 text-amber-500 flex items-center justify-center hover:bg-amber-500/10">
                {enPausa ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
              </button>
              <button onClick={() => controlar('detener')} className="w-9 h-9 rounded-xl border border-rose-500/40 text-rose-500 flex items-center justify-center hover:bg-rose-500/10">
                <Square size={11} className="fill-current" />
              </button>
            </div>
          )}
        </div>

        {listaUI}

        <Modal isOpen={dossierMovil} onClose={() => setDossierMovil(false)} title="Expediente del mes" size="2xl">
          {seleccionado && (
            <DeclarationDossier
              client={seleccionado.cliente}
              periodo={periodo}
              onVerFicha={() => { setDossierMovil(false); abrirFicha(seleccionado.cliente); }}
            />
          )}
        </Modal>
      </div>
    );
  }

  // ── Modo cockpit ──
  return (
    <div className="px-4 md:px-8 py-6 flex flex-col gap-4">
      {encabezado}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {selectorPeriodo}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <Gauge size={11} />
          {resumen.total} en cartera · {resumen.sujetos} sujetos del mes
        </div>
      </div>

      {sugerencia && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 animate-fade-in">
          <CalendarClock size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug flex-1">{sugerencia}</p>
          <button
            onClick={() => arrancarBucle()}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[9.5px] font-black uppercase tracking-wide hover:bg-amber-600 transition-colors"
          >
            Correr
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <StatCard
          label="Por declarar" valor={resumen.listos.length}
          detalle={resumen.vencidos > 0 ? `${resumen.vencidos} vencidos` : 'al día'}
          tono="border-amber-500/25 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300"
          icono={CircleDot}
          activo={filtro === 'listo'}
          onClick={() => setFiltro(filtro === 'listo' ? 'todos' : 'listo')}
        />
        <StatCard
          label="Declarados" valor={resumen.declarados.length}
          detalle={`${resumen.avance}% del mes`}
          tono="border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300"
          icono={BadgeCheck}
          activo={filtro === 'declarado'}
          onClick={() => setFiltro(filtro === 'declarado' ? 'todos' : 'declarado')}
        />
        <StatCard
          label="Revisión manual" valor={resumen.porPagar.length}
          detalle="borradores con saldo"
          tono="border-orange-500/25 bg-orange-500/[0.07] text-orange-700 dark:text-orange-300"
          icono={ShieldAlert}
          activo={filtro === 'por_pagar'}
          onClick={() => setFiltro(filtro === 'por_pagar' ? 'todos' : 'por_pagar')}
        />
        <StatCard
          label="Sin clave" valor={resumen.sinClave.length}
          detalle="no pueden entrar"
          tono="border-rose-500/25 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300"
          icono={AlertTriangle}
          activo={filtro === 'sin_clave'}
          onClick={() => setFiltro(filtro === 'sin_clave' ? 'todos' : 'sin_clave')}
        />
        <StatCard
          label="No declaran IVA" valor={resumen.noAplica.length}
          detalle="duermen este mes"
          tono="border-slate-400/25 bg-slate-500/[0.06] text-slate-600 dark:text-slate-300"
          icono={Pause}
          activo={filtro === 'no_aplica'}
          onClick={() => setFiltro(filtro === 'no_aplica' ? 'todos' : 'no_aplica')}
        />
        <StatCard
          label="Ritmo" valor={promedio > 0 ? formatearDuracion(promedio) : '—'}
          detalle={restantes > 0 && estimadoRestante > 0 ? `≈ ${formatearDuracion(estimadoRestante)} restante` : 'por cliente'}
          tono="border-sky-500/25 bg-sky-500/[0.07] text-sky-700 dark:text-sky-300"
          icono={Clock}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 flex flex-col gap-4">
          {panelCorrida}
          {listaUI}
          {historicoUI}
        </div>
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">
          {dossierUI}
          <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Info size={11} className="text-slate-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Cómo se lee</span>
            </div>
            <ul className="space-y-1 text-[9.5px] text-slate-400 dark:text-slate-500 leading-snug">
              <li>· <b className="text-amber-500">Por declarar</b>: entra al bucle ahora.</li>
              <li>· <b className="text-orange-500">Revisión manual</b>: el SRI pide plata, el borrador quedó guardado.</li>
              <li>· <b className="text-slate-400">No declara IVA</b>: semestral, popular o aún no empieza; duerme.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoopDeclaracionesScreen;
