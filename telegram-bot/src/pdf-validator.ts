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
 * Parses an SRI PDF and extracts validation data
 */
export async function validateSRIPDF(buffer: Buffer): Promise<ValidatedPDF> {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    const text = data.text;

    // RUC usually follows "Identificación:" or similar, or just a 13-digit number
    const rucMatch = text.match(/\d{13}/);

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

    return {
        ruc: rucMatch ? rucMatch[0] : "No encontrado",
        clientName: "Extraido del PDF",
        period: periodMatch ? periodMatch[1].trim() : "No encontrado",
        type,
        amount,
        isValid: !!rucMatch && type !== "Desconocido"
    };
}
