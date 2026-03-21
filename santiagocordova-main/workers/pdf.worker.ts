
import * as pdfjsLib from 'pdfjs-dist';
import { TaxRegime, SriExtractionResult } from '../types';

// Worker global para PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;
  if (type !== 'EXTRACT_PDF_DATA') return;

  try {
    const loadingTask = pdfjsLib.getDocument({ data: payload.arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const pagesToRead = Math.min(pdf.numPages, 2);

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ') + ' ';
    }

    const normalizedText = fullText.toUpperCase().replace(/\s+/g, ' ');
    const result = parseSriCertificate(normalizedText);
    
    self.postMessage({ id, status: 'success', result });
  } catch (error: any) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
};

function parseSriCertificate(text: string): SriExtractionResult {
    const extractBetween = (start: string, ends: string[]) => {
        const regex = new RegExp(`${start}\\s*[:|]?\\s*(.*?)(?=\\s*(?:${ends.join('|')})|$)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const rucMatch = text.match(/\b\d{13}\b/);
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);

    let regime = TaxRegime.General;
    if (text.includes("RIMPE") && text.includes("POPULAR")) regime = TaxRegime.RimpeNegocioPopular;
    else if (text.includes("RIMPE") && text.includes("EMPRENDEDOR")) regime = TaxRegime.RimpeEmprendedor;

    return {
      apellidos_nombres: extractBetween("RAZÓN SOCIAL", ["NOMBRE COMERCIAL", "ESTADO", "RUC"]) || extractBetween("APELLIDOS Y NOMBRES", ["RUC", "ESTADO"]),
      ruc: rucMatch ? rucMatch[0] : '',
      direccion: extractBetween("CALLE", ["NÚMERO", "INTERSECCIÓN"]) || "Verificar en PDF",
      contacto: { email: emailMatch ? emailMatch[0].toLowerCase() : '', celular: '' },
      regimen: regime,
      obligaciones_tributarias: text.includes("SEMESTRAL") ? 'semestral' : 'mensual',
      lista_obligaciones: [],
      actividad_economica: "Actividad detectada en sistema",
      es_artesano: text.includes("ARTESANO"),
      cantidad_establecimientos: 1
    };
}
