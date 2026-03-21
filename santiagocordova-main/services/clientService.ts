
import { Client, DeclarationStatus, TaxRegime, ClientCategory, ServiceFeesConfig, AdvancePaymentResult, Task, TaskStatus, SriExtractionResult } from '../types';
import { SRI_RENTA_GENERAL_MARCH } from '../constants';
import { getPeriod, getAnnualIncomeTaxDueDate, getNextPeriod } from './sri';
import { addMonths, addYears } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export const getClientServiceFee = (client: Client, fees: ServiceFeesConfig, period?: string): number => {
    if (client.customServiceFee !== undefined && client.customServiceFee !== null) {
        return client.customServiceFee;
    }
    // Logic for fee based on period (if provided) is usually handled at component level or more specific logic
    // This basic implementation falls back to category defaults
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
             // Assume Renta General for others for now
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
        const declarationYear = now.getFullYear() - 1; // Renta is for the previous year
        const dueDate = getAnnualIncomeTaxDueDate(client, declarationYear);
        const rentaFee = fees.rentaGeneral;

        newRentaTask = {
            id: uuidv4(),
            title: `Declaración Impuesto a la Renta ${declarationYear}`,
            description: `Preparar y presentar la declaración de impuesto a la renta para ${client.name} correspondiente al año fiscal ${declarationYear}.`,
            clientId: client.id,
            dueDate: dueDate ? dueDate.toISOString() : addYears(now, 1).toISOString(),
            status: TaskStatus.Abono, // 'Abono' status indicates it's pre-paid
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

/**
 * Creates a Client object from SRI PDF extraction result.
 * Matches category and determines fees based on regime.
 */
export const createClientFromExtraction = (extracted: SriExtractionResult, sriCredentials?: Record<string, string>): Client => {
    // Determine Category
    let category = ClientCategory.InternoMensual;
    if (extracted.regimen === TaxRegime.RimpeNegocioPopular) {
        category = ClientCategory.ImpuestoRentaNegocioPopular;
    } else if (extracted.obligaciones_tributarias === 'semestral') {
        category = ClientCategory.InternoSemestral;
    } else {
        category = ClientCategory.InternoMensual;
    }
    
    // Validate Regime (ensure string matches Enum, otherwise default to General)
    const safeRegime = Object.values(TaxRegime).includes(extracted.regimen as TaxRegime)
        ? (extracted.regimen as TaxRegime)
        : TaxRegime.General;
    
    // Look up password in vault
    const password = sriCredentials ? (sriCredentials[extracted.ruc] || '') : '';

    return {
        id: uuidv4(),
        ruc: extracted.ruc,
        name: extracted.apellidos_nombres,
        address: extracted.direccion,
        email: extracted.contacto.email,
        phones: extracted.contacto.celular ? [extracted.contacto.celular] : [],
        regime: safeRegime,
        category: category,
        sriPassword: password,
        declarationHistory: [],
        isActive: true,
        economicActivity: extracted.actividad_economica,
        isArtisan: extracted.es_artesano,
        establishmentCount: extracted.cantidad_establecimientos,
        jurisdiction: '', 
        notes: `[Importación Automática]\nObligaciones: ${extracted.lista_obligaciones.join(', ')}`
    };
};
