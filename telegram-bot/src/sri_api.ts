import { supabase } from './supabase';
import axios, { AxiosError } from 'axios';

const DEFAULT_API_URL = process.env.VITE_FACTURACION_API_URL || 'https://facturador-sri-api.onrender.com';
const API_PREFIX = '/api/v1';
const API_KEY = process.env.FACTURACION_API_KEY || '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir';

// ─── Retry helper para manejar cold-starts de Render (502/503/504) ────────────
async function withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    maxAttempts = 3,
    delayMs = 8000
): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            const status = err?.response?.status;
            const isRetryable = !status || status === 502 || status === 503 || status === 504 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
            if (!isRetryable || attempt === maxAttempts) break;
            console.warn(`⚠️ [${label}] Intento ${attempt} fallido (${status || err.code}). Reintentando en ${delayMs / 1000}s...`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw lastError;
}

// ─── Wake-up ping: despierta el servidor de Render antes de facturar ──────────
export async function wakeUpFacturadorApi(): Promise<boolean> {
    try {
        await axios.get(`${DEFAULT_API_URL}/health`, { timeout: 15000 });
        return true;
    } catch {
        // El ping puede fallar (404/502) — lo que importa es que el servidor reciba el request y despierte
        return true;
    }
}

export async function getEmisorConfig() {
    const { data, error } = await supabase
        .from('emisor_settings')
        .select('*')
        .eq('id', 'default_emisor')
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No se encontró configuración de emisor en Supabase');

    return {
        emisorRuc: data.ruc,
        emisorRazonSocial: data.razon_social,
        emisorNombreComercial: data.nombre_comercial,
        emisorDirMatriz: data.dir_matriz,
        emisorEstab: data.estab,
        emisorPtoEmi: data.pto_emi,
        emisorRegimen: data.regimen,
        ambiente: data.ambiente,
        emisorSecuencialInicio: data.secuencial_inicio,
        lastSeqFactura: data.last_seq_factura,
        lastSeqRetencion: data.last_seq_retencion,
        p12Base64: data.p12_base64,
        p12FileName: data.p12_filename,
        p12Password: data.p12_password,
        emisorLogo: data.logo_url
    };
}

export async function updateLastSeqFactura(newSeq: number) {
    await supabase.from('emisor_settings').update({ last_seq_factura: newSeq }).eq('id', 'default_emisor');
}

export function generateAccessKeyEcuador(
    fecha: string, // YYYY-MM-DD
    tipoComp: string, // "01" (Factura)
    ruc: string,
    amb: string,
    estab: string,
    pto: string,
    sec: string,
    codNumerico = '12345678',
    tipoEmi = '1'
) {
    const cleanFecha = fecha.replace(/-/g, ''); // "20260716" -> YYYYMMDD
    const d = cleanFecha.substring(6, 8) + cleanFecha.substring(4, 6) + cleanFecha.substring(0, 4); // DD+MM+YYYY
    
    const baseKey = d + tipoComp + ruc + amb + estab + pto + sec.padStart(9, '0') + codNumerico.padStart(8, '0') + tipoEmi;
    
    let sum = 0;
    let factor = 2;
    for (let i = baseKey.length - 1; i >= 0; i--) {
        sum += parseInt(baseKey[i], 10) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const remainder = sum % 11;
    let checkDigit = 11 - remainder;
    if (checkDigit === 11) checkDigit = 0;
    if (checkDigit === 10) checkDigit = 1;

    return baseKey + checkDigit;
}

export function getEcuadorLocalDateStr(): string {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Guayaquil',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(new Date());
    } catch {
        const d = new Date();
        const ecuadorDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));
        return ecuadorDate.toISOString().split('T')[0];
    }
}

export async function emitInvoice(client: any, concept: string, amount: number, paymentMethod: string) {
    const emisor = await getEmisorConfig();
    
    const { data: nextSeqData, error: seqError } = await supabase.rpc('get_next_sri_secuencial', { p_tipo: 'factura' });
    if (seqError || !nextSeqData) {
        throw new Error(`Error obteniendo secuencial atómico de Supabase: ${seqError?.message || 'Sin respuesta'}`);
    }
    const nextSeqNum = nextSeqData as number;
    const secuencial = String(nextSeqNum).padStart(9, '0');
    const todayStr = getEcuadorLocalDateStr();
    
    const key = generateAccessKeyEcuador(
        todayStr,
        '01',
        emisor.emisorRuc,
        emisor.ambiente,
        emisor.emisorEstab,
        emisor.emisorPtoEmi,
        secuencial
    );

    const isRimpePopular = emisor.emisorRegimen === '3';
    const ivaRate = isRimpePopular ? 0.00 : 0.15;
    const ivaValue = Number((amount * ivaRate).toFixed(2));
    const total = Number((amount + ivaValue).toFixed(2));
    
    const buyerIdType = client.ruc && client.ruc.length === 13 ? '04' : '05';

    const payload = {
        tipo: 'factura',
        data: {
            infoTributaria: {
                ambiente: emisor.ambiente,
                tipoEmision: '1',
                razonSocial: emisor.emisorRazonSocial,
                nombreComercial: emisor.emisorNombreComercial,
                ruc: emisor.emisorRuc,
                claveAcceso: key,
                codDoc: '01',
                estab: emisor.emisorEstab,
                ptoEmi: emisor.emisorPtoEmi,
                secuencial: secuencial,
                dirMatriz: emisor.emisorDirMatriz,
                regimen: emisor.emisorRegimen
            },
            infoAdicional: {
                telefono: client.phones?.[0] || '0999999999',
                email: client.email || 'cliente@example.com',
                direccion: client.address || 'Ecuador'
            },
            infoFactura: {
                fechaEmision: todayStr,
                dirEstablecimiento: emisor.emisorDirMatriz,
                obligadoContabilidad: 'NO',
                tipoIdentificacionComprador: buyerIdType,
                razonSocialComprador: client.name || client.trade_name,
                identificacionComprador: client.ruc,
                totalSinImpuestos: amount.toFixed(2),
                totalDescuento: '0.00',
                totalImpuesto: isRimpePopular
                    ? [{ codigo: '2', codigoPorcentaje: '0', baseImponible: amount.toFixed(2), valor: '0.00' }]
                    : [{ codigo: '2', codigoPorcentaje: '4', baseImponible: amount.toFixed(2), valor: ivaValue.toFixed(2) }],
                propina: '0.00',
                importeTotal: total.toFixed(2),
                moneda: 'DOLAR',
                pagos: {
                    formaPago: paymentMethod,
                    total: total.toFixed(2)
                }
            },
            detalle: [
                {
                    codigoPrincipal: '001',
                    codigoAuxiliar: '001',
                    descripcion: concept,
                    cantidad: '1.00',
                    precioUnitario: amount.toFixed(2),
                    descuento: '0.00',
                    precioTotalSinImpuesto: amount.toFixed(2),
                    impuesto: {
                        codigo: '2',
                        codigoPorcentaje: isRimpePopular ? '0' : '4',
                        tarifa: isRimpePopular ? '0' : '15',
                        baseImponible: amount.toFixed(2),
                        valor: ivaValue.toFixed(2)
                    }
                }
            ]
        }
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': API_KEY
    };
    const TIMEOUT = 60000; // 60s — Render puede tardar al despertar

    // 1. XML (con retry por cold-start 502)
    const xmlRes = await withRetry(
        () => axios.post(`${DEFAULT_API_URL}${API_PREFIX}/facturacion/xml`, payload, { headers, timeout: TIMEOUT }),
        'generar-xml'
    );
    if (!xmlRes.data.status) throw new Error('Error al generar XML: ' + (xmlRes.data.message || JSON.stringify(xmlRes.data)));
    const { xml, xml_base64 } = xmlRes.data.data;

    // 2. FIRMAR
    if (!emisor.p12Base64 || !emisor.p12Password) throw new Error('No hay firma electrónica configurada');
    const signRes = await withRetry(
        () => axios.post(`${DEFAULT_API_URL}${API_PREFIX}/facturacion/firmar`, {
            xml_base64,
            certificado_p12_base64: emisor.p12Base64,
            clave: emisor.p12Password
        }, { headers, timeout: TIMEOUT }),
        'firmar-xml'
    );
    if (!signRes.data.status) throw new Error('Error al firmar: ' + signRes.data.message);
    const signedXmlBase64 = signRes.data.data.xml_firmado_base64;
    const signedXmlStr = Buffer.from(signedXmlBase64, 'base64').toString('utf8');

    // 3. ENVIAR
    const sendRes = await withRetry(
        () => axios.post(`${DEFAULT_API_URL}${API_PREFIX}/facturacion/sri/enviar`, {
            xml_base64: signedXmlBase64,
            ambiente: emisor.ambiente
        }, { headers, timeout: TIMEOUT }),
        'enviar-sri'
    );
    if (!sendRes.data.status) throw new Error('Error al enviar al SRI: ' + sendRes.data.message);

    // 4. AUTORIZAR
    const authRes = await withRetry(
        () => axios.post(`${DEFAULT_API_URL}${API_PREFIX}/facturacion/sri/autorizar`, {
            clave_acceso: key,
            ambiente: emisor.ambiente
        }, { headers, timeout: TIMEOUT }),
        'autorizar-sri'
    );
    if (!authRes.data.status) throw new Error('Error al autorizar: ' + authRes.data.message);

    // Update sequences
    await updateLastSeqFactura(nextSeqNum);

    const resultComprobante = {
        id: `fac_${Date.now()}_${secuencial}`,
        tipo: 'factura',
        secuencial,
        claveAcceso: key,
        rucReceptor: client.ruc,
        nombreReceptor: client.name || client.trade_name,
        fechaEmision: todayStr,
        total: total,
        estado: 'Autorizado',
        ambiente: emisor.ambiente,
        xml: signedXmlStr
    };

    // Save to history (Supabase)
    await supabase.from('sri_comprobantes').upsert({
        id: resultComprobante.id,
        tipo: resultComprobante.tipo,
        secuencial: resultComprobante.secuencial,
        clave_acceso: resultComprobante.claveAcceso,
        ruc_receptor: resultComprobante.rucReceptor,
        nombre_receptor: resultComprobante.nombreReceptor,
        fecha_emision: resultComprobante.fechaEmision,
        total: resultComprobante.total,
        estado: resultComprobante.estado,
        ambiente: resultComprobante.ambiente,
        xml: resultComprobante.xml,
        created_at: new Date().toISOString()
    });

    return { comprobante: resultComprobante, emisor, payload };
}
