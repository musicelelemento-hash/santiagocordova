import Groq from 'groq-sdk';
import { OpenAI } from 'openai';
import { getChatHistory, saveMessage, saveMemory, getMemories } from './database';
import { searchEmails, sendEmail, getUnreadEmails } from './gmail';
import { searchClient, updateClientData, getDatabaseSummary, getDebtorClients, getUpcomingDeadlines, createClient, markPaymentAsPaid, markPaymentAsUnpaid, getCredentialStatus, bulkUpdateVipStatus, detectTaxInconsistencies, deleteClient, createTask, completeTask, clearTasks } from './database_ops';
import { clearChatHistory } from './database';
import { GoogleGenerativeAI } from '@google/generative-ai';

require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

const groqClient = new Groq({ apiKey: GROQ_API_KEY });
const openRouterClient = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://santiagocordova.com',
        'X-Title': 'SantiagoBot',
    },
});

export const BOT_NAME = "SantiagoBot";
export const STATUS_ICON = "⚡🛡️ [STITCH ELITE v5.0]";

const SYSTEM_PROMPT = `Baku: Comandante de Operaciones de Santiago. Excelencia absoluta, estatus de elite.
FILOSOFÍA STITCH: "La tecnología no es un fin, es el medio para la perfección."
REGLAS:
1. Solo datos. Firma: "Baku."
Santiago es el soberano; Baku es el núcleo. Baku: Control total.`;

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
        return await markPaymentAsPaid(ruc, type, period);
    },
    mark_payment_as_unpaid: async ({ ruc, type, period }: { ruc: string, type: 'IVA' | 'RENTA' | 'HONORARIOS', period?: string }, chatId: string) => {
        return await markPaymentAsUnpaid(ruc, type, period);
    },
    check_sri_credentials: async (args: any, chatId: string) => {
        return await getCredentialStatus();
    },
    bulk_update_vip_status: async ({ isVip, rucs }: { isVip: boolean, rucs?: string[] }, chatId: string) => {
        return await bulkUpdateVipStatus(isVip, rucs);
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
    }
};

/**
 * Ensures messages are in a format compatible with both Groq and OpenRouter
 * Deep cleans to remove any proprietary fields like 'refusal'.
 * Also truncates very long tool responses to save tokens.
 */
function cleanMessages(messages: any[]): any[] {
    return messages.map(m => {
        const clean: any = { role: m.role };
        
        // Ensure content is string or null
        if (m.content !== undefined && m.content !== null) {
            let text = String(m.content);
            // REDUCCIÓN AGRESIVA PARA EVITAR 429 (Groq TPD)
            if (m.role === 'tool' && text.length > 600) {
                text = text.substring(0, 600) + '... [Resumen Baku]';
            } else if (text.length > 1500) {
                text = text.substring(0, 1500) + '... [Truncado]';
            }
            clean.content = text;
        } else {
            clean.content = null;
        }

        if (m.tool_calls && Array.isArray(m.tool_calls)) {
            clean.tool_calls = m.tool_calls.map((tc: any) => ({
                id: tc.id,
                type: tc.type || 'function',
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments
                }
            }));
        }
        
        if (m.tool_call_id) clean.tool_call_id = m.tool_call_id;
        if (m.name) clean.name = m.name;
        
        return clean;
    });
}

// Tool Definitions for LLM
const toolDefinitions = [
    { type: "function", function: { name: "get_current_time", description: "Hora actual.", parameters: { type: "object", properties: { timezone: { type: "string" } } } } },
    { type: "function", function: { name: "get_database_summary", description: "Resumen global cartera.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "read_unread_emails", description: "Lee Gmail unread.", parameters: { type: "object", properties: { maxResults: { type: "number" } } } } },
    { type: "function", function: { name: "search_emails", description: "Busca Gmail.", parameters: { type: "object", properties: { query: { type: "string" }, maxResults: { type: "number" } }, required: ["query"] } } },
    { type: "function", function: { name: "send_email", description: "Envía Gmail.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } } },
    { type: "function", function: { name: "search_client", description: "Busca cliente x RUC/nombre.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "update_client_note", description: "Nota en expediente.", parameters: { type: "object", properties: { ruc: { type: "string" }, note: { type: "string" } }, required: ["ruc", "note"] } } },
    { type: "function", function: { name: "get_debtor_clients", description: "Lista deudores." } },
    { type: "function", function: { name: "get_upcoming_deadlines", description: "Vencimientos SRI 7 días." } },
    { type: "function", function: { name: "create_client", description: "Nuevo cliente.", parameters: { type: "object", properties: { ruc: { type: "string" }, name: { type: "string" }, regime: { type: "string", enum: ["Régimen General", "Rimpe Emprendedor", "Rimpe Negocio Popular"] }, sriPassword: { type: "string" }, email: { type: "string" }, phones: { type: "array", items: { type: "string" } } }, required: ["ruc", "name", "regime", "sriPassword"] } } },
    { type: "function", function: { name: "mark_payment_as_paid", description: "Marca pago (IVA/RENTA/HONORARIOS).", parameters: { type: "object", properties: { ruc: { type: "string" }, type: { type: "string", enum: ["IVA", "RENTA", "HONORARIOS"] }, period: { type: "string", description: "YYYY-MM" } }, required: ["ruc", "type"] } } },
    { type: "function", function: { name: "mark_payment_as_unpaid", description: "Revierte pago a PENDIENTE (IVA/RENTA/HONORARIOS).", parameters: { type: "object", properties: { ruc: { type: "string" }, type: { type: "string", enum: ["IVA", "RENTA", "HONORARIOS"] }, period: { type: "string", description: "YYYY-MM" } }, required: ["ruc", "type"] } } },
    { type: "function", function: { name: "check_sri_credentials", description: "Salud credenciales SRI." } },
    { type: "function", function: { name: "bulk_update_vip_status", description: "Update VIP masivo.", parameters: { type: "object", properties: { isVip: { type: "boolean" }, rucs: { type: "array", items: { type: "string" } } }, required: ["isVip"] } } },
    { type: "function", function: { name: "clear_chat_history", description: "Limpia historial chat.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "web_search_sri", description: "Busca leyes SRI web.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "escudo_fiscal", description: "Escaneo inconsistencias." } },
    { type: "function", function: { name: "delete_client", description: "Borra cliente.", parameters: { type: "object", properties: { ruc: { type: "string" }, confirm: { type: "boolean" } }, required: ["ruc", "confirm"] } } },
    { type: "function", function: { name: "create_task", description: "Nueva tarea agenda.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, dueDate: { type: "string" } }, required: ["title", "dueDate"] } } },
    { type: "function", function: { name: "clear_tasks", description: "Borra todas las tareas.", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "complete_task", description: "Completa o borra tarea.", parameters: { type: "object", properties: { taskId: { type: "string" }, action: { type: "string", enum: ["complete", "delete"] } }, required: ["taskId", "action"] } } },
    { type: "function", function: { name: "update_client_profile", description: "Update campos perfil.", parameters: { type: "object", properties: { ruc: { type: "string" }, updates: { type: "object" } }, required: ["ruc", "updates"] } } },
    { type: "function", function: { name: "save_memory", description: "Guarda memoria LP.", parameters: { type: "object", properties: { content: { type: "string" }, category: { type: "string", enum: ["preferencias", "semanal", "fiscal", "general"] }, monthsToKeep: { type: "number" } }, required: ["content"] } } },
    { type: "function", function: { name: "get_memories", description: "Recupera memoria LP.", parameters: { type: "object", properties: { limit: { type: "number" } } } } }
];

export async function processChatWithAgentLoop(chatId: string, userMessage: string): Promise<string> {
    // 1. Save user message to DB
    await saveMessage(chatId, 'user', userMessage);

    // 2. Fetch history (Ultra-minimal to save TPD)
    const history = await getChatHistory(chatId, 2);
    
    // 3. Fetch long-term memories
    const memories = await getMemories(chatId, 3);
    const memoryContext = memories.length > 0 
        ? `\nMEMORIAS:\n${memories.map(m => `- ${m.content}`).join('\n')}`
        : "";

    const messages: any[] = cleanMessages([
        { role: 'system', content: SYSTEM_PROMPT + memoryContext },
        ...history
    ]);

    let loopCount = 0;
    const MAX_LOOPS = 10; // Increased to handle complex tool chains
    const executedToolCalls = new Set<string>();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
    while (loopCount < MAX_LOOPS) {
        loopCount++;
        console.log(`Agent Loop ${loopCount} for chat ${chatId}`);

        let response;
        let lastError = "";
        
        // --- 1. TRY OPENROUTER GEMINI 2.0 (Main - Generous limits) ---
        try {
            console.log("📡 Attempting Primary (Gemini 2.0 Flash via OpenRouter)...");
            response = await openRouterClient.chat.completions.create({
                messages: cleanMessages(messages) as any,
                model: 'google/gemini-2.0-flash-001',
                tools: toolDefinitions as any,
                tool_choice: "auto",
                max_tokens: 1024
            });
            console.log(`✅ Gemini Primary Success`);
        } catch (error: any) {
            console.error('⚠️ Gemini Primary Error:', error.message);
            lastError = `Gemini: ${error.message}`;
            
            // --- 2. TRY GROQ (Fallback 1 - Strict limits) ---
            try {
                console.log(`📡 Groq Fallback 1: llama-3.3-70b-versatile...`);
                response = await groqClient.chat.completions.create({
                    messages: cleanMessages(messages) as any,
                    model: 'llama-3.3-70b-versatile',
                    tools: toolDefinitions as any,
                    tool_choice: "auto",
                    max_tokens: 1024
                });
                console.log(`✅ Groq Success`);
            } catch (paidError: any) {
                console.error(`⚠️ Groq Error:`, paidError.message);
                lastError += ` | Groq: ${paidError.message}`;
                
                // --- 3. TRY OPENROUTER FREE POOL (Free Emergency) ---
                const freeModels = [
                    'google/gemini-2.0-flash-001',
                    'google/gemini-2.0-flash-lite-preview-02-05:free',
                    'meta-llama/llama-3.1-8b-instruct:free',
                    'meta-llama/llama-3.1-405b-instruct',
                    'qwen/qwen-2.5-72b-instruct:free',
                    'deepseek/deepseek-chat:free'
                ];

                for (const freeModel of freeModels) {
                    try {
                        console.log(`📡 OpenRouter Fallback 2: ${freeModel}...`);
                        response = await openRouterClient.chat.completions.create({
                            messages: cleanMessages(messages) as any,
                            model: freeModel,
                            tools: toolDefinitions as any,
                            tool_choice: "auto",
                            max_tokens: 800
                        });
                        console.log(`✅ Success with ${freeModel}`);
                        break; 
                    } catch (freeError: any) {
                        console.warn(`⚠️ ${freeModel} failed:`, freeError.message);
                        lastError += ` | ${freeModel}: ${freeError.message}`;
                    }
                }

                if (!response && GEMINI_API_KEY) {
                    // --- 4. DIRECT GOOGLE FALLBACK (If key available) ---
                    try {
                        console.log("📡 Attempting Direct Google Gemini...");
                        // Use systemInstruction for proper persona adherence
                        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                        const model = genAI.getGenerativeModel({ 
                            model: "gemini-1.5-flash",
                            systemInstruction: SYSTEM_PROMPT 
                        });
                        
                        const conversationContext = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
                        const result = await model.generateContent(conversationContext);
                        const text = result.response.text();
                        return text; 
                    } catch (gError: any) {
                        lastError += ` | GeminiDirect: ${gError.message}`;
                    }
                }

                if (!response) {
                    return `Santiago, saturación crítica de IA. Baku está cansada.\n\nFallas:\n- Groq: Superó TPD (100k).\n- OpenRouter: ${lastError.substring(0, 100)}...\n\nSugerencia: Recarga $5 en OpenRouter o espera 20 min. Baku.`;
                }
            }
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
