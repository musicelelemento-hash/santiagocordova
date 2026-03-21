
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
  ivaMensual: 5, 
  ivaSemestral: 5, 
  rentaNP: 10,
  rentaGeneral: 10,
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
        declarations: [
            {
                period: '2024-05',
                status: DeclarationStatus.Pagada,
                updatedAt: new Date().toISOString(),
                paidAt: new Date().toISOString(),
                amount: 5
            }
        ],
        isActive: true,
        fee_structure: { monthly: 5, annual: 10, semestral: 5 }
    }
];

export const mockTasks: Task[] = [];
