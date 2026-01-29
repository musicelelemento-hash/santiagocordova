
import { isWeekend, getYear, format, addDays, getDay, addMonths, subMonths, setMonth, setYear, setDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaxRegime, Client, ClientCategory } from '../types';
import { SRI_DUE_DATES } from '../constants';

export interface TaxDeadline {
    obligation: string;
    periodDescription: string;
    deadline: Date;
    isAdjusted: boolean; 
    status: 'future' | 'current' | 'overdue';
    periodKey: string;
    priority: 'high' | 'medium' | 'low';
}

const getNinthDigit = (ruc: string): number => {
    if (!ruc || ruc.length < 10) return 0; 
    const char = ruc.length === 13 ? ruc.charAt(8) : ruc.charAt(9); 
    return parseInt(char, 10);
};

const getNextBusinessDay = (date: Date): Date => {
    let current = new Date(date);
    while (isWeekend(current)) {
        current = addDays(current, 1);
    }
    return current;
};

const getDeadlineDate = (year: number, month: number, ninthDigit: number): { date: Date, isAdjusted: boolean } => {
    const day = SRI_DUE_DATES[ninthDigit] || 28;
    // Month is 0-indexed in JS Date (0 = Jan, 2 = March, 4 = May)
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
    today.setHours(0,0,0,0);
    const currentYear = getYear(today);
    const deadlines: TaxDeadline[] = [];

    // --- 1. IMPUESTO A LA RENTA (ANUAL) ---
    // Regla de Negocio:
    // - General / Rimpe Emprendedor -> Marzo (Month 2)
    // - Rimpe Negocio Popular -> Mayo (Month 4)
    
    let rentaMonth = 2; // Marzo
    let rentaLabel = 'Impuesto a la Renta';
    let priority: 'high' | 'medium' = 'high';

    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        rentaMonth = 4; // Mayo
        rentaLabel = 'Renta RIMPE Popular (Cuota Fija)';
        priority = 'medium'; // Menos urgente que el IVA mensual usualmente, pero importante en Mayo
    } else {
        rentaLabel = 'Impuesto a la Renta (Global)';
    }

    // Calculamos para el año actual (se declara el año anterior)
    // Ej: En 2025 declaramos 2024.
    const { date: rentaDate, isAdjusted: rentaAdj } = getDeadlineDate(currentYear, rentaMonth, ninthDigit);
    const rentaPeriodKey = (currentYear - 1).toString();

    // Solo mostramos si la fecha es futura o reciente (últimos 30 días)
    if (rentaDate >= subMonths(today, 1)) {
        deadlines.push({
            obligation: rentaLabel,
            periodDescription: `Ejercicio Fiscal ${currentYear - 1}`,
            deadline: rentaDate,
            isAdjusted: rentaAdj,
            status: rentaDate < today ? 'overdue' : 'future',
            periodKey: rentaPeriodKey,
            priority: priority
        });
    }

    // --- 2. IVA (Mensual o Semestral) ---
    // Regla: Negocio Popular NO declara IVA (generalmente), solo Renta.
    if (client.regime !== TaxRegime.RimpeNegocioPopular) {
        
        const isSemestral = client.category.includes('Semestral') || client.regime === TaxRegime.RimpeEmprendedor;
        const isMonthly = !isSemestral; // Por defecto mensual si no es semestral ni popular puro

        if (isMonthly) {
            // Próximos 3 meses
            for (let i = 0; i < 3; i++) {
                const futureDate = addMonths(today, i);
                // La declaración es del mes anterior. 
                // Ej: Estamos en Agosto (Month 7), declaramos Julio (Month 6) en Agosto.
                // Fecha límite es en el mes actual `futureDate`
                const decMonth = futureDate.getMonth(); 
                const decYear = futureDate.getFullYear();
                
                const { date, isAdjusted } = getDeadlineDate(decYear, decMonth, ninthDigit);
                
                // Periodo que se declara (mes anterior)
                const declaredPeriodDate = subMonths(new Date(decYear, decMonth, 1), 1);
                const periodKey = format(declaredPeriodDate, 'yyyy-MM');
                const periodName = format(declaredPeriodDate, 'MMMM yyyy', { locale: es });

                if (date >= today) {
                    deadlines.push({
                        obligation: 'IVA Mensual',
                        periodDescription: periodName.charAt(0).toUpperCase() + periodName.slice(1),
                        deadline: date,
                        isAdjusted,
                        status: 'future',
                        periodKey: periodKey,
                        priority: 'high'
                    });
                }
            }
        } else {
            // Semestral
            // S1 (Ene-Jun) vence en Julio (Month 6)
            // S2 (Jul-Dic) vence en Enero (Month 0)
            
            // Chequear S1 del año actual
            const s1Date = getDeadlineDate(currentYear, 6, ninthDigit); // Julio
            if (s1Date.date >= today) {
                 deadlines.push({
                    obligation: 'IVA Semestral',
                    periodDescription: `1er Semestre ${currentYear}`,
                    deadline: s1Date.date,
                    isAdjusted: s1Date.isAdjusted,
                    status: 'future',
                    periodKey: `${currentYear}-S1`,
                    priority: 'medium'
                });
            }
            
            // Chequear S2 del año anterior (Vence Enero actual) o S2 actual (Vence Enero prox)
            const s2PrevDate = getDeadlineDate(currentYear, 0, ninthDigit); // Enero
            if (s2PrevDate.date >= subDays(today, 15)) { // Mostrar si venció hace poco
                 deadlines.push({
                    obligation: 'IVA Semestral',
                    periodDescription: `2do Semestre ${currentYear - 1}`,
                    deadline: s2PrevDate.date,
                    isAdjusted: s2PrevDate.isAdjusted,
                    status: s2PrevDate.date < today ? 'overdue' : 'future',
                    periodKey: `${currentYear - 1}-S2`,
                    priority: 'medium'
                });
            }
        }
    }

    // Ordenar por fecha de vencimiento más próxima
    return deadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
};

function subDays(date: Date, amount: number): Date {
    return new Date(date.getTime() - amount * 24 * 60 * 60 * 1000);
}
