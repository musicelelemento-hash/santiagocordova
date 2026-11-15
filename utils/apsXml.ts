import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Client } from '../types';

/**
 * REBEFICS / APS — Reporte de Beneficiarios Finales y Composición Societaria.
 *
 * Genera el XML `<aps>` con la MISMA estructura y orden de campos del anexo del
 * SRI (validado byte a byte contra el archivo real APS-20-2-2026.xml de
 * VIMARBO COMPANY S.A.S.).
 */

export interface ApsPersona {
    tipoIdentificacion?: string;   // C cédula · R RUC · P pasaporte
    numeroIdentificacion: string;
    primerNombre?: string;
    segundoNombre?: string;
    primerApellido?: string;
    segundoApellido?: string;
    nombresRazonSocial?: string;
    porcentaje?: number;
    esBeneficiarioFinal?: boolean;
    tipoRelacionadoSociedad?: string;
    parteRelacionadaInformante?: boolean;
    fechaNacimiento?: string;      // dd/mm/aaaa
    paisResidenciaFiscal?: string;
    provincia?: string;
    canton?: string;
    parroquia?: string;
    codigoPostal?: string;
    calle?: string;
}

export interface ApsDatos {
    ruc: string;
    anio: number;
    mes?: number;
    tipoSociedad?: string;
    anticipada?: 'SI' | 'NO';
    tipoDeclaracion?: string;
    accionistas?: ApsPersona[];
    beneficiarios?: ApsPersona[];
}

const v = (x: unknown, def = 'NA'): string => {
    const s = x === undefined || x === null ? '' : String(x);
    return s.trim() ? s : def;
};

// El SRI usa '0.0' para cero y entero para los porcentajes (51, 49).
const porcentaje = (n: unknown): string => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.0';
    if (v === 0) return '0.0';
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

const nombrePartes = (p: ApsPersona) => ({
    primerNombre: v(p.primerNombre),
    segundoNombre: v(p.segundoNombre),
    primerApellido: v(p.primerApellido),
    segundoApellido: v(p.segundoApellido),
});

export function construirAps(d: ApsDatos): string {
    const ruc = String(d.ruc || '').replace(/\D/g, '');
    const anio = String(d.anio || new Date().getFullYear());
    const mes = String(d.mes ?? 0).padStart(2, '0');
    const accionistas = (d.accionistas || []).map((a) => {
        const n = nombrePartes(a);
        return '<accionista>'
            + `<tipoSujeto>${v(a.tipoIdentificacion === 'R' ? '02' : '01', '01')}</tipoSujeto>`
            + `<tipoIdentificacion>${v(a.tipoIdentificacion, 'C')}</tipoIdentificacion>`
            + `<identificacionInformantePadre>${ruc}</identificacionInformantePadre>`
            + `<numeroIdentificacion>${v(a.numeroIdentificacion)}</numeroIdentificacion>`
            + `<primerNombre>${n.primerNombre}</primerNombre>`
            + `<segundoNombre>${n.segundoNombre}</segundoNombre>`
            + `<primerApellido>${n.primerApellido}</primerApellido>`
            + `<segundoApellido>${n.segundoApellido}</segundoApellido>`
            + `<nombresRazonSocial>${v(a.nombresRazonSocial)}</nombresRazonSocial>`
            + '<tipoRegimenFiscal>01</tipoRegimenFiscal>'
            + '<tipoSociedadExt>NA</tipoSociedadExt>'
            + '<figuraJuridicaExt>NA</figuraJuridicaExt>'
            + '<figuraJuridicaOtroExt>NA</figuraJuridicaOtroExt>'
            + '<esSociedadPublicaExt>NO</esSociedadPublicaExt>'
            + '<Menor10porc>NA</Menor10porc>'
            + '<porcentajeAccionarioNoBolsaExt>0.0</porcentajeAccionarioNoBolsaExt>'
            + '<porcentajeAccionarioBolsaExt>0.0</porcentajeAccionarioBolsaExt>'
            + `<esBeneficiarioFinal>${a.esBeneficiarioFinal === false ? 'NO' : 'SI'}</esBeneficiarioFinal>`
            + '<infoParticipacionAccionaria>'
            + '<codigoNivel>1</codigoNivel>'
            + `<tipoRelacionadoSociedad>${v(a.tipoRelacionadoSociedad, '10')}</tipoRelacionadoSociedad>`
            + `<porcentajeParticipacion>${porcentaje(a.porcentaje)}</porcentajeParticipacion>`
            + `<parteRelacionadaInformante>${a.parteRelacionadaInformante === false ? 'NO' : 'SI'}</parteRelacionadaInformante>`
            + '</infoParticipacionAccionaria>'
            + '<ubicacionResidenciaFiscal>'
            + `<paisResidenciaFiscal>${v(a.paisResidenciaFiscal, '593')}</paisResidenciaFiscal>`
            + '</ubicacionResidenciaFiscal>'
            + '</accionista>';
    }).join('');

    const beneficiarios = (d.beneficiarios || []).map((b) => {
        const n = nombrePartes(b);
        return '<beneficiario>'
            + `<tipoIdentificacion>${v(b.tipoIdentificacion, 'C')}</tipoIdentificacion>`
            + `<numeroIdentificacion>${v(b.numeroIdentificacion)}</numeroIdentificacion>`
            + `<primerNombre>${n.primerNombre}</primerNombre>`
            + `<segundoNombre>${n.segundoNombre}</segundoNombre>`
            + `<primerApellido>${n.primerApellido}</primerApellido>`
            + `<segundoApellido>${n.segundoApellido}</segundoApellido>`
            + `<fechaNacimiento>${v(b.fechaNacimiento)}</fechaNacimiento>`
            + '<porPropiedad>SI</porPropiedad>'
            + `<porcentajePropiedad>${porcentaje(b.porcentaje)}</porcentajePropiedad>`
            + '<porOtrosMotivos>01</porOtrosMotivos>'
            + '<porOtrosRelacionados>NA</porOtrosRelacionados>'
            + '<porAdministracion>NA</porAdministracion>'
            + `<nacionalidadUno>${v(b.paisResidenciaFiscal, '593')}</nacionalidadUno>`
            + '<nacionalidadDos>NA</nacionalidadDos>'
            + '<nacionalidadTres>NA</nacionalidadTres>'
            + `<residenciaFiscal>${v(b.paisResidenciaFiscal, '593')}</residenciaFiscal>`
            + '<jurisdiccion>NA</jurisdiccion>'
            + `<provincia>${v(b.provincia)}</provincia>`
            + '<ciudad>NA</ciudad>'
            + `<canton>${v(b.canton)}</canton>`
            + `<parroquia>${v(b.parroquia)}</parroquia>`
            + `<calle>${v(b.calle, 'SN')}</calle>`
            + '<numero>SN</numero>'
            + '<interseccion>SN</interseccion>'
            + `<codigoPostal>${v(b.codigoPostal)}</codigoPostal>`
            + '<referencia>SN</referencia>'
            + '</beneficiario>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="no"?><aps>'
        + '<TipoIDInformante>R</TipoIDInformante>'
        + `<IdInformante>${ruc}</IdInformante>`
        + `<TipoSociedad>${v(d.tipoSociedad, '01')}</TipoSociedad>`
        + `<Anio>${anio}</Anio>`
        + `<Mes>${mes}</Mes>`
        + '<PorcentajeAccionarioNoBolsa>0.00</PorcentajeAccionarioNoBolsa>'
        + '<codigoOperativo>APS</codigoOperativo>'
        + '<PorcentajeAccionarioBolsa>0.00</PorcentajeAccionarioBolsa>'
        + `<Anticipada>${d.anticipada === 'SI' ? 'SI' : 'NO'}</Anticipada>`
        + `<TipoDeclaracion>${v(d.tipoDeclaracion, '01')}</TipoDeclaracion>`
        + `<accionistas>${accionistas}</accionistas>`
        + `<beneficiarios>${beneficiarios}</beneficiarios>`
        + '</aps>';
}

/** Descarga el XML y el ZIP del APS del año indicado. */
export async function descargarAps(d: ApsDatos): Promise<void> {
    const xml = construirAps(d);
    const anio = String(d.anio || new Date().getFullYear());
    const mes = String(d.mes ?? 0).padStart(2, '0');
    const ruc = String(d.ruc || '').replace(/\D/g, '');
    const nombreXml = `APS-${anio}-${mes}.xml`;
    saveAs(new Blob([xml], { type: 'application/xml' }), nombreXml);
    const zip = new JSZip();
    zip.file(nombreXml, xml);
    const contenido = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    saveAs(contenido, `Anexo_APS_${ruc}.zip`);
}

/** Arma los datos del APS desde la ficha del cliente (taxProfile.company). */
export function apsDesdeCliente(client: Client, anio: number): ApsDatos {
    const company: any = (client.taxProfile as any)?.company || {};
    const partes: ApsPersona[] = Array.isArray(company.accionistas) ? company.accionistas : [];
    return {
        ruc: client.ruc,
        anio,
        mes: 0,
        tipoSociedad: company.tipoSociedad || '01',
        accionistas: partes.map((p) => ({
            ...p,
            tipoIdentificacion: p.tipoIdentificacion || 'C',
            esBeneficiarioFinal: p.esBeneficiarioFinal !== false,
            tipoRelacionadoSociedad: p.tipoRelacionadoSociedad || '10',
        })),
        beneficiarios: (Array.isArray(company.beneficiarios) && company.beneficiarios.length
            ? company.beneficiarios
            : partes.filter((p) => p.esBeneficiarioFinal !== false)) as ApsPersona[],
    };
}
