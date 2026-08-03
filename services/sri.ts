
import { SRI_DUE_DATES, SRI_RENTA_GENERAL_MARCH, SRI_RENTA_NP_MAY } from '../constants';
import { Client, TaxRegime, Declaration, DeclarationStatus } from '../types';
import { format, differenceInCalendarDays, subMonths, subYears, getYear, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from './db';

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

/**
 * Genera un link de WhatsApp manejando códigos internacionales y prefijos.
 * Si el número ya tiene +, lo deja como está (limpiando otros caracteres).
 * Si no tiene +, aplica lógica inteligente.
 */
export const getWhatsAppUrl = (phone: string, message?: string): string => {
    if (!phone) return '#';
    
    // Si ya tiene +, asumimos que el usuario sabe lo que hace
    if (phone.includes('+')) {
        const cleanPhone = phone.replace(/[^+0-9]/g, '');
        const baseUrl = `https://wa.me/${cleanPhone.replace('+', '')}`;
        return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
    }

    let cleanPhone = phone.replace(/\D/g, ''); 
    
    // Si empieza con 51, es Perú, no tocamos el prefijo
    if (cleanPhone.startsWith('51') && cleanPhone.length >= 11) {
        // Ya tiene el código de Perú
    } else if (cleanPhone.startsWith('593')) {
        // Ya tiene el código de Ecuador
    } else if (cleanPhone.startsWith('0')) {
        // Número local Ecuador (ej: 09...) -> 5939...
        cleanPhone = '593' + cleanPhone.substring(1);
    } else {
        // Default a Ecuador si no tiene nada claro
        cleanPhone = '593' + cleanPhone;
    }

    const baseUrl = `https://wa.me/${cleanPhone}`;
    return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
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
 * Lógica Central de Periodos (Actualizada: Prioridad Mensual/Semestral vía TaxProfile)
 */
export const getPeriod = (client: Pick<Client, 'taxProfile' | 'regime' | 'declarations'>, date: Date, overrideFrequency?: 'Mensual' | 'Semestral' | 'Ninguno' | 'Anual' | 'all'): string => {
    const currentYear = getYear(date);
    const prevYearStr = (currentYear - 1).toString();
    const month = getMonth(date); // 0-11

    // 1. REGLA: Si es RIMPE Negocio Popular, la obligación principal SIEMPRE es Anual.
    if (client.regime === TaxRegime.RimpeNegocioPopular || overrideFrequency === 'Anual') {
        return prevYearStr;
    }

    // 2. REGLA: Uso de TaxProfile (ivaFrequency) u override
    let ivaFreq = overrideFrequency || client.taxProfile?.ivaFrequency || 'Mensual';
    if (ivaFreq === 'all') ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';

    if (ivaFreq === 'Semestral') {
        // Habilitar un mes antes del vencimiento oficial (Junio para S1, Diciembre para S2)
        if (month === 5) {
            return `${currentYear}-S1`;
        }
        if (month === 11) {
            return `${currentYear}-S2`;
        }
        if (month < 5) { // Ene-May
            return `${currentYear - 1}-S2`;
        } else { // Jul-Nov
            return `${currentYear}-S1`;
        }
    }

    if (ivaFreq === 'Mensual') {
        const declarationMonth = subMonths(date, 1);
        return format(declarationMonth, 'yyyy-MM');
    }

    // Default Fallback
    if (client.regime === TaxRegime.RimpeEmprendedor) {
        if (month === 5) return `${currentYear}-S1`;
        if (month === 11) return `${currentYear}-S2`;
        if (month < 5) return `${currentYear - 1}-S2`;
        return `${currentYear}-S1`;
    }


    // Fallback por defecto a mensual para Devoluciones u otros casos no especificados
    const fallbackDate = subMonths(date, 1);
    return format(fallbackDate, 'yyyy-MM');
};

/**
 * Determina si el cliente requiere declaraciones de IVA (Mensual/Semestral).
 * Los Negocios Populares NO requieren IVA.
 */
export const requiresIva = (client: Pick<Client, 'regime' | 'taxProfile'>): boolean => {
    if (client.regime === TaxRegime.RimpeNegocioPopular) return false;
    if (client.taxProfile?.ivaFrequency === 'Ninguno') return false;
    return true;
};


export const getDueDate = (client: Pick<Client, 'ruc' | 'regime' | 'taxProfile'>, referenceDate: Date): Date | null => {
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
    }
    // Rimpe Emprendedor also uses March, so we fall back to Default March

    return new Date(declarationYear + 1, month, day);
};

export const getAnexoDueDate = (declarationYear: number): Date => {
    return new Date(declarationYear + 1, 1, 28);
};


export const getDaysUntilDue = (dueDate: Date | null): number | null => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);
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
        const monthName = (format(date, 'LLL', { locale: es }) || '').replace('.', '').toUpperCase();
        
        // Specifier for different forms if encoded in period or context
        if (period.includes(':ICE')) return `ICE ${monthName} ${year}`;
        if (period.includes(':ANEXO_ICE')) return `Anexo ICE ${monthName} ${year}`;
        
        return `${monthName} ${year}`;
    }
    if (period.includes(':PVP')) return `Anexo PVP ${period.split(':')[0]}`;
    return period;
};

/**
 * Formatea una fecha de manera segura evitando el error "Invalid time value"
 */
export const safeFormat = (dateInput: any, formatStr: string, options?: any): string => {
    try {
        if (!dateInput) return 'N/A';
        
        let date: Date;
        if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'string') {
            // Manejar fechas ISO y fechas simples YYYY-MM-DD
            if (dateInput.length === 10 && dateInput.includes('-')) {
                date = new Date(dateInput + 'T12:00:00');
            } else {
                date = new Date(dateInput);
            }
        } else {
            return 'N/A';
        }

        if (isNaN(date.getTime())) return 'N/A';
        
        return format(date, formatStr, { locale: es, ...options });
    } catch (e) {
        return 'N/A';
    }
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
    
    // Anexo PVP: Always Jan 1st - 5th
    if (period.includes(':PVP')) {
        const year = parseInt(period.split(':')[0], 10);
        return new Date(year, 0, 5); // January 5th
    }

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
        const cleanPeriod = period.split(':')[0]; // Remove :ICE etc
        const [year, month] = cleanPeriod.split('-');
        
        // Devolución IVA Tercera Edad handle - now via taxProfile
        if (client.taxProfile?.hasActiveDevolucionIva) {
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

/**
 * Generates a localized, time-aware WhatsApp notification message for tax declarations.
 */
export const generateDeclarationWhatsAppMessage = (
    clientName: string,
    type: string,
    period: string,
    amount: number,
    isPaid: boolean
): string => {
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Buen día';
    if (hour >= 12 && hour < 19) greeting = 'Buenas tardes';
    else if (hour >= 19 || hour < 5) greeting = 'Buenas noches';

    const name = clientName.split(' ')[0];
    const formattedPeriod = formatPeriodForDisplay(period);
    
    let msg = `¡Hola ${name}! 👋 ${greeting}. Le saludo de SantiagoCordova.com. Le informo que su obligación de ${type} correspondiente a ${formattedPeriod} ya ha sido procesada con éxito en el SRI. Adjunto el comprobante de la declaración.\n\n`;
    
    if (isPaid) {
        msg += `El cobro de honorarios por este trámite se encuentra pagado. ¡Muchas gracias por su puntualidad!`;
    } else if (amount > 0) {
        msg += `El valor total de honorarios es de $${amount.toFixed(2)}. Puede realizar el pago por transferencia o depósito.\n\n¡Muchas gracias por su confianza!`;
    } else {
        msg += `¡Muchas gracias por su confianza!`;
    }
    
    return msg;
};

/**
 * Descarga de manera robusta un archivo guardado (PDF, imagen, etc.) 
 * Soportando Blob URLs, URLs externas (HTTP/HTTPS), Data URLs, Base64 y fragmentación en la nube (__SPLIT__:).
 */
export const downloadStoredFile = async (fileObj: any, defaultName: string = 'comprobante.pdf'): Promise<boolean> => {
    if (!fileObj) return false;

    try {
        let fileName = fileObj.name || defaultName;
        let content = fileObj.content || fileObj.url || (typeof fileObj === 'string' ? fileObj : null);

        // Si el archivo está dividido (__SPLIT__:) en la base de datos/nube, reensamblarlo
        if (content && (content.startsWith('__SPLIT__:') || content.startsWith('__SPLIT__Solid'))) {
            try {
                const resolved = await db.rejoinLargeFiles({ content, proof_file: fileObj });
                if (resolved) {
                    if (resolved.content && !resolved.content.startsWith('__SPLIT__:')) {
                        content = resolved.content;
                    } else if (resolved.proof_file?.content && !resolved.proof_file.content.startsWith('__SPLIT__:')) {
                        content = resolved.proof_file.content;
                    }
                }
            } catch (err) {
                console.error("Error al reensamblar archivo grande desde la nube:", err);
            }
        }

        if (!content || typeof content !== 'string' || content.startsWith('__SPLIT__:')) {
            console.error("Contenido de archivo no disponible o corrupto");
            return false;
        }

        // Caso 1: Es una URL HTTP, HTTPS o Blob directamente
        if (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('blob:')) {
            const a = document.createElement('a');
            a.href = content;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return true;
        }

        // Caso 2: Es Data URL o Base64
        let base64Data = content;
        let mimeType = 'application/pdf';

        if (content.startsWith('data:')) {
            const parts = content.split(';');
            mimeType = parts[0].replace('data:', '') || 'application/pdf';
            base64Data = content.substring(content.indexOf(',') + 1);
        }

        // Limpiar espacios, saltos de línea y formateo inválido
        base64Data = base64Data.trim().replace(/[\r\n\s]/g, '');
        
        // Corregir relleno Base64 (padding '=') si faltara
        while (base64Data.length % 4 !== 0) {
            base64Data += '=';
        }

        // Decodificar binary string
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
        return true;
    } catch (err) {
        console.error("Error al descargar archivo guardado:", err);
        return false;
    }
};

export interface SriClaveValidationResult {
    isValid: boolean;
    clave: string;
    fechaEmision?: string;
    tipoComprobante?: string;
    tipoComprobanteNombre?: string;
    rucEmisor?: string;
    ambiente?: 'Pruebas' | 'Producción';
    serie?: string;
    secuencial?: string;
    codigoNumerico?: string;
    digitoVerificadorCalculado?: string;
    digitoVerificadorReal?: string;
    errorReason?: string;
}

export const validateSriClaveAcceso = (clave: string): SriClaveValidationResult => {
    const clean = (clave || '').replace(/\D/g, '');
    if (clean.length !== 49) {
        return {
            isValid: false,
            clave: clean,
            errorReason: `Longitud incorrecta: posee ${clean.length} dígitos. La Clave de Acceso SRI debe contener exactamente 49 dígitos.`
        };
    }

    const clave48 = clean.substring(0, 48);
    const digitoReal = clean.substring(48, 49);

    let peso = 2;
    let suma = 0;
    for (let i = clave48.length - 1; i >= 0; i--) {
        suma += parseInt(clave48[i], 10) * peso;
        peso++;
        if (peso > 7) peso = 2;
    }
    const residuo = suma % 11;
    let digitoCalculado = 11 - residuo;
    if (digitoCalculado === 11) digitoCalculado = 0;
    if (digitoCalculado === 10) digitoCalculado = 1;

    const isValid = String(digitoCalculado) === digitoReal;

    const day = clean.substring(0, 2);
    const month = clean.substring(2, 4);
    const year = clean.substring(4, 8);
    const tipo = clean.substring(8, 10);
    const ruc = clean.substring(10, 23);
    const amb = clean.substring(23, 24);
    const estab = clean.substring(24, 27);
    const pto = clean.substring(27, 30);
    const sec = clean.substring(30, 39);
    const codNum = clean.substring(39, 47);

    const tiposMap: Record<string, string> = {
        '01': 'Factura Electrónica',
        '04': 'Nota de Crédito',
        '05': 'Nota de Débito',
        '06': 'Guía de Remisión',
        '07': 'Comprobante de Retención'
    };

    return {
        isValid,
        clave: clean,
        fechaEmision: `${day}/${month}/${year}`,
        tipoComprobante: tipo,
        tipoComprobanteNombre: tiposMap[tipo] || `Comprobante Tipo ${tipo}`,
        rucEmisor: ruc,
        ambiente: amb === '1' ? 'Pruebas' : 'Producción',
        serie: `${estab}-${pto}`,
        secuencial: sec,
        codigoNumerico: codNum,
        digitoVerificadorCalculado: String(digitoCalculado),
        digitoVerificadorReal: digitoReal,
        errorReason: isValid ? undefined : `El dígito verificador (${digitoReal}) no coincide con el calculado (${digitoCalculado}) por Módulo 11.`
    };
};

