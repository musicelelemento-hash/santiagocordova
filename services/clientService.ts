
import { Client, DeclarationStatus, TaxRegime, ServiceFeesConfig, Task, TaskStatus } from '../types';
import { getPeriod, getAnnualIncomeTaxDueDate, getNextPeriod } from './sri';
import { addYears } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

/**
 * Determines if a client is courtesy, barter, zero-fee, or family/friends.
 */
export const isCourtesyClient = (client?: Partial<Client> | null, period?: string): boolean => {
    if (!client) return false;
    if (client.isCourtesy) return true;
    if (client.customServiceFee === 0) return true;
    if (client.fee_structure?.monthly === 0 && client.fee_structure?.semestral === 0 && client.fee_structure?.annual === 0) return true;
    // Si la cuota mensual está en 0 (para clientes mensuales o períodos mensuales de IVA)
    if (client.fee_structure?.monthly === 0 && (!period || (period.includes('-') && !period.includes('S')) || client.taxProfile?.ivaFrequency === 'Mensual')) return true;
    if (period && period.includes('-S') && client.fee_structure?.semestral === 0) return true;
    if (period && period.length === 4 && !period.includes('-') && client.fee_structure?.annual === 0) return true;

    const cat = `${client.category || ''} ${(client.taxProfile as any)?.category || ''} ${client.taxProfile?.alias || ''} ${client.notes || ''}`.toLowerCase();
    return cat.includes('cortesía') || cat.includes('cortesia') || cat.includes('trueque') || cat.includes('familia') || cat.includes('cero');
};

export interface ClientAdvanceInfo {
    hasAdvance: boolean;
    totalAdvanceCount: number;
    usedAdvanceCount: number;
    remainingAdvanceCount: number;
    monthlyFee: number;
    badgeText: string;
    tooltip: string;
    advancePeriods: string[];
    isPeriodAdvance: (period: string) => boolean;
    getPeriodAdvanceFraction: (period: string) => string | null;
    advanceCredits: number;
}

const matchPeriodSafe = (p1?: string, p2?: string): boolean => {
    if (!p1 || !p2) return false;
    const c1 = p1.split(':')[0].trim().toUpperCase().replace('-1S', '-S1').replace('1S', 'S1').replace('-2S', '-S2').replace('2S', 'S2');
    const c2 = p2.split(':')[0].trim().toUpperCase().replace('-1S', '-S1').replace('1S', 'S1').replace('-2S', '-S2').replace('2S', 'S2');
    return c1 === c2;
};

/**
 * Calculates advance payment information for a client, returning badge labels like "3/5 de $5".
 */
export const getClientAdvanceInfo = (client?: Partial<Client> | null, fees?: ServiceFeesConfig): ClientAdvanceInfo => {
    const emptyResult: ClientAdvanceInfo = {
        hasAdvance: false,
        totalAdvanceCount: 0,
        usedAdvanceCount: 0,
        remainingAdvanceCount: 0,
        monthlyFee: 0,
        badgeText: '',
        tooltip: '',
        advancePeriods: [],
        isPeriodAdvance: () => false,
        getPeriodAdvanceFraction: () => null,
        advanceCredits: 0
    };

    if (!client) return emptyResult;

    const declarations = client.declarations || [];
    const monthlyFee = client.fee_structure?.monthly ?? client.customServiceFee ?? (fees ? fees.ivaMensual : 5) ?? 5;
    const credits = (client.advanceCredits || 0) + ((client as any).advance_credits || 0);

    // Encontrar todas las declaraciones que forman parte de pagos adelantados
    const advanceDecls = declarations.filter(d => 
        d.is_advance === true || 
        d.transactionId?.startsWith('PAY-ADV-') ||
        (d.is_paid && d.status === DeclarationStatus.Pendiente)
    );

    // Obtener períodos únicos ordenados cronológicamente
    const advancePeriods = Array.from(new Set(advanceDecls.map(d => d.period))).sort();

    const hasAdvance = advancePeriods.length > 0 || credits > 0;
    if (!hasAdvance) return emptyResult;

    // Calcular cuántos ya fueron declarados (con comprobante o estado Enviada/Pagada)
    const usedDecls = advanceDecls.filter(d => 
        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada || !!d.proof_file) && d.is_paid
    );
    const usedAdvanceCount = usedDecls.length;
    const totalAdvanceCount = advancePeriods.length > 0 
        ? advancePeriods.length 
        : (monthlyFee > 0 ? Math.floor(credits / monthlyFee) : 0);
    const remainingAdvanceCount = Math.max(0, totalAdvanceCount - usedAdvanceCount);

    // Texto de la etiqueta para el cliente: Ej. "1/6 de $5" o "3/5 de $5"
    let badgeText = '';
    let tooltip = '';
    if (advancePeriods.length > 0) {
        const currentProgress = usedAdvanceCount > 0 ? usedAdvanceCount : 1;
        badgeText = `${currentProgress}/${totalAdvanceCount} de $${monthlyFee}`;
        tooltip = `Pago Adelantado: ${usedAdvanceCount} de ${totalAdvanceCount} cubiertos (${remainingAdvanceCount} pendientes) a $${monthlyFee}/mes`;
    } else if (credits > 0) {
        badgeText = `$${credits.toFixed(2)} disp.`;
        tooltip = `Saldo a favor por adelanto: $${credits.toFixed(2)} (${totalAdvanceCount} meses a $${monthlyFee}/mes)`;
    }

    const isPeriodAdvance = (period: string): boolean => {
        if (!period) return false;
        if (advancePeriods.some(p => matchPeriodSafe(p, period))) return true;
        const d = declarations.find(decl => matchPeriodSafe(decl.period, period));
        if (d && (d.is_advance || d.transactionId?.startsWith('PAY-ADV-'))) return true;
        return false;
    };

    const getPeriodAdvanceFraction = (period: string): string | null => {
        if (!period) return null;
        const idx = advancePeriods.findIndex(p => matchPeriodSafe(p, period));
        if (idx !== -1) {
            return `${idx + 1}/${totalAdvanceCount} de $${monthlyFee}`;
        }
        const d = declarations.find(decl => matchPeriodSafe(decl.period, period));
        if (d && (d.is_advance || d.transactionId?.startsWith('PAY-ADV-'))) {
            return `Adelanto ($${monthlyFee})`;
        }
        return null;
    };

    return {
        hasAdvance,
        totalAdvanceCount,
        usedAdvanceCount,
        remainingAdvanceCount,
        monthlyFee,
        badgeText,
        tooltip,
        advancePeriods,
        isPeriodAdvance,
        getPeriodAdvanceFraction,
        advanceCredits: credits
    };
};

/**
 * Calculates the fee for a specific period for a client.
 * If period is provided, it attempts to match Annual/Monthly specific fees.
 */
export const getClientServiceFee = (client: Client, fees: ServiceFeesConfig, period?: string): number => {
    if (isCourtesyClient(client, period)) return 0;
    // 1. Check for specific Period type (Annual vs Recurring)
    if (period) {
        // Annual Period (e.g., "2024")
        if (period.length === 4 && !period.includes('-')) {
            if (client.fee_structure?.annual !== undefined) return client.fee_structure.annual;
            return client.regime === TaxRegime.RimpeNegocioPopular ? fees.rentaNP : fees.rentaGeneral;
        }

        // Semestral Period (e.g., "2024-S1")
        if (period.includes('-S')) {
            if (client.fee_structure?.semestral !== undefined) return client.fee_structure.semestral;
            // Fallback to customServiceFee if no specific structure
            if (client.customServiceFee !== undefined) return client.customServiceFee;
            return fees.ivaSemestral;
        }

        // Monthly Period (e.g., "2024-05")
        if (period.includes('-') && !period.includes('S')) {
            let total = client.fee_structure?.monthly ?? (client.customServiceFee ?? fees.ivaMensual);

            // Add ICE fees if required
            if (client.taxProfile?.requiresIce) {
                total += client.fee_structure?.iceMonthly ?? 5; // Default $5
                total += client.fee_structure?.iceAnexo ?? 5;   // Default $5
            }

            return total;
        }
    }

    // 2. Fallback if no period provided (General Default) or legacy support
    // Priority: Specific Structure > Legacy Custom Fee > Global Config

    if (client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor) {
        return client.fee_structure?.semestral ?? client.customServiceFee ?? fees.ivaSemestral;
    }

    if (client.taxProfile?.ivaFrequency === 'Mensual' || client.taxProfile?.hasActiveDevolucionIva) {
        let total = client.fee_structure?.monthly ?? client.customServiceFee ?? fees.ivaMensual;
        if (client.taxProfile?.requiresIce) {
            total += client.fee_structure?.iceMonthly ?? 5;
            total += client.fee_structure?.iceAnexo ?? 5;
        }
        return total;
    }

    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        return client.fee_structure?.annual ?? client.customServiceFee ?? fees.rentaNP;
    }

    // Default for others
    return client.fee_structure?.annual ?? client.customServiceFee ?? fees.rentaGeneral;
};

