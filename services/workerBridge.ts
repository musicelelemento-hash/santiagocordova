
import { v4 as uuidv4 } from 'uuid';

// Singleton para mantener la instancia del worker viva
let workerInstance: Worker | null = null;

const getWorker = () => {
  if (!workerInstance) {
    // Vite maneja automáticamente la importación de workers con ?worker o new Worker(new URL(...))
    workerInstance = new Worker(new URL('../workers/processing.worker.ts', import.meta.url), { type: 'module' });
  }
  return workerInstance;
};

/**
 * Ejecuta una tarea pesada en el Web Worker.
 * @param type Tipo de tarea (ej: 'PARSE_CLIENTS_CSV')
 * @param payload Datos necesarios para la tarea
 * @returns Promesa con el resultado
 */
export const runWorkerTask = <T>(type: string, payload: any): Promise<T> => {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const id = uuidv4(); // ID único para correlacionar solicitud/respuesta

    const handleMessage = (e: MessageEvent) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', handleMessage);
        
        if (e.data.status === 'success') {
          resolve(e.data.result);
        } else {
          reject(new Error(e.data.error || 'Error desconocido en el worker'));
        }
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ type, payload, id });
  });
};
