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

/**
 * Algoritmo de validación de RUC y Cédula de Ecuador (Módulo 10 y 11)
 * Valida la provincia, el tercer dígito y el dígito verificador.
 */
export const validarIdentificacionEcuatoriana = (id: string): boolean => {
    const cedula = id.trim();
    if (cedula.length !== 10 && cedula.length !== 13) return false;
    
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) return false;
    
    const tercerDigito = parseInt(cedula.substring(2, 3), 10);
    if (tercerDigito < 0 || (tercerDigito > 6 && tercerDigito !== 9)) return false;
    
    // Algoritmo Módulo 10 para personas naturales
    if (tercerDigito < 6) {
        const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;
        
        for (let i = 0; i < 9; i++) {
            let valor = parseInt(cedula.charAt(i), 10) * coeficientes[i];
            if (valor > 9) valor -= 9;
            suma += valor;
        }
        
        const decenaSuperior = Math.ceil(suma / 10) * 10;
        const residuo = decenaSuperior - suma;
        const verificadorCalculado = residuo === 10 ? 0 : residuo;
        
        const esIdentificacionValida = verificadorCalculado === digitoVerificador;
        
        if (cedula.length === 13) {
            return esIdentificacionValida && cedula.substring(10, 13) === "001";
        }
        return esIdentificacionValida;
    }
    
    // Sociedades privadas / extranjeros (tercer dígito 9 - Módulo 11)
    if (tercerDigito === 9 && cedula.length === 13) {
        const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
        const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        
        for (let i = 0; i < 9; i++) {
            suma += parseInt(cedula.charAt(i), 10) * coeficientes[i];
        }
        
        const residuo = suma % 11;
        const verificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
        
        return verificadorCalculado === digitoVerificador && cedula.substring(10, 13) === "001";
    }
    
    // Sociedades públicas (tercer dígito 6 - Módulo 11)
    if (tercerDigito === 6 && cedula.length === 13) {
        const digitoVerificador = parseInt(cedula.substring(8, 9), 10);
        const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        
        for (let i = 0; i < 8; i++) {
            suma += parseInt(cedula.charAt(i), 10) * coeficientes[i];
        }
        
        const residuo = suma % 11;
        const verificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
        
        return verificadorCalculado === digitoVerificador && cedula.substring(9, 13) === "0001";
    }
    
    return false;
};

