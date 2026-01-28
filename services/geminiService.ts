
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
                    Eres un Auditor Tributario Senior del SRI (Ecuador). Tu tarea es extraer datos exactos de este Certificado de RUC.

                    INSTRUCCIONES DE EXTRACCIÓN PRECISAS:

                    1. **RUC**: Busca exactamente el número de 13 dígitos.
                    2. **Razón Social**: Extrae "Apellidos y Nombres" o la "Razón Social". NO confundir con el Representante Legal.
                    3. **Régimen Fiscal (CRÍTICO)**: 
                       - Si el documento dice "RIMPE" y "NEGOCIO POPULAR" -> Retorna exactamente: "${TaxRegime.RimpeNegocioPopular}"
                       - Si el documento dice "RIMPE" y "EMPRENDEDOR" -> Retorna exactamente: "${TaxRegime.RimpeEmprendedor}"
                       - Si dice "GENERAL" o no menciona RIMPE -> Retorna exactamente: "${TaxRegime.General}"
                    4. **Dirección Completa**: Concatena en una sola línea: Calle + Número + Intersección + Parroquia + Referencia (si existe).
                    5. **Contactos**: Email y Celular.
                    6. **Actividad Económica**: Extrae la actividad principal descrita.
                    7. **Obligaciones Tributarias**:
                       - Lee la sección de "Obligaciones Tributarias" del documento.
                       - Extrae la lista completa como texto (ej: "Declaración de IVA Semestral, Impuesto a la Renta Anual").
                       - Pon esto en el campo "notes".

                    FORMATO DE RESPUESTA JSON (SIN MARKDOWN):
                    {
                        "ruc": "string",
                        "name": "string",
                        "email": "string", 
                        "phones": ["string"],
                        "address": "string",
                        "economicActivity": "string",
                        "regime": "string",
                        "notes": "string (Lista de obligaciones extraídas)",
                        "isArtisan": boolean (true si dice "CALIFICACIÓN ARTESANAL")
                    }
                  ` }
              ]
          },
          config: { 
              responseMimeType: "application/json",
              temperature: 0.0 // Temperatura 0 para máxima precisión determinista
          }
        });
        
        const text = response.text || "{}";
        // Limpieza robusta de JSON por si el modelo incluye bloques de código
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Post-procesamiento para asegurar tipos
        return {
            ...data,
            phones: Array.isArray(data.phones) ? data.phones : (data.phones ? [data.phones] : [])
        };
    } 
    
    // MOCK FALLBACK (Solo si no hay API Key configurada)
    console.warn("Usando Mock de Datos (Falta API Key)");
    return {
        ruc: "1790085783001",
        name: "EMPRESA DE PRUEBA S.A. (MOCK)",
        regime: TaxRegime.General,
        email: "facturacion@empresa.mock",
        address: "Av. Amazonas y Naciones Unidas, Quito",
        phones: ["0991234567"],
        notes: "Obligaciones Simuladas: Declaración Mensual IVA, Anexo Transaccional."
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
