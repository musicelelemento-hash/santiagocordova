import { Client, Task, AnalysisType } from "../types";

// Mock service to replace AI functionality and prevent build errors

export const summarizeTextWithGemini = async (text: string): Promise<string> => {
  if (!text) return "";
  console.log("AI Summary disabled: Returning mock summary");
  return text.length > 50 ? text.substring(0, 50) + "..." : text;
};

export const analyzeClientPhoto = async (base64Image: string, mimeType: string): Promise<Partial<Client> & { phone?: string }> => {
  console.log("AI Photo Analysis disabled");
  // Simulate a delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Return a mock success or error depending on needs, here throwing to indicate it's disabled in UI
  throw new Error("La funcionalidad de análisis de imagen por IA está desactivada temporalmente para asegurar la estabilidad del despliegue.");
};

export const runStrategicAnalysis = async (clients: Client[], tasks: Task[], type: AnalysisType): Promise<string> => {
    console.log("AI Strategic Analysis disabled");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const clientsCount = clients.length;
    const tasksCount = tasks.length;

    return `
        <h3>Análisis Simplificado (Modo Seguro)</h3>
        <p>La conexión con IA avanzada está desactivada. Aquí tienes un resumen básico:</p>
        <ul>
            <li><strong>Total Clientes:</strong> ${clientsCount}</li>
            <li><strong>Total Tareas:</strong> ${tasksCount}</li>
        </ul>
        <p>Para habilitar el análisis profundo, verifique la configuración de la API en futuras actualizaciones.</p>
    `;
};