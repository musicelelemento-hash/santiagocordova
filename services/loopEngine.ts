/**
 * loopEngine — el "cerebro" del bucle mensual, del lado de la web.
 *
 * Hasta hoy, la web sólo podía DISPARAR un lote (`sendBatchDeclarationToExtension`)
 * y después mirar pulsos sueltos. No había una sola función que contestara las
 * preguntas que importan cuando se declaran 2000 clientes:
 *
 *   ¿A quién hay que declararle este mes?  ¿Quién NO declara IVA (y hay que
 *   dejarlo dormir)?  ¿Quién ya está declarado?  ¿Quién quedó con saldo a pagar
 *   esperando revisión manual?  ¿Cuánto tardó la corrida y cuánto tarda cada
 *   cliente, para saber si el siguiente mes entra en la tarde?
 *
 * Este módulo contesta eso sin tocar la UI y sin inventar datos: cuando algo no
 * se sabe, lo dice. Todo lo que es "tiempo" se mide aquí y se guarda en
 * `localStorage`, que es el único almacén compartido con la extensión.
 */

import type { Client, Declaration } from '../types';
import { getClientIvaFrequency, getDueDateForPeriod, isSriPasswordUpdated } from './sri';
import type { SriPasswordStatusInfo } from './sri';
import { isPeriodBeforeClientStart } from './complianceEngine';

// ── Estados del bucle, uno por cliente ───────────────────────────────────────

export type LoopBucket =
  /** Toca declararlo: tiene clave, declara IVA mensual y no hay comprobante. */
  | 'listo'
  /** Ya está: comprobante oficial guardado o declaración enviada/pagada. */
  | 'declarado'
  /** El bot frenó porque hay saldo a pagar. Borrador guardado: revisión manual. */
  | 'por_pagar'
  /** No le toca IVA este mes: semestral, popular, solo-plan o aún no empieza. */
  | 'no_aplica'
  /** Le toca, pero no hay clave SRI guardada. */
  | 'sin_clave'
  /** La clave existe pero el SRI la rechazó, caducó o bloqueó la cuenta. */
  | 'credencial_mala'
  /** Eliminado o inactivo: fuera del bucle y de la cartera. */
  | 'excluido';

export interface LoopClient {
  id: string;
  ruc: string;
  name: string;
  alias?: string;
  bucket: LoopBucket;
  /** Por qué está en ese estado, en una línea que se pueda leer en pantalla. */
  motivo: string;
  frecuencia: string;
  /** ISO de la fecha de vencimiento del período, si se pudo calcular. */
  vence: string | null;
  dias: number | null;
  /** Vencido = la fecha límite ya pasó y sigue sin declarar. */
  vencido: boolean;
  clave: SriPasswordStatusInfo;
  declaracion?: Declaration;
  /** Monto que el SRI pidió y por el que el bot no envió la declaración. */
  porPagar?: number;
  cliente: Client;
}

export interface LoopResumen {
  periodo: string;
  total: number;
  listos: LoopClient[];
  declarados: LoopClient[];
  porPagar: LoopClient[];
  noAplica: LoopClient[];
  sinClave: LoopClient[];
  credencialMala: LoopClient[];
  excluidos: LoopClient[];
  /** listos + declarados + porPagar: los que sí son sujetos del mes. */
  sujetos: number;
  /** % del mes resuelto (declarados + porPagar sobre sujetos). */
  avance: number;
  /** Cuántos de los que faltan ya pasaron su fecha límite. */
  vencidos: number;
}

// ── Períodos ─────────────────────────────────────────────────────────────────

const dos = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM` del mes calendario anterior: el IVA mensual que toca declarar. */
export function periodoIvaMensual(ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}`;
}

/** Los últimos `cantidad` períodos mensuales, del más reciente al más viejo. */
export function listarPeriodos(cantidad = 6, ref: Date = new Date()): string[] {
  const salida: string[] = [];
  for (let i = 1; i <= cantidad; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    salida.push(`${d.getFullYear()}-${dos(d.getMonth() + 1)}`);
  }
  return salida;
}

/** ¿Es el arranque de mes? Sirve para sugerir la corrida sin que la pidan. */
export function esInicioDeMes(ref: Date = new Date()): boolean {
  return ref.getDate() <= 12;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10" → "octubre 2026". */
export function periodoLegible(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  const mes = Number(m[2]);
  return `${MESES[mes - 1] || m[2]} ${m[1]}`;
}

// ── Clasificación por cliente ────────────────────────────────────────────────

/** Declaraciones del cliente para ese período exacto (ignora sufijos `:TIPO`). */
function declaracionesDelPeriodo(client: Client, periodo: string): Declaration[] {
  const lista = Array.isArray(client.declarations) ? client.declarations : [];
  return lista.filter((d) => !!d && String(d.period || '').split(':')[0].trim() === periodo);
}

const ESTADOS_ENVIADA = ['Enviada', 'Pagada', 'enviada', 'pagada', 'completado'];

function tieneComprobante(d: Declaration | undefined): boolean {
  if (!d) return false;
  const pf: any = d.proof_file;
  return !!(pf && (pf.url || pf.name || pf.bucketPath));
}

/** El bucket y el motivo de un cliente para un período concreto. */
export function clasificarCliente(client: Client, periodo: string, ref: Date = new Date()): LoopClient {
  const clave = isSriPasswordUpdated(client);
  const ivaFrecuencia = getClientIvaFrequency(client);
  const venceDate = getDueDateForPeriod(client, periodo);
  const vence = venceDate ? venceDate.toISOString() : null;
  const dias = venceDate ? Math.ceil((venceDate.getTime() - ref.getTime()) / 86400000) : null;

  const base = {
    id: client.id,
    ruc: String(client.ruc || '').replace(/\D/g, ''),
    name: client.name || client.tradeName || client.ruc,
    alias: client.taxProfile?.alias,
    frecuencia: ivaFrecuencia,
    vence,
    dias,
    vencido: false,
    clave,
    cliente: client
  };

  if (client.isDeleted) {
    return { ...base, bucket: 'excluido', motivo: 'Está en la papelera.' };
  }
  if (client.isActive === false) {
    return { ...base, bucket: 'excluido', motivo: 'Cliente inactivo: no entra al bucle.' };
  }
  if (client.clientType === 'solo_plan' || client.requiresDeclarations === false) {
    return { ...base, bucket: 'no_aplica', motivo: 'Sólo tiene plan de facturación, no declaraciones.' };
  }
  if (ivaFrecuencia !== 'Mensual') {
    return {
      ...base,
      bucket: 'no_aplica',
      motivo: ivaFrecuencia === 'Popular'
        ? 'RIMPE Negocio Popular: no presenta IVA mensual.'
        : `Declara IVA ${ivaFrecuencia.toLowerCase()}: este mes duerme.`
    };
  }
  if (isPeriodBeforeClientStart(client, periodo)) {
    const inicio = (client as any).clientStartPeriod
      || (client.taxProfile as any)?.clientStartPeriod
      || '';
    return {
      ...base,
      bucket: 'no_aplica',
      motivo: inicio ? `Empieza a declarar en ${inicio}.` : 'Aún no le toca declarar este período.'
    };
  }

  const delPeriodo = declaracionesDelPeriodo(client, periodo);
  const conComprobante = delPeriodo.find((d) => tieneComprobante(d));
  const enviada = delPeriodo.find((d) => ESTADOS_ENVIADA.includes(String(d.status || '')));

  if (conComprobante || enviada) {
    const d = conComprobante || enviada;
    return {
      ...base,
      bucket: 'declarado',
      motivo: conComprobante ? 'Comprobante oficial del SRI guardado.' : 'Declaración registrada como enviada.',
      declaracion: d
    };
  }

  const esperaPago = delPeriodo.find((d) => {
    const st = String(d.status || '').toLowerCase();
    const total = Number((d.proof_file?.metadata as any)?.totalPagar || 0);
    return st === 'por_pagar' || st === 'por pagar' || ((st === 'pendiente') && total > 0);
  });
  if (esperaPago) {
    const monto = Number((esperaPago.proof_file?.metadata as any)?.totalPagar || 0);
    return {
      ...base,
      bucket: 'por_pagar',
      motivo: monto > 0
        ? `Borrador guardado: el SRI pide $${monto.toFixed(2)} y hay que revisarlo a mano.`
        : 'Borrador guardado con saldo a pagar: revisión manual.',
      declaracion: esperaPago,
      porPagar: monto
    };
  }

  const vencido = !!(dias !== null && dias < 0);

  if (!String(client.sriPassword || '').trim()) {
    return { ...base, bucket: 'sin_clave', motivo: 'No hay clave SRI guardada: no se puede entrar.', vencido };
  }
  const estadoCred = client.taxProfile?.sriCredencial?.estado;
  if (estadoCred && estadoCred !== 'ok') {
    return { ...base, bucket: 'credencial_mala', motivo: clave.tooltip || 'La clave no sirve para entrar.', vencido };
  }

  return {
    ...base,
    bucket: 'listo',
    motivo: vencido ? 'Pendiente y ya pasó la fecha límite.' : 'Listo para declarar en el bucle.',
    vencido
  };
}

/** Clasifica toda la cartera y deja el resumen listo para pintar. */
export function clasificarCartera(clients: Client[], periodo: string, ref: Date = new Date()): LoopResumen {
  const items = (clients || []).map((c) => clasificarCliente(c, periodo, ref));
  const por = (b: LoopBucket) => items.filter((i) => i.bucket === b);

  const listos = por('listo');
  const declarados = por('declarado');
  const porPagar = por('por_pagar');
  const sujetos = listos.length + declarados.length + porPagar.length;
  const resueltos = declarados.length + porPagar.length;

  return {
    periodo,
    total: items.length,
    listos,
    declarados,
    porPagar,
    noAplica: por('no_aplica'),
    sinClave: por('sin_clave'),
    credencialMala: por('credencial_mala'),
    excluidos: por('excluido'),
    sujetos,
    avance: sujetos === 0 ? 100 : Math.round((resueltos / sujetos) * 100),
    vencidos: listos.filter((i) => i.vencido).length
  };
}

/** Los clientes que de verdad van a la cola del bucle, más urgentes primero. */
export function colaParaDeclarar(resumen: LoopResumen): Client[] {
  return [...resumen.listos]
    .sort((a, b) => {
      const da = a.dias === null ? 9999 : a.dias;
      const db = b.dias === null ? 9999 : b.dias;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    })
    .map((i) => i.cliente);
}

// ── Medición de tiempos (lo que el usuario pidió: cuánto dura el bucle) ──────

export interface LoopClientRun {
  ruc: string;
  nombre: string;
  ms: number;
  resultado: 'declarado' | 'por_pagar' | 'omitido' | 'error' | 'sin_dato';
  nota?: string;
}

export interface LoopRun {
  id: string;
  periodo: string;
  inicio: number;
  fin: number;
  duracionMs: number;
  total: number;
  declarados: number;
  porPagar: number;
  fallidos: number;
  clientes: LoopClientRun[];
}

const RUNS_KEY = 'sc_loop_corridas';
const RUNS_MAX = 25;

function leerJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function escribirJson(key: string, valor: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    /* sin almacén: se pierde el histórico, no la corrida */
  }
}

export function leerCorridas(): LoopRun[] {
  const lista = leerJson<LoopRun[]>(RUNS_KEY, []);
  return Array.isArray(lista) ? lista.filter((r) => r && typeof r.duracionMs === 'number') : [];
}

export function guardarCorrida(corrida: LoopRun): LoopRun[] {
  const lista = [corrida, ...leerCorridas().filter((r) => r.id !== corrida.id)].slice(0, RUNS_MAX);
  escribirJson(RUNS_KEY, lista);
  return lista;
}

export function borrarHistorialCorridas(): void {
  try { localStorage.removeItem(RUNS_KEY); } catch { /* nada que borrar */ }
}

/** Promedio real de milisegundos por cliente, mirando las corridas guardadas. */
export function promedioPorClienteMs(corridas: LoopRun[] = leerCorridas()): number {
  let ms = 0;
  let clientes = 0;
  for (const c of corridas) {
    if (!c.clientes || c.clientes.length === 0) continue;
    ms += c.duracionMs;
    clientes += c.clientes.length;
  }
  return clientes === 0 ? 0 : Math.round(ms / clientes);
}

/** Minutos estimados para los clientes que quedan, al ritmo histórico. */
export function estimarMsRestantes(cuantos: number, corridas: LoopRun[] = leerCorridas()): number {
  const promedio = promedioPorClienteMs(corridas);
  return cuantos > 0 && promedio > 0 ? cuantos * promedio : 0;
}

/** "12m 31s" / "1h 04m" / "48s" — formato corto para pantalla y consola. */
export function formatearDuracion(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${dos(m)}m`;
  if (m > 0) return `${m}m ${dos(s)}s`;
  return `${s}s`;
}

// ── Señal de la extensión ────────────────────────────────────────────────────

export interface PulsoRpa {
  t: number;
  evento: string;
  detalle?: string;
  cliente?: string;
  ruc?: string;
  indice?: number;
  total?: number;
  paso?: string;
  periodo?: string;
  estado?: string;
  fase?: string;
}

export type ExtensionEstado = 'en_linea' | 'inactiva' | 'sin_senal';

/**
 * ¿Está viva la extensión? Se mide por la antigüedad del último pulso
 * (`sc_ultimo_pulso_rpa`, que el bridge escribe en cada hito).
 */
export function estadoExtension(pulso: PulsoRpa | null, ref: number = Date.now()): ExtensionEstado {
  if (!pulso || !pulso.t) return 'sin_senal';
  const edad = ref - pulso.t;
  if (edad < 90_000) return 'en_linea';
  if (edad < 15 * 60_000) return 'inactiva';
  return 'sin_senal';
}

/** Lo último que se sabe del bucle, tal como quedó escrito en el almacén. */
export function leerUltimoPulso(): PulsoRpa | null {
  const p = leerJson<PulsoRpa | null>('sc_ultimo_pulso_rpa', null);
  return p && typeof p.t === 'number' ? p : null;
}

/**
 * Sugerencia de portada: sólo cuando hay algo real que sugerir.
 * Devuelve null cuando no hay nada pendiente — no queremos un cartel fijo
 * ocupando la pantalla todos los días.
 */
export function sugerenciaDelMes(resumen: LoopResumen, ref: Date = new Date()): string | null {
  if (resumen.listos.length === 0) return null;
  const n = resumen.listos.length;
  if (esInicioDeMes(ref)) {
    return `Arrancó el mes: ${n} cliente${n === 1 ? '' : 's'} por declarar ${periodoLegible(resumen.periodo)}. Es el momento del bucle mensual.`;
  }
  if (resumen.vencidos > 0) {
    return `${resumen.vencidos} cliente${resumen.vencidos === 1 ? '' : 's'} ya pasaron la fecha límite de ${periodoLegible(resumen.periodo)}. Conviene correr el bucle hoy.`;
  }
  return `${n} cliente${n === 1 ? '' : 's'} siguen sin declarar ${periodoLegible(resumen.periodo)}.`;
}
