import * as pdfjsLib from 'pdfjs-dist';
import { TaxRegime, SriExtractionResult } from '../types';
import { isPast } from 'date-fns';

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
      const nameParts = [];
      // El nombre suele estar antes del RUC. Buscamos hasta 6 posiciones atrás.
      for (let i = 1; i <= 6; i++) {
        const candidate = parts[rucIndex - i];
        if (!candidate) continue;

        const isLabel = candidate.includes("NÚMERO") ||
          candidate.includes("APELLIDOS") ||
          candidate.includes("NOMBRES") ||
          candidate.includes("CERTIFICADO") ||
          candidate.includes("REGISTRO") ||
          candidate.includes("IDENTIFICACIÓN") ||
          candidate.length < 3;

        if (!isLabel) {
          nameParts.unshift(candidate); // Agregamos al inicio para mantener el orden natural
        } else if (nameParts.length > 0) {
          // Si ya tenemos partes del nombre y encontramos una etiqueta, paramos.
          break;
        }
      }
      nombres = nameParts.join(' ');
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
      cantidad_establecimientos: parseInt(textOnly.match(/ESTABLECIMIENTOS\s*ABIERTOS\s*(\d+)/)?.[1] || '1'),
      isCertificate: (
        textOnly.includes("CERTIFICADO DE RUC") ||
        textOnly.includes("REGISTRO UNICO DE CONTRIBUYENTES") ||
        textOnly.includes("REGISTRO ÚNICO DE CONTRIBUYENTES") ||
        (textOnly.includes("SERVICIO DE RENTAS INTERNAS") && textOnly.includes("NUMERO RUC")) ||
        (textOnly.includes("SERVICIO DE RENTAS INTERNAS") && textOnly.includes("NÚMERO RUC")) ||
        (ruc.length === 13 && textOnly.includes("OBLIGACIONES TRIBUTARIAS"))
      )
    };

  } catch (error) {
    console.error("Error en extracción PDF:", error);
    throw new Error("No se pudo procesar el PDF.");
  }
};


export const extractDataFromDeclarationPdf = async (file: File): Promise<{
  ruc: string;
  formType: string;
  period: string; // YYYY-MM format
  amount: number;
  id: string;
  previewText?: string;
  declarationDate?: string;
  clientName: string;
  frequency: 'Mensual' | 'Semestral';
  strictValidation?: {
    hasRuc: boolean;
    hasPeriod: boolean;
    hasAmount: boolean;
    isFuture: boolean;
  };
}> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 2);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ') + ' ';
    }

    const cleanText = fullText.toUpperCase();

    if (cleanText.trim().length < 50) {
      throw new Error("Documento Ilegible o Imagen Escaneada. Se requiere un PDF estructurado.");
    }

    // Extracción de RUC
    const rucMatch = cleanText.match(/RUC\s*[:]?\s*(\d{13})/) || cleanText.match(/\b(\d{13})\b/);
    const ruc = rucMatch ? rucMatch[1] : '';

    // Extracción de Formulario
    let formType = 'DESCONOCIDO';
    if (cleanText.includes("FORMULARIO 104") || 
        cleanText.includes("VALOR AGREGADO") || 
        cleanText.includes("2011 DECLARACION DE IVA") ||
        cleanText.includes("DECLARACIÓN DE IVA")) {
      formType = 'IVA';
    } else if (cleanText.includes("FORMULARIO 102") || 
               cleanText.includes("RENTA PERSONAS") || 
               cleanText.includes("DECLARACIÓN DE IMPUESTO A LA RENTA") ||
               cleanText.includes("IMPUESTO A LA RENTA PERSONAS NATURALES")) {
      formType = 'RENTA';
    } else if (cleanText.includes("FORMULARIO 101")) {
      formType = 'RENTA SOCIEDADES';
    } else if (cleanText.includes("3031") || 
               cleanText.includes("BEBIDAS ALCOHÓLICAS") || 
               cleanText.includes("DECLARACIÓN DE ICE") || 
               cleanText.includes("DECLARACION DE ICE") || 
               cleanText.includes("FORMULARIO 105") || 
               cleanText.includes("CONSUMOS ESPECIALES")) {
      formType = 'ICE';
    } else if (cleanText.includes("ANEXO DE IMPUESTO A LOS CONSUMOS ESPECIALES") || 
               cleanText.includes("ANEXO DE CONSUMOS ESPECIALES") || 
               cleanText.includes("ANEXO ICE") || 
               cleanText.includes("SISTEMA DE RECEPCION DE ANEXOS POR INTERNET") || 
               cleanText.includes("PRESENTACIÓN DE ARCHIVO - ICE") || 
               cleanText.includes("PRESENTACION DE ARCHIVO - ICE")) {
      formType = 'ANEXO_ICE';
    } else if (cleanText.includes("ANEXO DE PRECIOS DE VENTA AL PÚBLICO") || 
               cleanText.includes("ANEXO PVP") || 
               cleanText.includes("PRESENTACIÓN DE ARCHIVO - PVP") || 
               cleanText.includes("PRESENTACION DE ARCHIVO - PVP")) {
      formType = 'PVP';
    }

    // Extracción de Periodo
    let period = '';
    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const monthIndex = months.findIndex(m => cleanText.includes(m));

    // Buscar específicamente "EJERCICIO FISCAL" (muy común en Renta)
    const fiscalYearMatch = cleanText.match(/EJERCICIO FISCAL\s*[:]?\s*(202[3-6])/) || cleanText.match(/AÑO\s*[:]?\s*(202[3-6])/);
    const yearMatch = fiscalYearMatch || cleanText.match(/\b(202[3-6])\b/);

    // Mejora para Formato "Período fiscal: MES AÑO"
    const fiscalPeriodMatch = cleanText.match(/PER[IÍ]ODO FISCAL\s*[:]?\s*([A-Z]+)\s*(202[3-6])/);

    if (fiscalPeriodMatch) {
      const mName = fiscalPeriodMatch[1];
      const year = fiscalPeriodMatch[2];
      const mIdx = months.findIndex(m => mName.includes(m));
      if (mIdx !== -1) {
        period = `${year}-${(mIdx + 1).toString().padStart(2, '0')}`;
      }
    } else if (monthIndex !== -1 && yearMatch) {
      const mNumeric = (monthIndex + 1).toString().padStart(2, '0');
      period = `${yearMatch[1]}-${mNumeric}`;
    } else if (yearMatch) {
      period = yearMatch[1];
      if (formType.includes('RENTA') && period === '2026' && !fiscalYearMatch) {
        const currentMonth = new Date().getMonth() + 1;
        if (currentMonth <= 6) {
          period = '2025';
        }
      }
    }

    // Extracción de Valor a Pagar
    const amountMatch = cleanText.match(/TOTAL A PAGAR\s*[:]?\s*([\d\.,]+)/) || cleanText.match(/TOTAL IMPUESTO A PAGAR\s*[:]?\s*([\d\.,]+)/);
    let amount = 0;
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(',', '.'));
    }

    // Extracción de Name (Razón Social)
    const nameMatch = cleanText.match(/RAZ[ÓO]N SOCIAL\s*[:]?\s*([^|:]+?)(?=\s*(?:IDENTIFICACI[ÓO]N|FECHA|PER[IÍ]ODO|IMPUESTO|$))/);
    const clientName = nameMatch ? nameMatch[1].trim() : '';

    // Extracción de Frecuencia
    const isSemestral = cleanText.includes('SEMESTRAL');
    const frequency = isSemestral ? 'Semestral' : 'Mensual';

    const idMatch = cleanText.match(/N[UÚ]MERO DE SERIE\s*[:]?\s*(\d+)/) || cleanText.match(/N[UÚ]MERO ADHESIVO\s*[:]?\s*(\d+)/);
    const id = idMatch ? idMatch[1] : '';

    // Extracción de Fecha de Declaración / Presentación / Carga
    const dateMatch = cleanText.match(/FECHA Y HORA DE DECLARACI[ÓO]N\s*[:]?\s*(\d{2})\/(\d{2})\/(\d{4})/i) ||
                      cleanText.match(/PRESENTADO CON FECHA Y HORA\s*[:]?\s*(\d{2})\/(\d{2})\/(\d{4})/i) ||
                      cleanText.match(/FECHA Y HORA\s*[:]?\s*(\d{2})\/(\d{2})\/(\d{4})/i) ||
                      cleanText.match(/FECHA DE CARGA\s*[:]?\s*(\d{2})[-/](\d{2})[-/](\d{4})/i);
    const declarationDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : '';

    // Autocorrección de año para Anexos cargados en la campaña activa de Junio 2026
    if (formType === 'ANEXO_ICE' && period === '2025-06' && declarationDate && declarationDate.startsWith('2026')) {
      period = '2026-06';
    }

    if (!ruc && formType === 'DESCONOCIDO') {
      throw new Error("Documento no reconocido como declaración válida del SRI.");
    }

    return { 
      ruc,
      formType, 
      period, 
      amount, 
      id, 
      previewText: cleanText.substring(0, 5000), 
      declarationDate,
      clientName,
      frequency,
      strictValidation: {
        hasRuc: !!ruc,
        hasPeriod: !!period,
        hasAmount: amountMatch !== null,
        isFuture: declarationDate ? isPast(new Date(declarationDate)) === false : false
      }
    };
  } catch (error: any) {
    console.error("Error parsing declaration PDF:", error);
    throw new Error(error.message || "No se pudo leer la declaración.");
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
