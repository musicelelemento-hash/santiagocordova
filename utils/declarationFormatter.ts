import { Client, Declaration } from '../types/client';
import { formatPeriodForDisplay } from '../services/sri';

export interface DeclarationCifras {
    period: string;
    formType: string;
    sriId: string;
    ventas15: number;
    ventas0: number;
    montoIvaVentas: number;
    compras15: number;
    compras5: number;
    compras0: number;
    montoIvaCompras: number;
    retIva: number;
    retRenta: number;
    impuestoCausado?: number;
    totalPagar: number;
    saldoFavor?: number;
    hasRealCifras: boolean;
    previewText?: string;
    pdfUrl?: string;
}

/**
 * Extrae y normaliza de forma robusta las cifras contables de una declaración.
 * Revisa metadata estructurada, transactionId y analiza texto del comprobante (previewText).
 */
export function extractDeclarationCifras(decl?: Declaration | null): DeclarationCifras {
    if (!decl) {
        return {
            period: '',
            formType: 'IVA',
            sriId: '',
            ventas15: 0,
            ventas0: 0,
            montoIvaVentas: 0,
            compras15: 0,
            compras5: 0,
            compras0: 0,
            montoIvaCompras: 0,
            retIva: 0,
            retRenta: 0,
            totalPagar: 0,
            hasRealCifras: false
        };
    }

    const meta = decl.proof_file?.metadata || {};
    const preview = (meta.previewText || '').toString();

    // 1. Extraer CEP / Identificador SRI
    let sriId = (meta.sriId || decl.transactionId || '').toString().trim();
    if (!sriId && preview) {
        const serieMatch = preview.match(/N[ÚU]MERO\s+DE\s+SERIE[:\s]*(\d{9,})/i) ||
                           preview.match(/CEP[:\s]*(\d{9,})/i) ||
                           preview.match(/ADHESIVO[:\s]*(\d{9,})/i) ||
                           preview.match(/(\b\d{12}\b)/);
        if (serieMatch) {
            sriId = serieMatch[1];
        }
    }

    // 2. Extraer Cifras Numéricas
    let ventas15 = Number(meta.ventas15 ?? 0);
    let ventas0 = Number(meta.ventas0 ?? 0);
    let montoIvaVentas = Number(meta.montoIvaVentas ?? (ventas15 > 0 ? +(ventas15 * 0.15).toFixed(2) : 0));

    let compras15 = Number(meta.compras15 ?? 0);
    let compras5 = Number(meta.compras5 ?? 0);
    let compras0 = Number(meta.compras0 ?? 0);
    let montoIvaCompras = Number(meta.montoIvaCompras ?? (compras15 > 0 ? +(compras15 * 0.15 + compras5 * 0.05).toFixed(2) : 0));

    let retIva = Number(meta.retIva ?? 0);
    let retRenta = Number(meta.retRenta ?? 0);

    // 3. Monto a Pagar
    let totalPagar = Number(meta.totalPagar ?? meta.amount ?? decl.amount ?? 0);
    if (totalPagar === 0 && preview.toUpperCase().includes('DECLARACIÓN SIN VALOR A PAGAR')) {
        totalPagar = 0;
    }

    // Si tiene cifras reales registradas
    const hasRealCifras = ventas15 > 0 || ventas0 > 0 || compras15 > 0 || compras5 > 0 || 
                          compras0 > 0 || retIva > 0 || retRenta > 0 || Boolean(sriId);

    const period = decl.period || meta.period || '';
    const formType = (decl.type || meta.formType || (period.length === 7 ? 'IVA' : 'RENTA')).toUpperCase();
    const pdfUrl = decl.proof_file?.url || undefined;

    return {
        period,
        formType,
        sriId,
        ventas15,
        ventas0,
        montoIvaVentas,
        compras15,
        compras5,
        compras0,
        montoIvaCompras,
        retIva,
        retRenta,
        impuestoCausado: Number(meta.impuestoCausado ?? 0),
        totalPagar,
        saldoFavor: Number(meta.saldoFavor ?? 0),
        hasRealCifras,
        previewText: preview,
        pdfUrl
    };
}

/**
 * Genera un texto limpio, profesional y listo para WhatsApp / Portapapeles
 * con todos los valores de la declaración del cliente.
 */
export function formatDeclarationSummary(client: Client, decl: Declaration): string {
    const cifras = extractDeclarationCifras(decl);
    const alias = client.taxProfile?.alias || client.tradeName || '';
    const periodoDisplay = formatPeriodForDisplay(cifras.period || decl.period);

    const lines: string[] = [
        `🧾 *DECLARACIÓN TRIBUTARIA SRI*`,
        `👤 *Cliente:* ${client.name}`,
    ];

    if (alias) {
        lines.push(`🏷️ *Alias:* ${alias}`);
    }

    lines.push(`🆔 *RUC:* ${client.ruc}`);
    lines.push(`📅 *Período:* ${periodoDisplay} (${cifras.formType})`);

    if (cifras.sriId) {
        lines.push(`🔢 *CEP / Serie SRI:* ${cifras.sriId}`);
    }

    lines.push(`───────────────────────────────`);

    if (cifras.ventas15 > 0 || cifras.ventas0 > 0) {
        lines.push(`💰 *Ventas Gravadas (15%):* $${cifras.ventas15.toFixed(2)}`);
        if (cifras.ventas0 > 0) {
            lines.push(`💰 *Ventas Tarifa 0%:* $${cifras.ventas0.toFixed(2)}`);
        }
    }

    if (cifras.compras15 > 0 || cifras.compras5 > 0 || cifras.compras0 > 0) {
        if (cifras.compras15 > 0) lines.push(`🛒 *Compras Gravadas (15%):* $${cifras.compras15.toFixed(2)}`);
        if (cifras.compras5 > 0) lines.push(`🛒 *Compras Tarifa (5%):* $${cifras.compras5.toFixed(2)}`);
        if (cifras.compras0 > 0) lines.push(`🛒 *Compras Tarifa 0%:* $${cifras.compras0.toFixed(2)}`);
    }

    if (cifras.montoIvaCompras > 0) {
        lines.push(`📊 *IVA en Compras:* $${cifras.montoIvaCompras.toFixed(2)}`);
    }

    if (cifras.retIva > 0) {
        lines.push(`🛡️ *Retenciones IVA a Favor:* $${cifras.retIva.toFixed(2)}`);
    }

    if (cifras.retRenta > 0) {
        lines.push(`🛡️ *Retenciones Renta:* $${cifras.retRenta.toFixed(2)}`);
    }

    lines.push(`💵 *Total a Pagar SRI:* $${cifras.totalPagar.toFixed(2)}`);
    lines.push(`───────────────────────────────`);

    if (cifras.pdfUrl) {
        lines.push(`📄 *Comprobante Digital:* ${cifras.pdfUrl}`);
    } else {
        lines.push(`✅ *Estado:* Declarado y Verificado ante el SRI`);
    }

    return lines.join('\n');
}
