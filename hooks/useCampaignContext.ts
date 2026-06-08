
import { useMemo } from 'react';
import { format, differenceInDays, addMonths, setDate } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export type CampaignPhase =
  | 'mensual_activa'       // Días 10-28 del mes: trabajo mensual SRI
  | 'mensual_preparacion'  // Días 1-9: preparar documentos, modo tranquilo
  | 'semestral_s1'         // Julio 10 - Agosto 28: declarar S1 del año actual (IVA ene-jun)
  | 'semestral_s2'         // Enero 10 - Febrero 28: declarar S2 del año anterior (IVA jul-dic)
  | 'renta_activa'         // Marzo 1 - Junio 30: declaraciones de Renta Anual
  | 'quieto';              // Sin vencimientos activos

export interface CampaignContext {
  phase: CampaignPhase;
  label: string;            // Ej: "IVA Mensual · Mayo 2026"
  sublabel: string;         // Ej: "Período declarado: Mayo 2026"
  urgency: 'critical' | 'high' | 'medium' | 'low';
  color: string;            // Tailwind color base
  gradient: string;         // Tailwind gradient classes
  borderColor: string;
  badgeColor: string;
  icon: string;             // Emoji icon
  daysRemaining: number | null;   // días hasta que cierra la campaña
  daysUntilOpen: number | null;   // días hasta que abre la próxima campaña
  campaignDeadline: Date | null;  // fecha límite de cierre
  nextCampaignLabel: string;      // Ej: "Semestral S2 abre en enero"

  // Flags de visibilidad para componentes
  showMensualTab: boolean;
  showSemestralTab: boolean;
  showRentaTab: boolean;
  isSemestralMonth: boolean;    // true si estamos en julio o enero
  isRentaMonth: boolean;        // true si estamos en mar-jun

  // Ordenamiento sugerido del día
  todaySriDigit: number | null;   // dígito del RUC que vence HOY
  tomorrowSriDigit: number | null; // dígito del RUC que vence MAÑANA
  sri9thDigitSchedule: Record<number, number>; // día → dígito 9no del RUC

  // Período activo de trabajo
  activePeriodLabel: string;  // Ej: "Mayo 2026" o "S1 2026"
}

// Tabla oficial SRI Ecuador: día del mes → dígito 9no del RUC que vence
const SRI_SCHEDULE: Record<number, number> = {
  10: 1,
  12: 2,
  14: 3,
  16: 4,
  18: 5,
  20: 6,
  22: 7,
  24: 8,
  26: 9,
  28: 0,
};

// Tabla inversa: dígito → día de vencimiento
const DIGIT_TO_DAY: Record<number, number> = {
  1: 10,
  2: 12,
  3: 14,
  4: 16,
  5: 18,
  6: 20,
  7: 22,
  8: 24,
  9: 26,
  0: 28,
};

/**
 * Calcula el dígito del RUC que vence en un día específico del mes.
 * Devuelve null si ese día no hay vencimiento SRI.
 */
function getDigitForDay(day: number): number | null {
  // Buscar el día exacto o el siguiente día de vencimiento
  const entry = SRI_SCHEDULE[day];
  return entry !== undefined ? entry : null;
}

/**
 * Encuentra el próximo día de vencimiento SRI a partir de hoy
 */
function getNextSriDueDay(fromDay: number): { day: number; digit: number } | null {
  const sortedDays = Object.keys(SRI_SCHEDULE).map(Number).sort((a, b) => a - b);
  for (const day of sortedDays) {
    if (day >= fromDay) return { day, digit: SRI_SCHEDULE[day] };
  }
  return null; // Fin de mes, siguiente mes empieza de nuevo
}

/**
 * Hook principal que calcula el contexto de campaña fiscal actual.
 * Se recalcula automáticamente basado en la fecha del sistema.
 */
export function useCampaignContext(overrideDate?: Date): CampaignContext {
  return useMemo(() => {
    const today = overrideDate ?? new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // 1-12
    const year = today.getFullYear();

    // ── DÍGITO SRI DEL DÍA ──────────────────────────────────────────────────
    const todaySriDigit = getDigitForDay(day);
    const tomorrowSriDigit = getDigitForDay(day + 1);

    // ── DETECCIÓN DE FASE ────────────────────────────────────────────────────

    // Semestral S1 → se declara en JULIO y AGOSTO
    // El período S1 cubre enero-junio del año en curso
    if ((month === 7 && day >= 10) || month === 8) {
      const deadline = new Date(year, 7, 28); // 28 de agosto
      const daysRemaining = differenceInDays(deadline, today);
      const periodLabel = `S1 ${year}`;
      return {
        phase: 'semestral_s1',
        label: `Semestral S1 · ${year}`,
        sublabel: `Período: Enero – Junio ${year}`,
        urgency: daysRemaining <= 7 ? 'critical' : daysRemaining <= 15 ? 'high' : 'medium',
        color: 'blue',
        gradient: 'from-blue-500 to-indigo-600',
        borderColor: 'border-blue-500/30',
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: '📅',
        daysRemaining,
        daysUntilOpen: null,
        campaignDeadline: deadline,
        nextCampaignLabel: `Renta Anual ${year + 1} abre en Marzo`,
        showMensualTab: true,
        showSemestralTab: true,
        showRentaTab: false,
        isSemestralMonth: true,
        isRentaMonth: false,
        todaySriDigit,
        tomorrowSriDigit,
        sri9thDigitSchedule: SRI_SCHEDULE,
        activePeriodLabel: periodLabel,
      };
    }

    // Semestral S2 → se declara en ENERO y FEBRERO
    // El período S2 cubre julio-diciembre del año anterior
    if ((month === 1 && day >= 10) || month === 2) {
      const deadline = new Date(year, 1, 28); // 28 de febrero
      const daysRemaining = differenceInDays(deadline, today);
      const periodLabel = `S2 ${year - 1}`;
      return {
        phase: 'semestral_s2',
        label: `Semestral S2 · ${year - 1}`,
        sublabel: `Período: Julio – Diciembre ${year - 1}`,
        urgency: daysRemaining <= 7 ? 'critical' : daysRemaining <= 15 ? 'high' : 'medium',
        color: 'indigo',
        gradient: 'from-indigo-500 to-violet-600',
        borderColor: 'border-indigo-500/30',
        badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        icon: '📅',
        daysRemaining,
        daysUntilOpen: null,
        campaignDeadline: deadline,
        nextCampaignLabel: `Renta Anual ${year - 1} abre en Marzo`,
        showMensualTab: true,
        showSemestralTab: true,
        showRentaTab: false,
        isSemestralMonth: true,
        isRentaMonth: false,
        todaySriDigit,
        tomorrowSriDigit,
        sri9thDigitSchedule: SRI_SCHEDULE,
        activePeriodLabel: periodLabel,
      };
    }

    // Renta Anual → Marzo a Junio
    if (month >= 3 && month <= 6) {
      const deadline = new Date(year, 5, 30); // 30 de junio
      const daysRemaining = differenceInDays(deadline, today);
      const rentaYear = year - 1;

      // ¿También es mensual? (días 10-28)
      const isMensualActive = day >= 10 && day <= 28;
      const prevMonthName = format(
        new Date(year, month - 2, 1),
        'MMMM yyyy',
        { locale: es }
      );

      return {
        phase: 'renta_activa',
        label: `Renta Anual ${rentaYear}${isMensualActive ? ` · IVA Mensual` : ''}`,
        sublabel: isMensualActive
          ? `Dos frentes activos: IVA ${prevMonthName} + Renta ${rentaYear}`
          : `Período fiscal: Año ${rentaYear}`,
        urgency: daysRemaining <= 30 ? 'high' : 'medium',
        color: 'emerald',
        gradient: 'from-emerald-500 to-teal-600',
        borderColor: 'border-emerald-500/30',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: '🛡️',
        daysRemaining,
        daysUntilOpen: null,
        campaignDeadline: deadline,
        nextCampaignLabel: `Semestral S1 ${year} abre en Julio`,
        showMensualTab: true,
        showSemestralTab: false,
        showRentaTab: true,
        isSemestralMonth: false,
        isRentaMonth: true,
        todaySriDigit,
        tomorrowSriDigit,
        sri9thDigitSchedule: SRI_SCHEDULE,
        activePeriodLabel: `Año ${rentaYear}`,
      };
    }

    // Mensual activa → días 10-28 (meses que no son semestral ni renta)
    if (day >= 10 && day <= 28) {
      // El período que se declara es el mes anterior
      const prevMonth = new Date(year, month - 2, 1);
      const prevMonthName = format(prevMonth, 'MMMM yyyy', { locale: es });
      const prevMonthKey = format(prevMonth, 'yyyy-MM');

      // Calcular fecha límite (día 28 del mes actual)
      const deadline = new Date(year, month - 1, 28);
      const daysRemaining = differenceInDays(deadline, today);

      // ¿Qué dígito es urgente hoy?
      const urgencyLevel =
        todaySriDigit !== null
          ? 'critical'
          : daysRemaining <= 3
          ? 'high'
          : 'medium';

      return {
        phase: 'mensual_activa',
        label: `IVA Mensual · ${format(prevMonth, 'MMMM', { locale: es }).toUpperCase()} ${year}`,
        sublabel: `Declarando período: ${prevMonthName}`,
        urgency: urgencyLevel,
        color: 'violet',
        gradient: 'from-violet-500 to-purple-600',
        borderColor: 'border-violet-500/30',
        badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
        icon: '⚡',
        daysRemaining,
        daysUntilOpen: null,
        campaignDeadline: deadline,
        nextCampaignLabel: nextCampaignHint(month, year),
        showMensualTab: true,
        showSemestralTab: false,
        showRentaTab: false,
        isSemestralMonth: false,
        isRentaMonth: false,
        todaySriDigit,
        tomorrowSriDigit,
        sri9thDigitSchedule: SRI_SCHEDULE,
        activePeriodLabel: prevMonthKey,
      };
    }

    // Fase quieta → días 1-9 del mes (modo preparación)
    const nextSriDay = getNextSriDueDay(day);
    const daysUntilOpen = nextSriDay ? nextSriDay.day - day : null;
    const prevMonth = new Date(year, month - 2, 1);
    const prevMonthName = format(prevMonth, 'MMMM yyyy', { locale: es });

    return {
      phase: 'mensual_preparacion',
      label: `Preparación · Campaña ${format(prevMonth, 'MMMM', { locale: es }).toUpperCase()}`,
      sublabel: `El día 10 inicia la campaña SRI de ${prevMonthName}`,
      urgency: 'low',
      color: 'slate',
      gradient: 'from-slate-500 to-slate-600',
      borderColor: 'border-slate-500/20',
      badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      icon: '🗓️',
      daysRemaining: null,
      daysUntilOpen,
      campaignDeadline: null,
      nextCampaignLabel: `Campaña abre el día 10 · Dígito 1 primero`,
      showMensualTab: true,   // Mostrar mensual igual para preparación
      showSemestralTab: false,
      showRentaTab: false,
      isSemestralMonth: false,
      isRentaMonth: false,
      todaySriDigit: null,
      tomorrowSriDigit: null,
      sri9thDigitSchedule: SRI_SCHEDULE,
      activePeriodLabel: format(prevMonth, 'yyyy-MM'),
    };
  }, [overrideDate]);
}

/**
 * Sugiere cuál será la siguiente campaña importante
 */
function nextCampaignHint(currentMonth: number, year: number): string {
  if (currentMonth === 6) return `Semestral S1 ${year} abre en Julio`;
  if (currentMonth === 12) return `Semestral S2 ${year} abre en Enero ${year + 1}`;
  if (currentMonth === 2) return `Renta Anual ${year - 1} abre en Marzo`;
  return `Próxima campaña mensual: ${format(new Date(year, currentMonth, 1), 'MMMM', { locale: es })}`;
}

/**
 * Utilidad: Dado el dígito 9no del RUC, retorna el día de vencimiento SRI
 */
export function getDueDayForDigit(digit: number): number {
  return DIGIT_TO_DAY[digit] ?? 28;
}

/**
 * Utilidad: Retorna el dígito que vence en un día específico (o null si no hay)
 */
export function getDigitDueOnDay(day: number): number | null {
  return SRI_SCHEDULE[day] !== undefined ? SRI_SCHEDULE[day] : null;
}
