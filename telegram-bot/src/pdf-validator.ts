const { PDFParse } = require('pdf-parse');

export interface ValidatedPDF {
    ruc: string;
    clientName: string;
    period: string; // e.g. "02/2025"
    type: string; // e.g. "IVA", "RENTA", "RETENCION"
    amount: string;
    isValid: boolean;
}

/**
 * Valida cédula (10) o RUC (13) de Ecuador con el algoritmo oficial del SRI:
 * provincia 01-24, tercer dígito (0-5 natural / 6 pública / 9 privada) y
 * dígito verificador por Módulo 10 u 11 según el tipo.
 */
function isValidEcuadorianId(id: string): boolean {
    const cedula = id.trim();
    if (!/^\d{10,13}$/.test(cedula)) return false;
    if (cedula.length !== 10 && cedula.length !== 13) return false;

    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) return false;
    const tercerDigito = parseInt(cedula.substring(2, 3), 10);
    if (tercerDigito < 0 || (tercerDigito > 6 && tercerDigito !== 9)) return false;

    // Módulo 10 — personas naturales (tercer dígito 0-5)
    if (tercerDigito < 6) {
        const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;
        for (let i = 0; i < 9; i++) {
            let valor = parseInt(cedula.charAt(i), 10) * coeficientes[i];
            if (valor > 9) valor -= 9;
            suma += valor;
        }
        const decenaSuperior = Math.ceil(suma / 10) * 10;
        const residuo = decenaSuperior - suma;
        const verificadorCalculado = residuo === 10 ? 0 : residuo;
        const valido = verificadorCalculado === digitoVerificador;
        return cedula.length === 13 ? valido && cedula.substring(10, 13) === "001" : valido;
    }

    // Módulo 11 — sociedades privadas (tercer dígito 9)
    if (tercerDigito === 9 && cedula.length === 13) {
        const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
        const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        for (let i = 0; i < 9; i++) suma += parseInt(cedula.charAt(i), 10) * coeficientes[i];
        const residuo = suma % 11;
        const verificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
        return verificadorCalculado === digitoVerificador && cedula.substring(10, 13) === "001";
    }

    // Módulo 11 — sociedades públicas (tercer dígito 6)
    if (tercerDigito === 6 && cedula.length === 13) {
        const digitoVerificador = parseInt(cedula.substring(8, 9), 10);
        const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        for (let i = 0; i < 8; i++) suma += parseInt(cedula.charAt(i), 10) * coeficientes[i];
        const residuo = suma % 11;
        const verificadorCalculado = residuo === 0 ? 0 : 11 - residuo;
        return verificadorCalculado === digitoVerificador && cedula.substring(9, 13) === "0001";
    }

    return false;
}

/**
 * Parses an SRI PDF and extracts validation data
 */
export async function validateSRIPDF(buffer: Buffer): Promise<ValidatedPDF> {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    const text = data.text;

    // RUC: primero con contexto del comprobante; si no, cualquier bloque aislado de 13 dígitos.
    // Se rechaza cualquier secuencia que no pase el dígito verificador del SRI (evita falsos positivos con # de serie/celular).
    let ruc = "No encontrado";
    const rucContextMatch = text.match(/(?:Identificación|Identificaci\W|RUC|Cedula|Cédula)[\s:]*\W*([0-9]{13})/i);
    const rucStandalone = text.match(/(?<!\d)([0-9]{13})(?!\d)/);
    const rucCandidate = (rucContextMatch && rucContextMatch[1]) || (rucStandalone && rucStandalone[1]);
    if (rucCandidate && isValidEcuadorianId(rucCandidate)) {
        ruc = rucCandidate;
    }

    // Period: Look for "Período fiscal: ..."
    const periodMatch = text.match(/Período fiscal:\s*(.*?)(?:\r\n?|\n|$)/i);

    // Type/Tax: Look for "Impuesto: ..." or common names
    let type = "Desconocido";
    if (text.includes("IMPUESTO A LA RENTA")) type = "RENTA";
    else if (text.includes("VALOR AGREGADO") || text.includes("IVA")) type = "IVA";
    else if (text.includes("RETENCIÓN")) type = "RETENCION";
    else if (text.includes("ANEXO")) type = "ANEXO";

    // Amount: Look for "VALOR A PAGAR" or "sin valor a pagar"
    let amount = "0.00";
    if (text.includes("sin valor a pagar")) {
        amount = "0.00";
    } else {
        const amountMatch = text.match(/VALOR\s*A\s*PAGAR.*?([\d,.]+)/i);
        if (amountMatch) amount = amountMatch[1];
    }

    let rawPeriod = periodMatch ? periodMatch[1].trim() : "No encontrado";
    const yearMatch = text.match(/\b(20\d{2})\b/);
    const yearStr = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    let cleanPeriod = rawPeriod;
    const upperText = text.toUpperCase();
    if (upperText.includes("PRIMER SEMESTRE") || upperText.includes("SEMESTRE 1") || upperText.includes("1ER SEMESTRE") || rawPeriod.toUpperCase().includes("1S") || rawPeriod.toUpperCase().includes("S1")) {
        cleanPeriod = `${yearStr}-S1`;
    } else if (upperText.includes("SEGUNDO SEMESTRE") || upperText.includes("SEMESTRE 2") || upperText.includes("2DO SEMESTRE") || rawPeriod.toUpperCase().includes("2S") || rawPeriod.toUpperCase().includes("S2")) {
        cleanPeriod = `${yearStr}-S2`;
    } else if (rawPeriod !== "No encontrado") {
        const mmYyyy = rawPeriod.match(/(\d{2})[/-](\d{4})/);
        if (mmYyyy) {
            cleanPeriod = `${mmYyyy[2]}-${mmYyyy[1]}`;
        }
    }

    return {
        ruc,
        clientName: "Extraido del PDF",
        period: cleanPeriod,
        type,
        amount,
        isValid: ruc !== "No encontrado" && type !== "Desconocido"
    };
}
