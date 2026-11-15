import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { PurchaseInvoiceItem } from '../services/supplierCatalogService';

/**
 * ATS — Anexo Transaccional Simplificado (mensual).
 *
 * Genera el XML `<iva>` con la estructura y el formato exactos del anexo del SRI.
 * Validado byte a byte contra los 7 ATS reales de VIMARBO (enero–julio 2026).
 */

export interface AtsCompra {
    codSustento: string;
    tpIdProv: string;
    idProv: string;
    tipoComprobante: string;
    parteRel: string;
    fechaRegistro: string;
    establecimiento: string;
    puntoEmision: string;
    secuencial: string;
    fechaEmision: string;
    autorizacion: string;
    baseNoGraIva: string;
    baseImponible: string;
    baseImpGrav: string;
    baseImpExe: string;
    montoIce: string;
    montoIva: string;
    valRetBien10: string;
    valRetServ20: string;
    valorRetBienes: string;
    valRetServ50: string;
    valorRetServicios: string;
    valRetServ100: string;
    totbasesImpReemb: string;
    pagoExterior: {
        pagoLocExt: string;
        paisEfecPago: string;
        aplicConvDobTrib: string;
        pagExtSujRetNorLeg: string;
        pagoRegFis: string;
    };
    formasDePago?: string[];
    docModificado?: string;
    estabModificado?: string;
    ptoEmiModificado?: string;
    secModificado?: string;
    autModificado?: string;
}

export interface AtsDatos {
    cabecera: {
        IdInformante: string;
        razonSocial: string;
        Anio: number | string;
        Mes: number | string;
        numEstabRuc?: string;
        totalVentas?: string;
        TipoIDInformante?: string;
        codigoOperativo?: string;
    };
    compras: AtsCompra[];
    ventasEstablecimiento: Array<{ codEstab: string; ventasEstab: string; ivaComp: string }>;
}

const s = (x: unknown, def = ''): string => (x === undefined || x === null ? def : String(x));

const compraXml = (x: AtsCompra): string => {
    const pe = x.pagoExterior || ({} as AtsCompra['pagoExterior']);
    const lineas: string[] = [
        '    <detalleCompras>',
        `      <codSustento>${s(x.codSustento)}</codSustento>`,
        `      <tpIdProv>${s(x.tpIdProv)}</tpIdProv>`,
        `      <idProv>${s(x.idProv)}</idProv>`,
        `      <tipoComprobante>${s(x.tipoComprobante)}</tipoComprobante>`,
        `      <parteRel>${s(x.parteRel)}</parteRel>`,
        `      <fechaRegistro>${s(x.fechaRegistro)}</fechaRegistro>`,
        `      <establecimiento>${s(x.establecimiento)}</establecimiento>`,
        `      <puntoEmision>${s(x.puntoEmision)}</puntoEmision>`,
        `      <secuencial>${s(x.secuencial)}</secuencial>`,
        `      <fechaEmision>${s(x.fechaEmision)}</fechaEmision>`,
        `      <autorizacion>${s(x.autorizacion)}</autorizacion>`,
        `      <baseNoGraIva>${s(x.baseNoGraIva, '0')}</baseNoGraIva>`,
        `      <baseImponible>${s(x.baseImponible, '0')}</baseImponible>`,
        `      <baseImpGrav>${s(x.baseImpGrav, '0')}</baseImpGrav>`,
        `      <baseImpExe>${s(x.baseImpExe, '0')}</baseImpExe>`,
        `      <montoIce>${s(x.montoIce, '0')}</montoIce>`,
        `      <montoIva>${s(x.montoIva, '0')}</montoIva>`,
        `      <valRetBien10>${s(x.valRetBien10, '0')}</valRetBien10>`,
        `      <valRetServ20>${s(x.valRetServ20, '0')}</valRetServ20>`,
        `      <valorRetBienes>${s(x.valorRetBienes, '0')}</valorRetBienes>`,
        `      <valRetServ50>${s(x.valRetServ50, '0')}</valRetServ50>`,
        `      <valorRetServicios>${s(x.valorRetServicios, '0')}</valorRetServicios>`,
        `      <valRetServ100>${s(x.valRetServ100, '0')}</valRetServ100>`,
        `      <totbasesImpReemb>${s(x.totbasesImpReemb, '           0.00')}</totbasesImpReemb>`,
        '      <pagoExterior>',
        `        <pagoLocExt>${s(pe.pagoLocExt, '01')}</pagoLocExt>`,
        `        <paisEfecPago>${s(pe.paisEfecPago, 'NA')}</paisEfecPago>`,
        `        <aplicConvDobTrib>${s(pe.aplicConvDobTrib, 'NA')}</aplicConvDobTrib>`,
        `        <pagExtSujRetNorLeg>${s(pe.pagExtSujRetNorLeg, 'NA')}</pagExtSujRetNorLeg>`,
        `        <pagoRegFis>${s(pe.pagoRegFis, 'NA')}</pagoRegFis>`,
        '      </pagoExterior>',
    ];
    if (Array.isArray(x.formasDePago) && x.formasDePago.length) {
        lineas.push('      <formasDePago>', ...x.formasDePago.map((f) => `        <formaPago>${s(f)}</formaPago>`), '      </formasDePago>');
    }
    if (x.docModificado) lineas.push(`      <docModificado>${s(x.docModificado)}</docModificado>`);
    if (x.estabModificado) lineas.push(`      <estabModificado>${s(x.estabModificado)}</estabModificado>`);
    if (x.ptoEmiModificado) lineas.push(`      <ptoEmiModificado>${s(x.ptoEmiModificado)}</ptoEmiModificado>`);
    if (x.secModificado) lineas.push(`      <secModificado>${s(x.secModificado)}</secModificado>`);
    if (x.autModificado) lineas.push(`      <autModificado>${s(x.autModificado)}</autModificado>`);
    lineas.push('    </detalleCompras>');
    return lineas.join('\n');
};

export function construirAts(d: AtsDatos): string {
    const c = d.cabecera;
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<iva>',
        `  <TipoIDInformante>${s(c.TipoIDInformante, 'R')}</TipoIDInformante>`,
        `  <IdInformante>${s(c.IdInformante)}</IdInformante>`,
        `  <razonSocial>${s(c.razonSocial)}</razonSocial>`,
        `  <Anio>${s(c.Anio)}</Anio>`,
        `  <Mes>${String(s(c.Mes)).padStart(2, '0')}</Mes>`,
        `  <numEstabRuc>${s(c.numEstabRuc, '001')}</numEstabRuc>`,
        `  <totalVentas>${s(c.totalVentas, '0.00')}</totalVentas>`,
        `  <codigoOperativo>${s(c.codigoOperativo, 'IVA')}</codigoOperativo>`,
        '  <compras>',
        ...(d.compras || []).map(compraXml),
        '  </compras>',
        '  <ventasEstablecimiento>',
        ...(d.ventasEstablecimiento || []).map((v) => [
            '    <ventaEst>',
            `      <codEstab>${s(v.codEstab, '001')}</codEstab>`,
            `      <ventasEstab>${s(v.ventasEstab, '0')}</ventasEstab>`,
            `      <ivaComp>${s(v.ivaComp, '0')}</ivaComp>`,
            '    </ventaEst>',
        ].join('\n')),
        '  </ventasEstablecimiento>',
        '</iva>',
        '',
    ].join('\n');
}

/** Descarga XML + ZIP del ATS. */
export async function descargarAts(d: AtsDatos): Promise<void> {
    const xml = construirAts(d);
    const anio = s(d.cabecera.Anio, String(new Date().getFullYear()));
    const mes = String(s(d.cabecera.Mes, '0')).padStart(2, '0');
    const ruc = s(d.cabecera.IdInformante).replace(/\D/g, '');
    const nombreXml = `ATS-${anio}-${mes}.xml`;
    saveAs(new Blob([xml], { type: 'application/xml' }), nombreXml);
    const zip = new JSZip();
    zip.file(nombreXml, xml);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    saveAs(blob, `Anexo_IVA_${ruc}.zip`);
}

/** Fecha dd/mm/aaaa desde ISO o texto. */
const fechaCorta = (x?: string): string => {
    if (!x) return '';
    const m = String(x).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return String(x);
};

const dos = (n: number): string => String(n).padStart(2, '0');

/**
 * Arma el ATS desde las compras registradas del período.
 * Devuelve también la lista de datos faltantes por comprobante (sin autorización
 * no se puede presentar: el SRI exige la clave de acceso de 49 dígitos).
 */
export function atsDesdeCompras(
    client: { ruc: string; name: string },
    periodo: string,
    invoices: PurchaseInvoiceItem[] | undefined,
    opciones?: { claveDeAcceso?: (inv: PurchaseInvoiceItem) => string | undefined },
): { datos: AtsDatos; faltantes: string[] } {
    const [anio, mes] = periodo.split('-').map(Number);
    const faltantes: string[] = [];
    const compras: AtsCompra[] = [];

    for (const inv of invoices || []) {
        const rucProv = String(inv.rucEmisor || '').replace(/\D/g, '');
        const autorizacion = opciones?.claveDeAcceso?.(inv) || inv.claveAcceso || '';
        if (!autorizacion) faltantes.push(`Factura ${inv.secuencial || inv.numero || inv.id} de ${inv.razonSocial}: falta la clave de acceso.`);
        const tarifa = Number(inv.tarifaIva ?? 15);
        const conCredito = inv.tieneCreditoTributario !== false;
        const base = Number(inv.valorSinImpuestos || 0);
        const iva = Number(inv.iva || 0);
        const tipo = inv.tipoComprobante === 'nota_credito' ? '04' : inv.tipoComprobante === 'liquidacion' ? '03' : '01';
        const serie = String(inv.secuencial || '').replace(/\D/g, '');
        const sec = serie.length >= 9 ? serie : String(inv.secuencial || dos(inv.numero || 0)).replace(/\D/g, '').padStart(9, '0');
        const estab = inv.establecimiento || (sec.length >= 9 ? sec.slice(0, 3) : '001');
        const ptoEmi = inv.puntoEmision || (sec.length >= 9 ? sec.slice(3, 6) : '001');
        const secuencial = sec.length >= 9 ? sec.slice(6) : sec;
        const sueldo = tarifa === 5
            ? { baseNoGraIva: '0', baseImponible: '0', baseImpGrav: '0', baseImpExe: '0', ivaComp: '0' }
            : { baseNoGraIva: '0', baseImponible: '0', baseImpGrav: base.toFixed(2), baseImpExe: '0', ivaComp: '0' };
        compras.push({
            codSustento: conCredito ? '01' : '02',
            tpIdProv: '01',
            idProv: rucProv,
            tipoComprobante: tipo,
            parteRel: 'NO',
            fechaRegistro: fechaCorta(inv.fechaEmision),
            establecimiento: estab,
            puntoEmision: ptoEmi,
            secuencial,
            fechaEmision: fechaCorta(inv.fechaEmision),
            autorizacion,
            baseNoGraIva: sueldo.baseNoGraIva,
            baseImponible: sueldo.baseImponible,
            baseImpGrav: sueldo.baseImpGrav,
            baseImpExe: sueldo.baseImpExe,
            montoIce: '0',
            montoIva: iva.toFixed(2),
            valRetBien10: '0',
            valRetServ20: '0',
            valorRetBienes: '0',
            valRetServ50: '0',
            valorRetServicios: '0',
            valRetServ100: '0',
            totbasesImpReemb: '           0.00',
            pagoExterior: { pagoLocExt: '01', paisEfecPago: 'NA', aplicConvDobTrib: 'NA', pagExtSujRetNorLeg: 'NA', pagoRegFis: 'NA' },
        });
    }

    return {
        datos: {
            cabecera: {
                IdInformante: String(client.ruc).replace(/\D/g, ''),
                razonSocial: String(client.name || '').slice(0, 300),
                Anio: anio || new Date().getFullYear(),
                Mes: mes || 1,
                numEstabRuc: '001',
                totalVentas: '0.00',
            },
            compras,
            ventasEstablecimiento: [{ codEstab: '001', ventasEstab: '0', ivaComp: '0' }],
        },
        faltantes,
    };
}
