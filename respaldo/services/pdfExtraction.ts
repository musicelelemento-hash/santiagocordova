
import * as pdfjsLib from 'pdfjs-dist';
import { TaxRegime, SriExtractionResult } from '../types';

// AJUSTE CRÍTICO: Sincronización de Versión del Worker
const pdfjsVersion = pdfjsLib.version || '5.4.530'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

export const extractDataFromSriPdf = async (file: File): Promise<SriExtractionResult> => {
  try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 2); 

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' | ');
        fullText += pageText + ' | ';
      }

      // Limpieza profunda y normalización
      const cleanText = fullText.toUpperCase().replace(/\s+/g, ' ').replace(/\|\s*\|/g, '|');
      const textOnly = cleanText.replace(/\|/g, ' ').replace(/\s+/g, ' ');

      console.log("SRI ENGINE - TEXT ONLY PREVIEW:", textOnly.substring(0, 1000));

      // --- 1. EXTRACCIÓN DE RUC ---
      let ruc = '';
      const rucMatch = cleanText.match(/N[ÚU]MERO RUC\s*[:\|]?\s*(\d{13})/) || cleanText.match(/\b(\d{10}001)\b/);
      ruc = rucMatch ? rucMatch[1] : '';

      // --- 2. EXTRACCIÓN DE NOMBRE (LOGICA REVERSA) ---
      let nombres = '';
      const parts = cleanText.split('|').map(p => p.trim()).filter(p => p.length > 0);
      const rucIndex = parts.findIndex(p => p.includes(ruc));
      
      if (rucIndex > 0) {
          // El nombre suele estar 2 o 3 posiciones antes del RUC en la tira de texto del PDF.js
          for (let i = 1; i <= 5; i++) {
              const candidate = parts[rucIndex - i];
              if (!candidate) continue;
              // Filtramos etiquetas comunes para no tomarlas como nombre
              const isLabel = candidate.includes("NÚMERO") || 
                              candidate.includes("APELLIDOS") || 
                              candidate.includes("NOMBRES") || 
                              candidate.includes("CERTIFICADO") || 
                              candidate.includes("REGISTRO") ||
                              candidate.length < 5;
              if (!isLabel) {
                  nombres = candidate;
                  break;
              }
          }
      }

      // --- 3. DIRECCIÓN Y UBICACIÓN (CLEAN BUILD) ---
      const provinciaM = textOnly.match(/PROVINCIA:\s*([^:]+?)(?=\s*(?:CANT[ÓO]N|PARROQUIA|DIRECCI|UBICACI|REFERENCIA|MEDIOS))/);
      const cantonM = textOnly.match(/CANT[ÓO]N:\s*([^:]+?)(?=\s*(?:PROVINCIA|PARROQUIA|DIRECCI|UBICACI|REFERENCIA|MEDIOS))/);
      const parroquiaM = textOnly.match(/PARROQUIA:\s*([^:]+?)(?=\s*(?:PROVINCIA|CANT[ÓO]N|DIRECCI|UBICACI|REFERENCIA|MEDIOS))/);
      const referenciaM = textOnly.match(/REFERENCIA:\s*([^:]+?)(?=\s*(?:DIRECCI[ÓO]N|UBICACI[ÓO]N|MEDIOS|EMAIL|CELULAR|ACTIVIDADES|ESTABLECIMIENTOS|$))/);

      const geoParts = [];
      if (provinciaM && provinciaM[1].trim()) geoParts.push(provinciaM[1].trim());
      if (cantonM && cantonM[1].trim()) geoParts.push(cantonM[1].trim());
      if (parroquiaM && parroquiaM[1].trim()) geoParts.push(parroquiaM[1].trim());
      
      const ubicacionGeografica = geoParts.length > 0 ? `Ubicación: ${geoParts.join(' / ')}` : '';
      const referencia = (referenciaM && referenciaM[1].trim()) ? `Ref: ${referenciaM[1].trim()}` : '';

      const direccionFinal = [ubicacionGeografica, referencia].filter(Boolean).join(' - ');

      // --- 4. CONTACTOS ---
      const emailMatch = cleanText.match(/[\w\.-]+@[\w\.-]+\.\w{2,}/g);
      const validEmail = emailMatch ? emailMatch.find(e => !e.includes("sri.gob.ec")) : '';

      const phoneMatch = textOnly.match(/(?:CELULAR|TELEFONO|TELF)[^0-9]*(\d{9,10})/);
      const validPhone = phoneMatch ? phoneMatch[1] : (textOnly.match(/\b09\d{8}\b/) ? textOnly.match(/\b09\d{8}\b/)![0] : '');

      // --- 5. RÉGIMEN & OBLIGACIONES ---
      let regimen = TaxRegime.General;
      if (textOnly.includes("NEGOCIO POPULAR")) regimen = TaxRegime.RimpeNegocioPopular;
      else if (textOnly.includes("RIMPE") && textOnly.includes("EMPRENDEDOR")) regimen = TaxRegime.RimpeEmprendedor;

      const listaObligaciones: string[] = [];
      if (textOnly.includes("DECLARACION DE IVA")) listaObligaciones.push("IVA");
      if (textOnly.includes("RENTA")) listaObligaciones.push("Impuesto a la Renta");

      return {
        apellidos_nombres: nombres || 'CONTRIBUYENTE',
        ruc: ruc,
        direccion: direccionFinal || 'Dirección no detectada',
        contacto: {
          email: validEmail || '',
          celular: validPhone || ''
        },
        regimen: regimen,
        obligaciones_tributarias: textOnly.includes("SEMESTRAL") ? "semestral" : "mensual",
        lista_obligaciones: listaObligaciones,
        actividad_economica: textOnly.match(/ACTIVIDADES ECONÓMICAS\s*([^:]+?)(?=\s*(?:ESTABLECIMIENTOS|OBLIGACIONES|$))/)?.[1]?.trim() || '',
        es_artesano: textOnly.includes("ARTESANO") && !textOnly.includes("NO REGISTRA"),
        cantidad_establecimientos: parseInt(textOnly.match(/ESTABLECIMIENTOS\s*ABIERTOS\s*(\d+)/)?.[1] || '1')
      };

  } catch (error) {
      console.error("Error en extracción PDF:", error);
      throw new Error("No se pudo procesar el PDF.");
  }
};
