
import * as pdfjsLib from 'pdfjs-dist';
import { TaxRegime, SriExtractionResult } from '../types';

// AJUSTE CRÍTICO: Usar exactamente la misma versión del worker que la librería principal (v5.4.530)
// Esto soluciona el error de "Fake Worker" o fallo silencioso al leer.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.worker.min.js';

export const extractDataFromSriPdf = async (file: File): Promise<SriExtractionResult> => {
  try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';

      // Extraer texto de las primeras páginas
      const maxPages = Math.min(pdf.numPages, 3);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Agregamos un separador ' | ' para evitar que palabras de columnas distintas se peguen
        const pageText = textContent.items.map((item: any) => item.str).join(' | ');
        fullText += pageText + ' ';
      }

      // Limpieza: Eliminar múltiples espacios y saltos de línea extraños
      fullText = fullText.replace(/\s+/g, ' ');
      const upperText = fullText.toUpperCase();

      console.log("Texto PDF Extraído (Raw):", upperText.substring(0, 600));

      // --- 1. RUC ---
      // Busca explícitamente 13 dígitos donde los últimos 3 sean 001
      const rucMatch = upperText.match(/\b([0-9]{10}001)\b/);
      const ruc = rucMatch ? rucMatch[1] : '';

      // --- 2. NOMBRES / RAZÓN SOCIAL ---
      // Estrategia A: Etiqueta "RAZÓN SOCIAL"
      let nameMatch = upperText.match(/RAZÓN SOCIAL[:\s]*\|?\s*(.*?)(?=\s*\|?\s*(?:NOMBRE COMERCIAL|ESTADO|RÉGIMEN|CLASE))/i);
      let nombres = nameMatch ? nameMatch[1].trim() : '';
      
      // Estrategia B (Certificado Alan): Etiqueta "APELLIDOS Y NOMBRES"
      // En el PDF provisto, el nombre aparece debajo o al lado de "Apellidos y nombres" y antes de "Número RUC"
      if (!nombres || nombres.length < 3) {
          const altMatch = upperText.match(/APELLIDOS Y NOMBRES[:\s]*\|?\s*(.*?)(?=\s*\|?\s*(?:NÚMERO RUC|ESTADO|RÉGIMEN))/i);
          if (altMatch) {
              nombres = altMatch[1].replace(/\|/g, '').trim();
          }
      }

      // Limpieza final del nombre (quitar caracteres extraños del pipe)
      nombres = nombres.replace(/\|/g, '').trim();

      // --- 3. DIRECCIÓN ---
      // El certificado suele tener etiquetas explícitas.
      // Formato observado: "Calle: 4 DE AGOSTO Número: S/N Intersección: COLON..."
      const calleMatch = fullText.match(/Calle:\s*(.*?)(?=\s+N[uú]mero:)/i);
      const numeroMatch = fullText.match(/N[uú]mero:\s*(.*?)(?=\s+Intersecci[oó]n:)/i);
      const interseccionMatch = fullText.match(/Intersecci[oó]n:\s*(.*?)(?=\s+Referencia:|\s+Parroquia:|$)/i);
      const parroquiaMatch = fullText.match(/Parroquia:\s*(.*?)(?=\s+Calle:|\s+Barrio:|$)/i);
      const referenciaMatch = fullText.match(/Referencia:\s*(.*?)(?=\s+Medios de contacto|\s+Teléfono|$)/i);

      let direccion = '';
      const parts = [];
      
      if (parroquiaMatch) parts.push(parroquiaMatch[1].trim().replace(/\|/g, ''));
      if (calleMatch) parts.push(calleMatch[1].trim().replace(/\|/g, ''));
      if (numeroMatch) parts.push(numeroMatch[1].trim().replace(/\|/g, ''));
      if (interseccionMatch) parts.push('y ' + interseccionMatch[1].trim().replace(/\|/g, ''));
      
      direccion = parts.filter(p => p && p !== 'S/N' && p !== 'SN').join(' ').trim();

      // Si hay referencia, la agregamos
      if (referenciaMatch) {
          direccion += ` (${referenciaMatch[1].trim().replace(/\|/g, '')})`;
      }

      // Fallback dirección general
      if (direccion.length < 5) {
           const dirGeneralMatch = fullText.match(/DIRECCI[OÓ]N.*?:(.*?)(?=\s+MEDIOS DE CONTACTO|\s+ACTIVIDAD|$)/i);
           if (dirGeneralMatch) direccion = dirGeneralMatch[1].replace(/\|/g, ' ').trim();
      }

      // --- 4. CONTACTO ---
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
      const emailsFound = fullText.match(emailRegex) || [];
      const validEmail = emailsFound.find(e => !e.toLowerCase().includes('sri.gob.ec') && !e.toLowerCase().includes('gob.ec')) || '';

      // Celular: Buscar 09...
      const cellRegex = /\b09\d{8}\b/g;
      const phonesFound = fullText.match(cellRegex) || [];
      // Teléfono fijo (07...) como en el ejemplo
      const landlineRegex = /\b0[2-7]\d{7}\b/g;
      const landlinesFound = fullText.match(landlineRegex) || [];
      
      const validPhone = phonesFound.length > 0 ? phonesFound[0] : (landlinesFound.length > 0 ? landlinesFound[0] : '');

      // --- 5. RÉGIMEN ---
      let regimen = TaxRegime.General;
      if (upperText.includes("NEGOCIO POPULAR") || upperText.includes("RIMPE POPULAR")) {
          regimen = TaxRegime.RimpeNegocioPopular;
      } else if (upperText.includes("RIMPE") || upperText.includes("EMPRENDEDOR")) {
          regimen = TaxRegime.RimpeEmprendedor;
      } else {
          // Por defecto General, que es lo que dice el PDF de Alan ("Régimen GENERAL")
          regimen = TaxRegime.General;
      }

      // --- 6. ACTIVIDAD ECONÓMICA ---
      // Buscar códigos de actividad (ej: G47220201)
      const actividadMatch = fullText.match(/Actividades económicas.*?([A-Z]\d{8}.*?)(?=\s+Establecimientos|\s+Abiertos)/i);
      let actividadEconomica = '';
      
      if (actividadMatch) {
           // Limpiar un poco el texto capturado
           actividadEconomica = actividadMatch[1].replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
           // Tomar solo la primera actividad si hay muchas
           if (actividadEconomica.length > 150) actividadEconomica = actividadEconomica.substring(0, 150) + '...';
      } else {
          // Intento fallback buscando texto descriptivo común
          const descMatch = fullText.match(/VENTA.*?|SERVICIOS.*?|ACTIVIDADES.*?/i);
          if(descMatch && descMatch[0].length > 10) actividadEconomica = descMatch[0].substring(0, 100);
      }

      // --- 7. OTROS ---
      const isArtisan = /CALIFICACI[ÓO]N ARTESANAL|JUNTA NACIONAL DE DEFENSA DEL ARTESANO/i.test(upperText);
      const establishmentMatches = fullText.match(/No\.?\s*ESTABLECIMIENTO/gi);
      let establishmentCount = establishmentMatches ? establishmentMatches.length : 1;
      // Ajuste si el PDF dice explícitamente "Abiertos [número]"
      const abiertosMatch = fullText.match(/Abiertos\s*\|?\s*(\d+)/i);
      if (abiertosMatch) establishmentCount = parseInt(abiertosMatch[1]);

      // --- 8. OBLIGACIONES ---
      const listaObligaciones: string[] = [];
      if (upperText.includes("MENSUAL") || upperText.includes("MES")) listaObligaciones.push("IVA Mensual");
      if (upperText.includes("SEMESTRAL") || upperText.includes("SEMESTRE")) listaObligaciones.push("IVA Semestral");
      if (upperText.includes("RENTA")) listaObligaciones.push("Renta");

      let periodicidadPrincipal = "mensual";
      if (regimen === TaxRegime.RimpeNegocioPopular) periodicidadPrincipal = "anual";
      else if (listaObligaciones.some(o => o.includes("Semestral"))) periodicidadPrincipal = "semestral";

      return {
        apellidos_nombres: nombres || 'CONTRIBUYENTE',
        ruc: ruc,
        direccion: direccion,
        contacto: {
          email: validEmail,
          celular: validPhone
        },
        regimen: regimen,
        obligaciones_tributarias: periodicidadPrincipal,
        lista_obligaciones: listaObligaciones,
        actividad_economica: actividadEconomica,
        es_artesano: isArtisan,
        cantidad_establecimientos: establishmentCount
      };
  } catch (error) {
      console.error("Error crítico en extracción PDF:", error);
      throw new Error("No se pudo leer el archivo PDF. Intente abrirlo y guardarlo nuevamente como PDF estándar.");
  }
};
