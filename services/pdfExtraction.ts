
import * as pdfjsLib from 'pdfjs-dist';
import { TaxRegime, SriExtractionResult } from '../types';

// Configurar el worker de PDF.js usando CDN para evitar problemas de configuración de Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const extractDataFromSriPdf = async (file: File): Promise<SriExtractionResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  
  let fullText = '';

  // Extraer texto de todas las páginas
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + ' ';
  }

  // Limpieza básica de espacios múltiples
  fullText = fullText.replace(/\s+/g, ' ');
  const upperText = fullText.toUpperCase();

  // --- LÓGICA DE EXTRACCIÓN (REGEX AVANZADO) ---

  // 1. RUC (13 dígitos que terminan en 001)
  const rucMatch = fullText.match(/NÚMERO RUC:\s*(\d{13})/i) || fullText.match(/\b(\d{10}001)\b/);
  const ruc = rucMatch ? rucMatch[1] : '';

  // 2. Nombres
  const nameMatch = fullText.match(/RAZÓN SOCIAL:\s*(.*?)(?=\s+NOMBRE COMERCIAL|\s+ESTADO|$)/i);
  let nombres = nameMatch ? nameMatch[1].trim() : '';
  
  if (!nombres) {
      const altNameMatch = fullText.match(/NOMBRES Y APELLIDOS:\s*(.*?)(?=\s+NOMBRE COMERCIAL|\s+ESTADO|$)/i);
      nombres = altNameMatch ? altNameMatch[1].trim() : '';
  }
  
  if (!nombres && fullText.includes("Apellidos y nombres")) {
       const headerMatch = fullText.match(/Apellidos y nombres\s+(.*?)\s+Número RUC/i);
       if (headerMatch) nombres = headerMatch[1].trim();
  }

  // 3. Dirección
  const parroquiaMatch = fullText.match(/Parroquia:\s*([A-Z\s]+?)(?=\s+Calle:|\s+Barrio:|\s+Intersección:|$)/i);
  const referenciaMatch = fullText.match(/Referencia:\s*(.*?)(?=\s+Manzana:|\s+Celular:|\s+Email:|$)/i);
  
  const parroquia = parroquiaMatch ? parroquiaMatch[1].trim() : '';
  const referencia = referenciaMatch ? referenciaMatch[1].trim() : '';
  const referenciaLimpia = referencia.split("Telefono")[0].split("Email")[0].substring(0, 100); 
  const direccion = parroquia || referenciaLimpia ? `${parroquia} - ${referenciaLimpia}` : '';

  // 4. Contacto (Lógica Mejorada)
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const emailsFound = fullText.match(emailRegex) || [];
  const validEmail = emailsFound.find(e => !e.includes('sri.gob.ec') && !e.includes('gob.ec')) || '';

  const cellRegex = /\b09\d{8}\b/g;
  const phonesFound = fullText.match(cellRegex) || [];
  const validPhone = phonesFound.length > 0 ? phonesFound[0] : '';

  // 5. Régimen (Lógica Estricta)
  let regimen = TaxRegime.General;
  
  if (upperText.includes("NEGOCIO POPULAR") || upperText.includes("RIMPE POPULAR")) {
      regimen = TaxRegime.RimpeNegocioPopular;
  } else if (upperText.includes("RIMPE") && upperText.includes("EMPRENDEDOR")) {
      regimen = TaxRegime.RimpeEmprendedor;
  } else if (upperText.includes("RÉGIMEN GENERAL") || upperText.includes("REGIMEN GENERAL")) {
      regimen = TaxRegime.General;
  } else {
      if (upperText.includes("RIMPE")) regimen = TaxRegime.RimpeEmprendedor;
      else regimen = TaxRegime.General;
  }

  // 6. Actividades
  const actividadesMatch = fullText.match(/Actividades económicas([\s\S]*?)(?=Establecimientos|Obligaciones|$)/i);
  let actividadEconomica = '';
  if (actividadesMatch) {
      actividadEconomica = actividadesMatch[1]
          .replace(/\*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
  }

  // 7. Artesano Calificado (Lógica Nueva)
  // Buscamos patrones como "Calificación Artesanal Nro" o menciones a la Junta
  const isArtisan = /CALIFICACI[ÓO]N ARTESANAL|JUNTA NACIONAL DE DEFENSA DEL ARTESANO/i.test(upperText);

  // 8. Establecimientos (Conteo Lógica Nueva)
  // Buscamos ocurrencias de cabeceras de establecimientos
  // Modelo Nuevo/Antiguo suele usar "No. ESTABLECIMIENTO: 001" o similar
  const establishmentMatches = fullText.match(/No\.?\s*ESTABLECIMIENTO/gi);
  let establishmentCount = establishmentMatches ? establishmentMatches.length : 1;

  // Validación extra: Si no encuentra matches explícitos, busca el número más alto de establecimiento
  if (!establishmentMatches) {
      const highestEstMatch = fullText.match(/ESTABLECIMIENTO[:\s]+(\d{3})/gi);
      if (highestEstMatch) {
          establishmentCount = highestEstMatch.length;
      }
  }

  // 9. Extracción de LISTA de Obligaciones
  const obligacionesRawMatch = fullText.match(/Obligaciones tributarias([\s\S]*?)(?=Números del RUC|Establecimientos|Información|$)/i);
  const listaObligaciones: string[] = [];
  
  if (obligacionesRawMatch && obligacionesRawMatch[1]) {
      const rawBlock = obligacionesRawMatch[1];
      const lines = rawBlock.split(/\s*•\s*|\s*-\s*|\s*\d{4}\s*-\s*/);
      
      lines.forEach(line => {
          const cleanLine = line.trim();
          if (cleanLine.length > 5 && !cleanLine.includes("Revise periódicamente")) {
               listaObligaciones.push(cleanLine.toUpperCase());
          }
      });
  }

  // 10. Determinación Certera de Periodicidad
  let periodicidadPrincipal = "mensual"; 
  
  const hasSemestral = listaObligaciones.some(obs => 
      (obs.includes("IVA") || obs.includes("VALOR AGREGADO")) && obs.includes("SEMESTRAL")
  );
  
  const hasMensual = listaObligaciones.some(obs => 
      (obs.includes("IVA") || obs.includes("VALOR AGREGADO")) && obs.includes("MENSUAL")
  );

  if (regimen === TaxRegime.RimpeNegocioPopular) {
      periodicidadPrincipal = "anual";
  } else if (hasSemestral) {
      periodicidadPrincipal = "semestral";
  } else if (hasMensual) {
      periodicidadPrincipal = "mensual";
  } else if (regimen === TaxRegime.RimpeEmprendedor) {
       periodicidadPrincipal = "semestral";
  }

  return {
    apellidos_nombres: nombres,
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
};
