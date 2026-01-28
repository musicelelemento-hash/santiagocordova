
import { isWeekend, getYear, format, addDays, getDay, addMonths, setMonth, setYear, setDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaxRegime, Client, ClientCategory } from '../types';
import { SRI_DUE_DATES } from '../constants';

export interface TaxDeadline {
    obligation: string;
    periodDescription: string;
    deadline: Date;
    isAdjusted: boolean; 
    status: 'future' | 'current' | 'overdue';
    periodKey: string; // Added for linking with history
}

const getNinthDigit = (ruc: string): number => {
    if (!ruc || ruc.length < 10) return 0; 
    const char = ruc.length === 13 ? ruc.charAt(8) : ruc.charAt(9); // 9th digit logic
    return parseInt(char, 10);
};

const getNextBusinessDay = (date: Date): Date => {
    let current = new Date(date);
    while (isWeekend(current)) {
        current = addDays(current, 1);
    }
    return current;
};

// Generates the deadline date based on the 9th digit rule
const getDeadlineDate = (year: number, month: number, ninthDigit: number): { date: Date, isAdjusted: boolean } => {
    const day = SRI_DUE_DATES[ninthDigit] || 28;
    const rawDate = new Date(year, month, day);
    const businessDate = getNextBusinessDay(rawDate);
    return {
        date: businessDate,
        isAdjusted: rawDate.getTime() !== businessDate.getTime()
    };
};

export const calculateTaxDeadlines = (client: Client): TaxDeadline[] => {
    if (!client.ruc || client.ruc.length < 10) return [];

    const ninthDigit = getNinthDigit(client.ruc);
    const today = new Date();
    const currentYear = getYear(today);
    const deadlines: TaxDeadline[] = [];

    // --- 1. INCOME TAX (RENTA) ---
    let rentaMonth = 2; // March (0-indexed)
    let rentaLabel = 'Impuesto a la Renta (Anual)';
    
    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        rentaMonth = 4; // May
        rentaLabel = 'Impuesto a la Renta (Cuota Fija)';
    } else if (client.regime === TaxRegime.RimpeEmprendedor) {
        rentaMonth = 2; // March
        rentaLabel = 'Impuesto a la Renta RIMPE';
    }

    // Check next 2 years of Rentas
    [currentYear, currentYear + 1].forEach(year => {
        const { date, isAdjusted } = getDeadlineDate(year, rentaMonth, ninthDigit);
        const periodKey = (year - 1).toString(); // Tax period is previous year
        
        if (date > today) {
            deadlines.push({
                obligation: rentaLabel,
                periodDescription: `Ejercicio Fiscal ${year - 1}`,
                deadline: date,
                isAdjusted,
                status: 'future',
                periodKey: periodKey
            });
        }
    });

    // --- 2. IVA (Monthly or Semestral) ---
    const isMonthly = client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad;
    const isSemestral = client.category.includes('Semestral') || client.regime === TaxRegime.RimpeEmprendedor; 

    if (isMonthly) {
        // Generate next 6 months
        for (let i = 0; i < 6; i++) {
            const futureDate = addMonths(today, i);
            const declarationMonth = futureDate.getMonth();
            const declarationYear = futureDate.getFullYear();
            
            const { date, isAdjusted } = getDeadlineDate(declarationYear, declarationMonth, ninthDigit);
            
            const prevDate = new Date(declarationYear, declarationMonth - 1, 1);
            const periodName = format(prevDate, 'MMMM yyyy', { locale: es });
            const periodKey = format(prevDate, 'yyyy-MM');

            if (date >= today) {
                deadlines.push({
                    obligation: 'Declaración IVA Mensual',
                    periodDescription: periodName.charAt(0).toUpperCase() + periodName.slice(1),
                    deadline: date,
                    isAdjusted,
                    status: 'future',
                    periodKey: periodKey
                });
            }
        }
    } else if (isSemestral) {
        // Check S1 Current Year
        const s1Date = getDeadlineDate(currentYear, 6, ninthDigit); // July
        if (s1Date.date >= today) {
            deadlines.push({ 
                obligation: 'IVA Semestral', 
                periodDescription: `1er Semestre ${currentYear}`, 
                deadline: s1Date.date, 
                isAdjusted: s1Date.isAdjusted,
                status: 'future',
                periodKey: `${currentYear}-S1`
            });
        }

        // Check S2 Current Year (Due Jan Next Year)
        const s2Date = getDeadlineDate(currentYear + 1, 0, ninthDigit); // Jan next year
        if (s2Date.date >= today) {
             deadlines.push({ 
                obligation: 'IVA Semestral', 
                periodDescription: `2do Semestre ${currentYear}`, 
                deadline: s2Date.date, 
                isAdjusted: s2Date.isAdjusted,
                status: 'future',
                periodKey: `${currentYear}-S2`
            });
        }
    }

    // --- 3. ANEXOS (Gastos Personales) ---
    [currentYear, currentYear + 1].forEach(year => {
        const anexoDate = getDeadlineDate(year, 1, ninthDigit); // Feb
        if (anexoDate.date >= today) {
             deadlines.push({
                obligation: 'Anexo Gastos Personales',
                periodDescription: `Proyección ${year - 1}`,
                deadline: anexoDate.date,
                isAdjusted: anexoDate.isAdjusted,
                status: 'future',
                periodKey: `ANEXO-${year-1}` // Artificial key for task matching if needed
            });
        }
    });

    return deadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime()).slice(0, 6);
};
