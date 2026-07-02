import { Client, Declaration, DeclarationStatus, TaxRegime, TaxObligationType, InternalStatus } from '../types';
import { getPeriod, getDueDateForPeriod, getNinthDigit, getDaysUntilDue, requiresIva } from './sri';
import { SRI_DUE_DATES } from '../constants';
import { subMonths, format, getYear, getMonth } from 'date-fns';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type ComplianceColor = 'green' | 'yellow' | 'orange' | 'red' | 'gray';
export type TaxFrequency = 'Mensual' | 'Semestral' | 'Anual' | 'all';

export interface ObligationStatus {
    type: TaxObligationType;
    period: string;
    label: string;
    color: ComplianceColor;
    daysRemaining: number | null;
    dueDate: Date | null;
    declaration: Declaration | null;
    isDeclared: boolean;
    isPaid: boolean;
}

export interface ClientCompliance {
    overallColor: ComplianceColor;
    score: number;
    obligations: ObligationStatus[];
    urgentCount: number;
    overdueCount: number;
    syncHealth: 'healthy' | 'warning' | 'critical';
}

export interface ComplianceSummary {
    green: number;
    yellow: number;
    orange: number;
    red: number;
    gray: number;
    total: number;
    averageScore: number;
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

const isDeclared = (decl: Declaration | undefined): boolean => {
    if (!decl) return false;
    return !!decl.proof_file ||
        decl.status === DeclarationStatus.Enviada ||
        decl.status === DeclarationStatus.Pagada;
};

const isPaid = (decl: Declaration | undefined): boolean => {
    if (!decl) return false;
    return decl.status === DeclarationStatus.Pagada || !!decl.is_paid;
};

const getColor = (daysRemaining: number | null, declared: boolean, paid: boolean, internalStatus?: InternalStatus): ComplianceColor => {
    if (declared && paid) return 'green';
    if (declared && !paid) return 'yellow';
    
    // Digital-First logic: If synced and ready, but not sent, and close to deadline
    if (!declared && internalStatus === InternalStatus.ReadyToDeclare) return 'orange';
    if (!declared && internalStatus === InternalStatus.InValidation) return 'yellow';
    if (!declared && internalStatus === InternalStatus.WaitingSync && daysRemaining !== null && daysRemaining <= 3) return 'orange';

    if (daysRemaining === null) return 'gray';
    if (daysRemaining < 0) return 'red';
    if (daysRemaining === 0) return 'orange';
    if (daysRemaining <= 5) return 'yellow';
    return 'gray';
};

// ─────────────────────────────────────────────────────────
// CORE: Get all obligations for a client at a given date
// ─────────────────────────────────────────────────────────

export const getClientObligations = (client: Client, date: Date, frequency: 'Mensual' | 'Semestral' | 'Anual' | 'all' = 'all'): ObligationStatus[] => {

    if (client.isDeleted || !client.isActive) return [];

    const obligations: ObligationStatus[] = [];
    const declarations = client.declarations || [];
    const currentYear = getYear(date);
    const rentaPeriod = (currentYear - 1).toString();

    // 1. IVA (Mensual / Semestral)
    const clientIvaFreq = client.taxProfile?.ivaFrequency || (client.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : (client.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'));
    const shouldIncludeIva = (frequency === 'all') || 
                            (frequency === 'Mensual' && clientIvaFreq === 'Mensual') ||
                            (frequency === 'Semestral' && clientIvaFreq === 'Semestral');

    if (requiresIva(client) && shouldIncludeIva) {
        const ivaPeriod = getPeriod(client, date);
        const ivaDecl = declarations.find(d => d.period === ivaPeriod);
        const ivaDue = getDueDateForPeriod(client, ivaPeriod);
        const ivaDays = ivaDue ? getDaysUntilDue(ivaDue) : null;
        const ivaDeclared = isDeclared(ivaDecl);
        const ivaPaids = isPaid(ivaDecl);

        obligations.push({
            type: 'IVA',
            period: ivaPeriod,
            label: clientIvaFreq === 'Semestral' ? `IVA Semestral` : `IVA Mensual`,
            color: getColor(ivaDays, ivaDeclared, ivaPaids, ivaDecl?.internalStatus),
            daysRemaining: ivaDays,
            dueDate: ivaDue,
            declaration: ivaDecl || null,
            isDeclared: ivaDeclared,
            isPaid: ivaPaids,
        });
    }


    // 2. Renta Anual
    const shouldIncludeRenta = (frequency === 'all' || frequency === 'Anual');
    const needsRenta = client.taxProfile?.requiresAnnualRenta ??
        (client.regime === TaxRegime.RimpeEmprendedor ||
            client.regime === TaxRegime.RimpeNegocioPopular ||
            client.regime === TaxRegime.General);

    if (needsRenta && shouldIncludeRenta) {

        const rentaDecl = declarations.find(d => d.period === rentaPeriod);
        const rentaDue = getDueDateForPeriod(client, rentaPeriod);
        const rentaDays = rentaDue ? getDaysUntilDue(rentaDue) : null;
        const rentaDeclared = isDeclared(rentaDecl);
        const rentaPaidStatus = isPaid(rentaDecl);

        // Solo mostrar si estamos en temporada (después de enero) o si está vencida
        const month = getMonth(date);
        if (month >= 0) { // Mostrar siempre — si no aplica el motor lo grays out
            obligations.push({
                type: 'RENTA',
                period: rentaPeriod,
                label: 'Renta Anual',
                color: getColor(rentaDays, rentaDeclared, rentaPaidStatus, rentaDecl?.internalStatus),
                daysRemaining: rentaDays,
                dueDate: rentaDue,
                declaration: rentaDecl || null,
                isDeclared: rentaDeclared,
                isPaid: rentaPaidStatus,
            });
        }
    }

    // 3. ICE Mensual (clientes como Chávez Cordova)
    if (client.taxProfile?.requiresIce && (frequency === 'all' || frequency === 'Mensual')) {

        const icePeriod = getPeriod({ ...client, taxProfile: { ...client.taxProfile!, ivaFrequency: 'Mensual' } }, date);
        const iceFullPeriod = `${icePeriod}:ICE`;
        const iceDecl = declarations.find(d => d.period === iceFullPeriod || d.period === `${icePeriod}-ICE`);
        const iceDue = getDueDateForPeriod(client, icePeriod);
        const iceDays = iceDue ? getDaysUntilDue(iceDue) : null;
        const iceDeclared = isDeclared(iceDecl);
        const icePaidStatus = isPaid(iceDecl);

        obligations.push({
            type: 'ICE',
            period: icePeriod,
            label: 'ICE Mensual',
            color: getColor(iceDays, iceDeclared, icePaidStatus, iceDecl?.internalStatus),
            daysRemaining: iceDays,
            dueDate: iceDue,
            declaration: iceDecl || null,
            isDeclared: iceDeclared,
            isPaid: icePaidStatus,
        });

        // ICE Anexo (same period)
        const iceAnexoPeriod = `${icePeriod}:ANEXO_ICE`;
        const iceAnexoDecl = declarations.find(d => d.period === iceAnexoPeriod);
        obligations.push({
            type: 'ANEXO',
            period: icePeriod,
            label: 'Anexo ICE',
            color: getColor(iceDays, isDeclared(iceAnexoDecl), isPaid(iceAnexoDecl)),
            daysRemaining: iceDays,
            dueDate: iceDue,
            declaration: iceAnexoDecl || null,
            isDeclared: isDeclared(iceAnexoDecl),
            isPaid: isPaid(iceAnexoDecl),
        });
    }

    // 4. Anexo PVP Anual
    if (client.taxProfile?.requiresAnexoPvp && (frequency === 'all' || frequency === 'Anual')) {

        const pvpPeriod = `${currentYear - 1}:PVP`;
        const pvpDecl = declarations.find(d => d.period === pvpPeriod);
        const pvpDue = new Date(currentYear, 0, 5); // 5 de enero
        const pvpDays = getDaysUntilDue(pvpDue);
        obligations.push({
            type: 'PVP',
            period: pvpPeriod,
            label: 'Anexo PVP',
            color: getColor(pvpDays, isDeclared(pvpDecl), isPaid(pvpDecl)),
            daysRemaining: pvpDays,
            dueDate: pvpDue,
            declaration: pvpDecl || null,
            isDeclared: isDeclared(pvpDecl),
            isPaid: isPaid(pvpDecl),
        });
    }

    // 5. Devolución de IVA
    if (client.taxProfile?.hasActiveDevolucionIva && (frequency === 'all' || frequency === 'Mensual')) {

        const devPeriod = getPeriod({ ...client, taxProfile: { ...client.taxProfile!, ivaFrequency: 'Mensual' } }, date);
        const devDecl = declarations.find(d => d.period === `${devPeriod}:DEV`);
        const devDue = getDueDateForPeriod(client, devPeriod);
        const devDays = devDue ? getDaysUntilDue(devDue) : null;
        obligations.push({
            type: 'ANEXO',
            period: devPeriod,
            label: 'Dev. IVA',
            color: getColor(devDays, isDeclared(devDecl), isPaid(devDecl)),
            daysRemaining: devDays,
            dueDate: devDue,
            declaration: devDecl || null,
            isDeclared: isDeclared(devDecl),
            isPaid: isPaid(devDecl),
        });
    }

    // 6. Anexo de Gastos Personales
    if (client.taxProfile?.requiresAnexosGastos && (frequency === 'all' || frequency === 'Anual')) {

        const gapPeriod = `${currentYear - 1}:GAP`;
        const gapDecl = declarations.find(d => d.period === gapPeriod);
        const gapDue = new Date(currentYear, 1, 28); // Feb 28
        const gapDays = getDaysUntilDue(gapDue);
        obligations.push({
            type: 'ANEXO',
            period: gapPeriod,
            label: 'Anexo Gastos',
            color: getColor(gapDays, isDeclared(gapDecl), isPaid(gapDecl)),
            daysRemaining: gapDays,
            dueDate: gapDue,
            declaration: gapDecl || null,
            isDeclared: isDeclared(gapDecl),
            isPaid: isPaid(gapDecl),
        });
    }

    // Determine the earliest period this client should have obligations for.
    // clientStartPeriod takes precedence over the global system floor.
    const clientFloor = client.clientStartPeriod || null;
    const globalFloorMonthly = '2026-01';
    const globalFloorSemestral = '2026-S1';
    const globalFloorAnnual = '2026';

    return obligations.filter(ob => {
        if (ob.period.length === 4) {
            const floor = clientFloor?.length === 4 ? clientFloor : globalFloorAnnual;
            return ob.period >= floor;
        }
        if (ob.period.includes('-S')) {
            // For semestral clientStartPeriod like '2026-S2', use it directly
            const floor = clientFloor?.includes('-S') ? clientFloor
                : clientFloor ? clientFloor.substring(0, 4) + '-S1' // fallback to start of year
                : globalFloorSemestral;
            return ob.period >= floor;
        }
        // Monthly
        const floor = (clientFloor && !clientFloor.includes('-S') && clientFloor.length === 7)
            ? clientFloor
            : globalFloorMonthly;
        return ob.period >= floor;
    });
};

/**
 * Returns the expected obligations for a specific period (month or semester)
 * This is used mainly for the Matrix view to know what to display for historical cells.
 */
export const getObligationsForPeriod = (client: Client, period: string): Array<{ type: TaxObligationType, label: string }> => {
    const obligations: Array<{ type: TaxObligationType, label: string }> = [];
    
    // Check if it's a semester period (e.g., 2024-S1)
    const isSemester = period.includes('-S');
    
    // Check if it's a pure year period (RENTA fiscal year, e.g., "2025")
    const isYearPeriod = /^\d{4}$/.test(period);
    
    // RENTA (período anual puro: "2025", "2024", etc.)
    if (isYearPeriod) {
        const needsRenta = client.taxProfile?.requiresAnnualRenta ||
            client.regime === TaxRegime.RimpeEmprendedor ||
            client.regime === TaxRegime.RimpeNegocioPopular ||
            client.regime === TaxRegime.General;
        if (needsRenta) {
            obligations.push({ type: 'RENTA', label: 'Renta Anual' });
        }
        if (client.taxProfile?.requiresAnexosGastos) {
            obligations.push({ type: 'ANEXO', label: 'Anexo Gastos' });
        }
        if (client.taxProfile?.hasActiveDevolucionIva) {
            obligations.push({ type: 'DEVOLUCION', label: 'Dev. IVA' });
        }
        return obligations;
    }
    
    // IVA
    if (requiresIva(client)) {
        const clientFreq = client.taxProfile?.ivaFrequency || (client.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : (client.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'));
        if (isSemester && clientFreq === 'Semestral') {
            obligations.push({ type: 'IVA', label: 'IVA Semestral' });
        } else if (!isSemester && clientFreq === 'Mensual') {
            obligations.push({ type: 'IVA', label: 'IVA Mensual' });
        }
    }
    
    // ICE (Always monthly if required)
    if (!isSemester && client.taxProfile?.requiresIce) {
        obligations.push({ type: 'ICE', label: 'ICE Mensual' });
        obligations.push({ type: 'ANEXO', label: 'Anexo ICE' });
    }
    
    return obligations;
};
// ─────────────────────────────────────────────────────────
// COMPLIANCE STATUS: Full client compliance snapshot
// ─────────────────────────────────────────────────────────

// Memory Cache for Compliance results to speed up large list analysis
const complianceCache = new Map<string, { result: ClientCompliance, timestamp: number, clientHash: string }>();

export const getClientCompliance = (client: Client, date: Date, frequency: 'Mensual' | 'Semestral' | 'Anual' | 'all' = 'all'): ClientCompliance => {
    // Cache Key: clientId + frequency + date string (day level)
    const dateKey = format(date, 'yyyy-MM-dd');
    const cacheKey = `${client.id}-${frequency}-${dateKey}`;
    
    // Simple hash based on declarations length and updatedAt
    const clientHash = `${client.declarations?.length || 0}-${client.updatedAt || ''}-${client.isActive}-${client.regime}`;
    
    const cached = complianceCache.get(cacheKey);
    if (cached && cached.clientHash === clientHash) {
        return cached.result;
    }

    const obligations = getClientObligations(client, date, frequency);


    if (obligations.length === 0) {
        return { overallColor: 'gray', score: 100, obligations, urgentCount: 0, overdueCount: 0, syncHealth: 'healthy' };
    }

    // Calculate overall color: worst obligation wins
    const colorPriority: Record<ComplianceColor, number> = { red: 0, orange: 1, yellow: 2, green: 3, gray: 4 };
    let worstColor: ComplianceColor = 'green';

    let declaredCount = 0;
    let urgentCount = 0;
    let overdueCount = 0;
    let activeObligations = 0;

    for (const ob of obligations) {
        if (ob.color === 'gray' && !ob.isDeclared && ob.daysRemaining !== null && ob.daysRemaining > 5) continue;

        activeObligations++;
        if (ob.isDeclared) declaredCount++;
        if (ob.color === 'red') overdueCount++;
        if (ob.color === 'orange' || ob.color === 'red') urgentCount++;

        if (colorPriority[ob.color] < colorPriority[worstColor]) {
            worstColor = ob.color;
        }
    }

    // Score: porcentaje de obligaciones cumplidas
    const score = activeObligations > 0
        ? Math.round((declaredCount / activeObligations) * 100)
        : 100;

    // Determine sync health based on last sync timestamp (ideally in the last 24h)
    let syncHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    const lastSyncStr = obligations[0]?.declaration?.lastSyncTimestamp;
    if (lastSyncStr) {
        const lastSync = new Date(lastSyncStr);
        const hoursDiff = (Date.now() - lastSync.getTime()) / 36e5;
        if (hoursDiff > 72) syncHealth = 'critical';
        else if (hoursDiff > 24) syncHealth = 'warning';
    }

    const result = {
        overallColor: worstColor,
        score,
        obligations,
        urgentCount,
        overdueCount,
        syncHealth,
    };

    // Store in cache
    complianceCache.set(cacheKey, { result, timestamp: Date.now(), clientHash });

    return result;
};

// ─────────────────────────────────────────────────────────
// PORTFOLIO SUMMARY: Aggregate across all clients
// ─────────────────────────────────────────────────────────

export const getComplianceSummary = (clients: Client[], date: Date, frequency: 'Mensual' | 'Semestral' | 'Anual' | 'all' = 'all'): ComplianceSummary => {

    const summary: ComplianceSummary = {
        green: 0, yellow: 0, orange: 0, red: 0, gray: 0,
        total: 0, averageScore: 0,
    };

    let totalScore = 0;
    let activeClients = 0;

    for (const client of clients) {
        if (client.isDeleted || !client.isActive) continue;
        activeClients++;

        const compliance = getClientCompliance(client, date, frequency);

        summary[compliance.overallColor]++;
        summary.total++;
        totalScore += compliance.score;
    }

    summary.averageScore = activeClients > 0 ? Math.round(totalScore / activeClients) : 0;
    return summary;
};

// ─────────────────────────────────────────────────────────
// HISTORICAL SCORE: Last N months compliance percentage
// ─────────────────────────────────────────────────────────

export const getHistoricalScore = (client: Client, months: number = 6): number[] => {
    const scores: number[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
        const refDate = subMonths(now, i);
        const period = getPeriod(client, refDate);
        
        // Skip periods before 2026
        const isBeforeStart = period.includes('-S') ? period < '2026-S1' : 
                             (period.length === 4 ? period < '2026' : period < '2026-01');
        
        if (isBeforeStart) {
            scores.push(100); // Consider compliant if before system start
            continue;
        }

        const decl = (client.declarations || []).find(d => d.period === period);
        const declared = isDeclared(decl);
        scores.push(declared ? 100 : 0);
    }

    return scores;
};

// ─────────────────────────────────────────────────────────
// DEADLINE HELPERS: For bot & alerts
// ─────────────────────────────────────────────────────────

export const getClientsExpiringInDays = (clients: Client[], days: number, date: Date, frequency?: TaxFrequency): Client[] => {
    return clients.filter(c => {
        if (c.isDeleted || !c.isActive) return false;
        const compliance = getClientCompliance(c, date, frequency);
        return compliance.obligations.some(ob =>
            !ob.isDeclared && ob.daysRemaining !== null && ob.daysRemaining >= 0 && ob.daysRemaining <= days
        );
    });
};

export const getClientsOverdue = (clients: Client[], date: Date, frequency?: TaxFrequency): Client[] => {
    return clients.filter(c => {
        if (c.isDeleted || !c.isActive) return false;
        const compliance = getClientCompliance(c, date, frequency);
        return compliance.overdueCount > 0;
    });
};

// ─────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────

export const COMPLIANCE_COLORS: Record<ComplianceColor, { bg: string; text: string; border: string; dot: string; label: string }> = {
    green: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/10',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/30',
        dot: 'bg-emerald-500',
        label: 'Al Día',
    },
    yellow: {
        bg: 'bg-amber-50 dark:bg-amber-900/10',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/30',
        dot: 'bg-amber-400',
        label: 'Próximo',
    },
    orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/10',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800/30',
        dot: 'bg-orange-500 animate-pulse',
        label: 'Vence Hoy',
    },
    red: {
        bg: 'bg-rose-50 dark:bg-rose-900/10',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800/30',
        dot: 'bg-rose-500 animate-pulse',
        label: 'Vencido',
    },
    gray: {
        bg: 'bg-slate-50 dark:bg-slate-800/20',
        text: 'text-slate-400 dark:text-slate-500',
        border: 'border-slate-200 dark:border-slate-800/30',
        dot: 'bg-slate-300 dark:bg-slate-600',
        label: 'Sin Obligación',
    },
};

/**
 * Devuelve el día de vencimiento SRI según el 9no dígito del RUC
 */
export const getSriDueDay = (ruc: string): number | null => {
    const digit = getNinthDigit(ruc);
    if (digit === -1) return null;
    return SRI_DUE_DATES[digit] ?? null;
};

// ─────────────────────────────────────────────────────────
// ELITE MULTI-PERIOD COMPLIANCE ENGINE EXTENSION
// ─────────────────────────────────────────────────────────

import { isPast } from 'date-fns';
import { getClientServiceFee } from './clientService';

export const getActivePeriodsForClient = (client: Client, date: Date = new Date()): string[] => {
    const periods: string[] = [];
    const ivaFreq = client.taxProfile?.ivaFrequency || (client.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : (client.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'));
    
    // We check monthly or semestral periods
    // Determine the floor period for this client
    const clientStartPeriod = client.clientStartPeriod || null;
    const floorMonthly = (clientStartPeriod && !clientStartPeriod.includes('-S') && clientStartPeriod.length === 7)
        ? clientStartPeriod : '2026-01';
    const floorSemestral = clientStartPeriod?.includes('-S') ? clientStartPeriod
        : clientStartPeriod ? clientStartPeriod.substring(0, 4) + '-S1' : '2026-S1';

    if (requiresIva(client) && ivaFreq !== 'Ninguno') {
        let currentDate = date;
        for (let i = 0; i < 24; i++) {
            const period = getPeriod(client, currentDate);
            const isBeforeStart = period.includes('-S') ? period < floorSemestral : period < floorMonthly;
            if (isBeforeStart) break;
            if (!periods.includes(period)) {
                periods.push(period);
            }
            if (ivaFreq === 'Mensual') {
                currentDate = subMonths(currentDate, 1);
            } else if (ivaFreq === 'Semestral') {
                currentDate = subMonths(currentDate, 6);
            }
        }
    }
    
    // We check Renta periods (2025 onwards, since 2025 renta is filed in 2026)
    const needsRenta = client.taxProfile?.requiresAnnualRenta ??
        (client.regime === TaxRegime.RimpeEmprendedor ||
         client.regime === TaxRegime.RimpeNegocioPopular ||
         client.regime === TaxRegime.General);
    if (needsRenta) {
        const currentYear = getYear(date);
        for (let year = currentYear - 1; year >= 2025; year--) {
            periods.push(year.toString());
        }
    }
    
    return periods;
};

export interface ClientDebtSummary {
    totalDebt: number;
    unpaidPeriodsCount: number;
    unpaidPeriods: string[];
    hasPendingPayment: boolean;
}

export interface ClientUndeclaredSummary {
    undeclaredPeriodsCount: number;
    undeclaredPeriods: string[];
    hasPendingObligation: boolean;
    overduePeriodsCount: number;
    overduePeriods: string[];
}

export const getClientDebtSummary = (client: Client, fees: any, date: Date = new Date()): ClientDebtSummary => {
    const activePeriods = getActivePeriodsForClient(client, date);
    const unpaidPeriods: string[] = [];
    let totalDebt = 0;
    
    activePeriods.forEach(period => {
        const decl = (client.declarations || []).find(d => d.period === period);
        const declared = isDeclared(decl);
        const paid = isPaid(decl);
        
        // A pending collection (Cobro Pendiente) is a period that is declared but not paid
        if (declared && !paid) {
            unpaidPeriods.push(period);
            const amount = decl?.amount || getClientServiceFee(client, fees, period);
            totalDebt += amount;
        }
    });
    
    return {
        totalDebt,
        unpaidPeriodsCount: unpaidPeriods.length,
        unpaidPeriods,
        hasPendingPayment: unpaidPeriods.length > 0
    };
};

export const getClientUndeclaredSummary = (client: Client, date: Date = new Date()): ClientUndeclaredSummary => {
    const activePeriods = getActivePeriodsForClient(client, date);
    const undeclaredPeriods: string[] = [];
    const overduePeriods: string[] = [];
    
    activePeriods.forEach(period => {
        const decl = (client.declarations || []).find(d => d.period === period);
        const declared = isDeclared(decl);
        
        if (!declared) {
            undeclaredPeriods.push(period);
            const dueDate = getDueDateForPeriod(client, period);
            if (dueDate && isPast(dueDate)) {
                overduePeriods.push(period);
            }
        }
    });
    
    return {
        undeclaredPeriodsCount: undeclaredPeriods.length,
        undeclaredPeriods,
        hasPendingObligation: undeclaredPeriods.length > 0,
        overduePeriodsCount: overduePeriods.length,
        overduePeriods
    };
};

