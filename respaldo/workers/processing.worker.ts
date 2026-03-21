
import { calculateTaxDeadlines } from '../services/taxLogic';
import { parseClientsFromCSV, parseBrowserPasswordsCSV } from '../services/csv';
import { Client } from '../types';

// Definición de tipos de mensajes
type WorkerMessage = 
  | { type: 'PARSE_CLIENTS_CSV'; payload: { fileContent: string; existingClients: Client[] }; id: string }
  | { type: 'PARSE_PASSWORDS_CSV'; payload: { fileContent: string; existingClients: Client[] }; id: string }
  | { type: 'CALCULATE_TAX_DEADLINES_BULK'; payload: { clients: Client[] }; id: string };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = e.data;

  try {
    let result;
    switch (type) {
      case 'PARSE_CLIENTS_CSV':
        // Procesamiento intensivo de texto y regex
        result = parseClientsFromCSV(payload.fileContent, payload.existingClients);
        break;

      case 'PARSE_PASSWORDS_CSV':
        // Procesamiento intensivo de texto y búsqueda en array
        result = parseBrowserPasswordsCSV(payload.fileContent, payload.existingClients);
        break;

      case 'CALCULATE_TAX_DEADLINES_BULK':
        // Cálculo masivo de fechas para calendario/reportes
        result = payload.clients.map(client => ({
          clientId: client.id,
          deadlines: calculateTaxDeadlines(client)
        }));
        break;

      default:
        throw new Error(`Tipo de tarea desconocida: ${type}`);
    }

    // Enviar resultado exitoso de vuelta
    self.postMessage({ id, status: 'success', result });

  } catch (error: any) {
    console.error(`Worker Error (${type}):`, error);
    // Enviar error de vuelta
    self.postMessage({ id, status: 'error', error: error.message });
  }
};
