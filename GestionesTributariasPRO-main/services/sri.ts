
import { SRI_DUE_DATES, SRI_RENTA_GENERAL_MARCH, SRI_RENTA_NP_MAY } from '../constants';
import { Client, ClientCategory, TaxRegime, Declaration } from '../types';
import { format, differenceInCalendarDays, subMonths, subYears } from 'date-fns';
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
  return parseInt(identifier[8], 10);
};

export const validateSriPassword = (password: string): { isValid: boolean, criteria: Record<string, boolean> } => {
    const criteria = {
        length: password.length >= 10,
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

export const getPeriod = (client: Pick<Client, 'category' | 'regime'>, date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        // Annual declaration is for the previous year. In 2024 we declare 2023.
        const declarationYear = subYears(date, 1);
        return format(declarationYear, 'yyyy');
    }
    if (client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad) {
        // Monthly declaration is for the previous month. In November we declare October.
        const declarationMonth = subMonths(date, 1);
        return format(declarationMonth, 'yyyy-MM');
    }
    if (client.category.includes('Semestral')) {
        // S1 (Jan-Jun) is declared in July. S2 (Jul-Dec) is declared in Jan of next year.
        // If we are in Jan-Jun, the pending declaration is for S2 of the previous year.
        // If we are in Jul-Dec, the pending declaration is for S1 of the current year.
        if (month < 6) { // Currently in Jan-Jun
            return `${year - 1}-S2`;
        } else { // Currently in Jul-Dec
            return `${year}-S1`;
        }
    }
    // Fallback for any other case - this shouldn't be hit with current types
    const fallbackDate = subMonths(date, 1);
    return format(fallbackDate, 'yyyy-MM');
};


export const getDueDate = (client: Pick<Client, 'ruc' | 'regime' | 'category'>, referenceDate: Date): Date | null => {
  const ninthDigit = getNinthDigit(client.ruc);
  if (ninthDigit === -1 || !(ninthDigit in SRI_DUE_DATES)) {
    return null;
  }
  const day = SRI_DUE_DATES[ninthDigit];
  
  // This function is for IVA (monthly/semestral) based on a reference date.
  // The reference date's month and year are used to construct the due date.
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
};

export const getAnnualIncomeTaxDueDate = (client: Pick<Client, 'ruc' | 'regime'>, declarationYear: number): Date | null => {
    const ninthDigit = getNinthDigit(client.ruc);
    if (ninthDigit === -1 || !(ninthDigit in SRI_DUE_DATES)) return null;
    const day = SRI_DUE_DATES[ninthDigit];
    
    const month = client.regime === TaxRegime.RimpeNegocioPopular 
        ? SRI_RENTA_NP_MAY 
        : SRI_RENTA_GENERAL_MARCH;
    
    // Declaration for 'declarationYear' is due in 'declarationYear + 1'
    return new Date(declarationYear + 1, month, day);
};

export const getAnexoDueDate = (declarationYear: number): Date => {
  // Anexo is due before the Renta declaration, typically in February. Month is 0-indexed.
  return new Date(declarationYear + 1, 1, 28); // February 28th
};


export const getDaysUntilDue = (dueDate: Date | null): number | null => {
  if (!dueDate) return null;
  const today = new Date();
  return differenceInCalendarDays(dueDate, today);
}
export const formatPeriodForDisplay = (period: string): string => {
    if (period.length === 4) { // Annual, e.g. '2024'
        return `Renta ${period}`;
    }
    if (period.includes('-S')) { // Semestral, e.g. '2024-S1'
        const [year, semester] = period.split('-S');
        const semesterText = semester === '1' ? '1er Sem.' : '2do Sem.';
        return `IVA ${semesterText} ${year}`;
    }
    if (period.includes('-')) { // Monthly, e.g. '2024-07'
        const [year, month] = period.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthName = format(date, 'LLL', { locale: es }).replace('.', '').toUpperCase();
        return `${monthName} IVA ${year}`;
    }
    return period;
};

export const getNextPeriod = (period: string): string => {
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
    return period; // Fallback
};

export const getDueDateForPeriod = (client: Client, period: string): Date | null => {
    let referenceDate: Date;
    if (period.includes('-S')) {
        const [year, semester] = period.split('-S');
        if (semester === '1') {
            referenceDate = new Date(parseInt(year), 6, 1); // July 1st
        } else {
            referenceDate = new Date(parseInt(year) + 1, 0, 1); // Jan 1st of next year
        }
        return getDueDate(client, referenceDate);
    } else if (period.length === 4) {
        return getAnnualIncomeTaxDueDate(client, parseInt(period, 10));
    } else if (period.includes('-')) {
        const [year, month] = period.split('-');
        if (client.category === ClientCategory.DevolucionIvaTerceraEdad) {
            // Internal due date: last day of the month following the period
            return new Date(parseInt(year), parseInt(month), 0);
        }
        // Due date is in the next month for standard IVA
        referenceDate = new Date(parseInt(year), parseInt(month), 1);
        return getDueDate(client, referenceDate);
    }
    return null;
}

export const getPeriodEndDate = (period: string): Date | null => {
    if (period.includes('-S')) {
        const [yearStr, semester] = period.split('-S');
        const year = parseInt(yearStr, 10);
        // Semester 1 (Jan-Jun) ends June 30th. Semester 2 (Jul-Dec) ends Dec 31st.
        const month = semester === '1' ? 5 : 11; // 0-indexed month
        return new Date(year, month + 1, 0); // Last day of the month
    }
    if (period.length === 4) { // Annual
        return new Date(parseInt(period, 10), 11, 31);
    }
    if (period.includes('-')) { // Monthly
        const [yearStr, monthStr] = period.split('-');
        return new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0); // Day 0 of next month is last day of current
    }
    return null;
};

export const isPeriodInThePast = (period: string, referenceDate: Date): boolean => {
    const periodEndDate = getPeriodEndDate(period);
    if (!periodEndDate) return false;
    const refDate = new Date(referenceDate); // Avoid mutating original
    refDate.setHours(0, 0, 0, 0);
    return refDate > periodEndDate;
};

// --- SRI API FETCH LOGIC ---

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

    // ESTRATEGIA 1: API MÓVIL (Rica en datos: Actividad, Dirección)
    try {
        // Esta URL es utilizada por la app móvil del SRI y suele devolver datos detallados
        const targetUrl = `https://srienlinea.sri.gob.ec/movil-servicios/api/v1.0/contribuyente/${rucToQuery}`;
        // Usamos un proxy CORS de alto rendimiento
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        const response = await fetchWithTimeout(proxyUrl);
        
        if (response.ok) {
            const data = await response.json();
            // Validamos que haya nombre, lo mínimo necesario
            if (data && (data.razonSocial || data.nombreComercial)) {
                
                // Extracción de Actividad Económica
                let activity = data.actividadEconomicaPrincipal;
                if (!activity && data.actividadesEconomicas && Array.isArray(data.actividadesEconomicas)) {
                    // Si no está en el campo principal, buscamos en el array
                    const mainActivity = data.actividadesEconomicas.find((a: any) => a.estado === 'A'); // Activa
                    activity = mainActivity ? mainActivity.nombreActividad : data.actividadesEconomicas[0]?.nombreActividad;
                }

                // Extracción de Dirección Fiscal (Establecimiento Matriz)
                let fullAddress = '';
                if (data.establecimientos && Array.isArray(data.establecimientos)) {
                    const matriz = data.establecimientos.find((e: any) => e.tipoEstablecimiento === 'MATRIZ' && e.estado === 'ABIERTO') || data.establecimientos[0];
                    if (matriz) {
                        // Construimos la dirección con los campos disponibles
                        const parts = [
                            matriz.calle,
                            matriz.numero,
                            matriz.interseccion
                        ].filter(Boolean); // Eliminamos null/undefined/vacíos
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

    // ESTRATEGIA 2: API WEB (Respaldo, menos datos)
    try {
        const targetUrl = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/existePorNumeroRuc?numeroRuc=${rucToQuery}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const response = await fetchWithTimeout(proxyUrl);
        
        if (response.ok) {
            const data = await response.json();
            if (data && (data.razonSocial || data.nombreComercial)) {
                return {
                    name: data.razonSocial || data.nombreComercial || '',
                    status: data.estadoPersona?.estadoPersona || undefined,
                    activity: data.actividadEconomicaPrincipal,
                    // La API Web standard a veces no trae la dirección detallada en este endpoint ligero
                };
            }
        }
    } catch (error) {
        console.warn("SRI Auto-fill all strategies failed:", error);
    }
    
    return null;
};
