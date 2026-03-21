
import { Client, DeclarationStatus, TaxRegime, ClientCategory, ServiceFeesConfig, AdvancePaymentResult, Task, TaskStatus } from '../types';
import { getPeriod, getAnnualIncomeTaxDueDate, getNextPeriod } from './sri';
import { addYears } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calculates the fee for a specific period for a client.
 * If period is provided, it attempts to match Annual/Monthly specific fees.
 */
export const getClientServiceFee = (client: Client, fees: ServiceFeesConfig, period?: string): number => {
    // 1. Check for specific Period type (Annual vs Recurring)
    if (period) {
        // Annual Period (e.g., "2024")
        if (period.length === 4 && !period.includes('-')) {
             if (client.feeStructure?.annual !== undefined) return client.feeStructure.annual;
             return client.regime === TaxRegime.RimpeNegocioPopular ? fees.rentaNP : fees.rentaGeneral;
        }
        
        // Semestral Period (e.g., "2024-S1")
        if (period.includes('-S')) {
            if (client.feeStructure?.semestral !== undefined) return client.feeStructure.semestral;
            // Fallback to customServiceFee if no specific structure
            if (client.customServiceFee !== undefined) return client.customServiceFee;
            return fees.ivaSemestral;
        }

        // Monthly Period (e.g., "2024-05")
        if (period.includes('-') && !period.includes('S')) {
            if (client.feeStructure?.monthly !== undefined) return client.feeStructure.monthly;
            // Fallback
             if (client.customServiceFee !== undefined) return client.customServiceFee;
             return fees.ivaMensual;
        }
    }

    // 2. Fallback if no period provided (General Default) or legacy support
    // Priority: Specific Structure > Legacy Custom Fee > Global Config
    
    if (client.category.includes('Semestral')) {
        return client.feeStructure?.semestral ?? client.customServiceFee ?? fees.ivaSemestral;
    }
    
    if (client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad) {
        return client.feeStructure?.monthly ?? client.customServiceFee ?? fees.ivaMensual;
    }

    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        return client.feeStructure?.annual ?? client.customServiceFee ?? fees.rentaNP;
    }

    // Default for others
    return client.feeStructure?.annual ?? client.customServiceFee ?? fees.rentaGeneral;
};

export const addAdvancePayments = (
    client: Client, 
    advancePeriods: number, 
    fees: ServiceFeesConfig,
    includeRentaAdvance: boolean
): AdvancePaymentResult => {
    if (!client) {
        return { updatedClient: client, paidPeriods: [], transactionId: '' };
    }

    const now = new Date();
    const transactionId = `ADV-${now.getTime().toString().slice(-6)}`;
    const paidPeriods: { period: string; amount: number }[] = [];
    let newRentaTask: Task | undefined = undefined;

    const pendingDeclarations = client.declarationHistory
        .filter(d => d.status !== DeclarationStatus.Pagada)
        .sort((a, b) => a.period.localeCompare(b.period));

    const periodsToPay = pendingDeclarations.slice(0, advancePeriods);
    const periodsToPaySet = new Set(periodsToPay.map(p => p.period));

    const updatedHistory = client.declarationHistory.map(declaration => {
        if (periodsToPaySet.has(declaration.period)) {
            // Pass the period to get the correct fee type (Annual vs Monthly)
            const amount = declaration.amount ?? getClientServiceFee(client, fees, declaration.period);
            paidPeriods.push({ period: declaration.period, amount });
            return {
                ...declaration,
                status: DeclarationStatus.Pagada,
                updatedAt: now.toISOString(),
                paidAt: now.toISOString(),
                transactionId,
                amount,
            };
        }
        return declaration;
    });
    
    if (includeRentaAdvance && client.regime !== TaxRegime.RimpeNegocioPopular) {
        const declarationYear = now.getFullYear() - 1; 
        const dueDate = getAnnualIncomeTaxDueDate(client, declarationYear);
        
        // Calculate fee for Annual Renta
        const rentaPeriod = declarationYear.toString();
        const rentaFee = getClientServiceFee(client, fees, rentaPeriod);

        newRentaTask = {
            id: uuidv4(),
            title: `Declaración Impuesto a la Renta ${declarationYear}`,
            description: `Preparar y presentar la declaración de impuesto a la renta para ${client.name} correspondiente al año fiscal ${declarationYear}.`,
            clientId: client.id,
            dueDate: dueDate ? dueDate.toISOString() : addYears(now, 1).toISOString(),
            status: TaskStatus.Abono, 
            cost: rentaFee,
            advancePayment: rentaFee,
        };
        
        paidPeriods.push({ period: `Renta ${declarationYear}`, amount: rentaFee });
    }

    const updatedClient = {
        ...client,
        declarationHistory: updatedHistory,
    };
    
    return {
        updatedClient,
        paidPeriods,
        transactionId,
        newRentaTask,
    };
};
