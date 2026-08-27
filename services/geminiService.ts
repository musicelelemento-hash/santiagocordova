
import { GoogleGenAI } from "@google/genai";
import { getProxyClient, isProxyConfigured, GeminiProxyRequest, GeminiProxyResponse } from "./geminiProxyClient";
import { Client, Task, AnalysisType, TaxRegime, Message } from "../types";

/**
 * Interfaz común para ambos backends de IA:
 *  - Proxy serverless (recomendado): la API key vive en el backend, nunca en el bundle.
 *  - SDK directo con VITE_GEMINI_API_KEY: modo legado/desarrollo local.
 */
type AIClientLike = {
  models: {
    generateContent: (req: GeminiProxyRequest) => Promise<GeminiProxyResponse>;
  };
};

// Inicialización del cliente AI
const getAIClient = (): AIClientLike | null => {
  // Si hay proxy configurado, la API key NO viaja al navegador.
  if (isProxyConfigured()) return getProxyClient();
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI(apiKey) as unknown as AIClientLike;
};

export const summarizeTextWithGemini = async (text: string): Promise<string> => {
  if (!text || text.trim().length < 5) return "";
  try {
    const ai = getAIClient();
    if (!ai) return text.substring(0, 100) + "...";

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Eres un asistente contable experto. Resume la siguiente nota de cliente en una frase ejecutiva y accionable: "${text}"` }] }],
    });
    return response.text || text;
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return text;
  }
};

/**
 * Análisis PROFESIONAL de Certificados de RUC (PDF)
 * Especializado en estructura del SRI Ecuador.
 */
export const analyzeClientPhoto = async (base64Data: string, mimeType: string): Promise<Partial<Client> & { phone?: string }> => {
  try {
    const ai = getAIClient();

    // Validación estricta para asegurar que procesamos el formato correcto si es posible
    const effectiveMime = mimeType === 'application/pdf' ? 'application/pdf' : mimeType;

    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType: effectiveMime } },
            {
              text: `
                        Eres un Auditor Tributario del SRI (Ecuador). Analiza este Certificado de RUC.
                        
                        EXTRAE CON PRECISIÓN QUIRÚRGICA:
                        1. **RUC**: 13 dígitos exactos.
                        2. **Razón Social**: Nombre completo o Razón Social.
                        3. **Régimen (CRÍTICO)**: 
                           - "RIMPE NEGOCIO POPULAR" -> "${TaxRegime.RimpeNegocioPopular}"
                           - "RIMPE EMPRENDEDOR" -> "${TaxRegime.RimpeEmprendedor}"
                           - Si no dice RIMPE -> "${TaxRegime.General}"
                        4. **Contactos (BUSCA EN TODO EL DOCUMENTO)**: 
                           - Email: Busca patrones de correo (@) en la sección "Medios de Contacto" o "Ubicación".
                           - Celular: Busca números de 10 dígitos que empiecen con '09'. Prioriza celulares sobre fivos.
                        5. **Dirección**: Calle, número, intersección y parroquia.
                        6. **Actividad**: La actividad principal listada.
                        7. **Obligaciones (PERIODICIDAD)**:
                           - Lee la sección "Obligaciones Tributarias".
                           - Si encuentras la palabra "SEMESTRAL" junto a "IVA" -> Escribe en notas: "OBLIGACIÓN SEMESTRAL DETECTADA".
                           - Si solo dice "DECLARACIÓN DE IVA" o "MENSUAL" -> Escribe en notas: "OBLIGACIÓN MENSUAL DETECTADA".
                           - Copia textualmente las obligaciones encontradas en el campo 'notes'.

                        JSON RETURN:
                        {
                            "ruc": "string",
                            "name": "string",
                            "email": "string", 
                            "phones": ["string"],
                            "address": "string",
                            "economicActivity": "string",
                            "regime": "string",
                            "notes": "string",
                            "isArtisan": boolean
                        }
                    ` }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.0
        }
      });

      const text = response.text || "{}";
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);

      return {
        ...data,
        phones: Array.isArray(data.phones) ? data.phones : (data.phones ? [data.phones] : [])
      };
    }

    // MOCK FALLBACK: NO devolver datos falsos de demostración — eso creaba clientes inventados.
    // Mejor lanzar un error claro para que el usuario sepa que falta configurar la IA.
    throw new Error("IA de análisis no configurada. Configura el proxy de Gemini (VITE_GEMINI_PROXY_URL) o VITE_GEMINI_API_KEY.");

  } catch (error) {
    console.error("Gemini Document Error:", error);
    throw new Error("No se pudo procesar el documento. Asegúrese de que el archivo no esté protegido.");
  }
};

export const runStrategicAnalysis = async (clients: Client[], tasks: Task[], type: AnalysisType): Promise<string> => {
  try {
    const ai = getAIClient();
    if (!ai) throw new Error("No API Key");

    const dataSnippet = JSON.stringify({
      totalClients: clients.length,
      activeClients: clients.filter(c => c.isActive).length,
      regimes: clients.reduce((acc: any, c) => { acc[c.regime] = (acc[c.regime] || 0) + 1; return acc; }, {}),
      pendingTasks: tasks.filter(t => t.status !== 'Pagada' && t.status !== 'Completada').length,
      totalIncome: tasks.filter(t => t.status === 'Pagada').reduce((sum, t) => sum + (t.cost || 0), 0)
    });

    const promptMap: Record<AnalysisType, string> = {
      [AnalysisType.Cashflow]: "Analiza el flujo de caja potencial vs real. Identifica cuellos de botella en la cobranza.",
      [AnalysisType.RiskMatrix]: "Evalúa el riesgo de la cartera de clientes basado en la distribución de regímenes y estados.",
      [AnalysisType.Optimization]: "Sugiere 3 estrategias para aumentar la facturación promedio por cliente.",
      [AnalysisType.Efficiency]: "Analiza la eficiencia operativa basada en la relación tareas pendientes vs completadas.",
      [AnalysisType.Strategic]: "Realiza un análisis estratégico integral de la salud del negocio, integrando finanzas, clientes y operaciones. Proporciona una hoja de ruta de alto nivel para el crecimiento."
    };

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `
                Eres un consultor de negocios senior para un estudio contable en Ecuador.
                Basado en estos datos anonimizados: ${dataSnippet}
                
                Realiza un: ${promptMap[type]}
                
                Formato de respuesta: HTML limpio (usando <h3>, <p>, <ul>, <li>, <strong>). Sé directo, profesional y estratégico.
            ` }]
      }],
    });

    return response.text || "Análisis no disponible.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return `
            <h3>Modo Offline</h3>
            <p>No se pudo conectar con el motor de IA. Verifique su conexión o clave API.</p>
        `;
  }
};


export const getAssistantResponse = async (messages: Message[], clients: Client[], tasks: Task[]): Promise<string> => {
    try {
        const ai = getAIClient();
        if (!ai) return "Lo siento, para asistirte necesito mi 'cerebro' conectado (falta API Key). Pero envíame tu duda y trataré de responderte con mi lógica base por ahora.";

        // Support Functions for Tools
        const functions: Record<string, Function> = {
            search_clients: ({ query }: { query: string }) => {
                const search = query.toLowerCase();
                return clients
                    .filter(c => c.name.toLowerCase().includes(search) || c.ruc.includes(search))
                    .map(c => ({ name: c.name, ruc: c.ruc, regime: c.regime }));
            },
            get_client_details: ({ ruc }: { ruc: string }) => {
                const client = clients.find(c => c.ruc === ruc);
                if (!client) return { error: "Cliente no encontrado" };
                
                const clientTasks = tasks.filter(t => t.clientId === client.id);
                const debt = clientTasks
                    .filter(t => t.status !== 'Pagada' && t.status !== 'Completada')
                    .reduce((sum, t) => sum + (t.cost || 0), 0);
                
                return {
                    name: client.name,
                    ruc: client.ruc,
                    regime: client.regime,
                    debt: debt,
                    email: client.email || 'No registrado',
                    phone: client.phones?.[0] || 'No registrado'
                };
            },
            get_financial_summary: () => {
                const paid = tasks.filter(t => t.status === 'Pagada').reduce((s, t) => s + (t.cost || 0), 0);
                const pending = tasks.filter(t => t.status !== 'Pagada' && t.status !== 'Completada').length;
                return {
                    totalRevenueCollected: paid,
                    pendingTaskCount: pending,
                    activeClients: clients.filter(c => c.isActive).length
                };
            }
        };

        const toolDeclarations: any[] = [
            {
                name: "search_clients",
                description: "Busca clientes por nombre, razón social o RUC.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "El término de búsqueda (nombre o RUC)" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_client_details",
                description: "Obtiene los detalles completos de un cliente específico, incluyendo deudas y régimen.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        ruc: { type: "STRING", description: "El RUC del cliente" }
                    },
                    required: ["ruc"]
                }
            },
            {
                name: "get_financial_summary",
                description: "Obtiene un resumen financiero del mes actual (honorarios recaudados, tareas pendientes).",
                parameters: {
                    type: "OBJECT",
                    properties: {}
                }
            }
        ];

        let history: any[] = [
            {
                role: 'user',
                parts: [{ text: `
                    Eres el "Elite Accounting Assistant" de Soluciones Contables Pro (Ecuador).
                    Tu jefe es el Ing. Santiago Córdova.
                    
                    TIENES ACCESO A HERRAMIENTAS para consultar la base de datos de clientes y finanzas.
                    SIEMPRE usa las herramientas si el usuario pregunta por datos específicos de clientes, deudas o recaudación.
                    
                    TONO: Profesional, ejecutivo, eficiente y muy amable.
                    REGLAS:
                    1. Si no encuentras un dato, sé directo pero amable.
                    2. SIEMPRE ofrece derivar a WhatsApp para temas complejos.
                    3. Tus respuestas deben ser breves y estructuradas. Usa negritas.
                    4. SIEMPRE responde en ESPAÑOL.
                ` }]
            },
            {
                role: 'model',
                parts: [{ text: 'Entendido. Estoy listo para asistir con datos precisos de los clientes y finanzas de Soluciones Contables Pro. ¿En qué puedo ayudarle hoy?' }]
            },
            ...messages.map(m => ({
                role: m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }))
        ];

        let response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: history,
            config: {
                tools: [{ functionDeclarations: toolDeclarations }]
            }
        });

        // Loop handles potential multiple function calls in one response
        while (response.functionCalls && response.functionCalls.length > 0) {
            // Add the model's response (with function calls) to history
            history.push(response.candidates?.[0]?.content);

            const toolResults = await Promise.all(response.functionCalls.map(async (call) => {
                const fn = call.name ? functions[call.name] : undefined;
                const result = fn ? fn(call.args) : { error: "Function not found" };
                
                return {
                    functionResponse: {
                        name: call.name,
                        response: { content: result }
                    }
                };
            }));

            // Add tool results to history
            history.push({
                role: 'tool',
                parts: toolResults
            });

            // Get standard response after providing tool data
            response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: history,
                config: {
                    tools: [{ functionDeclarations: toolDeclarations }]
                }
            });
        }

        return response.text || "Disculpe, no pude generar una respuesta de texto.";
    } catch (error) {
        console.error("Assistant Error:", error);
        return "Mil disculpas, parece que mi sistema de consulta está temporalmente fuera de mi alcance. ¿Podría intentarlo de nuevo?";
    }
};
