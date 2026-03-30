import { format, addMonths, setDate, isAfter, startOfMonth } from 'date-fns';
import { TaxRegime } from '../types/client';

/**
 * SRI Rule: 9th digit determines the due date
 * 1 -> 10th
 * 2 -> 12th
 * 3 -> 14th
 * 4 -> 16th
 * 5 -> 18th
 * 6 -> 20th
 * 7 -> 22th
 * 8 -> 24th
 * 9 -> 26th
 * 0 -> 28th
 */
export const getSriDueDay = (rucOrCedula: string): number => {
    if (!rucOrCedula || rucOrCedula.length < 9) return 28; // fallback to worst case scenario
    
    // Si la cédula termina en 001, puede que no tenga RUC, pero si es cédula (10 digitos) sin 001, o RUC (13 digitos).
    // Always use the 9th digit for RUC calculation.
    const ninthDigit = parseInt(rucOrCedula.charAt(8));
    
    if (isNaN(ninthDigit)) return 28;

    if (ninthDigit === 0) return 28;
    return 10 + ((ninthDigit - 1) * 2);
};

export type PeriodType = 'mensual' | 'semestral_1' | 'semestral_2' | 'anual_natural' | 'anual_sociedad';

/**
 * Calcula la fecha de vencimiento exacta
 * @param ruc RUC o Cédula del cliente
 * @param referenceDate Fecha/periodo de la declaración (ej. para Enero 2026, pasamos "2026-01-01")
 * @param type Tipo de declaración
 * @returns Fecha límite de declaración
 */
export const calculateDueDate = (ruc: string, referenceDate: Date, type: PeriodType): Date => {
    const dueDay = getSriDueDay(ruc);
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-11

    let dueDate = new Date();

    switch (type) {
        case 'mensual':
            // Se declara al mes siguiente
            dueDate = startOfMonth(addMonths(referenceDate, 1));
            break;
        case 'semestral_1':
            // Enero-Junio se declara en Julio
            dueDate = new Date(year, 6, 1); // Julio (6)
            break;
        case 'semestral_2':
            // Julio-Diciembre se declara en Enero del próximo año
            dueDate = new Date(year + 1, 0, 1); // Enero (0)
            break;
        case 'anual_natural':
            // Personas Naturales: Marzo
            dueDate = new Date(year + 1, 2, 1); // Marzo (2)
            break;
        case 'anual_sociedad':
            // Sociedades: Abril
            dueDate = new Date(year + 1, 3, 1); // Abril (3)
            break;
        default:
            dueDate = startOfMonth(addMonths(referenceDate, 1));
    }

    // Set the specific day
    return setDate(dueDate, dueDay);
};

/**
 * Helper to check if a declaration is overdue against the current date
 */
export const isOverdue = (dueDate: Date): boolean => {
    const today = new Date();
    // Vencida si hoy es mayor a dueDate
    return isAfter(today, dueDate);
};
