
import { Client, DeclarationStatus, TaxRegime, ClientCategory, ServiceFeesConfig, AdvancePaymentResult, Task, TaskStatus } from '../types';
import { getPeriod, getAnnualIncomeTaxDueDate, getNextPeriod } from './sri';
import { addYears } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export const getClientServiceFee = (client: Client, fees: ServiceFeesConfig): number => {
    // Correctly accessing customServiceFee from Client
    if (client.customServiceFee !== undefined && client.customServiceFee !== null) {
        return client.customServiceFee;
    }
    switch (client.category) {
        case ClientCategory.SuscripcionMensual:
        case ClientCategory.InternoMensual:
            return fees.ivaMensual;
        case ClientCategory.SuscripcionSemestral:
        case ClientCategory.InternoSemestral:
            return fees.ivaSemestral;
        case ClientCategory.ImpuestoRentaNegocioPopular:
            return fees.rentaNP;
        case ClientCategory.DevolucionIvaTerceraEdad:
            return fees.devolucionIva;
        default:
            return fees.rentaGeneral;
    }
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
            const amount = declaration.amount ?? getClientServiceFee(client, fees);
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
        const rentaFee = fees.rentaGeneral;

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
