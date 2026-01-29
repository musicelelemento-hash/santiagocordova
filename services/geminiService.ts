
import { GoogleGenAI } from "@google/genai";
import { Client, Task, AnalysisType, TaxRegime, ClientCategory } from "../types";

// Inicialización del cliente AI
const getAIClient = () => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') return null;
    return new GoogleGenAI({ apiKey });
};

export const summarizeTextWithGemini = async (text: string): Promise<string> => {
  if (!text || text.trim().length < 5) return "";
  try {
    const ai = getAIClient();
    if (!ai) return text.substring(0, 100) + "...";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Eres un asistente contable experto. Resume la siguiente nota de cliente en una frase ejecutiva y accionable: "${text}"`,
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
          model: 'gemini-2.5-flash', // Flash es excelente para documentos de texto denso
          contents: {
              parts: [
                  { inlineData: { data: base64Data, mimeType: effectiveMime } },
                  { text: `
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
                       - Celular: Busca números de 10 dígitos que empiecen con '09'. Prioriza celulares sobre fijos.
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
          },
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
        if(!ai) throw new Error("No API Key");

        const dataSnippet = JSON.stringify({ 
            totalClients: clients.length,
            activeClients: clients.filter(c => c.isActive).length,
            regimes: clients.reduce((acc: any, c) => { acc[c.regime] = (acc[c.regime] || 0) + 1; return acc; }, {}),
            pendingTasks: tasks.filter(t => t.status !== 'Pagada' && t.status !== 'Completada').length,
            totalIncome: tasks.filter(t => t.status === 'Pagada').reduce((sum, t) => sum + (t.cost || 0), 0)
        });

        const promptMap = {
            cashflow: "Analiza el flujo de caja potencial vs real. Identifica cuellos de botella en la cobranza.",
            riskMatrix: "Evalúa el riesgo de la cartera de clientes basado en la distribución de regímenes y estados.",
            optimization: "Sugiere 3 estrategias para aumentar la facturación promedio por cliente.",
            efficiency: "Analiza la eficiencia operativa basada en la relación tareas pendientes vs completadas."
        };

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Eres un consultor de negocios senior para un estudio contable en Ecuador.
                Basado en estos datos anonimizados: ${dataSnippet}
                
                Realiza un: ${promptMap[type]}
                
                Formato de respuesta: HTML limpio (usando <h3>, <p>, <ul>, <li>, <strong>). Sé directo, profesional y estratégico.
            `,
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
