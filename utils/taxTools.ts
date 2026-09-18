import type { ServiceFeesConfig } from '../types/service';

/**
 * Herramientas fiscales compartidas, extraídas de `screens/LandingPage.tsx`
 * (simulador de régimen/impuesto, calculadora de multas por atraso y
 * calendario de vencimiento por dígito de RUC) para que otras pantallas
 * — como `screens/LandingLujoPage.tsx` — puedan ofrecer las mismas
 * herramientas sin reimplementar ni desincronizar las reglas tributarias.
 *
 * IMPORTANTE: la matemática aquí debe permanecer idéntica a la de
 * `screens/LandingPage.tsx` (que se deja intacta como página "clásica" en
 * `/clasica`). Si las reglas del SRI cambian, actualiza ambos lugares o,
 * mejor, migra `LandingPage.tsx` a importar de aquí en una pasada aparte.
 */

export type ActividadTipo = 'comercial' | 'profesional' | 'discapacidad_3ra_edad';

export interface TaxDetails {
    regimen: string;
    planTitle: string;
    price: number;
    impuestoEstimadoAnual: number;
    ahorroEstimado: number;
    formularios: string;
    description: string;
}

/** Subconjunto de ServiceFeesConfig que necesita el simulador (todas opcionales, con fallback). */
export type ServiceFeesLike = Partial<Pick<ServiceFeesConfig, 'rentaNP' | 'ivaSemestral' | 'ivaMensual' | 'devolucionIva'>> | null | undefined;

/**
 * Simulación del régimen/impuesto estimado según ingresos anuales y tipo de
 * actividad (RIMPE Negocio Popular / Emprendedor, Régimen General para
 * profesionales o corporativo, y Devolución de IVA para grupos prioritarios).
 * Misma tabla usada por `screens/LandingPage.tsx`'s `calculateDetailedTax`.
 */
export const calculateDetailedTax = (ingresos: number, actividad: ActividadTipo, serviceFees?: ServiceFeesLike): TaxDetails => {
    const npPrice = serviceFees?.rentaNP || 50;
    const semPrice = serviceFees?.ivaSemestral || 80;
    const menPrice = (serviceFees?.ivaMensual || 20) * 5;
    const devPrice = serviceFees?.devolucionIva || 30;

    if (actividad === 'discapacidad_3ra_edad') {
        return {
            regimen: "Grupos Prioritarios (SRI)",
            planTitle: "Devolución IVA Tercera Edad",
            price: devPrice,
            impuestoEstimadoAnual: 0,
            ahorroEstimado: 1200,
            formularios: "Solicitud Digital de Devolución Mensual SRI",
            description: "Trámite 100% digital de recuperación mensual del IVA para Tercera Edad y Discapacidad. Acreditación bancaria directa con cero trámite presencial."
        };
    }

    if (actividad === 'profesional') {
        const gastoDeducibleEst = ingresos * 0.4;
        const baseImponible = Math.max(0, ingresos - gastoDeducibleEst);
        const impuestoEstimado = baseImponible > 11902 ? (baseImponible - 11902) * 0.10 : 0;
        return {
            regimen: "Régimen General (Servicios Profesionales)",
            planTitle: "Profesionales Autónomos",
            price: menPrice,
            impuestoEstimadoAnual: Math.round(impuestoEstimado),
            ahorroEstimado: Math.round(impuestoEstimado * 0.45),
            formularios: "Formulario 104 Mensual + Formulario 102 Renta Anual",
            description: "Gestión contable mensual completa para profesionales independientes, médicos, ingenieros y consultores. Asesoría fiscal para deducción máxima y devolución de retenciones."
        };
    }

    // RIMPE Scale
    if (ingresos <= 20000) {
        return {
            regimen: "RIMPE - Negocio Popular",
            planTitle: "RIMPE Negocio Popular",
            price: npPrice,
            impuestoEstimadoAnual: 60,
            ahorroEstimado: 350,
            formularios: "Formulario 102A Simplificado Anual (Notas de venta autorizadas)",
            description: "Declaración anual obligatoria simplificada para microempresarios, tiendas, talleres y comercios con facturación de hasta $20,000 USD al año."
        };
    } else if (ingresos <= 300000) {
        let impuestoEstimado = 60;
        if (ingresos > 20000 && ingresos <= 50000) {
            impuestoEstimado = 60 + (ingresos - 20000) * 0.01;
        } else if (ingresos <= 100000) {
            impuestoEstimado = 360 + (ingresos - 50000) * 0.0125;
        } else if (ingresos <= 200000) {
            impuestoEstimado = 985 + (ingresos - 100000) * 0.015;
        } else {
            impuestoEstimado = 2485 + (ingresos - 200000) * 0.02;
        }

        return {
            regimen: "RIMPE - Emprendedor",
            planTitle: "RIMPE Emprendedor",
            price: semPrice,
            impuestoEstimadoAnual: Math.round(impuestoEstimado),
            ahorroEstimado: Math.round(impuestoEstimado * 0.35 + 450),
            formularios: "Formulario 104 Semestral de IVA + Formulario 102A Renta",
            description: "Declaraciones semestrales de IVA y declaración anual de Renta para empresas y comercios con ingresos entre $20,001 y $300,000 USD."
        };
    } else {
        const baseEst = ingresos * 0.25;
        const impuestoEstimado = baseEst * 0.25;
        return {
            regimen: "Régimen General (Corporativo)",
            planTitle: "Consultoría Corporativa Pro",
            price: 150,
            impuestoEstimadoAnual: Math.round(impuestoEstimado),
            ahorroEstimado: Math.round(impuestoEstimado * 0.28),
            formularios: "Formulario 104 Mensual + Retenciones + Estados Financieros Anuales",
            description: "Planificación fiscal corporativa integral, auditoría preventiva de balance y blindaje ante auditorías del SRI para empresas consolidadas."
        };
    }
};

export type PenaltyType = 'sin_ventas' | 'con_ventas';

export interface PenaltyResult {
    totalRiesgo: number;
    multaBase: number;
    interes: number;
    ahorroConNosotros: number;
}

/**
 * Estimación de riesgo por declaraciones atrasadas (multa base del SRI +
 * interés estimado sobre ventas cuando aplica). Misma tabla usada por
 * `screens/LandingPage.tsx`'s `calculatePenaltyRisk`.
 */
export const calculatePenaltyRisk = (meses: number, tipo: PenaltyType, ventas: number): PenaltyResult => {
    const multaPorMes = tipo === 'sin_ventas' ? 30 : 45;
    const totalMultaBase = meses * multaPorMes;
    const interesEstimado = tipo === 'con_ventas' ? (ventas * 0.15 * 0.012 * meses) : 0;
    const totalRiesgo = Math.round(totalMultaBase + interesEstimado);
    return {
        totalRiesgo,
        multaBase: totalMultaBase,
        interes: Math.round(interesEstimado),
        ahorroConNosotros: Math.round(totalRiesgo * 0.6)
    };
};

export interface RucDeadlineInfo {
    day: number;
    label: string;
    daysLeft: number;
    isImminent: boolean;
}

/**
 * Calendario de vencimiento mensual según el 9no dígito del RUC/cédula
 * (0 -> día 28, 1 -> día 10, ... 9 -> día 26), con días restantes hasta el
 * próximo vencimiento. Misma tabla usada por `screens/LandingPage.tsx`'s
 * `getRucDeadlineInfo`.
 */
export const getRucDeadlineInfo = (digit: number): RucDeadlineInfo => {
    const days = [28, 10, 12, 14, 16, 18, 20, 22, 24, 26];
    const day = days[digit] ?? 10;

    const now = new Date();
    const currentMonthDay = now.getDate();
    let daysLeft = day - currentMonthDay;
    if (daysLeft < 0) {
        daysLeft += 30; // Next cycle
    }
    const isImminent = daysLeft <= 3;

    return {
        day,
        label: `Día ${day} de cada mes`,
        daysLeft,
        isImminent
    };
};
