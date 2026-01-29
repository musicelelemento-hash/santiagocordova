
import { Client, Task, DeclarationStatus, ClientCategory, TaskStatus, Declaration, TaxRegime, RentaCategory } from './types';
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
  ivaMensual: 5, // Mínimo $5
  ivaSemestral: 10, // Ajustado a valor razonable > 5
  rentaNP: 10,
  rentaGeneral: 20, 
  devolucionIva: 15,
  devolucionRenta: 20, 
  anexoGastosPersonales: 15, 
  customPunctualServices: [
      { id: 'ice-mensual', name: 'Declaración Mensual de ICE', price: 25.00 },
      { id: 'anexo-ice', name: 'Anexo de Movimiento ICE', price: 20.00 },
      { id: 'anexo-pvp', name: 'Anexo Anual PVP', price: 30.00 },
      { id: 'impuesto-vehicular', name: 'Impuesto a la Propiedad de Vehículos', price: 10.00 },
      { id: 'anexo-transaccional', name: 'Anexo Transaccional Simplificado (ATS)', price: 25.00 },
      { id: 'anexo-accionistas', name: 'Anexo de Accionistas (APS)', price: 40.00 },
      { id: 'supercias', name: 'Informe Superintendencia de Compañías', price: 50.00 }
  ],
  serviceBundles: [
    {
        id: 'combo-devolucion-renta',
        title: 'Combo Devolución Impuesto Renta',
        description: 'Servicio completo para recuperar saldo a favor. Incluye: Impuesto a la Renta + Anexo de Gastos + Solicitud de Devolución.',
        price: 25.00,
        originalPrice: 45.00, // Suma aprox de individuales
        features: [
            'Declaración Impuesto a la Renta',
            'Anexo de Gastos Personales',
            'Solicitud de Devolución de Retenciones'
        ]
    },
    {
        id: 'combo-recuperacion-total',
        title: 'Pack Recuperación Total (IVA)',
        description: 'Solución integral para recuperar sus impuestos y cumplir obligaciones anuales.',
        price: 25.00,
        originalPrice: 45.00,
        features: [
            'Declaración Impuesto a la Renta',
            'Anexo de Gastos Personales',
            'Solicitud de Devolución de IVA'
        ]
    }
  ]
};


export const mockClients: Client[] = [
    {
        id: uuidv4(),
        ruc: '0702706813001',
        name: 'Aleida',
        sriPassword: 'Aleida2021*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [
            {
                period: '2024-05',
                status: DeclarationStatus.Pagada,
                updatedAt: new Date().toISOString(),
                paidAt: new Date().toISOString(),
                amount: 5
            }
        ],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0702608118001',
        name: 'SARA HGW',
        sriPassword: 'Uyaguari0702*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'falta'
    },
    {
        id: uuidv4(),
        ruc: '1102605118001',
        name: 'Manuel Labanda',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0750599714001',
        name: 'Mirella Noles',
        sriPassword: 'Faro1998**',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual, // Updated
        customServiceFee: 15, // Added custom fee
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0703257220001',
        name: 'Machuca',
        sriPassword: 'Machuca@1997',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0750036220001',
        name: 'Karla Iñiguez',
        sriPassword: 'KARLAv07500.',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '2000022224001',
        name: 'Fausto Maldonado',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'falta'
    },
    {
        id: uuidv4(),
        ruc: '0707018438001',
        name: 'Daniel',
        sriPassword: '29De11de1997@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'falta'
    },
    {
        id: uuidv4(),
        ruc: '0705322535001',
        name: 'Esposo Chamorro',
        sriPassword: 'Eve88ariel0@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0801048844001',
        name: 'Walter Humberto',
        sriPassword: 'WALTER08010m.',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0704621242001',
        name: 'Mercy las Gaviotas',
        sriPassword: 'Jzaid132411@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0702547753001',
        name: 'Elita Cardenas',
        sriPassword: 'Noviembre28@@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'falta'
    },
    {
        id: uuidv4(),
        ruc: '0700748452001',
        name: 'Alicia Zamora',
        sriPassword: 'Gregorio13*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: '25 saldo. ALICIAZA ZAMORA. ZAMORA777'
    },
    {
        id: uuidv4(),
        ruc: '0703675157001',
        name: 'Maza',
        sriPassword: 'Joaquin2023#',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'llamar'
    },
    {
        id: uuidv4(),
        ruc: '0703524652001',
        name: 'K peñafiel hgw',
        sriPassword: 'Paradise1419*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0706763463001',
        name: 'Helen',
        sriPassword: 'Lilibeth95@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '1203704075001',
        name: 'Marido Carlota',
        sriPassword: 'GAROFALOq@1975',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0702475377001',
        name: 'Jorge Redrovan',
        sriPassword: 'Redrovan1967*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'falta'
    },
    {
        id: uuidv4(),
        ruc: '0703554071001',
        name: 'Sandro pineda Lamilla',
        sriPassword: 'Pineda2013*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0701672370001',
        name: 'Benito',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'hacer y llamar 0994983292'
    },
    {
        id: uuidv4(),
        ruc: '0705786770001',
        name: 'Ortiz',
        sriPassword: 'Ortiz0705*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0702432782001',
        name: 'Cecilia Merchan',
        sriPassword: 'Lemm1997**',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'esposa Walter'
    },
    {
        id: uuidv4(),
        ruc: '0705542587001',
        name: 'Hermana de Gino',
        sriPassword: 'Gbatari95_',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: '4 meses desde mayo'
    },
    {
        id: uuidv4(),
        ruc: '0914250683001',
        name: 'Manuel Nagua',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0962224697001',
        name: 'Moto Pasaje',
        sriPassword: 'Luoruier2025!',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0705948792001',
        name: 'Romero',
        sriPassword: 'Fromero777.',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'Debe 3 declaraciones'
    },
    {
        id: uuidv4(),
        ruc: '0705072494001',
        name: 'Cerafin',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0703953299001',
        name: 'Cuenca',
        sriPassword: 'Joelito2005@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '1722764808001',
        name: 'José Rodríguez',
        sriPassword: 'Antonio1991@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0704368604001',
        name: 'Reyes',
        sriPassword: 'Reyes2021*',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0705726230001',
        name: 'Flores Parrillada',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'falta'
    },
    {
        id: uuidv4(),
        ruc: '0704627934001',
        name: 'Vanesa de la peaña',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'declaración'
    },
    {
        id: uuidv4(),
        ruc: '0701694226001',
        name: 'Vanesa (Don Felix)',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'declaración'
    },
    {
        id: uuidv4(),
        ruc: '0102354446001',
        name: 'Rufo',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0704789205001',
        name: 'Alan',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0706997079001',
        name: 'Matías HGW',
        sriPassword: 'Es Mabie123059_',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0706482023001',
        name: 'Vinos',
        sriPassword: 'Vinos2025@',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '1103034052001',
        name: 'CABRERA BERONICA MARIA',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true
    },
    {
        id: uuidv4(),
        ruc: '0701358368001',
        name: 'Camba María',
        sriPassword: '',
        regime: TaxRegime.General,
        category: ClientCategory.SuscripcionMensual,
        declarationHistory: [],
        isActive: true,
        notes: 'Desde julio no aparece'
    }
];

export const mockTasks: Task[] = [];
