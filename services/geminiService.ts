
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
 * Soporta Imágenes y PDFs
 */
export const analyzeClientPhoto = async (base64Data: string, mimeType: string): Promise<Partial<Client> & { phone?: string }> => {
  try {
    const ai = getAIClient();
    
    if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: {
              parts: [
                  { inlineData: { data: base64Data, mimeType } },
                  { text: `
                    Actúa como un Auditor Tributario del SRI (Ecuador). Analiza este documento (Certificado RUC, Cédula o similar).
                    
                    EXTRAE LOS SIGUIENTES DATOS CON EXACTITUD:

                    1. **Identificación**: Número RUC (13 dígitos) o Cédula (10 dígitos).
                    2. **Razón Social**: "Apellidos y nombres" o "Razón Social" completo.
                    3. **Dirección**: Extrae la dirección completa. IMPORTANTE: Incluye "Calle", "Intersección", "Referencia" y "Parroquia" si aparecen.
                    4. **Contactos**: 
                       - Email (Prioridad alta).
                       - Celular (Busca en "Medios de contacto", "Celular" o "Teléfono").
                    5. **Régimen**: 
                       - "RIMPE NEGOCIO POPULAR" -> regime: 'RIMPE Negocio Popular'
                       - "RIMPE EMPRENDEDOR" -> regime: 'RIMPE Emprendedor'
                       - "GENERAL" -> regime: 'Régimen General'
                    6. **Obligaciones & Notas**:
                       Analiza las obligaciones listadas. Si encuentras estas específicas, agrégalas al texto de 'notes':
                       - "ANEXO TRANSACCIONAL SIMPLIFICADO" -> Agregar "• ATS Mensual ($15)"
                       - "BENEFICIARIOS FINALES" o "COMPOSICION SOCIETARIA" -> Agregar "• REBEFICS Anual ($10)"
                       - "IMPUESTO A LA RENTA SOCIEDADES" -> Agregar "• Renta Sociedades 1021 ($15)"
                       - "OBLIGADO A LLEVAR CONTABILIDAD" -> Agregar "• Obligado a Contabilidad"

                    Retorna SOLO JSON:
                    {
                        "ruc": "string",
                        "name": "string",
                        "email": "string", 
                        "phones": ["string"],
                        "address": "string",
                        "economicActivity": "string",
                        "regime": "string (Enum exacto)",
                        "notes": "string (Las obligaciones adicionales encontradas)"
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
        return JSON.parse(jsonStr);
    } 
    
    // MOCK FALLBACK
    return {
        ruc: "070" + Math.floor(Math.random() * 10000000).toString().padEnd(9, '0') + "001",
        name: "CONTRIBUYENTE PRUEBA IA",
        regime: TaxRegime.RimpeEmprendedor,
        email: "prueba@ejemplo.com",
        phones: ["0999999999"],
        notes: "Datos simulados (Sin API Key)."
    };

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("No se pudo procesar el documento. Verifique que sea legible.");
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
