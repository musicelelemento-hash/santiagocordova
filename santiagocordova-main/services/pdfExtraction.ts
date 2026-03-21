
import { extractPdfInWorker } from './workerBridge';
import { SriExtractionResult } from '../types';

// In-memory cache for extracted data
const pdfCache = new Map<string, SriExtractionResult>();

/**
 * Generates a SHA-256 hash of the file content to use as a cache key.
 */
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts data from an SRI RUC Certificate PDF.
 * Uses a Web Worker to prevent UI freezing during heavy processing.
 */
export const extractDataFromSriPdf = async (file: File): Promise<SriExtractionResult> => {
    try {
        console.log(`[SC Pro] Iniciando análisis de archivo: ${file.name} (${Math.round(file.size / 1024)}KB)`);
        
        const hash = await hashFile(file);
        if (pdfCache.has(hash)) {
            console.log("[SC Pro] Cache Hit: Recuperando datos previos para este archivo.");
            return pdfCache.get(hash)!;
        }

        const result = await extractPdfInWorker(file);
        
        // Almacenar en cache solo si es válido
        if (result && result.ruc) {
            pdfCache.set(hash, result);
        }
        
        return result;
    } catch (error: any) {
        console.error("[SC Pro] Error Crítico en Extracción PDF:", error);
        throw new Error(error.message || "No se pudo descifrar el documento PDF.");
    }
};
