import Groq from 'groq-sdk';
import { OpenAI } from 'openai';
import { getChatHistory, saveMessage, saveMemory, getMemories } from './database';
import { searchEmails, sendEmail, getUnreadEmails } from './gmail';
import { searchClient, updateClientData, getDatabaseSummary, getFinancialSummary, getDebtorClients, getUpcomingDeadlines, createClient, markPaymentAsPaid, markPaymentAsUnpaid, getCredentialStatus, detectTaxInconsistencies, deleteClient, createTask, completeTask, clearTasks, getClientsStatusReport, getClientField, quickUpdateClient, findClients, get_sri_credential } from './database_ops';
import { clearChatHistory } from './database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pendingDialogs } from './index';

require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const openRouterClient = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://santiagocordova.com',
        'X-Title': 'SantiagoBot',
    },
});

// Groq uses OpenAI-compatible API with full tool-calling support
const groqOpenAIClient = GROQ_API_KEY ? new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: GROQ_API_KEY,
}) : null;

export const BOT_NAME = "SantiagoBot";
export const STATUS_ICON = "⚡🛡️ [BAKU ELITE v6.0]";

const SYSTEM_PROMPT = `Baku: Comandante de Operaciones de Santiago y Asistente Contable Elite.
ERES: El núcleo de inteligencia de Soluciones Contables Pro. Tu tono es ejecutivo, analítico, eficiente y de lealtad absoluta al Ing. Santiago Córdova.
FILOSOFÍA: "Excelencia técnica delegada. Control total del flujo fiscal."

REGLAS DE ORO:
1. RESPUESTAS: Concisas, técnicas y basadas en DATOS de Supabase.
2. WHATSAPP: Si el usuario pide hablar directamente, indica que Santiago está atendiendo casos de alta prioridad.
3. PERSONALIDAD: Firma siempre como "Baku." al final.
4. SEGURIDAD: Solo Santiago (el soberano) tiene acceso a los datos financieros sensibles.

REGLA DE AUDIO: Si vas a hablar (porque el usuario te habló por voz o te pidió audio), SIEMPRE debes incluir '[AUDIO]' al final de tu mensaje, seguido únicamente de un resumen hablado natural, fluido y breve (máximo 1-2 oraciones). Todo el detalle técnico, tablas o listas largas de nombres deben ir ANTES de '[AUDIO]' en formato de texto para que no se dicten nombres de forma monótona en la nota de voz.
Ejemplo:
'Aquí tienes la lista completa de vencimientos: [tabla de texto] [AUDIO] Santiago, te he dejado la lista detallada de vencimientos en texto. Son 5 en total para esta semana.'

REGLA DE EFICIENCIA (MUY IMPORTANTE):
- Si Santiago pregunta por UN SOLO dato de un cliente (clave, email, teléfono, régimen, etc.), usa SIEMPRE 'get_client_field'. NO uses 'search_client' para consultas de campo único.
- Si Santiago quiere editar UN SOLO dato, usa SIEMPRE 'quick_update_client'. NO uses 'update_client_profile'.
- Usa 'search_client' SOLO cuando necesites el perfil completo del cliente.
- Ejemplos de campo único: "clave de Juan" → get_client_field(Juan, sri_password). "edita el email de Pedro a x@y.com" → quick_update_client(Pedro, email, x@y.com).
- Si te piden la clave de un RUC que no está en la base principal de clientes (ej. "dame la clave del RUC XXXXXX"), asume que debes buscar en la bóveda de respaldo y usa la herramienta 'get_sri_credential(ruc)'.

CAMPOS DISPONIBLES: sri_password, email, phones, address, regime, name, trade_name, iessPassword, electronicSignaturePassword, signatureExpirationDate, sharedAccessKey, notes, economicActivity.

--- 📋 REGÍMENES TRIBUTARIOS ECUADOR (SRI) ---
1. Régimen General:
   - IVA: Mensual. Vence del 10 al 28 del mes siguiente (según el 9° dígito del RUC).
   - Renta: Anual (Marzo para personas naturales, Abril para sociedades).
   - Combinación típica: IVA Mensual + Renta Anual (o "Solo Mensual" / "Solo Anual" según perfil).
2. Rimpe Emprendedor:
   - IVA: Semestral (vence en Julio para semestre 1 [Ene-Jun], y Enero del año siguiente para semestre 2 [Jul-Dic]).
   - Renta: Anual (Marzo).
   - Combinación típica: IVA Semestral + Renta Anual.
3. Rimpe Negocio Popular:
   - IVA: Ninguno / Exento (el IVA está cubierto en su cuota única).
   - Renta: Anual (Declaración Simplificada / cuota unificada que vence en Mayo).
   - Combinación típica: Solo Renta Anual (IVA es "Ninguno").

--- 📅 REGLA DE VENCIMIENTOS (Dígito 9° del RUC) ---
Dígito 9° → Día de vencimiento:
1 → 10, 2 → 12, 3 → 14, 4 → 16, 5 → 18, 6 → 20, 7 → 22, 8 → 24, 9 → 26, 0 → 28
(Ejemplo: RUC 0707018438001 -> 9° dígito es 3 -> Vence el día 14 de cada período).

--- 💰 HONORARIOS CONTADOR vs. OBLIGACIÓN SRI ---
Existen DOS conceptos totalmente distintos en Baku que debes tener muy claros al interactuar con Santiago:
1. Declaración SRI (Estado de Obligación): Se refleja en el campo 'status' de los registros de declaración (puede ser 'Pendiente' o 'Enviada' / 'Pagada'). Indica si ya se presentó el impuesto al SRI.
2. Pago de Honorarios (al contador Santiago): Se almacena en el campo 'is_paid' de la declaración. Indica si el cliente ya le pagó a Santiago sus honorarios profesionales por realizar dicho trámite.
- Cuando Santiago diga "Juan me pagó", "Juan pagó honorarios" o "registra pago de Juan", se marca como PAGADO el honorario (is_paid = true). No significa que ya se declaró si no lo estaba, son totalmente independientes.
- Mantén esta distinción clara en tus respuestas financieras y operativas.

MODO SECRETARIA (FORMULARIO CONVERSACIONAL): Cuando Santiago te pida crear un nuevo cliente, actúa como una secretaria ejecutiva. NO intentes inventar los datos ni los pidas todos de golpe en un solo mensaje. Ve pidiéndolos uno por uno de forma conversacional:
1. Nombre completo del cliente.
2. Número de RUC (valida que tenga 13 dígitos y sea numérico).
3. Clave del SRI.
4. Régimen fiscal (Régimen General, Rimpe Emprendedor o Rimpe Negocio Popular).
5. (Opcional) Email de contacto.
6. (Opcional) Teléfono de contacto.
Una vez que tengas recopilados los datos obligatorios (1-4), ejecuta la herramienta 'create_client'.

HABILIDAD: MENSAJES DE COBRO: Cuando Santiago diga "genera el mensaje de cobro para [cliente] por $[monto]" o similar, usa la herramienta 'generate_cobro_message' para crear un mensaje profesional listo para copiar y enviar por WhatsApp. Pide el monto si no lo dice.

HABILIDAD: ALERTAS DE CREDENCIALES: Cuando Santiago pregunte "¿alguna clave va a vencer?" o "revisa credenciales", usa 'get_signature_alerts' para escanear todas las claves SRI y alertar sobre las que estén próximas a expirar.`;


// Tool logic implementation
const availableTools: Record<string, (args: any, chatId: string) => Promise<string>> = {
    get_current_time: async ({ timezone }: { timezone?: string }, chatId: string) => {
        const tz = timezone || 'America/Guayaquil';
        return `The current time in ${tz} is ${new Date().toLocaleString('es-EC', { timeZone: tz })}.`;
    },
    read_unread_emails: async (args: any, chatId: string) => {
        return await getUnreadEmails(chatId, args?.maxResults || 5);
    },
    search_emails: async ({ query, maxResults }: { query: string, maxResults?: number }, chatId: string) => {
        return await searchEmails(chatId, query, maxResults);
    },
    send_email: async (args: any, chatId: string) => {
        return await sendEmail(chatId, args.to, args.subject, args.body);
    },
    search_client: async ({ query }: { query: string }, chatId: string) => {
        return await searchClient(query);
    },
    get_database_summary: async (args: any, chatId: string) => {
        return await getDatabaseSummary();
    },
    get_financial_summary: async (args: any, chatId: string) => {
        return await getFinancialSummary();
    },
    update_client_note: async ({ ruc, note }: { ruc: string, note: string }, chatId: string) => {
        return await updateClientData(ruc, { notes: note });
    },
    get_debtor_clients: async (args: any, chatId: string) => {
        return await getDebtorClients();
    },
    get_upcoming_deadlines: async (args: any, chatId: string) => {
        return await getUpcomingDeadlines();
    },
    create_client: async (args: any, chatId: string) => {
        return await createClient(args);
    },
    mark_payment_as_paid: async ({ ruc, type, period }: { ruc: string, type: 'IVA' | 'RENTA' | 'HONORARIOS', period?: string }, chatId: string) => {
        const matches = await findClients(ruc, '*');
        if (matches.length === 0) return `❌ No encontré ningún cliente con "${ruc}". Baku.`;
        if (matches.length > 1) {
            pendingDialogs.set(chatId, {
                type: 'mark_payment',
                chatId,
                step: 'select_client',
                candidates: matches,
                data: {}
            });
            const list = matches.map((c: any, i: number) => `${i + 1}. **${c.name}** (RUC: \`${c.ruc || 'N/A'}\`${c.trade_name ? ` | Comercial: *${c.trade_name}*` : ''}${c.regime ? ` | Régimen: *${c.regime}*` : ''})`).join('\n');
            return `Encontré varios clientes. He iniciado el flujo de confirmación. Por favor, selecciona el número:\n\n${list}\n\nEscribe **cancelar** para salir. Baku.`;
        }

        const client = matches[0];
        const regime = client.regime || 'Régimen General';
        const isPopular = regime === 'Rimpe Negocio Popular';
        const isEmprendedor = regime === 'Rimpe Emprendedor';
        const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

        pendingDialogs.set(chatId, {
            type: 'mark_payment',
            chatId,
            step: 'ask_payment_period',
            client,
            data: period ? { periods: [period] } : {}
        });

        return `He iniciado el flujo interactivo de pago para **${client.name}** (IVA: ${ivaFrequency}). ¿Qué período(s) deseas marcar como pagado? (Escribe el período o 'adelantado'). Baku.`;
    },
    mark_declaration: async ({ ruc, type, period }: { ruc: string, type?: 'IVA' | 'RENTA', period?: string }, chatId: string) => {
        const matches = await findClients(ruc, '*');
        if (matches.length === 0) return `❌ No encontré ningún cliente con "${ruc}". Baku.`;
        if (matches.length > 1) {
            pendingDialogs.set(chatId, {
                type: 'mark_declaration',
                chatId,
                step: 'select_client',
                candidates: matches,
                data: {}
            });
            const list = matches.map((c: any, i: number) => `${i + 1}. **${c.name}** (RUC: \`${c.ruc || 'N/A'}\`${c.trade_name ? ` | Comercial: *${c.trade_name}*` : ''}${c.regime ? ` | Régimen: *${c.regime}*` : ''})`).join('\n');
            return `Encontré varios clientes. He iniciado el flujo de confirmación. Por favor, selecciona el número:\n\n${list}\n\nEscribe **cancelar** para salir. Baku.`;
        }

        const client = matches[0];
        pendingDialogs.set(chatId, {
            type: 'mark_declaration',
            chatId,
            step: type ? 'ask_declaration_period' : 'ask_declaration_type',
            client,
            data: { type, periods: period ? [period] : undefined }
        });

        if (type) {
            return `He iniciado el flujo interactivo de declaración de **${type}** para **${client.name}**. ¿Para qué período es la declaración? Baku.`;
        } else {
            return `He iniciado el flujo interactivo de declaración para **${client.name}**. ¿Qué tipo de declaración es? Responde **IVA** o **RENTA**. Baku.`;
        }
    },
    mark_payment_as_unpaid: async ({ ruc, type, period }: { ruc: string, type: 'IVA' | 'RENTA' | 'HONORARIOS', period?: string }, chatId: string) => {
        return await markPaymentAsUnpaid(ruc, type, period);
    },
    check_sri_credentials: async (args: any, chatId: string) => {
        return await getCredentialStatus();
    },
    web_search_sri: async ({ query }: { query: string }, chatId: string) => {
        console.log(`🌐 Performing live SRI web search for: ${query}`);
        try {
            const response = await openRouterClient.chat.completions.create({
                model: 'perplexity/llama-3-sonar-small-32k-online',
                messages: [{ role: 'user', content: `Busca información actualizada del SRI de Ecuador sobre: ${query}. Responde de forma técnica y concisa para un contador.` }],
                max_tokens: 1024
            });
            return response.choices[0].message.content || 'No se encontró información en la web.';
        } catch (e: any) {
            return `Error en búsqueda web: ${e.message}`;
        }
    },
    clear_chat_history: async (args: any, chatId: string) => {
        await clearChatHistory(chatId);
        return "Chat history cleared. Baku.";
    },
    escudo_fiscal: async (args: any, chatId: string) => {
        return await detectTaxInconsistencies();
    },
    delete_client: async ({ ruc, confirm }: { ruc: string, confirm: boolean }, chatId: string) => {
        return await deleteClient(ruc, confirm);
    },
    create_task: async ({ title, description, dueDate }: { title: string, description: string, dueDate: string }, chatId: string) => {
        return await createTask(title, description, dueDate);
    },
    clear_tasks: async (args: any, chatId: string) => {
        return await clearTasks();
    },
    complete_task: async ({ taskId, action }: { taskId: string, action: 'complete' | 'delete' }, chatId: string) => {
        return await completeTask(taskId, action);
    },
    update_client_profile: async ({ ruc, updates }: { ruc: string, updates: any }, chatId: string) => {
        return await updateClientData(ruc, updates);
    },
    save_memory: async ({ content, category, monthsToKeep }: { content: string, category?: 'preferencias' | 'semanal' | 'fiscal' | 'general', monthsToKeep?: number }, chatId: string) => {
        const success = await saveMemory(chatId, content, category, monthsToKeep);
        return success ? "Memoria guardada con éxito. Baku." : "Error al guardar memoria.";
    },
    get_memories: async ({ limit }: { limit?: number }, chatId: string) => {
        const memories = await getMemories(chatId, limit);
        if (memories.length === 0) return "No hay memorias importantes guardadas todavía. Baku.";
        return memories.map(m => `📌 [${m.category}] ${m.content}`).join('\n');
    },
    get_clients_tax_status_report: async (args: any, chatId: string) => {
        return await getClientsStatusReport();
    },
    get_client_field: async ({ identifier, field }: { identifier: string, field: string }, chatId: string) => {
        return await getClientField(identifier, field);
    },
    quick_update_client: async ({ identifier, field, value }: { identifier: string, field: string, value: any }, chatId: string) => {
        return await quickUpdateClient(identifier, field, value);
    },
    generate_cobro_message: async ({ ruc, clientName, amount, period, paymentInfo }: { ruc: string, clientName?: string, amount?: number, period?: string, paymentInfo?: string }, chatId: string) => {
        // Build a professional WhatsApp payment reminder message
        let client: any = null;
        if (ruc || clientName) {
            const searchResult = await searchClient(ruc || clientName || '');
            const nameDisplay = clientName || ruc;
            if (amount && amount > 0) {
                const periodStr = period ? ` correspondiente al periodo ${period}` : '';
                const payment = paymentInfo || 'transferencia bancaria o efectivo';
                return `💬 *MENSAJE DE COBRO LISTO (copiar y enviar por WhatsApp):*

---
Estimado/a *${nameDisplay}*, le saluda la secretaría de *Soluciones Contables Pro*.

Le comunicamos que se encuentra pendiente el pago de sus honorarios por un valor de *$${amount.toFixed(2)}*${periodStr}.

Por favor, realice el pago por medio de ${payment} a la mayor brevedad posible para mantener sus declaraciones al día y evitar recargos por mora.

Quedamos atentos ante cualquier consulta. ¡Muchas gracias!

*Ing. Santiago Córdova*
*Soluciones Contables Pro*
---

_Baku._`;
            }
        }
        return `❌ Para generar el mensaje de cobro necesito al menos el nombre/RUC del cliente y el monto pendiente. Ejemplo: "Genera el mensaje de cobro para William Cuenca por $15". Baku.`;
    },
    get_signature_alerts: async (args: any, chatId: string) => {
        return await getCredentialStatus();
    },
    get_sri_credential: async ({ ruc }: { ruc: string }, chatId: string) => {
        return await get_sri_credential(ruc);
    }
};

/**
 * Ensures messages are in a format compatible with both Groq and OpenRouter
 * Deep cleans to remove any proprietary fields like 'refusal'.
 * Also truncates very long tool responses to save tokens.
 */
function cleanMessages(messages: any[], maxToolLength: number = 600, maxGeneralLength: number = 1500): any[] {
    const cleaned = messages.map(m => {
        const clean: any = { role: m.role };
        
        // Ensure content is string or null
        if (m.content !== undefined && m.content !== null) {
            let text = String(m.content);
            // REDUCCIÓN DINÁMICA SEGÚN MODELO ACTIVO
            if (m.role === 'tool' && text.length > maxToolLength) {
                text = text.substring(0, maxToolLength) + '... [Resumen Baku]';
            } else if (text.length > maxGeneralLength) {
                text = text.substring(0, maxGeneralLength) + '... [Truncado]';
            }
            clean.content = text;
        } else {
            clean.content = null;
        }

        if (m.tool_calls && Array.isArray(m.tool_calls)) {
            clean.tool_calls = m.tool_calls.map((tc: any) => {
                let safeName = tc.function?.name || 'unknown_tool';
                
                // Fix LLM hallucinations where JSON arguments are put into the tool name
                if (safeName.includes('{')) {
                    safeName = safeName.split('{')[0].trim();
                }
                
                // Ensure name conforms to standard regex ^[a-zA-Z0-9_-]{1,64}$
                safeName = safeName.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);
                if (!safeName) safeName = 'unknown_tool';

                return {
                    id: tc.id,
                    type: tc.type || 'function',
                    function: {
                        name: safeName,
                        arguments: tc.function?.arguments || '{}'
                    }
                };
            });
        }
        
        if (m.tool_call_id) clean.tool_call_id = m.tool_call_id;
        if (m.name) clean.name = m.name;
        
        
        return clean;
    });
    
    // Validate tool_calls sequence to prevent 400 Bad Request
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i].role === 'assistant' && cleaned[i].tool_calls) {
            // Check if the next message is a tool response
            let hasMatchingToolResponse = false;
            for (let j = i + 1; j < cleaned.length; j++) {
                if (cleaned[j].role === 'tool') {
                    // Check if it matches any of the tool calls
                    if (cleaned[i].tool_calls.some((tc: any) => tc.id === cleaned[j].tool_call_id)) {
                        hasMatchingToolResponse = true;
                        break;
                    }
                } else if (cleaned[j].role === 'user' || cleaned[j].role === 'assistant') {
                    // Sequence broken
                    break;
                }
            }
            if (!hasMatchingToolResponse) {
                // Remove dangling tool_calls to avoid 400 errors
                delete cleaned[i].tool_calls;
            }
        }
    }
    
    return cleaned;
}

// Tool Definitions for LLM
const toolDefinitions = [
    { type: "function", function: { name: "get_current_time", description: "Hora actual.", parameters: { type: "object", properties: { timezone: { type: "string" } } } } },
    { type: "function", function: { name: "get_database_summary", description: "Resumen global cartera (conteo clientes).", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "get_financial_summary", description: "Reporte de recaudación y honorarios del mes actual.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "read_unread_emails", description: "Lee Gmail unread.", parameters: { type: "object", properties: { maxResults: { type: "number" } } } } },
    { type: "function", function: { name: "search_emails", description: "Busca Gmail.", parameters: { type: "object", properties: { query: { type: "string" }, maxResults: { type: "number" } }, required: ["query"] } } },
    { type: "function", function: { name: "send_email", description: "Envía Gmail.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } } },
    { type: "function", function: { name: "search_client", description: "Busca cliente x RUC/nombre.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "update_client_note", description: "Nota en expediente.", parameters: { type: "object", properties: { ruc: { type: "string" }, note: { type: "string" } }, required: ["ruc", "note"] } } },
    { type: "function", function: { name: "get_debtor_clients", description: "Lista deudores." } },
    { type: "function", function: { name: "get_upcoming_deadlines", description: "Vencimientos SRI 7 días." } },
    { type: "function", function: { name: "create_client", description: "Nuevo cliente.", parameters: { type: "object", properties: { ruc: { type: "string" }, name: { type: "string" }, regime: { type: "string", enum: ["Régimen General", "Rimpe Emprendedor", "Rimpe Negocio Popular"] }, sriPassword: { type: "string" }, email: { type: "string" }, phones: { type: "array", items: { type: "string" } } }, required: ["ruc", "name", "regime", "sriPassword"] } } },
    { type: "function", function: { name: "mark_payment_as_paid", description: "Marca pago (IVA/RENTA/HONORARIOS).", parameters: { type: "object", properties: { ruc: { type: "string" }, type: { type: "string", enum: ["IVA", "RENTA", "HONORARIOS"] }, period: { type: "string", description: "YYYY-MM" } }, required: ["ruc", "type"] } } },
    { type: "function", function: { name: "mark_declaration", description: "Inicia el flujo interactivo de declaración del SRI (IVA/RENTA) para un cliente.", parameters: { type: "object", properties: { ruc: { type: "string" }, type: { type: "string", enum: ["IVA", "RENTA"] }, period: { type: "string", description: "YYYY-MM" } }, required: ["ruc"] } } },
    { type: "function", function: { name: "mark_payment_as_unpaid", description: "Revierte pago a PENDIENTE (IVA/RENTA/HONORARIOS).", parameters: { type: "object", properties: { ruc: { type: "string" }, type: { type: "string", enum: ["IVA", "RENTA", "HONORARIOS"] }, period: { type: "string", description: "YYYY-MM" } }, required: ["ruc", "type"] } } },
    { type: "function", function: { name: "check_sri_credentials", description: "Salud credenciales SRI." } },
    { type: "function", function: { name: "clear_chat_history", description: "Limpia historial chat.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "web_search_sri", description: "Busca leyes SRI web.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "escudo_fiscal", description: "Escaneo inconsistencias." } },
    { type: "function", function: { name: "delete_client", description: "Borra cliente.", parameters: { type: "object", properties: { ruc: { type: "string" }, confirm: { type: "boolean" } }, required: ["ruc", "confirm"] } } },
    { type: "function", function: { name: "create_task", description: "Nueva tarea agenda.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, dueDate: { type: "string" } }, required: ["title", "dueDate"] } } },
    { type: "function", function: { name: "clear_tasks", description: "Borra todas las tareas.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "complete_task", description: "Completa o borra tarea.", parameters: { type: "object", properties: { taskId: { type: "string" }, action: { type: "string", enum: ["complete", "delete"] } }, required: ["taskId", "action"] } } },
    { type: "function", function: { name: "update_client_profile", description: "Update campos perfil.", parameters: { type: "object", properties: { ruc: { type: "string" }, updates: { type: "object" } }, required: ["ruc", "updates"] } } },
    { type: "function", function: { name: "save_memory", description: "Guarda memoria LP.", parameters: { type: "object", properties: { content: { type: "string" }, category: { type: "string", enum: ["preferencias", "semanal", "fiscal", "general"] }, monthsToKeep: { type: "number" } }, required: ["content"] } } },
    { type: "function", function: { name: "get_memories", description: "Recupera memoria LP.", parameters: { type: "object", properties: { limit: { type: "number" } } } } },
    { type: "function", function: { name: "get_clients_tax_status_report", description: "Obtiene reporte detallado de clientes SRI: quiénes son mensuales, quiénes semestrales, quiénes ya declararon y quiénes faltan.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "get_client_field", description: "Lee UN SOLO campo de un cliente. PREFERIR sobre search_client para consultas de campo único. Campos: sri_password, email, phones, address, regime, name, trade_name, iessPassword, electronicSignaturePassword, signatureExpirationDate, sharedAccessKey, notes, economicActivity.", parameters: { type: "object", properties: { identifier: { type: "string", description: "Nombre o RUC del cliente" }, field: { type: "string", description: "Campo exacto a leer" } }, required: ["identifier", "field"] } } },
    { type: "function", function: { name: "quick_update_client", description: "Edita UN SOLO campo de un cliente de forma directa. PREFERIR sobre update_client_profile para ediciones simples.", parameters: { type: "object", properties: { identifier: { type: "string", description: "Nombre o RUC del cliente" }, field: { type: "string", description: "Campo a actualizar" }, value: { description: "Nuevo valor" } }, required: ["identifier", "field", "value"] } } },
    { type: "function", function: { name: "generate_cobro_message", description: "Genera mensaje profesional de cobro listo para enviar por WhatsApp. Úsalo cuando Santiago pida 'generar mensaje de cobro', 'redactar cobro', 'mensaje para cobrar' a un cliente.", parameters: { type: "object", properties: { ruc: { type: "string", description: "RUC del cliente (opcional si se da nombre)" }, clientName: { type: "string", description: "Nombre del cliente" }, amount: { type: "number", description: "Monto a cobrar en USD" }, period: { type: "string", description: "Periodo de la deuda ej: Mayo 2026" }, paymentInfo: { type: "string", description: "Método de pago preferido (opcional)" } }, required: ["amount"] } } },
    { type: "function", function: { name: "get_signature_alerts", description: "Revisa el estado de las credenciales SRI de todos los clientes y alerta sobre contraseñas próximas a expirar o vencidas.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "get_sri_credential", description: "Busca la clave SRI de un cliente que no está en el sistema, pero sí en la base de datos de claves locales importadas. Úsalo si el RUC no está en la base de datos principal pero necesitas su clave.", parameters: { type: "object", properties: { ruc: { type: "string", description: "El número de RUC completo (13 dígitos)" } }, required: ["ruc"] } } }
];

export async function processChatWithAgentLoop(chatId: string, userMessage: string): Promise<string> {
    // 1. Save user message to DB
    await saveMessage(chatId, 'user', userMessage);

    // 2. Fetch history (Increased to 10 messages for better context since Gemini has high limits)
    const history = await getChatHistory(chatId, 10);
    
    // 3. Fetch long-term memories
    const memories = await getMemories(chatId, 3);
    const memoryContext = memories.length > 0 
        ? `\nMEMORIAS:\n${memories.map(m => `- ${m.content}`).join('\n')}`
        : "";

    const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT + memoryContext },
        ...history
    ];

    let loopCount = 0;
    const MAX_LOOPS = 10; // Increased to handle complex tool chains
    const executedToolCalls = new Set<string>();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
    while (loopCount < MAX_LOOPS) {
        loopCount++;
        console.log(`Agent Loop ${loopCount} for chat ${chatId}`);

        let response;
        let lastError = "";
               // --- 1. TRY DIRECT GOOGLE GEMINI 2.0 (Fast, direct, OpenAI-compatible, generous limits) ---
        if (GEMINI_API_KEY) {
            try {
                console.log("📡 Attempting Primary (Direct Google Gemini 2.0 Flash)...");
                const directGoogleClient = new OpenAI({
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                    apiKey: GEMINI_API_KEY,
                });
                response = await directGoogleClient.chat.completions.create({
                    messages: cleanMessages(messages, 15000, 20000) as any,
                    model: 'gemini-2.0-flash',
                    tools: toolDefinitions as any,
                    tool_choice: "auto",
                    max_tokens: 1500
                });
                console.log(`✅ Direct Gemini Success`);
            } catch (error: any) {
                console.error('⚠️ Direct Gemini Error:', error.message);
                lastError = `DirectGemini: ${error.message}`;
            }
        }

        // --- 2. TRY OPENROUTER GEMINI 2.0 (Fallback if direct fails or key not set) ---
        if (!response) {
            try {
                console.log("📡 Attempting Secondary (Gemini 2.0 Flash via OpenRouter)...");
                response = await openRouterClient.chat.completions.create({
                    messages: cleanMessages(messages, 15000, 20000) as any,
                    model: 'google/gemini-2.0-flash-001',
                    tools: toolDefinitions as any,
                    tool_choice: "auto",
                    max_tokens: 1500
                });
                console.log(`✅ OpenRouter Gemini Success`);
            } catch (error: any) {
                console.error('⚠️ OpenRouter Gemini Error:', error.message);
                lastError += ` | OpenRouterGemini: ${error.message}`;
            }
        }

        if (!response) {
            // --- 3. GROQ via OpenAI-compatible client (supports tool calling, free, no credits) ---
            if (groqOpenAIClient) {
                try {
                    console.log("📡 Attempting Groq (Llama 3.3 70B via OpenAI client with tools)...");
                    response = await groqOpenAIClient.chat.completions.create({
                        messages: cleanMessages(messages, 5000, 7000) as any,
                        model: 'llama-3.3-70b-versatile',
                        tools: toolDefinitions as any,
                        tool_choice: "auto",
                        max_tokens: 1200,
                        temperature: 0.5,
                    });
                    console.log('✅ Groq Tool-Calling Success');
                } catch (groqError: any) {
                    console.error('⚠️ Groq Error:', groqError.message);
                    lastError += ` | Groq: ${groqError.message}`;
                }
            }
        }

        if (!response) {
            // --- 4. OPENROUTER FREE MODELS (try multiple, no credits needed) ---
            const freeModels = [
                'meta-llama/llama-3.3-70b-instruct:free',
                'mistralai/mistral-7b-instruct:free',
                'google/gemma-3-27b-it:free',
            ];
            for (const freeModel of freeModels) {
                if (response) break;
                try {
                    console.log(`📡 Attempting OpenRouter Free: ${freeModel}...`);
                    response = await openRouterClient.chat.completions.create({
                        messages: cleanMessages(messages, 3000, 4000) as any,
                        model: freeModel,
                        tools: toolDefinitions as any,
                        tool_choice: "auto",
                        max_tokens: 900
                    });
                    console.log(`✅ OpenRouter Free Success (${freeModel})`);
                } catch (freeError: any) {
                    console.error(`⚠️ OpenRouter Free Error (${freeModel}):`, freeError.message);
                    lastError += ` | ${freeModel.split('/')[1]}: ${freeError.message}`;
                }
            }
        }

        if (!response) {
            // --- 5. GOOGLE SDK (Gemini 1.5 Flash last resort) ---
            if (GEMINI_API_KEY) {
                try {
                    console.log("📡 Attempting Google SDK (Gemini 1.5 Flash)...");
                    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({
                        model: "gemini-1.5-flash",
                        systemInstruction: SYSTEM_PROMPT
                    });
                    const conversationContext = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
                    const result = await model.generateContent(conversationContext);
                    const text = result.response.text();
                    if (text) {
                        await saveMessage(chatId, 'assistant', text);
                        return text;
                    }
                } catch (gError: any) {
                    lastError += ` | GeminiSDK: ${gError.message}`;
                }
            }
        }

        if (!response) {
            // Build actionable error message
            const tips: string[] = [];
            if (!GEMINI_API_KEY) tips.push("• *GEMINI_API_KEY* no está configurada en Render");
            else tips.push("• *GEMINI_API_KEY* activa pero da error 400 — posiblemente caducada o inválida");
            if (!GROQ_API_KEY) tips.push("• *GROQ_API_KEY* no está configurada (crea una gratis en console.groq.com)");
            tips.push("• *OpenRouter* sin créditos — recargar $5 en openrouter.ai para Gemini, o solo configurar GROQ_API_KEY");
            return `⚠️ *Baku sin conexión de IA.*\n\n*Diagnóstico:*\n${tips.join('\n')}\n\n_Baku._`;
        }



        if (!response || !response.choices || response.choices.length === 0 || !response.choices[0].message) {
            return "Lo siento, Santiago, mi conexión con los servidores de inteligencia se interrumpió o no recibí una respuesta válida. Intenta de nuevo. Baku.";
        }

        const responseMessage = response.choices[0].message;

        // Save assistant message that may contain text and/or tool_calls
        await saveMessage(chatId, 'assistant', responseMessage.content, responseMessage.tool_calls);
        messages.push(responseMessage as any);

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            // Loop tools
            for (const tc of responseMessage.tool_calls) {
                const toolCall = tc as any;
                
                // Prevent duplicate tool calls in the same loop (Protection)
                const callFingerprint = `${toolCall.function.name}:${toolCall.function.arguments}`;
                if (executedToolCalls.has(callFingerprint)) {
                  console.warn(`🛑 Duplicate tool call detected: ${callFingerprint}. Breaking loop.`);
                  return responseMessage.content || "Se ha detectado un bucle de herramientas. ¿En qué más puedo ayudarte? Baku.";
                }
                executedToolCalls.add(callFingerprint);

                let toolResponse = '';
                try {
                    const functionName = toolCall.function.name;
                    // OpenRouter might pass toolCall natively or stringified
                    const args = typeof toolCall.function.arguments === 'string'
                        ? JSON.parse(toolCall.function.arguments || '{}')
                        : toolCall.function.arguments;

                    if (availableTools[functionName]) {
                        console.log(`🛠️ Executing tool: ${functionName}`, args);
                        // Execute tool
                        toolResponse = await availableTools[functionName](args, chatId);
                    } else {
                        console.warn(`Tool not found: ${functionName}`);
                        toolResponse = `Error: Tool ${functionName} not found. Baku.`;
                    }
                } catch (e: any) {
                    console.error("Tool execution error:", e);
                    toolResponse = `Error executing tool ${toolCall.function.name}: ${e.message}. Baku.`;
                }

                // Save tool response
                await saveMessage(chatId, 'tool', toolResponse, null, toolCall.id, toolCall.function.name);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: toolResponse
                });
            }
        } else {
            // No more tool calls, we are done
            return responseMessage.content || "He procesado tu solicitud, Santiago. ¿Necesitas algo más? Baku.";
        }
    }

    return "Se alcanzó el límite de pensamiento (loops) de Baku. Por favor, sé más específico. Baku.";
}
