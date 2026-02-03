
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

      // Leer páginas y unir
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Usamos ' | ' para separar items y conservar estructura visual
        const pageText = textContent.items.map((item: any) => item.str).join(' | ');
        fullText += pageText + ' | ';
      }

      // Limpieza inicial: Mayúsculas y normalización de espacios
      const cleanText = fullText.toUpperCase().replace(/\s+/g, ' ').replace(/\|\s*\|/g, '|');

      console.log("SRI RAW DATA (Extracted):", cleanText.substring(0, 1500));

      // --- 1. EXTRACCIÓN DE RUC ---
      let ruc = '';
      // Buscar específicamente la etiqueta seguida de 13 dígitos
      const rucLabelMatch = cleanText.match(/N[ÚU]MERO RUC\s*[:\|]?\s*(\d{13})/);
      
      if (rucLabelMatch) {
          ruc = rucLabelMatch[1];
      } else {
          // Fallback: Cualquier 13 dígitos terminados en 001
          const anyRucMatch = cleanText.match(/\b(\d{10}001)\b/);
          ruc = anyRucMatch ? anyRucMatch[1] : '';
      }

      // --- 2. EXTRACCIÓN DE NOMBRE ---
      let nombres = '';
      
      if (ruc) {
          const parts = cleanText.split('|').map(p => p.trim()).filter(p => p.length > 0);
          const rucIndex = parts.findIndex(p => p.includes(ruc));
          
          if (rucIndex > 0) {
              for (let i = 1; i <= 3; i++) {
                  const candidate = parts[rucIndex - i];
                  if (!candidate) continue;

                  if (candidate.includes("NÚMERO RUC") || 
                      candidate.includes("APELLIDOS Y NOMBRES") || 
                      candidate.includes("REGISTRO") || 
                      candidate.includes("CONTRIBUYENTES") ||
                      candidate.length < 5) {
                      continue;
                  }
                  nombres = candidate;
                  break;
              }
          }
      }

      if (!nombres || nombres.length < 5) {
          const labelNameRegex = /(?:RAZ[ÓO]N SOCIAL|APELLIDOS Y NOMBRES)\s*[:\|]?\s*([^\|]+?)(?=\s*\|?\s*(?:NOMBRE COMERCIAL|ESTADO|RÉGIMEN|CLASE|FECHA|N[ÚU]MERO RUC))/i;
          const matchA = cleanText.match(labelNameRegex);
          if (matchA && matchA[1].trim().length > 3) {
              nombres = matchA[1].trim();
          } 
      }

      nombres = nombres.replace(/\|/g, '').replace(/[0-9]/g, '').trim();

      // --- 3. DIRECCIÓN (LÓGICA ELEGANTE ACTUALIZADA) ---
      // Objetivo: "Calle y Intersección / Canton / Provincia" o "Referencia / Canton / Provincia"
      
      const provinciaM = cleanText.match(/PROVINCIA:\s*([^\|]+)/);
      const cantonM = cleanText.match(/CANT[ÓO]N:\s*([^\|]+)/);
      const calleM = cleanText.match(/CALLE:\s*([^\|]+)/);
      const interseccionM = cleanText.match(/INTERSECCI[ÓO]N:\s*([^\|]+)/);
      const numeroM = cleanText.match(/N[ÚU]MERO:\s*([^\|]+)/);
      const referenciaM = cleanText.match(/(?:REFERENCIA|REF:)\s*([^\|]+?)(?=\s*\|?\s*(?:MEDIOS|UBICACI|EMAIL|CELULAR|TELEFONO|DOMICILIO))/);

      const provincia = provinciaM ? provinciaM[1].trim() : '';
      const canton = cantonM ? cantonM[1].trim() : '';
      const calle = calleM ? calleM[1].trim() : '';
      const interseccion = interseccionM ? interseccionM[1].trim() : '';
      const numero = numeroM ? numeroM[1].trim() : '';
      const referencia = referenciaM ? referenciaM[1].trim() : '';

      let direccionPrincipal = '';

      // Estrategia 1: Calle + Intersección (Prioridad Alta)
      if (calle && calle !== 'S/N' && calle.length > 2) {
          direccionPrincipal = calle;
          if (interseccion && interseccion !== 'S/N') {
              direccionPrincipal += ` Y ${interseccion}`;
          }
          if (numero && numero !== 'S/N') {
              direccionPrincipal += ` ${numero}`;
          }
      } 
      // Estrategia 2: Referencia (Si no hay calle)
      else if (referencia && referencia.length > 3) {
          direccionPrincipal = referencia;
      }
      // Estrategia 3: Fallback a bloque genérico
      else {
          const dirBlock = cleanText.match(/DIRECCI[ÓO]N\s*[:\|]?\s*([^\|]+?)(?=\s*\|?\s*(?:MEDIOS|UBICACI|EMAIL))/);
          if (dirBlock) direccionPrincipal = dirBlock[1].trim();
      }

      // Limpieza y Formato Final
      const partesDireccion = [direccionPrincipal];
      if (canton) partesDireccion.push(canton);
      if (provincia) partesDireccion.push(provincia);
      
      const direccionFinal = partesDireccion
        .filter(p => p && p !== 'S/N')
        .join(' / ')
        .replace(/\s+/g, ' ');

      // --- 4. CONTACTOS (LÓGICA VALIOSA DE DOMICILIO) ---
      
      // A. Extraer EMAIL
      let validEmail = '';
      const allEmails = cleanText.match(/[\w\.-]+@[\w\.-]+\.\w{2,}/g);
      if (allEmails) {
          const personalEmails = allEmails.filter(e => !e.includes("sri.gob.ec") && !e.includes("gobierno.ec"));
          validEmail = personalEmails.length > 0 ? personalEmails[0] : allEmails[0];
      }

      // B. Extraer TELÉFONO (Celular o Domicilio)
      let validPhone = '';
      
      // 1. Buscar etiqueta explícita primero (incluyendo Domicilio)
      const phoneLabelMatch = cleanText.match(/(?:CELULAR|TELEFONO|TELF|DOMICILIO)[^:0-9]*[:\.]?\s*[\|-]?\s*((?:09\d{8})|(?:0[2-7]\d{7}))/);
      if (phoneLabelMatch) {
          validPhone = phoneLabelMatch[1];
      } else {
           // 2. Barrido global: Prioridad Celular (09...) luego Fijo (02-07...)
           const allMobiles = cleanText.match(/\b09\d{8}\b/g);
           const allLandlines = cleanText.match(/\b0[2-7]\d{7}\b/g); // Captura fijos de 7 dígitos + código provincia (9 total)
           
           if (allMobiles && allMobiles.length > 0) {
               validPhone = allMobiles[0];
           } else if (allLandlines && allLandlines.length > 0) {
               validPhone = allLandlines[0]; // "Extráelo igual es valioso"
           }
      }

      // --- 5. RÉGIMEN & OBLIGACIONES ---
      let regimen = TaxRegime.General;
      if (cleanText.includes("NEGOCIO POPULAR") || cleanText.includes("POPULARES")) {
          regimen = TaxRegime.RimpeNegocioPopular;
      } else if (cleanText.includes("RIMPE") && cleanText.includes("EMPRENDEDOR")) {
          regimen = TaxRegime.RimpeEmprendedor;
      }

      const listaObligaciones: string[] = [];
      let periodicidadPrincipal = "mensual";

      if (cleanText.includes("SEMESTRAL")) {
          listaObligaciones.push("IVA Semestral");
          periodicidadPrincipal = "semestral";
      } else if (cleanText.includes("DECLARACION DE IVA") || cleanText.includes("MENSUAL")) {
          listaObligaciones.push("IVA Mensual");
          periodicidadPrincipal = "mensual";
      }
      
      if (cleanText.includes("RENTA")) listaObligaciones.push("Impuesto a la Renta");
      if (regimen === TaxRegime.RimpeNegocioPopular) periodicidadPrincipal = "anual";

      // --- 6. OTROS ---
      const actMatch = cleanText.match(/([A-Z]\d{6,})\s*[\-]?\s*([^\|]+)/);
      let actividad = actMatch ? actMatch[2].trim() : '';
      if (actividad.length > 150) actividad = actividad.substring(0, 150) + '...';

      const isArtisan = cleanText.includes("ARTESANO") && !cleanText.includes("NO REGISTRA") && !cleanText.includes("ARTESANO: NO");
      const establecimientosMatch = cleanText.match(/ESTABLECIMIENTOS\s*(?:ABIERTOS|REGISTRADOS)?\s*[:\|]?\s*(\d+)/);
      const estCount = establecimientosMatch ? parseInt(establecimientosMatch[1]) : 1;

      return {
        apellidos_nombres: nombres || 'CONTRIBUYENTE',
        ruc: ruc,
        direccion: direccionFinal || 'Dirección no detectada',
        contacto: {
          email: validEmail || '',
          celular: validPhone || ''
        },
        regimen: regimen,
        obligaciones_tributarias: periodicidadPrincipal,
        lista_obligaciones: listaObligaciones,
        actividad_economica: actividad,
        es_artesano: isArtisan,
        cantidad_establecimientos: estCount
      };

  } catch (error) {
      console.error("Error crítico en extracción PDF:", error);
      throw new Error("No se pudo procesar el archivo PDF. Asegúrese de que no esté dañado.");
  }
};
