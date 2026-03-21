
import { Client, Task, DeclarationStatus, TaskStatus, Declaration, TaxRegime, RentaCategory } from './types';
import { v4 as uuidv4 } from 'uuid';

// Tabla oficial de vencimientos según el noveno dígito del RUC
// Aplicable para: Régimen General, RIMPE Emprendedor y RIMPE Negocio Popular
export const SRI_DUE_DATES: { [key: number]: number } = {
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

// Months for annual income tax declarations (0-indexed)
export const SRI_RENTA_GENERAL_MARCH = 2; // March (Régimen General y RIMPE Emprendedor)
export const SRI_RENTA_NP_MAY = 4;        // May (RIMPE Negocio Popular)

export const INITIAL_SERVICE_FEES = {
    ivaMensual: 15,
    ivaSemestral: 25,
    rentaNP: 30,
    rentaGeneral: 70,
    devolucionIva: 25,
    devolucionRenta: 45,
    anexoGastosPersonales: 30,
    rentaButtonsStartMonth: 1, // Default January
    customPunctualServices: [
        { id: 'firma-electronica', name: 'Firma Electrónica', price: 35.00 },
        { id: 'pack-facturador', name: 'Pack Facturador', price: 55.00 },
        { id: 'ice-mensual', name: 'Declaración Mensual de ICE', price: 10.00 },
        { id: 'anexo-ice', name: 'Anexo de Movimiento ICE', price: 10.00 },
        { id: 'anexo-pvp', name: 'Anexo Anual PVP', price: 15.00 },
        { id: 'impuesto-vehicular', name: 'Impuesto a la Propiedad de Vehículos', price: 15.00 },
        { id: 'anexo-transaccional', name: 'Anexo Transaccional Simplificado (ATS)', price: 30.00 },
        { id: 'anexo-accionistas', name: 'Anexo de Accionistas (APS)', price: 45.00 },
        { id: 'supercias', name: 'Informe Superintendencia de Compañías', price: 60.00 }
    ]
};

export const mockClients: Client[] = [
    {
        id: uuidv4(),
        ruc: '0702706813001',
        name: 'Aleida',
        sriPassword: 'Aleida2021*',
        regime: TaxRegime.General,
        isVip: true,
        taxProfile: {
            ivaFrequency: 'Mensual',
            requiresAnnualRenta: true,
            requiresAnexosGastos: false,
            hasActiveDevolucionIva: false,
            hasActiveElderlyDevolucionIva: false,
            requiresIce: false,
            requiresAnexoPvp: false
        },
        declarationHistory: [
            {
                period: '2024-05',
                status: DeclarationStatus.Pagada,
                updatedAt: new Date().toISOString(),
                paidAt: new Date().toISOString(),
                amount: 5
            }
        ],
        isActive: true,
        feeStructure: { monthly: 5, annual: 10, semestral: 10 }
    },
    {
        id: uuidv4(),
        ruc: '0702706813002', // Placeholder RUC for CHAVEZ CORDOVA GUIDO ERMEL
        name: 'CHAVEZ CORDOVA GUIDO ERMEL',
        sriPassword: 'Guido2026*',
        regime: TaxRegime.General,
        isVip: true,
        taxProfile: {
            ivaFrequency: 'Mensual',
            requiresAnnualRenta: true,
            requiresAnexosGastos: false,
            hasActiveDevolucionIva: false,
            hasActiveElderlyDevolucionIva: false,
            requiresIce: true,
            requiresAnexoPvp: true
        },
        declarationHistory: [],
        isActive: true,
        feeStructure: { 
            monthly: 25, 
            annual: 10, 
            iceMonthly: 10, 
            iceAnexo: 5, 
            anexoPvp: 10 
        }
    }
];

export const mockTasks: Task[] = [];
