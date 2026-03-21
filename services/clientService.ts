
import { Client, DeclarationStatus, TaxRegime, ServiceFeesConfig, Task, TaskStatus } from '../types';
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
            let total = client.feeStructure?.monthly ?? (client.customServiceFee ?? fees.ivaMensual);

            // Add ICE fees if required
            if (client.taxProfile?.requiresIce) {
                total += client.feeStructure?.iceMonthly ?? 5; // Default $5
                total += client.feeStructure?.iceAnexo ?? 5;   // Default $5
            }

            return total;
        }
    }

    // 2. Fallback if no period provided (General Default) or legacy support
    // Priority: Specific Structure > Legacy Custom Fee > Global Config

    if (client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor) {
        return client.feeStructure?.semestral ?? client.customServiceFee ?? fees.ivaSemestral;
    }

    if (client.taxProfile?.ivaFrequency === 'Mensual' || client.taxProfile?.hasActiveDevolucionIva) {
        let total = client.feeStructure?.monthly ?? client.customServiceFee ?? fees.ivaMensual;
        if (client.taxProfile?.requiresIce) {
            total += client.feeStructure?.iceMonthly ?? 5;
            total += client.feeStructure?.iceAnexo ?? 5;
        }
        return total;
    }

    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        return client.feeStructure?.annual ?? client.customServiceFee ?? fees.rentaNP;
    }

    // Default for others
    return client.feeStructure?.annual ?? client.customServiceFee ?? fees.rentaGeneral;
};

