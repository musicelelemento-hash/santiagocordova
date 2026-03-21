
import { SriExtractionResult, TaxRegime } from '../types';

/**
 * Motor de lectura PDF v9.1 ELITE PRO.
 * Separación inteligente de metadatos para evitar el efecto 'shampoo'.
 */
export const extractPdfInWorker = (file: File): Promise<SriExtractionResult> => {
  return new Promise(async (resolve, reject) => {
    const id = `pdf-${Date.now()}`;
    
    const workerCode = `
      import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.0.379';
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

      self.onmessage = async (e) => {
        const { type, payload, id } = e.data;
        if (type !== 'EXTRACT_PDF_DATA') return;

        try {
          const loadingTask = pdfjsLib.getDocument({ data: payload.arrayBuffer });
          const pdf = await loadingTask.promise;
          
          let rawItems = [];
          const page = await pdf.getPage(1);
          const textContent = await page.getTextContent();
          
          // Filtramos elementos vacíos para tener una secuencia limpia
          rawItems = textContent.items.map(item => item.str.trim()).filter(item => item.length > 0);
          const fullText = rawItems.join(' ');
          const textUpper = fullText.toUpperCase();

          const extractTag = (text, tag, limiters = []) => {
            const index = text.indexOf(tag);
            if (index === -1) return '';
            let result = text.substring(index + tag.length).trim();
            let firstLimiterIndex = result.length;
            limiters.forEach(l => {
                const lIdx = result.indexOf(l);
                if (lIdx !== -1 && lIdx < firstLimiterIndex) firstLimiterIndex = lIdx;
            });
            return result.substring(0, firstLimiterIndex).replace(/[:|]/g, '').trim();
          };

          // 1. EXTRACCIÓN DE IDENTIDAD (SOPORTE MULTILÍNEA MEJORADO)
          let name = '';
          const nameLabels = ["APELLIDOS Y NOMBRES", "RAZÓN SOCIAL"];
          
          for (const label of nameLabels) {
            const idx = rawItems.findIndex(item => item.toUpperCase().includes(label));
            
            if (idx !== -1) {
              // Estrategia: Escanear hacia atrás desde la etiqueta hasta encontrar encabezados de documento
              // Esto permite capturar nombres que ocupan 2 o 3 líneas por encima de la etiqueta
              let nameParts = [];
              let ptr = idx - 1;
              
              while (ptr >= 0) {
                const item = rawItems[ptr];
                const upperItem = item.toUpperCase();
                
                // Palabras de parada que indican que ya no estamos en el nombre (Header del documento)
                if (
                    upperItem.includes("REGISTRO") || 
                    upperItem.includes("ÚNICO") || 
                    upperItem.includes("CONTRIBUYENTES") || 
                    upperItem.includes("CERTIFICADO") || 
                    upperItem.includes("SRI") ||
                    upperItem === "RUC" ||
                    upperItem === "NÚMERO RUC"
                ) {
                    break;
                }
                
                // Agregamos al inicio del array porque estamos yendo hacia atrás
                nameParts.unshift(item);
                ptr--;
              }
              
              if (nameParts.length > 0) {
                name = nameParts.join(' ');
                break;
              }
            }
          }
          
          // Fallback por si la estructura visual falló
          if (!name) {
             name = extractTag(textUpper, "APELLIDOS Y NOMBRES", ["NÚMERO RUC", "ESTADO"]) ||
                    extractTag(textUpper, "RAZÓN SOCIAL", ["NOMBRE COMERCIAL", "ESTADO"]);
          }

          // 2. EXTRACCIÓN DE RUC (BÚSQUEDA DIRECCIONAL)
          let ruc = '';
          
          // A. Buscar etiqueta específica "NÚMERO RUC" y mirar alrededor
          const rucLabelIdx = rawItems.findIndex(item => item.toUpperCase().includes("NÚMERO RUC"));
          if (rucLabelIdx !== -1) {
             // Revisar item actual (ej: "NÚMERO RUC: 17...")
             const currentMatch = rawItems[rucLabelIdx].match(/\\d{13}/);
             if (currentMatch) {
                 ruc = currentMatch[0];
             } 
             // Revisar el siguiente item (ej: ["NÚMERO RUC", "17..."])
             else if (rawItems[rucLabelIdx + 1] && /\\d{13}/.test(rawItems[rucLabelIdx + 1])) {
                 ruc = rawItems[rucLabelIdx + 1].match(/\\d{13}/)[0];
             }
          }

          // B. Regex global como respaldo (busca cualquier secuencia de 13 dígitos que termine en 001)
          if (!ruc) {
              const rucMatch = fullText.match(/\\b\\d{10}001\\b/);
              if (rucMatch) ruc = rucMatch[0];
              else {
                  // Último intento: cualquier 13 dígitos
                  const any13 = fullText.match(/\\b\\d{13}\\b/);
                  if (any13) ruc = any13[0];
              }
          }

          // 3. DIRECCIÓN LIMPIA (Sin ruidos de email o telf)
          const prov = extractTag(textUpper, "PROVINCIA:", ["CANTÓN"]);
          const cant = extractTag(textUpper, "CANTÓN:", ["PARROQUIA"]);
          const parr = extractTag(textUpper, "PARROQUIA:", ["BARRIO", "CALLE", "UBICACIÓN"]);
          const calle = extractTag(textUpper, "CALLE:", ["NÚMERO", "INTERSECCIÓN", "REFERENCIA"]);
          const proAddress = [prov, cant, parr, calle].filter(Boolean).join(' - ');

          // 4. DESENREDO DE ACTIVIDADES (Identificación por códigos SRI)
          const activitiesRaw = [];
          const actIndex = rawItems.findIndex(item => item.toUpperCase().includes("ACTIVIDADES ECONÓMICAS"));
          if (actIndex !== -1) {
             let currentBlock = "";
             for(let i = actIndex + 1; i < rawItems.length; i++) {
                const item = rawItems[i].replace('•', '').trim();
                if (item.includes("Establecimientos") || item.includes("Obligaciones")) break;
                
                // Si detectamos un código SRI (Ej: G46...) o una letra sola al inicio seguida de números
                if (/^[A-Z]\\d{5,10}/.test(item) || /^[A-Z]\\s\\d{5}/.test(item)) {
                   if (currentBlock) activitiesRaw.push(currentBlock);
                   currentBlock = item;
                } else if (currentBlock) {
                   currentBlock += " " + item;
                } else if (item.length > 8 && !item.includes('@') && !item.includes('09')) {
                   currentBlock = item;
                }
             }
             if (currentBlock) activitiesRaw.push(currentBlock);
          }

          const cleanActivities = activitiesRaw.map(a => 
             a.replace(/\\s+/g, ' ').replace(/- -/g, '-').trim()
          ).filter(a => a.length > 10);

          // 5. RÉGIMEN
          let regime = "Régimen General";
          if (textUpper.includes("NEGOCIO POPULAR")) regime = "RIMPE Negocio Popular";
          else if (textUpper.includes("EMPRENDEDOR")) regime = "RIMPE Emprendedor";

          const emailMatch = fullText.match(/[\\w.-]+@[\\w.-]+\\.\\w{2,}/);
          const celMatch = fullText.match(/\\b09\\d{8}\\b/);

          const result = {
            apellidos_nombres: name.trim() || "REVISAR PDF",
            ruc: ruc || "",
            direccion: proAddress || "REVISAR SECCIÓN DOMICILIO EN PDF",
            contacto: { 
              email: emailMatch ? emailMatch[0].toLowerCase() : '', 
              celular: celMatch ? celMatch[0] : '' 
            },
            regimen: regime,
            obligaciones_tributarias: textUpper.includes("SEMESTRAL") ? 'semestral' : 'mensual',
            lista_obligaciones: cleanActivities,
            actividad_economica: cleanActivities.join(' | '),
            es_artesano: textUpper.includes("ARTESANO") && !textUpper.includes("NO REGISTRA"),
            cantidad_establecimientos: 1
          };
          
          self.postMessage({ id, status: 'success', result });
        } catch (error) {
          self.postMessage({ id, status: 'error', error: error.message });
        }
      };
    `;

    let worker: Worker;
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
    } catch (e: any) { return reject(new Error("Fallo al iniciar el motor Elite.")); }

    worker.onmessage = (e) => {
      if (e.data.id !== id) return;
      worker.terminate();
      if (e.data.status === 'success') resolve(e.data.result);
      else reject(new Error(e.data.error));
    };

    worker.postMessage({ type: 'EXTRACT_PDF_DATA', payload: { arrayBuffer: await file.arrayBuffer() }, id });
  });
};
    