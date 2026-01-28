
import { isWeekend, getYear, format, addDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaxRegime, Client } from '../types';
import { SRI_DUE_DATES } from '../constants';

export interface TaxDeadline {
    obligation: string;
    periodDescription: string;
    deadline: Date;
    isAdjusted: boolean; 
}

const getNinthDigit = (ruc: string): number => {
    if (!ruc || ruc.length < 10 || isNaN(Number(ruc))) return 0; 
    return parseInt(ruc.charAt(8), 10);
};

const getNextMonday = (date: Date): Date => {
    const day = getDay(date);
    const daysToAdd = day === 0 ? 1 : (day === 6 ? 2 : 0);
    return addDays(date, daysToAdd);
};

const adjustToBusinessDay = (date: Date): { date: Date; adjusted: boolean } => {
    if (isWeekend(date)) {
        return { date: getNextMonday(date), adjusted: true };
    }
    return { date, adjusted: false };
};

export const calculateTaxDeadlines = (client: Client): TaxDeadline[] => {
    const { ruc, regime, category, accountingObligated } = client;
    
    if (ruc.length === 10) {
        return []; 
    }

    const ninthDigit = getNinthDigit(ruc);
    const baseDay = SRI_DUE_DATES[ninthDigit] || 28;
    const currentYear = getYear(new Date());
    const deadlines: TaxDeadline[] = [];

    if (regime === TaxRegime.RimpeNegocioPopular) {
        const rentaDate = new Date(currentYear, 4, baseDay); 
        const adjustedRenta = adjustToBusinessDay(rentaDate);
        deadlines.push({
            obligation: 'Impuesto a la Renta (Cuota Fija)',
            periodDescription: `Ejercicio Fiscal ${currentYear - 1}`,
            deadline: adjustedRenta.date,
            isAdjusted: adjustedRenta.adjusted
        });
        return deadlines;
    }

    const isSemestral = category.includes('Semestral');
    const isMonthly = category.includes('Mensual');

    if (isMonthly) {
        for (let month = 0; month < 12; month++) {
            let dueMonth = month + 1;
            let dueYear = currentYear;
            if (dueMonth > 11) { dueMonth = 0; dueYear = currentYear + 1; }

            const baseDate = new Date(dueYear, dueMonth, baseDay);
            const { date, adjusted } = adjustToBusinessDay(baseDate);
            const monthName = format(new Date(currentYear, month, 1), 'MMMM', { locale: es });

            deadlines.push({
                obligation: 'Declaración IVA Mensual',
                periodDescription: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentYear}`,
                deadline: date,
                isAdjusted: adjusted
            });
        }
        
        if (accountingObligated) {
             for (let month = 0; month < 12; month++) {
                let dueMonth = month + 1;
                let dueYear = currentYear;
                if (dueMonth > 11) { dueMonth = 0; dueYear = currentYear + 1; }

                const baseDate = new Date(dueYear, dueMonth, baseDay);
                const { date, adjusted } = adjustToBusinessDay(baseDate);
                const monthName = format(new Date(currentYear, month, 1), 'MMMM', { locale: es });

                deadlines.push({
                    obligation: 'Retenciones en la Fuente',
                    periodDescription: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentYear}`,
                    deadline: date,
                    isAdjusted: adjusted
                });
            }
        }
    } 
    else if (isSemestral) {
        const sem1Date = adjustToBusinessDay(new Date(currentYear, 6, baseDay)); 
        deadlines.push({ obligation: 'IVA Semestral', periodDescription: '1er Semestre (Ene-Jun)', deadline: sem1Date.date, isAdjusted: sem1Date.adjusted });

        const sem2Date = adjustToBusinessDay(new Date(currentYear + 1, 0, baseDay)); 
        deadlines.push({ obligation: 'IVA Semestral', periodDescription: '2do Semestre (Jul-Dic)', deadline: sem2Date.date, isAdjusted: sem2Date.adjusted });
    }

    if (regime === TaxRegime.General) {
        const anexoDate = adjustToBusinessDay(new Date(currentYear, 1, baseDay)); 
        deadlines.push({
            obligation: 'Anexo Gastos Personales',
            periodDescription: `Ejercicio ${currentYear - 1}`,
            deadline: anexoDate.date,
            isAdjusted: anexoDate.adjusted
        });

        const rentaDate = adjustToBusinessDay(new Date(currentYear, 2, baseDay)); 
        deadlines.push({
            obligation: 'Impuesto a la Renta (Anual)',
            periodDescription: `Ejercicio ${currentYear - 1}`,
            deadline: rentaDate.date,
            isAdjusted: rentaDate.adjusted
        });
    }

    if (regime === TaxRegime.RimpeEmprendedor) {
        const rentaDate = adjustToBusinessDay(new Date(currentYear, 4, baseDay)); 
        deadlines.push({
            obligation: 'Impuesto a la Renta RIMPE',
            periodDescription: `Ejercicio ${currentYear - 1}`,
            deadline: rentaDate.date,
            isAdjusted: rentaDate.adjusted
        });
    }

    return deadlines;
};
