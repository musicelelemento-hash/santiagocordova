
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

  // --- LÓGICA DE EXTRACCIÓN (REGEX) ---

  // 1. RUC
  const rucMatch = fullText.match(/NÚMERO RUC:\s*(\d{13})/i) || fullText.match(/RUC\s*(\d{13})/i);
  const ruc = rucMatch ? rucMatch[1] : '';

  // 2. Nombres (Busca "RAZÓN SOCIAL" y toma lo que sigue hasta antes de "NOMBRE COMERCIAL" o "ESTADO")
  const nameMatch = fullText.match(/RAZÓN SOCIAL:\s*(.*?)(?=\s+NOMBRE COMERCIAL|\s+ESTADO|$)/i);
  let nombres = nameMatch ? nameMatch[1].trim() : '';
  
  // Si falla razón social, intentar Nombres y Apellidos
  if (!nombres) {
      const altNameMatch = fullText.match(/NOMBRES Y APELLIDOS:\s*(.*?)(?=\s+NOMBRE COMERCIAL|\s+ESTADO|$)/i);
      nombres = altNameMatch ? altNameMatch[1].trim() : '';
  }
  
  // A veces el nombre aparece justo después de "Registro Único de Contribuyentes" en la primera línea relevante
  if (!nombres && fullText.includes("Apellidos y nombres")) {
       const headerMatch = fullText.match(/Apellidos y nombres\s+(.*?)\s+Número RUC/i);
       if (headerMatch) nombres = headerMatch[1].trim();
  }

  // 3. Dirección (Busca Parroquia y Referencia)
  const parroquiaMatch = fullText.match(/Parroquia:\s*([A-Z\s]+?)(?=\s+Calle:|\s+Barrio:|\s+Intersección:|$)/i);
  const referenciaMatch = fullText.match(/Referencia:\s*(.*?)(?=\s+Manzana:|\s+Celular:|\s+Email:|$)/i);
  
  const parroquia = parroquiaMatch ? parroquiaMatch[1].trim() : '';
  const referencia = referenciaMatch ? referenciaMatch[1].trim() : '';
  const direccion = `Parroquia: ${parroquia} | Referencia: ${referencia}`;

  // 4. Contacto
  const emailMatch = fullText.match(/Email:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
  const celularMatch = fullText.match(/Celular:\s*(\d{10})/i); 

  // 5. Régimen (Lógica Estricta)
  let regimen = TaxRegime.General;
  
  // Prioridad: Negocio Popular > Emprendedor > General
  if (upperText.includes("NEGOCIO POPULAR") || upperText.includes("RIMPE POPULAR")) {
      regimen = TaxRegime.RimpeNegocioPopular;
  } else if (upperText.includes("RIMPE") && upperText.includes("EMPRENDEDOR")) {
      regimen = TaxRegime.RimpeEmprendedor;
  } else if (upperText.includes("RÉGIMEN GENERAL") || upperText.includes("REGIMEN GENERAL")) {
      regimen = TaxRegime.General;
  } else {
      // Fallback si solo dice RIMPE y no especifica
      if (upperText.includes("RIMPE")) regimen = TaxRegime.RimpeEmprendedor;
      else regimen = TaxRegime.General;
  }

  // 6. Actividades (Limpieza de *)
  const actividadesMatch = fullText.match(/Actividades económicas([\s\S]*?)(?=Establecimientos|Obligaciones|$)/i);
  let actividadEconomica = '';
  if (actividadesMatch) {
      actividadEconomica = actividadesMatch[1]
          .replace(/\*/g, '') // Eliminar asteriscos
          .replace(/\s+/g, ' ') // Normalizar espacios
          .trim();
  }

  // 7. Extracción de LISTA de Obligaciones
  // Buscamos el bloque entre "Obligaciones tributarias" y la siguiente sección importante
  const obligacionesRawMatch = fullText.match(/Obligaciones tributarias([\s\S]*?)(?=Números del RUC|Establecimientos|Información|$)/i);
  const listaObligaciones: string[] = [];
  
  if (obligacionesRawMatch && obligacionesRawMatch[1]) {
      const rawBlock = obligacionesRawMatch[1];
      // Separar por bullets, guiones o fechas (ej: 2021 - ...)
      const lines = rawBlock.split(/\s*•\s*|\s*-\s*|\s*\d{4}\s*-\s*/);
      
      lines.forEach(line => {
          const cleanLine = line.trim();
          if (cleanLine.length > 5 && !cleanLine.includes("Revise periódicamente")) {
               // Mejorar limpieza de texto para coincidencias posteriores
               listaObligaciones.push(cleanLine.toUpperCase());
          }
      });
  }

  // 8. Determinación Certera de Periodicidad (Para categoría base)
  let periodicidadPrincipal = "mensual"; 
  
  const hasSemestral = listaObligaciones.some(obs => obs.includes("SEMESTRAL"));
  const hasMensual = listaObligaciones.some(obs => obs.includes("MENSUAL"));

  if (regimen === TaxRegime.RimpeNegocioPopular) {
      periodicidadPrincipal = "anual";
  } else if (hasSemestral) {
      periodicidadPrincipal = "semestral";
  } else if (hasMensual) {
      periodicidadPrincipal = "mensual";
  }


  return {
    apellidos_nombres: nombres,
    ruc: ruc,
    direccion: direccion.trim() === 'Parroquia:  | Referencia:' ? '' : direccion, // Limpiar si vacío
    contacto: {
      email: emailMatch ? emailMatch[1] : '',
      celular: celularMatch ? celularMatch[1] : ''
    },
    regimen: regimen,
    obligaciones_tributarias: periodicidadPrincipal,
    lista_obligaciones: listaObligaciones,
    actividad_economica: actividadEconomica
  };
};
