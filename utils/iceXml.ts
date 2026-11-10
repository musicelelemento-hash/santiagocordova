import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Anexo ICE (Impuesto a los Consumos Especiales).
 *
 * Genera el XML con el mismo formato que entrega el SRI y lo descarga junto con
 * su ZIP. Los datos salen de `tax_profile.ice_ventas[periodo]`, que es lo que
 * publica la extensión al preparar el anexo del mes.
 */

export const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export interface IceProducto {
    codProdICE: string;
    gramoAzucar?: number;
    tipoIdCliente?: string;
    idCliente?: string;
    tipoVentaICE?: number | string;
    ventaICE?: number;
    devICE?: number;
    cantProdBajaICE?: number;
}

export interface IceVentasPeriodo {
    periodo: string;
    productos?: IceProducto[];
    ventaTotal?: number;
    devolucionTotal?: number;
    gramosAzucar?: number;
}

export interface AnexoIceDatos {
    ruc: string;
    nombre: string;
    anio: number;
    mes: number;
    productos: IceProducto[];
}

const gramos = (v: unknown): string => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

const importe = (v: unknown): string => {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return '0';
    return n.toFixed(2);
};

/** XML exacto del anexo ICE (mismo orden de campos que el del SRI). */
export function construirAnexoIce({ ruc, nombre, anio, mes, productos }: AnexoIceDatos): string {
    const lineas = productos.map((pr) => '<vta>'
        + `<codProdICE>${pr.codProdICE}</codProdICE>`
        + `<gramoAzucar>${gramos(pr.gramoAzucar)}</gramoAzucar>`
        + `<tipoIdCliente>${pr.tipoIdCliente || 'F'}</tipoIdCliente>`
        + `<idCliente>${pr.idCliente || '9999999999999'}</idCliente>`
        + `<tipoVentaICE>${pr.tipoVentaICE || 1}</tipoVentaICE>`
        + `<ventaICE>${importe(pr.ventaICE)}</ventaICE>`
        + `<devICE>${importe(pr.devICE)}</devICE>`
        + `<cantProdBajaICE>${Number(pr.cantProdBajaICE) || 0}</cantProdBajaICE>`
        + '</vta>').join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>'
        + '<ice>'
        + '<TipoIDInformante>R</TipoIDInformante>'
        + `<IdInformante>${ruc}</IdInformante>`
        + `<razonSocial>${nombre}</razonSocial>`
        + `<Anio>${anio}</Anio>`
        + `<Mes>${String(mes).padStart(2, '0')}</Mes>`
        + '<actImport>02</actImport>'
        + '<codigoOperativo>ICE</codigoOperativo>'
        + `<ventas>${lineas}</ventas>`
        + '</ice>';
}

const nombreBaseDe = (datos: AnexoIceDatos): string =>
    `ICE-${datos.anio}-${datos.ruc} ${MESES_CORTOS[datos.mes - 1]}`;

/** Descarga sólo el XML del anexo. */
export function descargarAnexoIceXml(datos: AnexoIceDatos): void {
    saveAs(new Blob([construirAnexoIce(datos)], { type: 'application/xml' }), `${nombreBaseDe(datos)}.xml`);
}

/** Descarga sólo el ZIP, con el nombre que pide el SRI (AICEmmaaaa.zip). */
export async function descargarAnexoIceZip(datos: AnexoIceDatos): Promise<void> {
    const zip = new JSZip();
    zip.file(`${nombreBaseDe(datos)}.xml`, construirAnexoIce(datos));
    const contenido = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    saveAs(contenido, `AICE${String(datos.mes).padStart(2, '0')}${datos.anio}.zip`);
}

/** Descarga el XML y el ZIP juntos. */
export async function descargarAnexoIce(datos: AnexoIceDatos): Promise<void> {
    descargarAnexoIceXml(datos);
    await descargarAnexoIceZip(datos);
}