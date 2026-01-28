
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
 * Análisis estratégico de documentos (RUC/Cédula) usando Gemini Vision
 */
export const analyzeClientPhoto = async (base64Image: string, mimeType: string): Promise<Partial<Client> & { phone?: string }> => {
  try {
    const ai = getAIClient();
    
    if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: {
              parts: [
                  { inlineData: { data: base64Image, mimeType } },
                  { text: `
                    Actúa como un Auditor Tributario del SRI (Ecuador). Analiza este "Certificado de Registro Único de Contribuyentes" o Cédula.
                    
                    EXTRAE LOS DATOS CON EXACTITUD LITERAL DEL DOCUMENTO:

                    1. **RUC/CI**: Número de 13 dígitos o 10 dígitos.
                    2. **Razón Social**: Busca "Apellidos y nombres" o "Razón Social". Ej: RAMIREZ ALVARADO ALEIDA MARLENE.
                    3. **Email**: CRÍTICO. Busca en la sección "Medios de contacto" o bajo "Email:". Extrae el correo completo.
                    4. **Teléfono**: Busca en "Medios de contacto" bajo "Celular:" o "Teléfono".
                    5. **Dirección Completa**: ESTO ES CRÍTICO. Combina los campos "Calle", "Número", "Intersección", "Referencia" y "Parroquia". 
                       Formato deseado: "Calle Principal y Secundaria, Ref: [Referencia], Pq. [Parroquia]".
                    6. **Actividad**: Código y descripción principal. Ej: "G4799... VENTA AL POR MENOR...".

                    7. **LÓGICA DE CLASIFICACIÓN (Mapeo)**:
                       - SI "Régimen" dice "RIMPE NEGOCIO POPULAR" -> regime: 'RIMPE Negocio Popular', category: 'Impuesto a la Renta (Negocio Popular)'.
                       - SI "Régimen" dice "RIMPE EMPRENDEDOR" -> regime: 'RIMPE Emprendedor'.
                       - SI "Régimen" dice "GENERAL" -> regime: 'Régimen General'.
                       
                       - PARA CATEGORÍA (Si no es Negocio Popular):
                         Mira "Obligaciones tributarias".
                         - Si dice "SEMESTRAL" -> category: 'Suscripción Semestral'.
                         - Si dice "MENSUAL" -> category: 'Suscripción Mensual IVA'.
                         - Por defecto -> 'Suscripción Mensual IVA'.

                    8. **OTROS**:
                       - isArtisan: true si ves "Artesano: Calificado" o número de calificación.
                       - obligadoContabilidad: true si dice "SI".

                    Retorna SOLO JSON:
                    {
                        "ruc": "string",
                        "name": "string",
                        "email": "string", 
                        "phones": ["string"],
                        "address": "string",
                        "economicActivity": "string",
                        "regime": "string (Enum exacto)",
                        "category": "string (Enum exacto)",
                        "isArtisan": boolean,
                        "obligadoContabilidad": boolean,
                        "notes": "Resumen corto de obligaciones encontradas (ej: Obligado 2011 IVA, 1021 Renta)."
                    }
                  ` }
              ]
          },
          config: { 
              responseMimeType: "application/json",
              temperature: 0.0 // Cero creatividad, máxima precisión de extracción
          }
        });
        
        const text = response.text || "{}";
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } 
    
    // MOCK FALLBACK
    return {
        ruc: "070" + Math.floor(Math.random() * 10000000).toString().padEnd(9, '0') + "001",
        name: "CONTRIBUYENTE PRUEBA IA",
        regime: TaxRegime.RimpeEmprendedor,
        category: ClientCategory.SuscripcionMensual,
        email: "prueba@ejemplo.com",
        phones: ["0999999999"],
        notes: "Datos simulados (Sin API Key)."
    };

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("No se pudo leer el PDF. Asegúrate de que sea un archivo válido.");
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
