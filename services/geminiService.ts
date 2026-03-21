
import { GoogleGenAI } from "@google/genai";
import { Client, Task, AnalysisType, TaxRegime, Message } from "../types";

// Inicialización del cliente AI
const getAIClient = () => {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') return null;
  return new GoogleGenAI(apiKey);
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

    // MOCK FALLBACK
    console.warn("Usando Mock de Datos (Falta API Key)");
    return {
      ruc: "1790085783001",
      name: "EMPRESA DE PRUEBA S.A. (MOCK)",
      regime: TaxRegime.General,
      email: "facturacion@empresa.mock",
      address: "Av. Amazonas y Naciones Unidas, Quito",
      phones: ["0991234567"],
      notes: "Obligaciones: Declaración de IVA MENSUAL."
    };

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

    // System prompt como instrucción inicial o embebido en el historial
    const prompt = `
      Eres la Recepcionista Virtual del Ing. Santiago Córdova, un reconocido experto en gestión tributaria y contable en Ecuador.
      Tu MISION PRINCIPAL y ÚNICA es filtrar prospectos o dudas iniciales y DERIVARLOS lo más rápido posible al WhatsApp privado de Santiago.
      
      REGLAS DE ORO:
      1. NO brindar asesorías fiscales largas, profundas o detalladas. Eres recepcionista, no el contador titular.
      2. Si alguien pregunta por sus deudas, estados de cuenta, liquidaciones del SRI o trámites avanzados, responde: "Por motivos de confidencialidad y para brindarle una atención 100% personalizada, esos temas los maneja directamente el Ing. Santiago. Escríbale ahora mismo a su WhatsApp."
      3. Mantén respuestas sumamente amables, persuasivas y MUY CORTAS (1 o 2 líneas máximo).
      4. Invítalos SIEMPRE a usar el botón flotante de WhatsApp de la página o a escribir directamente ("Puede contactarlo dando clic al ícono de WhatsApp").
    `;

    // Convertimos nuestros mensajes al formato de Gemini
    const geminiHistory = messages.map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    // Nos aseguramos de inyectar el prompt de sistema
    const contents = [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [{ text: 'Entendido. Seré una recepcionista amable, breve, y derivaré toda consulta técnica o de clientes al WhatsApp del Ing. Santiago Córdova.' }]},
      ...geminiHistory
    ];

    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: contents,
    });

    return result.text || "Disculpe, tuve un pequeño lapsus en mis registros. ¿Podría repetirme la consulta?";
  } catch (error) {
    console.error("Assistant Error:", error);
    return "Mil disculpas, parece que el archivo de sistema está temporalmente fuera de mi alcance. ¿En qué más puedo servirle?";
  }
};
