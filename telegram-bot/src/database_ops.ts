import { supabase } from './supabase';
import crypto from 'crypto';
import { getFirestore } from './firebase-admin-init';

async function logAuditAction(action: string, details: string, type: string, severity: string) {
    try {
        await supabase.from('audit_logs').insert({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action,
            details,
            type,
            severity
        });
    } catch (e) {
        console.error("Failed to log audit action:", e);
    }
}

export async function findClients(query: string, selectFields: string) {
    const { data: rawClients, error } = await supabase
        .from('clients')
        .select(selectFields)
        .eq('is_deleted', false);
    if (error) throw error;
    const clients = rawClients as any[] | null;
    if (!clients) return [];
    
    const queryLower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const parts = queryLower.split(' ').filter(p => p.length > 0);
    
    return clients.filter((c: any) => {
        const nameMatch = c.name ? c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const tradeMatch = c.trade_name ? c.trade_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const rucMatch = c.ruc ? c.ruc : '';
        return parts.every(part => nameMatch.includes(part) || tradeMatch.includes(part) || rucMatch.includes(part));
    });
}

export interface ClientObligationsInfo {
    regime: string;
    ivaFrequency: 'Mensual' | 'Semestral' | 'Ninguno';
    requiresAnnualRenta: boolean;
    dueDayOfMonth: number | 'N/A';
    ivaPeriodLabel: string;
    rentaPeriodLabel: string;
    obligationsDescription: string;
}

export function getClientObligations(client: any): ClientObligationsInfo {
    const regime = client.regime || 'Régimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
    const requiresAnnualRenta = client.tax_profile?.requiresAnnualRenta ?? true;
    
    const ruc = client.ruc || "";
    const ninthDigit = ruc.length >= 9 ? parseInt(ruc[8]) : -1;
    const SRI_DUE_DATES: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28 };
    const dueDayOfMonth = ninthDigit !== -1 ? SRI_DUE_DATES[ninthDigit] : 'N/A';
    
    let ivaPeriodLabel = 'N/A';
    if (ivaFrequency === 'Mensual') {
        ivaPeriodLabel = 'Mensual';
    } else if (ivaFrequency === 'Semestral') {
        ivaPeriodLabel = 'Semestral (Julio/Enero)';
    } else {
        ivaPeriodLabel = 'Exento / Ninguno';
    }
    
    let rentaPeriodLabel = requiresAnnualRenta ? 'Anual (Marzo)' : 'No requiere';
    if (isPopular && requiresAnnualRenta) {
        rentaPeriodLabel = 'Anual Simplificada (Mayo)';
    }

    let obligationsDescription = "";
    if (ivaFrequency === 'Mensual' && requiresAnnualRenta) {
        obligationsDescription = "IVA Mensual y Renta Anual";
    } else if (ivaFrequency === 'Semestral' && requiresAnnualRenta) {
        obligationsDescription = "IVA Semestral y Renta Anual";
    } else if (ivaFrequency === 'Mensual') {
        obligationsDescription = "Solo IVA Mensual";
    } else if (ivaFrequency === 'Semestral') {
        obligationsDescription = "Solo IVA Semestral";
    } else if (requiresAnnualRenta) {
        obligationsDescription = "Solo Renta Anual";
    } else {
        obligationsDescription = "Sin Obligaciones registradas";
    }

    return {
        regime,
        ivaFrequency,
        requiresAnnualRenta,
        dueDayOfMonth,
        ivaPeriodLabel,
        rentaPeriodLabel,
        obligationsDescription
    };
}

/**
 * Searches for a client by RUC or Name in the 'sc_pro_backup' collection
 */
export async function searchClient(query: string) {
    console.log(`🔍 Searching client with query: ${query}`);
    try {
        // Query '*' to avoid column 'declarations' does not exist error (actual DB column is declaration_history)
        const clients = await findClients(query, '*');

        if (!clients || clients.length === 0) {
            if (query.trim().length === 13 && /^\d+$/.test(query.trim())) {
                const backupCred = await get_sri_credential(query.trim());
                if (!backupCred.includes('❌ No se encontró')) {
                    return `⚠️ El cliente RUC ${query} no está en tu base de datos principal, pero encontré lo siguiente en la bóveda de importación rápida:\n\n${backupCred}`;
                }
            }
            return `No he podido encontrar a ningún cliente con el nombre o RUC "${query}" en la base de datos de PostgreSQL. ¿Podrías verificar el nombre?`;
        }

        const totalMatches = clients.length;
        if (totalMatches > 1) {
            let response = `He localizado ${totalMatches} expediente(s) que coinciden con tu búsqueda:\n\n`;
            clients.slice(0, 10).forEach((c: any) => {
                response += `👤 *${c.name}*\n🆔 RUC: \`${c.ruc || ''}\`${c.trade_name ? ` | Comercial: *${c.trade_name}*` : ''} | Régimen: ${c.regime || 'Régimen General'}\n\n`;
            });
            if (totalMatches > 10) response += `_... y ${totalMatches - 10} clientes más._\n\n`;
            response += `Escribe el RUC o el nombre exacto del cliente que deseas consultar en detalle. Baku.`;
            return response;
        }

        const resultsToSummarize = clients;
        let response = `He localizado el expediente en la base de datos SQL:\n\n`;

        resultsToSummarize.forEach((c: any) => {
            const ruc = c.ruc || "";
            const obligations = getClientObligations(c);
            
            // Block 1: Header / Metadata
            response += `👤 *${c.name}*\n`;
            if (c.trade_name) response += `🏢 *Comercial:* ${c.trade_name}\n`;
            response += `🆔 RUC: \`${ruc}\` | 📅 Vence: Día *${obligations.dueDayOfMonth}* de cada período\n`;
            
            if (c.email) response += `📧 *Email:* ${c.email}\n`;
            if (c.phones && c.phones.length > 0) response += `📞 *Telf:* ${c.phones.join(', ')}\n`;
            if (c.address) response += `📍 *Dirección:* ${c.address}\n`;
            if (c.economic_activity) response += `💼 *Actividad:* ${c.economic_activity}\n`;

            if (c.sri_password) response += `🔑 *Clave SRI:* ${c.sri_password}\n`;
            if (c.iess_password) response += `🔑 *Clave IESS:* ${c.iess_password}\n`;
            if (c.signature_password) response += `🔑 *Clave Firma Elec:* ${c.signature_password}\n`;
            if (c.signature_expiration) response += `⏳ *Caducidad Firma:* ${c.signature_expiration}\n`;
            if (c.sharedAccessKey) response += `🔗 *Clave Compartida:* ${c.sharedAccessKey}\n`;

            // Block 2: SRI Obligations Overview
            response += `\n⚖️ *OBLIGACIONES SRI:* ${obligations.obligationsDescription}\n`;
            response += `   • Régimen: *${obligations.regime}*\n`;
            if (obligations.ivaFrequency !== 'Ninguno') {
                response += `   • IVA: *${obligations.ivaFrequency}* (Vence el día ${obligations.dueDayOfMonth} del período siguiente)\n`;
            } else {
                response += `   • IVA: *Exento (No declara)*\n`;
            }
            response += `   • Renta: *${obligations.rentaPeriodLabel}*\n`;

            // Block 3: State of declarations and payment of fees
            let totalToPay = 0;
            let feeBreakdown = "";
            const isCortesia = (c.name || "").toLowerCase().includes("daniel cordova") || 
                               (c.name || "").toLowerCase().includes("aleida ramirez") || 
                               (c.name || "").toLowerCase().includes("ramirez aleida");
            
            const feeKey = obligations.ivaFrequency === 'Mensual' ? 'monthly' 
                           : obligations.ivaFrequency === 'Semestral' ? 'semestral' 
                           : undefined;
            const ivaFee = feeKey ? (c.fee_structure?.[feeKey] ?? (obligations.ivaFrequency === 'Semestral' ? 10 : 5)) : 0;
            const rentaFee = c.fee_structure?.annual ?? 10;
            
            const allDeclarations = c.declaration_history || [];
            
            const pendingDeclarations = allDeclarations.filter((d: any) => d.status === 'Pendiente');
            const declaredDeclarations = allDeclarations.filter((d: any) => d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file);
            
            const unpaidIva = allDeclarations.filter((d: any) => d.type === 'IVA' && !d.is_paid && (d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file));
            const unpaidRenta = allDeclarations.filter((d: any) => d.type === 'RENTA' && !d.is_paid && (d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file));

            if (unpaidIva.length > 0) {
                const sumIva = unpaidIva.length * ivaFee;
                totalToPay += sumIva;
                feeBreakdown += `$${sumIva} IVA (${unpaidIva.length} pend.) + `;
            }

            if (unpaidRenta.length > 0) {
                const sumRenta = unpaidRenta.length * rentaFee;
                totalToPay += sumRenta;
                feeBreakdown += `$${sumRenta} Renta (${unpaidRenta.length} pend.) + `;
            }

            response += `\n📑 *ESTADO DE DECLARACIONES SRI:*\n`;
            if (declaredDeclarations.length > 0) {
                const latestIva = declaredDeclarations.filter((d: any) => d.type === 'IVA').sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
                const latestRenta = declaredDeclarations.filter((d: any) => d.type === 'RENTA').sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
                if (latestIva) response += `   • Último IVA: *${latestIva.period}* → ✅ Declarado (SRI)\n`;
                if (latestRenta) response += `   • Última Renta: *${latestRenta.period}* → ✅ Declarada (SRI)\n`;
            }
            
            if (pendingDeclarations.length > 0) {
                response += `   ⚠️ *Falta Declarar al SRI:* ` + pendingDeclarations.map((d: any) => `*${d.type} ${d.period}*`).join(', ') + ` ❌\n`;
            } else {
                response += `   • SRI: ¡Todas las declaraciones al día! ✅\n`;
            }

            response += `\n💰 *HONORARIOS AL CONTADOR:*\n`;
            if (totalToPay > 0) {
                response += `   • Deuda Total: *$${totalToPay}* (${feeBreakdown.slice(0, -3)}) ❌ PENDIENTE\n`;
            } else if (isCortesia) {
                response += `   • Deuda Total: Cortesía 🎁 ✅\n`;
            } else {
                response += `   • Deuda Total: ¡Al día! ✅ Sin deudas de honorarios.\n`;
            }

            if (c.notes) response += `\n📝 _Notas:_ ${c.notes}\n`;
            response += `--------------------------\n`;
        });

        if (totalMatches > 5) {
            response += `\n*Aviso:* Hay ${totalMatches - 5} resultados adicionales. Sé más específico en tu búsqueda para ver los demás.`;
        }

        return response;
    } catch (error: any) {
        console.error("Error searching in Supabase:", error);
        return "Error al consultar la base de datos: " + error.message;
    }
}

/**
 * Gets a list of clients who have pending payments or pending declarations.
 */
export async function getDebtorClients() {
    console.log(`💸 Fetching debtor clients from Supabase...`);
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .eq('is_deleted', false);

        if (error) throw error;
        if (!clients || clients.length === 0) return "No hay clientes registrados.";
        
        let totalDebt = 0;
        const debtors: any[] = [];

        let mensalesCount = 0;
        let semestralesCount = 0;
        let popularCount = 0;
        let rentaCount = 0;

        clients.forEach(c => {
            const regime = c.regime || 'Régimen General';
            const isPopular = regime === 'Rimpe Negocio Popular';
            const isEmprendedor = regime === 'Rimpe Emprendedor';
            const ivaFreq = c.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
            
            const pendingDeclarations = c.declaration_history?.filter((d: any) => d.status === 'Pendiente') || [];
            
            const unpaidIva = c.declaration_history?.filter((d: any) => d.type === 'IVA' && !d.is_paid && (d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file)) || [];
            const unpaidRenta = c.declaration_history?.filter((d: any) => d.type === 'RENTA' && !d.is_paid && (d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file)) || [];
            
            const feeKey = ivaFreq === 'Mensual' ? 'monthly' 
                           : ivaFreq === 'Semestral' ? 'semestral' 
                           : undefined;
            const ivaFee = feeKey ? (c.fee_structure?.[feeKey] ?? (ivaFreq === 'Semestral' ? 10 : 5)) : 0;
            const rentaFee = c.fee_structure?.annual ?? 10;
            
            let clientDebt = (unpaidIva.length * ivaFee) + (unpaidRenta.length * rentaFee);

            if (clientDebt > 0 || pendingDeclarations.length > 0) {
                totalDebt += clientDebt;
                
                if (ivaFreq === 'Mensual') mensalesCount++;
                if (ivaFreq === 'Semestral') semestralesCount++;
                if (isPopular) popularCount++;
                if (c.tax_profile?.requiresAnnualRenta) rentaCount++;

                debtors.push({ 
                    ...c, 
                    clientDebt, 
                    pendingDecCount: pendingDeclarations.length, 
                    typeLabel: isPopular ? 'Popular' : (ivaFreq === 'Semestral' ? 'Semestral' : 'Mensual') 
                });
            }
        });

        if (debtors.length === 0) return "✅ Todo al día. No hay pendientes de IVA, Renta o Honorarios. Baku.";

        let response = `📊 *REPORTE FINANCIERO DE PENDIENTES:*
- Total por Cobrar: **$${totalDebt}** 💰
- IVA Mensual: ${mensalesCount}
- IVA Semestral: ${semestralesCount}
- Renta Anual: ${rentaCount}
- Negocio Popular: ${popularCount}

---
`;

        debtors.slice(0, 15).forEach((c: any) => {
            const phone = c.phones && c.phones.length > 0 ? c.phones[0] : null;
            response += `👤 *${c.name}* | \`${c.ruc}\` | ${c.typeLabel}\n`;
            if (phone) response += `   📞 ${phone}\n`;
            response += `   💼 Honorarios: ${c.clientDebt > 0 ? `$${c.clientDebt} ❌` : '✅'}\n`;
            response += `   ⚖️ Declaración SRI: ${c.pendingDecCount > 0 ? `${c.pendingDecCount} pend. ❌` : '✅'}\n`;
        });

        if (debtors.length > 15) response += `\n_...y ${debtors.length - 15} clientes más._`;


        return response;
    } catch (error: any) {
        return "Error al obtener deudores: " + error.message;
    }
}

/**
 * Calculates upcoming SRI deadlines based on the 9th digit of RUC.
 */
export async function getUpcomingDeadlines() {
    console.log(`📅 Calculating upcoming deadlines from Supabase...`);
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .eq('is_deleted', false);

        if (error) throw error;
        if (!clients || clients.length === 0) return "No hay clientes registrados.";
        const SRI_DUE_DATES: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28 };
        
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth() + 1; // 1-indexed (1: Ene, 7: Jul, etc.)
        
        const upcoming = clients.filter((c: any) => {
            const ruc = c.ruc || "";
            const ninthDigit = ruc.length >= 9 ? parseInt(ruc[8]) : -1;
            if (ninthDigit === -1) return false;
            
            const dueDay = SRI_DUE_DATES[ninthDigit];
            const isDueSoon = dueDay >= currentDay && dueDay <= currentDay + 7;
            if (!isDueSoon) return false;

            // Determine if they actually have an obligation due this month
            const regime = c.regime || 'Régimen General';
            const isPopular = regime === 'Rimpe Negocio Popular';
            const isEmprendedor = regime === 'Rimpe Emprendedor';
            const ivaFreq = c.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
            const reqRenta = c.tax_profile?.requiresAnnualRenta ?? true;

            const hasIvaThisMonth = ivaFreq === 'Mensual' || 
                                    (ivaFreq === 'Semestral' && (currentMonth === 7 || currentMonth === 1));
            
            const hasRentaThisMonth = reqRenta && (
                (isPopular && currentMonth === 5) || // Popular Renta in May
                (!isPopular && currentMonth === 3)   // General / Emprendedor Renta in March
            );

            return hasIvaThisMonth || hasRentaThisMonth;
        });

        if (upcoming.length === 0) return "📅 No hay vencimientos del SRI programados para los próximos 7 días.";

        const monthlyCount = upcoming.filter((c: any) => {
            const isEmprendedor = c.regime === 'Rimpe Emprendedor';
            const isPopular = c.regime === 'Rimpe Negocio Popular';
            const ivaFreq = c.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
            return ivaFreq === 'Mensual';
        }).length;

        const semiannualCount = upcoming.filter((c: any) => {
            const isEmprendedor = c.regime === 'Rimpe Emprendedor';
            const isPopular = c.regime === 'Rimpe Negocio Popular';
            const ivaFreq = c.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
            return ivaFreq === 'Semestral';
        }).length;

        const popularCount = upcoming.filter((c: any) => c.regime === 'Rimpe Negocio Popular').length;

        let response = `📅 *RESUMEN DE VENCIMIENTOS (7 DÍAS):*
- IVA Mensual: ${monthlyCount}
- IVA Semestral: ${semiannualCount}
- Negocio Popular: ${popularCount}

---
`;

        upcoming.sort((a: any, b: any) => {
            const dayA = SRI_DUE_DATES[parseInt(String(a.ruc).charAt(8))];
            const dayB = SRI_DUE_DATES[parseInt(String(b.ruc).charAt(8))];
            return dayA - dayB;
        }).slice(0, 15).forEach((c: any) => {
            const dueDay = SRI_DUE_DATES[parseInt(String(c.ruc).charAt(8))];
            const isEmprendedor = c.regime === 'Rimpe Emprendedor';
            const isPopular = c.regime === 'Rimpe Negocio Popular';
            const ivaFreq = c.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
            const typeLabel = isPopular ? 'Popular' : (ivaFreq === 'Semestral' ? 'Semst.' : 'Mens.');
            
            // Check if already declared for the likely current period (latest in history)
            const latest = c.declaration_history?.[0];
            const isDone = latest?.status === 'Enviada' || latest?.status === 'Pagada' || !!latest?.proof_file;

            response += `🔔 *Día ${dueDay}:* ${c.name.split(' ')[0]} | ${typeLabel} | ${isDone ? '✅ Declarado' : '❌ Pendiente'}\n`;
        });

        return response;
    } catch (error: any) {
        return "Error al calcular vencimientos: " + error.message;
    }
}

// [DEPRECATED] Google Sheets sync no migrada al bot. La webapp usa VITE_GOOGLE_SCRIPT_URL directamente.
export const syncToSheets = async () => { console.warn("[Bot] Sheets sync no disponible — usar la webapp."); };

/**
 * Updates or adds information to a client's record
 */
export async function updateClientData(ruc: string, updates: any) {
    console.log(`📝 Updating client ${ruc} in Supabase with:`, updates);
    try {
        const { error } = await supabase
            .from('clients')
            .update(updates)
            .eq('ruc', ruc);

        if (error) throw error;

        await logAuditAction('Actualización por Bot', `Expediente RUC ${ruc}`, 'client', 'info');
        return `✅ Expediente de RUC ${ruc} actualizado correctamente en PostgreSQL.`;
    } catch (error: any) {
        console.error("Error updating Supabase:", error);
        return "Error al actualizar la base de datos: " + error.message;
    }
}

/**
 * Marks a task as complete or deletes it from Supabase.
 */
export async function completeTask(taskId: string, action: 'complete' | 'delete') {
    console.log(`📝 Task Action: ${action} on ${taskId}`);
    try {
        if (action === 'delete') {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('tasks').update({ status: 'Completada' }).eq('id', taskId);
            if (error) throw error;
        }

        await logAuditAction(action === 'delete' ? 'Borrado de Tarea' : 'Completado de Tarea', `ID: ${taskId}`, 'task', action === 'delete' ? 'warning' : 'info');
        return `✅ Tarea ${action === 'delete' ? 'eliminada' : 'marcada como completada'} con éxito en Supabase.`;
    } catch (error: any) {
        return "Error al gestionar la tarea: " + error.message;
    }
}

/**
 * Clears ALL tasks from the internal agenda. Baku.
 */
/**
 * High-level financial summary matching the Elite Web Assistant.
 * Calculates total revenue collected in the current month.
 */
export async function getFinancialSummary() {
    console.log(`📊 Generating Elite Financial Summary from Supabase...`);
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*');

        if (error) throw error;
        if (!clients) return "No hay datos de clientes para analizar. Baku.";

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let totalRevenue = 0;
        let pendingCollections = 0;
        let declarationsDoneThisMonth = 0;

        clients.forEach(c => {
            const declarations = c.declaration_history || [];
            
            // 1. Calculate Revenue (Actually Paid this month)
            const paidThisMonth = declarations.filter((d: any) => 
                d.is_paid && d.paid_at && d.paid_at.startsWith(currentMonthStr)
            );
            
            paidThisMonth.forEach((d: any) => {
                const ivaFreq = c.tax_profile?.ivaFrequency || 'Mensual';
                const feeKey = ivaFreq === 'Mensual' ? 'monthly' 
                               : ivaFreq === 'Semestral' ? 'semestral' 
                               : undefined;
                const fee = d.type === 'RENTA' 
                    ? (c.fee_structure?.annual || 10) 
                    : (feeKey ? (c.fee_structure?.[feeKey] || (ivaFreq === 'Semestral' ? 10 : 5)) : 0);
                totalRevenue += fee;
            });

            // 2. Pending Collections (Enviada but not paid)
            const pending = declarations.filter((d: any) => 
                !d.is_paid && (d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file)
            );
            
            pending.forEach((d: any) => {
                const ivaFreq = c.tax_profile?.ivaFrequency || 'Mensual';
                const feeKey = ivaFreq === 'Mensual' ? 'monthly' 
                               : ivaFreq === 'Semestral' ? 'semestral' 
                               : undefined;
                const fee = d.type === 'RENTA' 
                    ? (c.fee_structure?.annual || 10) 
                    : (feeKey ? (c.fee_structure?.[feeKey] || (ivaFreq === 'Semestral' ? 10 : 5)) : 0);
                pendingCollections += fee;
            });

            // 3. Declarations done this month
            declarationsDoneThisMonth += declarations.filter((d: any) => 
                d.status !== 'Pendiente' && d.updated_at && d.updated_at.startsWith(currentMonthStr)
            ).length;
        });

        return `📊 *ESTADO FINANCIERO ELITE (${currentMonthStr})*
----------------------------------
💰 *Recaudación Total:* $${totalRevenue.toFixed(2)}
⏳ *Por Cobrar:* $${pendingCollections.toFixed(2)}
📑 *Gestiones Completadas:* ${declarationsDoneThisMonth}

Santiago, el flujo de caja operativo está en $${totalRevenue.toFixed(2)}. Tienes $${pendingCollections.toFixed(2)} en honorarios listos para ser reclamados. Baku.`;

    } catch (err: any) {
        console.error("Error in getFinancialSummary:", err);
        return `Error al generar el reporte financiero: ${err.message}. Baku.`;
    }
}

export async function getDatabaseSummary() {
    console.log(`📊 Generating global database summary from Supabase...`);
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .eq('is_deleted', false);

        if (error) throw error;
        if (!clients || clients.length === 0) return "La base de datos está vacía.";

        const total = clients.length;
        const rimpePopular = clients.filter(c => c.regime === 'Rimpe Negocio Popular').length;
        const rimpeEmprendedor = clients.filter(c => c.regime === 'Rimpe Emprendedor').length;
        const general = total - rimpePopular - rimpeEmprendedor;

        let pendingIvaPayments = 0;
        let pendingDeclarations = 0;
        let eliteCount = 0;
        let totalFeesAmount = 0;

        clients.forEach(c => {
            const ivaFreq = c.tax_profile?.ivaFrequency || 'Mensual';
            const needsIva = c.regime !== 'Rimpe Negocio Popular' && ivaFreq !== 'Ninguno';
            
            const declarations = c.declaration_history || [];
            const lastIva = declarations.filter((d: any) => d.type === 'IVA').sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
            
            const isIvaDeclared = !needsIva || (lastIva?.status === 'Enviada' || lastIva?.status === 'Pagada' || !!lastIva?.proof_file);
            const isIvaPaid = !needsIva || (lastIva?.is_paid || lastIva?.status === 'Pagada');

            const needsRenta = c.tax_profile?.requiresAnnualRenta ?? (c.regime === 'Rimpe Negocio Popular' || c.regime === 'Rimpe Emprendedor');
            // Check for RENTA type declaration
            const lastRenta = declarations.filter((d: any) => d.type === 'RENTA').sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
            const isRentaDeclared = !needsRenta || (lastRenta?.status === 'Enviada' || lastRenta?.status === 'Pagada');
            const isRentaPaid = !needsRenta || lastRenta?.is_paid;

            if (needsIva) {
                if (!isIvaDeclared) pendingDeclarations++;
                if (isIvaDeclared && !isIvaPaid) {
                    pendingIvaPayments++;
                    const feeKey = ivaFreq === 'Mensual' ? 'monthly' 
                                   : ivaFreq === 'Semestral' ? 'semestral' 
                                   : undefined;
                    const ivaFee = feeKey ? (c.fee_structure?.[feeKey] || (ivaFreq === 'Semestral' ? 10 : 5)) : 0;
                    totalFeesAmount += ivaFee;
                }
            }

            if (needsRenta && !isRentaPaid) {
                const rentaFee = c.fee_structure?.annual || 10;
                totalFeesAmount += rentaFee;
            }

            if (isIvaDeclared && isIvaPaid && isRentaDeclared && isRentaPaid) {
                eliteCount++;
            }
        });

        const pendingRentaCount = clients.filter(c => {
            const needsRenta = c.tax_profile?.requiresAnnualRenta ?? (c.regime === 'Rimpe Negocio Popular' || c.regime === 'Rimpe Emprendedor');
            const lastRenta = (c.declaration_history || []).filter((d: any) => d.type === 'RENTA')[0];
            return needsRenta && !lastRenta?.is_paid;
        }).length;

        const compliancePercent = Math.round((eliteCount / total) * 100);

        // Identificar frentes de acción inmediatos
        const urgentlyPending = clients.filter(c => {
            const ivaFreq = c.tax_profile?.ivaFrequency || 'Mensual';
            const lastIva = (c.declaration_history || []).filter((d: any) => d.type === 'IVA').sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
            return (ivaFreq !== 'Ninguno' && (!lastIva || (lastIva.status !== 'Enviada' && lastIva.status !== 'Pagada' && !lastIva.proof_file)));
        }).slice(0, 5).map(c => c.name.split(' ')[0]).join(', ');

        return `📊 *ESTADO ESTRATÉGICO DE CARTERA:*
----------------------------------
📈 *Health Score Global:* ${compliancePercent}%
👥 *Universo:* ${total} Clientes Activos

🛡️ *DESGLOSE OPERATIVO:*
- General: ${general}
- Emprendedor: ${rimpeEmprendedor}
- Popular: ${rimpePopular}

🚧 *FRENTES CRÍTICOS:*
- 📑 Declaraciones Pendientes: ${pendingDeclarations}
- 💰 Cartera por Cobrar: $${totalFeesAmount} USD
- 🚨 Foco Inmediato: ${urgentlyPending}${total > 5 ? '...' : ''}

Santiago, el sistema reporta un ${compliancePercent}% de eficacia operativa. Tenemos **$${totalFeesAmount}** líquidos por recuperar. ¿Procedemos con los recordatorios masivos? Baku.`;

    } catch (error: any) {
        return "Error al generar resumen: " + error.message;
    }
}


/**
 * Creates a new client in the database. Baku.
 */
export async function createClient(data: {
    ruc: string;
    name: string;
    regime: string;
    sriPassword: string;
    email?: string;
    phones?: string[];
}) {
    console.log(`🆕 Creating new client in Supabase: ${data.name} (${data.ruc})`);
    try {
        const { data: existing } = await supabase.from('clients').select('id').eq('ruc', data.ruc).single();
        if (existing) return `⚠️ El RUC ${data.ruc} ya está registrado.`;

        const newClient = {
            ruc: data.ruc,
            name: data.name,
            sri_password: data.sriPassword,
            regime: data.regime,
            email: data.email || "",
            phones: data.phones || [],
            is_active: true,
            tax_profile: {
                ivaFrequency: data.regime === 'Rimpe Negocio Popular' ? 'Ninguno' : data.regime === 'Rimpe Emprendedor' ? 'Semestral' : 'Mensual',
                requiresAnnualRenta: true
            }
        };

        const { error } = await supabase.from('clients').insert(newClient);
        if (error) throw error;

        await logAuditAction('Nuevo Cliente (Bot)', `${data.name} - RUC: ${data.ruc}`, 'client', 'info');
        return `✅ Cliente **${data.name}** creado exitosamente en Supabase. Baku.`;
    } catch (error: any) {
        console.error("Error creating client:", error);
        return "Error al crear cliente: " + error.message;
    }
}

/**
 * Marks a specific payment as paid. Baku.
 */
export async function markPaymentAsPaid(identifier: string, type: 'IVA' | 'RENTA' | 'HONORARIOS', period?: string): Promise<string> {
    console.log(`💰 Marking ${type} ${period || ''} as paid in Supabase for client ${identifier}`);
    try {
        const matches = await findClients(identifier, '*');
        if (!matches || matches.length === 0) return `❌ No encontré ningún cliente con "${identifier}". Baku.`;
        if (matches.length > 1) {
            const list = matches.map((c: any) => `• ${c.name} (\`${c.ruc}\`)`).join('\n');
            return `Encontré ${matches.length} clientes. ¿Cuál quieres marcar como pagado?\n${list}`;
        }

        const client = matches[0];

        if (type === 'RENTA') {
            // Find current period renta
            const periodToMark = period || new Date().getFullYear().toString();
            let history = [...(client.declaration_history || [])];
            let found = false;
            
            for (let d of history) {
                if (d.type === 'RENTA' && d.period === periodToMark) {
                    d.is_paid = true;
                    d.paid_at = new Date().toISOString();
                    d.status = 'Pagada';
                    found = true;
                    break;
                }
            }
            if (!found) return `No se encontró una declaración de RENTA para el periodo ${periodToMark}.`;
            
            const { error: updErr } = await supabase.from('clients').update({ declaration_history: history }).eq('id', client.id);
            if (updErr) throw updErr;
            await logAuditAction('Cobro Registrado (Bot)', `Renta ${periodToMark} - RUC: ${client.ruc}`, 'finance', 'info');
            return `✅ Cobro de **Renta Anual (${periodToMark})** para ${client.name} marcado como pagado en Supabase. Baku.`;
        }

        if (type === 'IVA' || type === 'HONORARIOS') {
            let history = [...(client.declaration_history || [])];
            let targetIdx = -1;
            
            if (period) {
                targetIdx = history.findIndex(d => d.type === type && d.period === period);
            } else {
                // Mark oldest unpaid
                const oldest = history
                    .filter((d: any) => d.type === type && !d.is_paid && d.status !== 'Pendiente')
                    .sort((a: any, b: any) => a.period.localeCompare(b.period))[0];
                if (oldest) {
                    targetIdx = history.indexOf(oldest);
                }
            }
            
            if (targetIdx === -1) return `No hay pagos pendientes de ${type} para ${client.name}.`;
            
            history[targetIdx].is_paid = true;
            history[targetIdx].paid_at = new Date().toISOString();
            history[targetIdx].status = 'Pagada';
            
            const { error: updErr } = await supabase.from('clients').update({ declaration_history: history }).eq('id', client.id);
            if (updErr) throw updErr;
            await logAuditAction('Cobro Registrado (Bot)', `${type} ${history[targetIdx].period} - RUC: ${client.ruc}`, 'finance', 'info');
            return `✅ Cobro de **${type}** (${history[targetIdx].period}) para ${client.name} actualizado en Supabase. Baku.`;
        }

        return "Tipo de pago no reconocido. Baku.";
    } catch (error: any) {
        console.error("Error marking payment:", error);
        return "Error al actualizar pago: " + error.message;
    }
}

/**
 * Reverts a payment status to unpaid. Baku.
 */
export async function markPaymentAsUnpaid(ruc: string, type: 'IVA' | 'RENTA' | 'HONORARIOS', period?: string): Promise<string> {
    console.log(`⏪ Reverting ${type} ${period || ''} to unpaid in Supabase for ${ruc}`);
    try {
        const { data: clients, error } = await supabase.from('clients').select('*').eq('ruc', ruc);
        if (error) throw error;
        if (!clients || clients.length === 0) return `No se encontró al cliente RUC ${ruc}.`;

        const client = clients[0];
        let history = [...(client.declaration_history || [])];
        let found = false;
        
        for (let d of history) {
            let match = false;
            if (type === 'RENTA' && d.type === 'RENTA') {
                if (!period || d.period === period) match = true;
            } else if (d.type === type && d.period === period) {
                match = true;
            }
            
            if (match) {
                d.is_paid = false;
                d.paid_at = null;
                if (d.proof_file) d.status = 'Enviada';
                else d.status = 'Enviada'; // Default to enviada if reverting payment
                found = true;
            }
        }
        
        if (!found) return `No se encontraron pagos de ${type} para revertir en el periodo especificado.`;
        
        const { error: updErr } = await supabase.from('clients').update({ declaration_history: history }).eq('id', client.id);
        if (updErr) throw updErr;

        await logAuditAction('Reversión de Cobro (Bot)', `${type} ${period || 'antiguo'} - RUC: ${ruc}`, 'finance', 'warning');
        return `✅ Cobro de **${type}** para ${client.name} revertido a PENDIENTE en Supabase. Baku.`;
    } catch (error: any) {
        console.error("Error reverting payment:", error);
        return "Error al revertir pago: " + error.message;
    }
}
/**
 * Scans the database for SRI credential health. Baku.
 */
export async function getCredentialStatus() {
    console.log(`🔍 Scanning SRI credentials in Supabase...`);
    try {
        const { data: clients, error } = await supabase.from('clients').select('*').eq('is_deleted', false);
        if (error) throw error;
        if (!clients || clients.length === 0) return "No hay clientes registrados.";

        const weakPasswords = ["123456", "sri123", "contraseña", "password", "sri2024", "sri2025"];
        
        const issues = clients.map((c: any) => {
            const problems: string[] = [];
            const pass = (c.sri_password || "").trim();
            
            if (!pass) {
                problems.push("❌ CLAVE FALTANTE");
            } else if (pass.length < 6) {
                problems.push("⚠️ CLAVE MUY CORTA");
            } else if (weakPasswords.includes(pass.toLowerCase())) {
                problems.push("⚠️ CLAVE GENÉRICA/DÉBIL");
            }

            if (c.signature_expiration) {
                const expDate = new Date(c.signature_expiration);
                const diffDays = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) problems.push("🚫 FIRMA CADUCADA");
                else if (diffDays < 30) problems.push(`⏳ FIRMA POR CADUCAR (${diffDays} días)`);
            }

            return { name: c.name, ruc: c.ruc, problems };
        }).filter((item: any) => item.problems.length > 0);

        if (issues.length === 0) return "✅ Credenciales SRI OK. Baku.";

        let response = `🦅 *REPORTE DE SRI HUNTER (CREDENCIALES):*\n\n`;
        issues.slice(0, 15).forEach(issue => {
            response += `👤 *${issue.name}* (\`${issue.ruc}\`)\n`;
            issue.problems.forEach(p => response += `   ${p}\n`);
            response += `\n`;
        });

        if (issues.length > 15) response += `_...y ${issues.length - 15} clientes más con observaciones._`;

        return response;
    } catch (error: any) {
        console.error("Error scanning credentials:", error);
        return "Error al escanear credenciales: " + error.message;
    }
}



/**
 * Analyzes the database for inconsistencies and risks (Escudo Fiscal). Baku.
 */
export async function detectTaxInconsistencies() {
    console.log(`🛡️ Running Escudo Fiscal analysis in Supabase...`);
    try {
        const { data: clients, error } = await supabase.from('clients').select('*').eq('is_deleted', false);
        if (error) throw error;
        if (!clients || clients.length === 0) return "La base de datos está vacía.";
        
        const insights: string[] = [];

        clients.forEach((c: any) => {
            const problems: string[] = [];
            
            // 1. Missing SRI Password
            if (!c.sri_password) problems.push("Falta clave SRI");
            
            // 2. Missing Contact Info
            if (!c.email && (!c.phones || c.phones.length === 0)) problems.push("Sin datos de contacto");
            
            // 3. Regime/Frequency Mismatch or Missing Regime
            const regime = c.regime || "";
            const freq = c.tax_profile?.ivaFrequency || "";
            if (!regime) problems.push("⚠️ Régimen no definido");
            if (regime === 'Régimen General' && freq === 'Semestral') problems.push("⚠️ General con frecuencia Semestral");
            if (regime.includes('Rimpe') && freq === 'Mensual') problems.push("⚠️ Rimpe con frecuencia Mensual");

            // 4. RUC Validation (Emergency check)
            if (c.ruc && c.ruc.length !== 13) problems.push("❌ RUC inválido (no tiene 13 dígitos)");

            // 5. Critical Pending (SRI)
            const pendingDecs = c.declaration_history?.filter((d: any) => d.status === 'Pendiente').length || 0;
            if (pendingDecs > 6) problems.push(`🔥 ${pendingDecs} declaraciones pendientes`);

            if (problems.length > 0) {
                insights.push(`👤 *${c.name.split(' ')[0]}* (${c.ruc}): ${problems.join(', ')}`);
            }
        });

        if (insights.length === 0) return "✅ Escudo Fiscal: No se detectaron inconsistencias críticas en la base de datos. Baku.";

        let response = `🛡️ *REPORTE DE ESCUDO FISCAL:*
He detectado ${insights.length} expedientes con inconsistencias o riesgos potenciales:

${insights.slice(0, 12).join('\n')}

${insights.length > 12 ? `_...y ${insights.length - 12} más._` : ''}

Santiago, ¿quieres que te ayude a proponer correcciones para estos clientes? Baku.`;

        return response;
    } catch (error: any) {
        return "Error en Escudo Fiscal: " + error.message;
    }
}

/**
 * Deletes a client from the database. REQUIRES EXPLICIT CONFIRMATION. Baku.
 */
export async function deleteClient(ruc: string, confirmed: boolean) {
    console.log(`🛑 Attempting to delete client ${ruc} from Supabase...`);
    if (!confirmed) return `⚠️ **SEGURIDAD:** Santiago debe confirmar explícitamente el borrado de RUC ${ruc}.`;

    try {
        const { error } = await supabase.from('clients').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('ruc', ruc);
        if (error) throw error;
        await logAuditAction('Borrado de Cliente (Bot)', `RUC: ${ruc}`, 'client', 'warning');
        return `✅ **BORRADO EXITOSO:** RUC ${ruc} marcado como eliminado en Supabase. Baku.`;
    } catch (error: any) {
        return "Error al eliminar cliente: " + error.message;
    }
}

/**
 * Creates a new task in the global tasks list. Baku.
 */
export async function createTask(title: string, description: string, dueDate: string) {
    console.log(`📝 Creating task in Supabase: ${title}`);
    try {
        const newTask = {
            title,
            description,
            due_date: dueDate,
            status: 'Pendiente'
        };

        const { error } = await supabase.from('tasks').insert(newTask);
        if (error) throw error;

        return `✅ Tarea "**${title}**" creada para el **${dueDate}** en Supabase. Baku.`;
    } catch (error: any) {
        console.error("Error creating task:", error);
        return "Error al crear la tarea: " + error.message;
    }
}

export async function clearTasks() {
    console.log(`🗑️ Clearing all tasks in Supabase...`);
    try {
        const { error } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return "✅ **PODER DE LIMPIEZA:** Todas las tareas eliminadas de Supabase. Baku.";
    } catch (error: any) {
        return "Error al vaciar tareas: " + error.message;
    }
}

/**
 * Generates a detailed status report of active clients:
 * - Who is monthly (IVA frequency)
 * - Who is semiannual (IVA frequency)
 * - Who is already declared
 * - Who is missing declarations
 */
export async function getClientsStatusReport() {
    console.log(`📊 Generating detailed clients status report from Supabase...`);
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .eq('is_deleted', false);

        if (error) throw error;
        if (!clients || clients.length === 0) return "No hay clientes registrados en la base de datos.";

        const mensuales: string[] = [];
        const semestrales: string[] = [];
        const populares: string[] = [];
        const alDia: string[] = [];
        const faltaDeclarar: string[] = [];

        clients.forEach((c: any) => {
            const regime = c.regime || 'Régimen General';
            const isPopular = regime === 'Rimpe Negocio Popular';
            const isEmprendedor = regime === 'Rimpe Emprendedor';
            const ivaFreq = c.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

            // Classify by frequency
            if (ivaFreq === 'Mensual') {
                mensuales.push(c.name);
            } else if (ivaFreq === 'Semestral') {
                semestrales.push(c.name);
            } else {
                populares.push(c.name);
            }

            // Classify by declaration status (latest IVA period)
            const declarations = c.declaration_history || [];
            const needsIva = regime !== 'Rimpe Negocio Popular' && ivaFreq !== 'Ninguno';
            
            // Get latest IVA declaration
            const lastIva = declarations
                .filter((d: any) => d.type === 'IVA')
                .sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
            
            const isIvaDeclared = !needsIva || (lastIva?.status === 'Enviada' || lastIva?.status === 'Pagada' || !!lastIva?.proof_file);

            // Get latest Renta declaration (if required)
            const needsRenta = c.tax_profile?.requiresAnnualRenta ?? (isPopular || isEmprendedor);
            const lastRenta = declarations
                .filter((d: any) => d.type === 'RENTA')
                .sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
            const isRentaDeclared = !needsRenta || (lastRenta?.status === 'Enviada' || lastRenta?.status === 'Pagada');

            const isFullyUpToDate = isIvaDeclared && isRentaDeclared;
            const periodStr = lastIva ? ` (${lastIva.period})` : '';

            if (isFullyUpToDate) {
                alDia.push(`${c.name}${periodStr}`);
            } else {
                const pendingDetails: string[] = [];
                if (!isIvaDeclared) pendingDetails.push("IVA");
                if (!isRentaDeclared) pendingDetails.push("Renta");
                faltaDeclarar.push(`${c.name} [Falta: ${pendingDetails.join(', ')}]`);
            }
        });

        const formatList = (arr: string[], max = 15) => {
            if (arr.length === 0) return 'Ninguno';
            let res = arr.slice(0, max).map(n => `- ${n}`).join('\n');
            if (arr.length > max) res += `\n_...y ${arr.length - max} más._`;
            return res;
        };

        let report = `📊 *REPORTE OPERATIVO DE CLIENTES (SRI):*\n`;
        report += `------------------------------------\n\n`;
        
        report += `📅 *FRECUENCIA DE IVA:*\n`;
        report += `🗓️ *Mensuales (${mensuales.length}):*\n${formatList(mensuales)}\n\n`;
        report += `🗓️ *Semestrales (${semestrales.length}):*\n${formatList(semestrales)}\n\n`;
        report += `🗓️ *Exentos/Popular (${populares.length}):*\n${formatList(populares)}\n\n`;
        
        report += `------------------------------------\n\n`;
        report += `🛡️ *ESTADO DE CUMPLIMIENTO (ÚLTIMO PERIODO):*\n`;
        report += `✅ *Al Día / Declarados (${alDia.length}):*\n${formatList(alDia)}\n\n`;
        report += `🚨 *Faltan por Declarar (${faltaDeclarar.length}):*\n${formatList(faltaDeclarar, 25)}\n\n`;

        return report;
    } catch (error: any) {
        console.error("Error in getClientsStatusReport:", error);
        return `Error al generar el reporte operativo: ${error.message}`;
    }
}

// ─────────────────────────────────────────────
// LIGHTWEIGHT SINGLE-FIELD READ — minimal tokens
// ─────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
    sri_password:                 'Clave SRI',
    email:                        'Email',
    phones:                       'Teléfonos',
    address:                      'Dirección',
    regime:                       'Régimen',
    ruc:                          'RUC',
    name:                         'Nombre',
    trade_name:                   'Nombre Comercial',
    iessPassword:                 'Clave IESS',
    electronicSignaturePassword:  'Clave Firma Electrónica',
    signatureExpirationDate:      'Caducidad Firma',
    sharedAccessKey:              'Clave Compartida',
    notes:                        'Notas',
    economicActivity:             'Actividad Económica',
};

const FIELD_DB_MAPPING: Record<string, string> = {
    sri_password:                 'sri_password',
    email:                        'email',
    phones:                       'phones',
    address:                      'address',
    regime:                       'regime',
    ruc:                          'ruc',
    name:                         'name',
    trade_name:                   'trade_name',
    iessPassword:                 'iess_password',
    electronicSignaturePassword:  'signature_password',
    signatureExpirationDate:      'signature_expiration',
    notes:                        'notes',
    economicActivity:             'economic_activity',
    sharedAccessKey:              'shared_access_key',
};

export async function getClientField(identifier: string, field: string): Promise<string> {
    console.log(`🔍 [Lightweight] getClientField: "${identifier}" → field "${field}"`);
    try {
        const dbField = FIELD_DB_MAPPING[field] || field;
        const clients = await findClients(identifier, `id, name, ruc, trade_name, ${dbField}`);
        if (!clients || clients.length === 0) {
            if (field === 'sri_password' && identifier.trim().length === 13 && /^\d+$/.test(identifier.trim())) {
                const backupCred = await get_sri_credential(identifier.trim());
                if (!backupCred.includes('❌ No se encontró')) {
                    return `⚠️ El cliente RUC ${identifier} no está registrado en tu base principal, pero encontré esto en la bóveda:\n\n${backupCred}`;
                }
            }
            return `❌ No encontré ningún cliente con "${identifier}". Baku.`;
        }

        if (clients.length > 1) {
            const list = clients.map((c: any) => `• ${c.name} (RUC: \`${c.ruc}\`${c.trade_name ? ` | Comercial: *${c.trade_name}*` : ''})`).join('\n');
            return `Encontré ${clients.length} clientes. ¿Cuál necesitas?\n${list}`;
        }

        const c = clients[0];
        const value = (c as any)[dbField];
        const label = FIELD_LABELS[field] || field;

        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
            const shortLabel = label.toLowerCase();
            return `📋 *${c.name}* — ${label}: _(vacío)_\n\n💡 _Tip: Puedes agregarla escribiendo: "edita ${shortLabel} de ${c.name} a [nuevo valor]"_ Baku.`;
        }

        const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
        return `📋 *${c.name}* — ${label}: \`${displayValue}\``;
    } catch (err: any) {
        return `Error al leer campo: ${err.message}. Baku.`;
    }
}

export async function quickUpdateClient(identifier: string, field: string, value: any): Promise<string> {
    console.log(`✏️ [Lightweight] quickUpdateClient: "${identifier}" → ${field} = "${value}"`);
    try {
        const clients = await findClients(identifier, 'id, name, ruc, trade_name');
        if (!clients || clients.length === 0)
            return `❌ No encontré "${identifier}" en la base de datos. Baku.`;

        if (clients.length > 1) {
            const list = clients.map((c: any) => `• ${c.name} (RUC: \`${c.ruc}\`${c.trade_name ? ` | Comercial: *${c.trade_name}*` : ''})`).join('\n');
            return `Encontré ${clients.length} coincidencias. ¿Cuál edito?\n${list}\nResponde con el nombre exacto o RUC. Baku.`;
        }

        const client = clients[0];

        const dbField = FIELD_DB_MAPPING[field] || field;
        // Parse value: phones should be an array
        let parsedValue = value;
        if (dbField === 'phones') {
            parsedValue = Array.isArray(value) ? value : [String(value)];
        }

        const { error: updateErr } = await supabase
            .from('clients')
            .update({ [dbField]: parsedValue, updated_at: new Date().toISOString() })
            .eq('id', client.id);

        if (updateErr) throw updateErr;

        const label = FIELD_LABELS[field] || field;
        await logAuditAction(
            'Edición Rápida (Bot)',
            `${client.name} — ${label}: "${parsedValue}"`,
            'client', 'info'
        );
        return `✅ *${client.name}* — ${label} actualizado a: \`${parsedValue}\`. Baku.`;
    } catch (err: any) {
        return `Error al actualizar: ${err.message}. Baku.`;
    }
}

export async function markPaymentsList(
    identifier: string,
    type: 'IVA' | 'RENTA' | 'HONORARIOS',
    periods: string[]
): Promise<string> {
    console.log(`💰 Marking payments ${type} for periods [${periods.join(', ')}] as paid for client ${identifier}`);
    try {
        const matches = await findClients(identifier, '*');
        if (!matches || matches.length === 0) return `❌ No encontré ningún cliente con "${identifier}". Baku.`;
        if (matches.length > 1) {
            const list = matches.map((c: any) => `• ${c.name} (\`${c.ruc}\`)`).join('\n');
            return `Encontré ${matches.length} clientes. ¿Cuál deseas actualizar?\n${list}`;
        }

        const client = matches[0];
        let history = [...(client.declaration_history || [])];
        const nowStr = new Date().toISOString();
        const updatedPeriods: string[] = [];

        // For monthly/semiannual fees, the type is usually stored as 'IVA' or 'RENTA' in declaration_history.
        // If type is 'HONORARIOS', we default to 'IVA' in the records as monthly fees are bound to IVA periods.
        const dbType = type === 'HONORARIOS' ? 'IVA' : type;

        for (const period of periods) {
            let entry = history.find(d => d.type === dbType && d.period === period);
            if (entry) {
                entry.is_paid = true;
                entry.paid_at = nowStr;
                entry.updatedAt = nowStr;
                // If it was already sent/declared, update its status to Pagada
                if (entry.status === 'Enviada') {
                    entry.status = 'Pagada';
                }
            } else {
                // If it doesn't exist, create a new one as 'Pendiente' but prepaid
                history.push({
                    type: dbType,
                    period,
                    status: 'Pendiente',
                    is_paid: true,
                    paid_at: nowStr,
                    declaredAt: null,
                    updatedAt: nowStr,
                    proof_file: null,
                    amount: 0
                });
            }
            updatedPeriods.push(period);
        }

        // Sort history by period for sanity
        history.sort((a: any, b: any) => a.period.localeCompare(b.period));

        const { error: updErr } = await supabase.from('clients').update({ declaration_history: history }).eq('id', client.id);
        if (updErr) throw updErr;

        await logAuditAction('Cobro Registrado (Bot)', `${type} [${updatedPeriods.join(', ')}] - RUC: ${client.ruc}`, 'finance', 'info');
        return `✅ Pago de **${type}** para los periodos **${updatedPeriods.join(', ')}** del cliente **${client.name}** registrado como PAGADO en Supabase. Baku.`;
    } catch (error: any) {
        console.error("Error marking payments list:", error);
        return "Error al registrar pagos: " + error.message;
    }
}

export async function markDeclaration(
    identifier: string,
    type: 'IVA' | 'RENTA',
    period: string,
    method: 'pdf' | 'click'
): Promise<string> {
    console.log(`📑 Marking declaration ${type} for period ${period} using ${method} for client ${identifier}`);
    try {
        const matches = await findClients(identifier, '*');
        if (!matches || matches.length === 0) return `❌ No encontré ningún cliente con "${identifier}". Baku.`;
        if (matches.length > 1) {
            const list = matches.map((c: any) => `• ${c.name} (\`${c.ruc}\`)`).join('\n');
            return `Encontré ${matches.length} clientes. ¿Cuál deseas actualizar?\n${list}`;
        }

        const client = matches[0];
        let history = [...(client.declaration_history || [])];
        const nowStr = new Date().toISOString();
        
        const proof_file = method === 'pdf' ? {
            name: 'manual_upload.pdf',
            metadata: {
                formType: type,
                uploadedAt: nowStr
            }
        } : null;

        // Try to find if an entry for this period and type already exists
        let entryIdx = history.findIndex(d => d.type === type && d.period === period);

        if (entryIdx !== -1) {
            // Update existing entry
            history[entryIdx].status = history[entryIdx].is_paid ? 'Pagada' : 'Enviada';
            history[entryIdx].declaredAt = nowStr;
            history[entryIdx].updatedAt = nowStr;
            history[entryIdx].proof_file = proof_file;
        } else {
            // Create a new entry
            history.push({
                type,
                period,
                status: 'Enviada',
                is_paid: false,
                declaredAt: nowStr,
                updatedAt: nowStr,
                proof_file,
                amount: 0
            });
        }

        // Sort history by period for sanity
        history.sort((a: any, b: any) => a.period.localeCompare(b.period));

        const { error: updErr } = await supabase.from('clients').update({ declaration_history: history, updated_at: new Date().toISOString() }).eq('id', client.id);
        if (updErr) throw updErr;

        await logAuditAction('Declaración Registrada (Bot)', `${type} ${period} (${method}) - RUC: ${client.ruc}`, 'sri', 'info');
        return `✅ Declaración de **${type}** (${period}) para ${client.name} registrada como **Enviada** (vía ${method === 'pdf' ? 'PDF' : 'clic'}) en Supabase. Baku.`;
    } catch (error: any) {
        console.error("Error marking declaration:", error);
        return "Error al registrar declaración: " + error.message;
    }
}

/**
 * Retreives an SRI credential directly from the synchronized Firebase store,
 * bypassing the need to query the entire client database.
 */
export async function get_sri_credential(ruc: string): Promise<string> {
    console.log(`🔑 Fetching SRI credential for RUC ${ruc} from Firebase...`);
    try {
        const firestore = getFirestore();
        const docRef = firestore.collection("sc_pro_backup").doc("sriCredentials");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data()?.data || {};
            // Look up the exact RUC key
            const password = data[ruc];
            if (password) {
                return `🔑 Clave SRI para RUC ${ruc}:\n\`${password}\`\n\n_Obtenido de la bóveda sincronizada de contraseñas. Baku._`;
            }
        }
        return `❌ No se encontró la clave SRI para el RUC ${ruc} en la bóveda de contraseñas.`;
    } catch (error: any) {
        console.error("Error fetching SRI credential from Firebase:", error);
        return `Error al consultar la bóveda de contraseñas: ${error.message}`;
    }
}
