
import { SRI_DUE_DATES, SRI_RENTA_GENERAL_MARCH, SRI_RENTA_NP_MAY } from '../constants';
import { Client, ClientCategory, TaxRegime, Declaration, DeclarationStatus } from '../types';
import { format, differenceInCalendarDays, subMonths, subYears, getYear, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface SRIPublicData {
    name: string;
    activity?: string;
    status?: string;
    address?: string;
    phone?: string;
}

export const validateRuc = (ruc: string): ValidationResult => {
  if (!ruc || ruc.trim() === '') {
    return { isValid: false, message: 'El RUC es obligatorio.' };
  }
  if (!/^\d{13}$/.test(ruc)) {
    return { isValid: false, message: 'El RUC debe tener 13 dígitos numéricos.' };
  }
  if (!ruc.endsWith('001')) {
    return { isValid: false, message: 'El RUC debe terminar en "001".' };
  }
  return { isValid: true };
};

export const validateIdentifier = (identifier: string): ValidationResult => {
  if (!identifier || identifier.trim() === '') {
    return { isValid: false, message: 'El identificador es obligatorio.' };
  }
  if (!/^\d+$/.test(identifier)) {
    return { isValid: false, message: 'El identificador debe contener solo dígitos.' };
  }
  if (identifier.length === 13) {
    return validateRuc(identifier);
  }
  if (identifier.length === 10) {
    // Basic cedula validation (length and numeric is already checked)
    return { isValid: true };
  }
  return { isValid: false, message: 'Debe ser un RUC de 13 dígitos o Cédula de 10 dígitos.' };
};

export const getIdentifierSortKey = (identifier: string | undefined): number => {
  if (!identifier || identifier.length < 9) {
    return 99; // Sort items without a valid identifier last
  }
  const digit = parseInt(identifier[8], 10);
  // SRI Calendar Logic: 1 (10th) -> ... -> 9 (26th) -> 0 (28th)
  // So '0' must be treated as 10 to sort at the end.
  return digit === 0 ? 10 : digit;
};

export const validateSriPassword = (password: string): { isValid: boolean, criteria: { length: boolean, uppercase: boolean, lowercase: boolean, number: boolean, special: boolean } } => {
    const criteria = {
        length: password.length >= 8, 
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    const isValid = Object.values(criteria).every(Boolean);
    return { isValid, criteria };
};


export const getNinthDigit = (ruc: string): number => {
  if (ruc.length < 9) return -1;
  return parseInt(ruc[8], 10);
};

/**
 * Lógica Central de Periodos (Actualizada: Prioridad Mensual/Semestral)
 */
export const getPeriod = (client: Pick<Client, 'category' | 'regime' | 'declarationHistory'>, date: Date): string => {
    const currentYear = getYear(date);
    const prevYearStr = (currentYear - 1).toString();
    const month = getMonth(date); // 0-11
    
    // Safety check
    const category = client.category || '';

    // 1. REGLA: Si es RIMPE Negocio Popular, la obligación principal SIEMPRE es Anual.
    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        return prevYearStr;
    }

    // 2. REGLA: Para Régimen General y Emprendedor, PRIORIZAMOS LA OBLIGACIÓN RECURRENTE (Mensual/Semestral).
    // Lógica Estándar (IVA Mensual / Semestral / Devoluciones)
    if (category.includes('Mensual') || category === ClientCategory.DevolucionIvaTerceraEdad) {
        const declarationMonth = subMonths(date, 1);
        return format(declarationMonth, 'yyyy-MM');
    }
    
    if (category.includes('Semestral')) {
        if (month < 6) { // Ene-Jun (Se declara el S2 del año anterior)
            return `${currentYear - 1}-S2`;
        } else { // Jul-Dic (Se declara el S1 del año actual)
            return `${currentYear}-S1`;
        }
    }

    // Fallback por defecto a mensual
    const fallbackDate = subMonths(date, 1);
    return format(fallbackDate, 'yyyy-MM');
};


export const getDueDate = (client: Pick<Client, 'ruc' | 'regime' | 'category'>, referenceDate: Date): Date | null => {
  const ninthDigit = getNinthDigit(client.ruc);
  if (ninthDigit === -1 || !(ninthDigit in SRI_DUE_DATES)) {
    return null;
  }
  const day = SRI_DUE_DATES[ninthDigit];
  
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
};

export const getAnnualIncomeTaxDueDate = (client: Pick<Client, 'ruc' | 'regime'>, declarationYear: number): Date | null => {
    const ninthDigit = getNinthDigit(client.ruc);
    if (ninthDigit === -1 || !(ninthDigit in SRI_DUE_DATES)) return null;
    const day = SRI_DUE_DATES[ninthDigit];
    
    let month = SRI_RENTA_GENERAL_MARCH; // Default March
    
    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        month = SRI_RENTA_NP_MAY; // May
    } else if (client.regime === TaxRegime.RimpeEmprendedor) {
        month = 3; // April (0-indexed 3 is April)
    }
    
    return new Date(declarationYear + 1, month, day);
};

export const getAnexoDueDate = (declarationYear: number): Date => {
  return new Date(declarationYear + 1, 1, 28); 
};


export const getDaysUntilDue = (dueDate: Date | null): number | null => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dueDate);
  target.setHours(0,0,0,0);
  return differenceInCalendarDays(target, today);
}

export const formatPeriodForDisplay = (period: string): string => {
    if (!period) return 'N/A';
    if (period.length === 4) { // Annual
        return `Renta ${period}`;
    }
    if (period.includes('-S')) { // Semestral
        const [year, semester] = period.split('-S');
        const semesterText = semester === '1' ? '1er Sem.' : '2do Sem.';
        return `IVA ${semesterText} ${year}`;
    }
    if (period.includes('-')) { // Monthly
        const [year, month] = period.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthName = format(date, 'LLL', { locale: es }).replace('.', '').toUpperCase();
        return `${monthName} ${year}`;
    }
    return period;
};

export const getNextPeriod = (period: string): string => {
    if (!period) return '';
    if (period.includes('-S')) {
        const [yearStr, semester] = period.split('-S');
        const year = parseInt(yearStr, 10);
        if (semester === '1') {
            return `${year}-S2`;
        } else {
            return `${year + 1}-S1`;
        }
    }
    if (period.length === 4) { // Annual
        const year = parseInt(period, 10);
        return `${year + 1}`;
    }
    if (period.includes('-')) { // Monthly
        const [yearStr, monthStr] = period.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10);
        if (month === 12) {
            month = 1;
            year += 1;
        } else {
            month += 1;
        }
        return `${year}-${month.toString().padStart(2, '0')}`;
    }
    return period;
};

export const getDueDateForPeriod = (client: Client, period: string): Date | null => {
    if (!period) return null;
    let referenceDate: Date;
    if (period.includes('-S')) {
        const [year, semester] = period.split('-S');
        if (semester === '1') {
            referenceDate = new Date(parseInt(year), 6, 1); // July 1st of same year
        } else {
            referenceDate = new Date(parseInt(year) + 1, 0, 1); // Jan 1st of next year
        }
        return getDueDate(client, referenceDate);
    } else if (period.length === 4) {
        return getAnnualIncomeTaxDueDate(client, parseInt(period, 10));
    } else if (period.includes('-')) {
        const [year, month] = period.split('-');
        if (client.category === ClientCategory.DevolucionIvaTerceraEdad) {
            return new Date(parseInt(year), parseInt(month), 0);
        }
        referenceDate = new Date(parseInt(year), parseInt(month), 1);
        return getDueDate(client, referenceDate);
    }
    return null;
}

export const getPeriodEndDate = (period: string): Date | null => {
    if (period.includes('-S')) {
        const [yearStr, semester] = period.split('-S');
        const year = parseInt(yearStr, 10);
        const month = semester === '1' ? 5 : 11; 
        return new Date(year, month + 1, 0); 
    }
    if (period.length === 4) {
        return new Date(parseInt(period, 10), 11, 31);
    }
    if (period.includes('-')) {
        const [yearStr, monthStr] = period.split('-');
        return new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0); 
    }
    return null;
};

export const isPeriodInThePast = (period: string, referenceDate: Date): boolean => {
    const periodEndDate = getPeriodEndDate(period);
    if (!periodEndDate) return false;
    const refDate = new Date(referenceDate);
    refDate.setHours(0, 0, 0, 0);
    return refDate > periodEndDate;
};

// ... (SRI Fetch Logic remains same)
export const fetchSRIPublicData = async (identifier: string): Promise<SRIPublicData | null> => {
    if (!identifier || (identifier.length !== 10 && identifier.length !== 13)) return null;
    const rucToQuery = identifier.length === 10 ? `${identifier}001` : identifier;
    
    const fetchWithTimeout = async (url: string, timeout = 3500) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    try {
        const targetUrl = `https://srienlinea.sri.gob.ec/movil-servicios/api/v1.0/contribuyente/${rucToQuery}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        const response = await fetchWithTimeout(proxyUrl);
        
        if (response.ok) {
            const data = await response.json();
            if (data && (data.razonSocial || data.nombreComercial)) {
                let activity = data.actividadEconomicaPrincipal;
                if (!activity && data.actividadesEconomicas && Array.isArray(data.actividadesEconomicas)) {
                    const mainActivity = data.actividadesEconomicas.find((a: any) => a.estado === 'A');
                    activity = mainActivity ? mainActivity.nombreActividad : data.actividadesEconomicas[0]?.nombreActividad;
                }
                let fullAddress = '';
                if (data.establecimientos && Array.isArray(data.establecimientos)) {
                    const matriz = data.establecimientos.find((e: any) => e.tipoEstablecimiento === 'MATRIZ' && e.estado === 'ABIERTO') || data.establecimientos[0];
                    if (matriz) {
                        const parts = [matriz.calle, matriz.numero, matriz.interseccion].filter(Boolean);
                        fullAddress = parts.join(' ').trim();
                    }
                }
                return {
                    name: data.razonSocial || data.nombreComercial || '',
                    status: data.estado || 'DESCONOCIDO',
                    activity: activity,
                    address: fullAddress
                };
            }
        }
    } catch (e) {
        console.log("SRI Movil API falló o timeout, intentando método alternativo...");
    }
    return null;
};
