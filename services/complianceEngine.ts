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
    const clientIvaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
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

    return obligations;
};

/**
 * Returns the expected obligations for a specific period (month or semester)
 * This is used mainly for the Matrix view to know what to display for historical cells.
 */
export const getObligationsForPeriod = (client: Client, period: string): Array<{ type: TaxObligationType, label: string }> => {
    const obligations: Array<{ type: TaxObligationType, label: string }> = [];
    
    // Check if it's a semester period (e.g., 2024-S1)
    const isSemester = period.includes('-S');
    
    // IVA
    if (requiresIva(client)) {
        const clientFreq = client.taxProfile?.ivaFrequency || 'Mensual';
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
    
    // RENTA (Only for Yearly period, but we often map it to the month of March in the matrix or as a special row)
    // However, the matrix usually shows months. If the period is YYYY-03, we might want to show Renta.
    // For now, let's keep it simple: Matrix shows IVA and ICE by default.
    
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
