import html2pdf from 'html2pdf.js';

export interface RideComprobanteData {
    id?: string;
    tipo?: string; // 'factura' | 'retencion' | 'nota_venta'
    secuencial: string;
    claveAcceso: string;
    numeroAutorizacion?: string;
    rucReceptor?: string;
    nombreReceptor?: string;
    fechaEmision?: string;
    total: number;
    xml?: string;
    ambiente?: string;
    mensajeError?: string;
    period?: string;
}

export interface RideEmisorData {
    ruc?: string;
    razonSocial?: string;
    nombreComercial?: string;
    dirMatriz?: string;
    estab?: string;
    ptoEmi?: string;
    regimen?: string; // '0' = General, '2' = RIMPE Emprendedor, '3' = RIMPE Negocio Popular
    ambiente?: string;
    logoUrl?: string;
}

export interface RideBuyerData {
    razonSocial?: string;
    identificacion?: string;
    direccion?: string;
    fechaEmision?: string;
    phone?: string;
    email?: string;
}

/**
 * Normaliza y formatea fechas para el comprobante de manera consistente (DD/MM/YYYY o DD/MM/YYYY HH:mm)
 */
export function formatRideDate(dateStr?: string): string {
    if (!dateStr) return '';
    const clean = dateStr.trim();
    
    // Si viene con timestamp ISO (YYYY-MM-DDTHH:mm:ss...)
    if (clean.includes('T')) {
        const [dPart, tPart] = clean.split('T');
        const dMatch = dPart.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
        const timeClean = (tPart || '').split('-')[0].split('+')[0].substring(0, 5);
        if (dMatch) {
            return timeClean ? `${dMatch[3]}/${dMatch[2]}/${dMatch[1]} ${timeClean}` : `${dMatch[3]}/${dMatch[2]}/${dMatch[1]}`;
        }
    }

    // Formato YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:\s+(\d{2}:\d{2}))?/);
    if (isoMatch) {
        return isoMatch[4] ? `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]} ${isoMatch[4]}` : `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    // Si ya viene DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}:\d{2}))?/);
    if (dmyMatch) {
        return isoMatch?.[4] ? `${dmyMatch[1]}/${dmyMatch[2]}/${dmyMatch[3]} ${dmyMatch[4]}` : `${dmyMatch[1]}/${dmyMatch[2]}/${dmyMatch[3]}`;
    }

    // Parse estándar
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    return clean;
}

/**
 * Filtra y sanea textos filtrados del sistema (ej: "DIRECCIÓN NO DETECTADA")
 */
export function sanitizeAddress(addr?: string): string {
    if (!addr) return '—';
    const trimmed = addr.trim();
    if (!trimmed || /direcci[oó]n\s+no\s+detectada/i.test(trimmed) || trimmed.toLowerCase() === 'ecuador') {
        return '—';
    }
    return trimmed;
}

/**
 * Corrige erratas comunes en textos y descripciones del comprobante (ej: "DELSERVICIO" -> "DEL SERVICIO", "SANTIGO" -> "SANTIAGO")
 */
export function cleanInvoiceText(str?: string): string {
    if (!str) return '';
    return str
        .replace(/DELSERVICIO/gi, 'DEL SERVICIO')
        .replace(/SANTIGO/gi, 'SANTIAGO')
        .replace(/\bAGOST\b/gi, 'Agosto')
        .replace(/\bSEPT\b/gi, 'Septiembre')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Genera un código numérico aleatorio de 8 dígitos para la Clave de Acceso del SRI
 */
export function generateRandomNumericCode(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Genera el SVG del código de barras para la Clave de Acceso de 49 dígitos del SRI
 */
export function generateBarcodeBars(clave: string): string {
    if (!clave) return '';
    let x = 6;
    const height = 28;
    const rects: string[] = [];
    
    // Guard bars iniciales
    rects.push(`<rect x="${x}" y="0" width="2" height="${height}" fill="#1a1a1a"/>`); x += 3;
    rects.push(`<rect x="${x}" y="0" width="1" height="${height}" fill="#1a1a1a"/>`); x += 2;
    rects.push(`<rect x="${x}" y="0" width="2" height="${height}" fill="#1a1a1a"/>`); x += 3;

    for (let i = 0; i < clave.length; i++) {
        const digit = parseInt(clave[i], 10) || 0;
        const w = ((digit * 7 + i) % 3) * 0.7 + 1.1;
        const space = ((digit * 3 + i) % 2) * 0.7 + 1.3;
        rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="#1a1a1a"/>`);
        x += w + space;
    }

    // Guard bars finales
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="2" height="${height}" fill="#1a1a1a"/>`); x += 3;
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="1" height="${height}" fill="#1a1a1a"/>`); x += 2;
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="2" height="${height}" fill="#1a1a1a"/>`); x += 6;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(x)} ${height}" width="100%" height="26" style="display:block;max-width:290px;margin:0 auto;" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

/**
 * Procesa un comprobante electrónico y genera el documento RIDE con la proporción Áurea Tributaria (φ = 1.618)
 */
export function generateRideParts(
    comprobante: RideComprobanteData,
    emisorOverride?: RideEmisorData,
    buyerOverride?: RideBuyerData
) {
    const emisor = {
        razonSocial: cleanInvoiceText(emisorOverride?.razonSocial || localStorage.getItem('sc_emisor_razon') || 'CORDOVA RAMIREZ ROBERTO SANTIAGO'),
        nombreComercial: cleanInvoiceText(emisorOverride?.nombreComercial || localStorage.getItem('sc_emisor_comercial') || 'Santiago Córdova · Asesoría & Soluciones Tributarias'),
        ruc: emisorOverride?.ruc || localStorage.getItem('sc_emisor_ruc') || '0705787745001',
        dirMatriz: emisorOverride?.dirMatriz || localStorage.getItem('sc_emisor_dir') || 'Colon y Sucre / Pasaje - El Oro',
        estab: emisorOverride?.estab || localStorage.getItem('sc_emisor_estab') || '001',
        ptoEmi: emisorOverride?.ptoEmi || localStorage.getItem('sc_emisor_pto') || '001',
        secuencial: comprobante.secuencial,
        claveAcceso: comprobante.claveAcceso,
        ambiente: (comprobante.ambiente === '2' || localStorage.getItem('sc_emisor_ambiente') === '2') ? 'PRODUCCIÓN' : 'PRUEBAS',
        regimen: emisorOverride?.regimen || localStorage.getItem('sc_emisor_regimen') || '3',
        logoUrl: emisorOverride?.logoUrl || localStorage.getItem('sc_emisor_logo') || ''
    };

    const receptor = {
        razonSocial: cleanInvoiceText(buyerOverride?.razonSocial || comprobante.nombreReceptor || 'CONSUMIDOR FINAL'),
        identificacion: buyerOverride?.identificacion || comprobante.rucReceptor || '9999999999999',
        direccion: sanitizeAddress(buyerOverride?.direccion || '—'),
        fechaEmision: buyerOverride?.fechaEmision || comprobante.fechaEmision || new Date().toISOString().split('T')[0],
        email: buyerOverride?.email || '',
        phone: buyerOverride?.phone || ''
    };

    let itemsHtml = '';
    let subtotal15 = 0;
    let subtotal0 = comprobante.total;
    let iva15 = 0;
    let totalDescuento = 0;
    const total = comprobante.total;
    let formaPagoDesc = 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
    let formaPagoTotal = comprobante.total;
    const xmlCamposAdicionales: { nombre: string; valor: string }[] = [];
    let rawAuthDate = '';

    // Parsear XML si está presente
    if (comprobante.xml) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(comprobante.xml, "text/xml");
            
            const rz = xmlDoc.getElementsByTagName("razonSocial")[0]?.textContent;
            if (rz) emisor.razonSocial = cleanInvoiceText(rz);
            const nc = xmlDoc.getElementsByTagName("nombreComercial")[0]?.textContent;
            if (nc) emisor.nombreComercial = cleanInvoiceText(nc);
            const ruc = xmlDoc.getElementsByTagName("ruc")[0]?.textContent;
            if (ruc) emisor.ruc = ruc;
            const dm = xmlDoc.getElementsByTagName("dirMatriz")[0]?.textContent;
            if (dm) emisor.dirMatriz = dm;
            const est = xmlDoc.getElementsByTagName("estab")[0]?.textContent;
            if (est) emisor.estab = est;
            const pe = xmlDoc.getElementsByTagName("ptoEmi")[0]?.textContent;
            if (pe) emisor.ptoEmi = pe;

            const rzReceptor = xmlDoc.getElementsByTagName("razonSocialComprador")[0]?.textContent
                || xmlDoc.getElementsByTagName("razonSocialSujetoRetenido")[0]?.textContent
                || xmlDoc.getElementsByTagName("razonSocialProveedor")[0]?.textContent;
            if (rzReceptor) receptor.razonSocial = cleanInvoiceText(rzReceptor);

            const idReceptor = xmlDoc.getElementsByTagName("identificacionComprador")[0]?.textContent
                || xmlDoc.getElementsByTagName("identificacionSujetoRetenido")[0]?.textContent
                || xmlDoc.getElementsByTagName("identificacionProveedor")[0]?.textContent;
            if (idReceptor) receptor.identificacion = idReceptor;

            const dirReceptor = xmlDoc.getElementsByTagName("direccionComprador")[0]?.textContent
                || xmlDoc.getElementsByTagName("direccionProveedor")[0]?.textContent;
            if (dirReceptor) receptor.direccion = sanitizeAddress(dirReceptor);

            const fEmi = xmlDoc.getElementsByTagName("fechaEmision")[0]?.textContent;
            if (fEmi) receptor.fechaEmision = fEmi;

            const fAut = xmlDoc.getElementsByTagName("fechaAutorizacion")[0]?.textContent;
            if (fAut) rawAuthDate = fAut;

            // Detalles de productos/servicios
            const detalles = xmlDoc.getElementsByTagName("detalle");
            if (detalles.length > 0) {
                subtotal0 = 0; // Se recalcula con los detalles reales
                for (let i = 0; i < detalles.length; i++) {
                    const det = detalles[i];
                    const cod = det.getElementsByTagName("codigoPrincipal")[0]?.textContent || '001';
                    const desc = cleanInvoiceText(det.getElementsByTagName("descripcion")[0]?.textContent || 'Servicios Contables');
                    const cant = det.getElementsByTagName("cantidad")[0]?.textContent || '1.00';
                    const pu = det.getElementsByTagName("precioUnitario")[0]?.textContent || total.toFixed(2);
                    const descVal = det.getElementsByTagName("descuento")[0]?.textContent || '0.00';
                    const pt = det.getElementsByTagName("precioTotalSinImpuesto")[0]?.textContent || total.toFixed(2);
                    const descNum = parseFloat(descVal) || 0;
                    if (descNum > 0) totalDescuento += descNum;

                    itemsHtml += `
                    <tr>
                        <td class="col-cod">${cod}</td>
                        <td class="col-cant">${cant}</td>
                        <td class="col-desc">${desc}</td>
                        <td class="col-num">$${parseFloat(pu).toFixed(2)}</td>
                        <td class="col-num">${descNum > 0 ? `$${descNum.toFixed(2)}` : '—'}</td>
                        <td class="col-num col-total">$${parseFloat(pt).toFixed(2)}</td>
                    </tr>`;
                }
            }

            // Totales de impuestos
            const totalImpuestos = xmlDoc.getElementsByTagName("totalImpuesto");
            for (let i = 0; i < totalImpuestos.length; i++) {
                const ti = totalImpuestos[i];
                const codPorc = ti.getElementsByTagName("codigoPorcentaje")[0]?.textContent;
                const baseImp = parseFloat(ti.getElementsByTagName("baseImponible")[0]?.textContent || '0');
                const val = parseFloat(ti.getElementsByTagName("valor")[0]?.textContent || '0');
                if (codPorc === '4' || codPorc === '2' || codPorc === '3') {
                    subtotal15 = baseImp;
                    iva15 = val;
                } else if (codPorc === '0') {
                    subtotal0 = baseImp;
                }
            }

            // Forma de pago
            const pagos = xmlDoc.getElementsByTagName("pago");
            if (pagos.length > 0) {
                const fp = pagos[0].getElementsByTagName("formaPago")[0]?.textContent;
                const fpt = parseFloat(pagos[0].getElementsByTagName("total")[0]?.textContent || '0');
                if (fpt > 0) formaPagoTotal = fpt;
                if (fp === '01') formaPagoDesc = 'SIN UTILIZACION DEL SISTEMA FINANCIERO (EFECTIVO)';
                else if (fp === '19') formaPagoDesc = 'TARJETA DE CREDITO';
                else if (fp === '20') formaPagoDesc = 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO (TRANSFERENCIA / DEPOSITO)';
            }

            // Campos adicionales
            const campos = xmlDoc.getElementsByTagName("campoAdicional");
            for (let i = 0; i < campos.length; i++) {
                const nombre = campos[i].getAttribute("nombre") || `Campo ${i + 1}`;
                const valor = campos[i].textContent || '';
                const lowerName = nombre.toLowerCase();
                // Omitir campos técnicos ruidosos o repetidos
                if (lowerName.includes('rucproveedor') || lowerName.includes('token') || lowerName.includes('firma')) continue;
                xmlCamposAdicionales.push({ nombre: cleanInvoiceText(nombre), valor: cleanInvoiceText(valor) });
            }
        } catch (e) {
            console.warn('[rideService] Error parseando XML del comprobante:', e);
        }
    }

    if (!itemsHtml) {
        itemsHtml = `
        <tr>
            <td class="col-cod">001</td>
            <td class="col-cant">1.00</td>
            <td class="col-desc">Servicios Profesionales de Asesoría Contable y Tributaria</td>
            <td class="col-num">$${total.toFixed(2)}</td>
            <td class="col-num">—</td>
            <td class="col-num col-total">$${total.toFixed(2)}</td>
        </tr>`;
    }

    // Tratamiento Tributario SRI:
    // Todos los comprobantes electrónicos de ventas (código 01) son FACTURA ELECTRÓNICA.
    // En RIMPE Negocio Popular o Emprendedor se mantiene el distintivo legal del régimen en el membrete.
    const isRimpePopular = emisor.regimen === '3';
    const isRimpeEmprendedor = emisor.regimen === '2';
    const isRetencion = comprobante.tipo === 'retencion' || comprobante.tipo?.toLowerCase() === 'retencion';
    const isNotaCredito = comprobante.tipo === 'nota_credito' || comprobante.tipo?.toLowerCase() === 'nota_credito';

    let docTitle = 'FACTURA ELECTRÓNICA';
    if (isRetencion) {
        docTitle = 'COMPROBANTE DE RETENCIÓN';
    } else if (isNotaCredito) {
        docTitle = 'NOTA DE CRÉDITO';
    } else {
        docTitle = 'FACTURA ELECTRÓNICA';
    }

    const regimeLabel = isRimpePopular
        ? `<div class="aurea-regime-badge">CONTRIBUYENTE RÉGIMEN RIMPE · NEGOCIO POPULAR</div>`
        : isRimpeEmprendedor
            ? `<div class="aurea-regime-badge">CONTRIBUYENTE RÉGIMEN RIMPE · EMPRENDEDOR</div>`
            : '';

    const formattedEmissionDate = formatRideDate(receptor.fechaEmision);
    const formattedAuthDate = formatRideDate(rawAuthDate || receptor.fechaEmision);
    const docPrefix = isRetencion ? 'Retencion' : (isNotaCredito ? 'NotaCredito' : 'Factura');
    const filename = `RIDE_${docPrefix}_${emisor.estab}_${emisor.ptoEmi}_${comprobante.secuencial}.pdf`;

    // Totales según tratamiento tributario SRI para Facturas Electrónicas:
    let totalsTableHtml = '';
    const subtotalSinImp = (subtotal15 + subtotal0);
    totalsTableHtml = `
    <table class="aurea-totals-table">
        <tbody>
            ${subtotal15 > 0 ? `
            <tr>
                <td class="tot-label">SUBTOTAL 15%:</td>
                <td class="tot-val">$${subtotal15.toFixed(2)}</td>
            </tr>` : ''}
            ${(subtotal0 > 0 || isRimpePopular || subtotal15 === 0) ? `
            <tr>
                <td class="tot-label">SUBTOTAL 0%:</td>
                <td class="tot-val">$${(subtotal0 > 0 ? subtotal0 : (subtotal15 === 0 ? total : 0)).toFixed(2)}</td>
            </tr>` : ''}
            <tr>
                <td class="tot-label">SUBTOTAL SIN IMPUESTOS:</td>
                <td class="tot-val">$${(subtotalSinImp > 0 ? subtotalSinImp : total).toFixed(2)}</td>
            </tr>
            ${totalDescuento > 0 ? `
            <tr>
                <td class="tot-label">DESCUENTO:</td>
                <td class="tot-val">$${totalDescuento.toFixed(2)}</td>
            </tr>` : ''}
            ${iva15 > 0 ? `
            <tr>
                <td class="tot-label">IVA 15%:</td>
                <td class="tot-val">$${iva15.toFixed(2)}</td>
            </tr>` : ''}
            <tr class="tot-hero-row">
                <td class="tot-hero-label">VALOR TOTAL:</td>
                <td class="tot-hero-val">$${total.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>`;

    const cardContentHtml = `
    <div class="invoice-card">
        <!-- Encabezado Proporción Áurea (61.8% izquierda, 38.2% derecha) -->
        <div class="aurea-top-grid">
            <!-- Columna Emisor (61.8%) -->
            <div class="emisor-block">
                <div class="emisor-legal-name">${emisor.razonSocial}</div>
                <div class="emisor-trade-name">${emisor.nombreComercial}</div>
                <div class="emisor-meta-line">
                    <span class="meta-label">Matriz:</span> ${emisor.dirMatriz}
                </div>
                <div class="emisor-meta-line">
                    <span class="meta-label">Obligado a llevar contabilidad:</span> NO
                </div>
                ${regimeLabel}
            </div>

            <!-- Columna Autorización & Clave de Acceso (38.2%) -->
            <div class="auth-block">
                <div class="doc-header-row">
                    <div class="doc-ruc">R.U.C. ${emisor.ruc}</div>
                    <div class="doc-title">${docTitle}</div>
                    <div class="doc-secuencial">No. ${emisor.estab}-${emisor.ptoEmi}-${comprobante.secuencial}</div>
                </div>

                <div class="auth-divider"></div>

                <!-- Bloque Único Autorización y Clave de Acceso (Sin repeticiones) -->
                <div class="auth-key-box">
                    <div class="auth-key-label">N.º DE AUTORIZACIÓN / CLAVE DE ACCESO</div>
                    <div class="auth-barcode-wrap">
                        ${generateBarcodeBars(comprobante.claveAcceso)}
                    </div>
                    <div class="auth-key-string">${comprobante.claveAcceso}</div>
                </div>

                <div class="auth-meta-row">
                    <div><span class="meta-label">Ambiente:</span> <strong>${emisor.ambiente}</strong></div>
                    <div><span class="meta-label">Emisión:</span> NORMAL</div>
                </div>
                <div class="auth-meta-row">
                    <div><span class="meta-label">Fecha:</span> ${formattedAuthDate}</div>
                </div>
            </div>
        </div>

        <!-- Bloque Cliente / Comprador -->
        <div class="client-card">
            <div class="client-grid">
                <div>
                    <div class="client-field-label">RAZÓN SOCIAL / CLIENTE</div>
                    <div class="client-field-val client-val-strong">${receptor.razonSocial}</div>
                </div>
                <div>
                    <div class="client-field-label">RUC / CÉDULA</div>
                    <div class="client-field-val client-mono">${receptor.identificacion}</div>
                </div>
                <div>
                    <div class="client-field-label">DIRECCIÓN</div>
                    <div class="client-field-val">${receptor.direccion}</div>
                </div>
                <div>
                    <div class="client-field-label">FECHA DE EMISIÓN</div>
                    <div class="client-field-val">${formattedEmissionDate}</div>
                </div>
            </div>
        </div>

        <!-- Tabla de Detalles / Líneas -->
        <table class="aurea-items-table">
            <thead>
                <tr>
                    <th style="width: 60px;">Cód.</th>
                    <th style="width: 48px; text-align: center;">Cant.</th>
                    <th>Descripción</th>
                    <th style="width: 80px; text-align: right;">P. Unit.</th>
                    <th style="width: 70px; text-align: right;">Desc.</th>
                    <th style="width: 85px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <!-- Sección Inferior Proporción Áurea (61.8% izquierda, 38.2% derecha) -->
        <div class="aurea-bottom-grid">
            <!-- Izquierda: Pago & Info Adicional (61.8%) -->
            <div class="bottom-left-col">
                <div class="aurea-sub-card">
                    <div class="sub-card-title">Forma de Pago</div>
                    <div class="pago-item-row">
                        <span class="pago-desc">${formaPagoDesc}</span>
                        <span class="pago-amount">$${formaPagoTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div class="aurea-sub-card">
                    <div class="sub-card-title">Información Adicional</div>
                    <div class="info-list">
                        ${receptor.email ? `<div><span class="meta-label">Email:</span> ${receptor.email}</div>` : ''}
                        ${receptor.phone ? `<div><span class="meta-label">Teléfono:</span> ${receptor.phone}</div>` : ''}
                        ${comprobante.period ? `<div><span class="meta-label">Período:</span> ${cleanInvoiceText(comprobante.period)}</div>` : ''}
                        ${xmlCamposAdicionales.map(c => `<div><span class="meta-label">${c.nombre}:</span> ${c.valor}</div>`).join('')}
                    </div>
                </div>

                <!-- Crédito de Sistema Sutil y Elegante al pie (Áurea Tributaria) -->
                <div class="aurea-system-credit">
                    Áurea Tributaria · Santiago Córdova
                </div>
            </div>

            <!-- Derecha: Totales (38.2%) -->
            <div class="bottom-right-col">
                ${totalsTableHtml}
            </div>
        </div>
    </div>`;

    const cssStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
    
    @page {
        size: A4 portrait;
        margin: 13mm 15mm;
    }

    *, *::before, *::after {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }

    body {
        margin: 0;
        padding: 16px;
        background: #f8fafc;
        color: #1a1a1a;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 8.5pt;
        line-height: 1.35;
    }

    .invoice-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 24px 28px;
        max-width: 800px;
        margin: 0 auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    /* Grilla Superior Áurea (1.618 : 1) */
    .aurea-top-grid {
        display: grid;
        grid-template-columns: 1.618fr 1fr;
        gap: 20px;
        margin-bottom: 16px;
        align-items: start;
    }

    .emisor-block {
        padding-right: 8px;
    }

    .emisor-legal-name {
        font-size: 14pt;
        font-weight: 800;
        color: #0a3641;
        letter-spacing: -0.3px;
        line-height: 1.2;
        margin-bottom: 4px;
        text-transform: uppercase;
    }

    .emisor-trade-name {
        font-size: 9pt;
        font-weight: 600;
        color: #4b5563;
        margin-bottom: 8px;
    }

    .emisor-meta-line {
        font-size: 8pt;
        color: #4b5563;
        margin-bottom: 3px;
        line-height: 1.3;
    }

    .meta-label {
        font-weight: 600;
        color: #6b7280;
    }

    .aurea-regime-badge {
        display: inline-block;
        margin-top: 8px;
        padding: 3px 8px;
        background: #f0fdf9;
        border: 1px solid #ccfbf1;
        border-left: 3px solid #0a3641;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 7.5pt;
        font-weight: 700;
        color: #0a3641;
        letter-spacing: 0.3px;
    }

    .auth-block {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px 14px;
    }

    .doc-header-row {
        margin-bottom: 8px;
    }

    .doc-ruc {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10.5pt;
        font-weight: 700;
        color: #1a1a1a;
        margin-bottom: 2px;
    }

    .doc-title {
        font-size: 12pt;
        font-weight: 800;
        color: #0a3641;
        letter-spacing: 0.2px;
        margin-bottom: 2px;
    }

    .doc-secuencial {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10pt;
        font-weight: 700;
        color: #374151;
    }

    .auth-divider {
        height: 1px;
        background: #e5e7eb;
        margin: 8px 0;
    }

    .auth-key-box {
        margin-bottom: 8px;
        text-align: center;
    }

    .auth-key-label {
        font-size: 7pt;
        font-weight: 700;
        color: #6b7280;
        letter-spacing: 0.5px;
        text-align: left;
        margin-bottom: 4px;
    }

    .auth-barcode-wrap {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 4px 2px;
        margin-bottom: 4px;
    }

    .auth-key-string {
        font-family: 'JetBrains Mono', monospace;
        font-size: 7pt;
        font-weight: 600;
        color: #1a1a1a;
        letter-spacing: 0.4px;
        word-break: break-all;
        line-height: 1.15;
    }

    .auth-meta-row {
        display: flex;
        justify-content: space-between;
        font-size: 7.5pt;
        color: #4b5563;
        margin-top: 3px;
    }

    /* Tarjeta Cliente */
    .client-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 16px;
        background: #ffffff;
    }

    .client-grid {
        display: grid;
        grid-template-columns: 1.618fr 1fr;
        column-gap: 16px;
        row-gap: 6px;
    }

    .client-field-label {
        font-size: 6.8pt;
        font-weight: 700;
        color: #9ca3af;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        margin-bottom: 1px;
    }

    .client-field-val {
        font-size: 8.5pt;
        color: #1a1a1a;
    }

    .client-val-strong {
        font-weight: 700;
        color: #0a3641;
        text-transform: uppercase;
    }

    .client-mono {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
    }

    /* Tabla de Detalles */
    .aurea-items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
    }

    .aurea-items-table th {
        background: #f8fafc;
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #cbd5e1;
        font-size: 7.5pt;
        font-weight: 700;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        padding: 6px 8px;
        text-align: left;
    }

    .aurea-items-table td {
        padding: 6px 8px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 8.5pt;
        color: #1a1a1a;
        vertical-align: top;
    }

    .col-cod {
        font-family: 'JetBrains Mono', monospace;
        font-size: 7.5pt;
        color: #6b7280;
    }

    .col-cant {
        text-align: center;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
    }

    .col-desc {
        line-height: 1.3;
    }

    .col-num {
        text-align: right;
        font-family: 'JetBrains Mono', monospace;
        font-feature-settings: "tnum" 1;
        white-space: nowrap;
    }

    .col-total {
        font-weight: 700;
        color: #1a1a1a;
    }

    /* Grilla Inferior Áurea (1.618 : 1) */
    .aurea-bottom-grid {
        display: grid;
        grid-template-columns: 1.618fr 1fr;
        gap: 20px;
        align-items: start;
    }

    .aurea-sub-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 10px;
        background: #ffffff;
    }

    .sub-card-title {
        font-size: 7.5pt;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        margin-bottom: 4px;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 3px;
    }

    .pago-item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8pt;
    }

    .pago-desc {
        font-weight: 600;
        color: #374151;
        max-width: 75%;
    }

    .pago-amount {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        color: #1a1a1a;
    }

    .info-list {
        font-size: 7.8pt;
        color: #4b5563;
        line-height: 1.4;
    }

    .aurea-system-credit {
        font-size: 7pt;
        color: #9ca3af;
        letter-spacing: 0.3px;
        margin-top: 6px;
    }

    /* Tabla de Totales */
    .aurea-totals-table {
        width: 100%;
        border-collapse: collapse;
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
    }

    .aurea-totals-table td {
        padding: 4px 10px;
        font-size: 8pt;
    }

    .tot-label {
        font-weight: 600;
        color: #4b5563;
        border-bottom: 1px solid #f1f5f9;
    }

    .tot-val {
        text-align: right;
        font-family: 'JetBrains Mono', monospace;
        font-feature-settings: "tnum" 1;
        font-weight: 600;
        color: #1a1a1a;
        border-bottom: 1px solid #f1f5f9;
        white-space: nowrap;
    }

    .tot-hero-row td {
        border-top: 1.5px solid #0a3641;
        border-bottom: none;
        padding-top: 8px;
        padding-bottom: 8px;
    }

    .tot-hero-label {
        font-size: 9.5pt;
        font-weight: 800;
        color: #0a3641;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .tot-hero-val {
        text-align: right;
        font-family: 'JetBrains Mono', monospace;
        font-feature-settings: "tnum" 1;
        font-size: 13.5pt;
        font-weight: 800;
        color: #0a3641;
        white-space: nowrap;
    }

    /* Reglas de Impresión Rigurosas */
    @media print {
        body {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
        }

        .no-print {
            display: none !important;
        }

        .invoice-card {
            border: 1px solid #d1d5db !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .aurea-top-grid, .aurea-bottom-grid {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .aurea-items-table {
            page-break-inside: auto;
        }

        .aurea-items-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    }
    `;

    const fullDocHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${filename.replace('.pdf', '')}</title>
    <style>${cssStyles}</style>
</head>
<body>
    <div class="no-print" style="max-width: 800px; margin: 0 auto 12px; padding: 10px 16px; background: #0a3641; color: #ffffff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', sans-serif;">
        <div>
            <div style="font-weight: 800; font-size: 12px; letter-spacing: 0.3px;">Áurea Tributaria · ${docTitle}</div>
            <div style="font-size: 10px; opacity: 0.8; margin-top: 1px;">No. ${emisor.estab}-${emisor.ptoEmi}-${comprobante.secuencial} · ${receptor.razonSocial}</div>
        </div>
        <button onclick="window.print()" style="background: #ffffff; color: #0a3641; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            🖨️ Imprimir / Guardar PDF
        </button>
    </div>
    ${cardContentHtml}
</body>
</html>`;

    return { cardContentHtml, cssStyles, fullDocHtml, filename, emisor, receptor, docTitle };
}

/**
 * Descarga directamente el PDF en el navegador del usuario utilizando html2pdf con proporciones exactas
 */
export async function downloadRidePdf(
    comprobante: RideComprobanteData,
    emisorOverride?: RideEmisorData,
    buyerOverride?: RideBuyerData
): Promise<void> {
    const { cardContentHtml, cssStyles, filename } = generateRideParts(comprobante, emisorOverride, buyerOverride);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // Ancho A4 exacto a 96 DPI
    container.innerHTML = `<style>${cssStyles}</style><div style="padding: 20px;">${cardContentHtml}</div>`;
    document.body.appendChild(container);

    const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    try {
        await (html2pdf as any)().set(opt).from(container).save();
    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
}

/**
 * Abre el PDF del RIDE directamente en el visor nativo de PDF del navegador (o lo descarga si los popups están bloqueados)
 */
export async function openRidePdfDirect(
    comprobante: RideComprobanteData,
    emisorOverride?: RideEmisorData,
    buyerOverride?: RideBuyerData
): Promise<void> {
    const { cardContentHtml, cssStyles, filename } = generateRideParts(comprobante, emisorOverride, buyerOverride);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // Ancho A4 exacto a 96 DPI
    container.innerHTML = `<style>${cssStyles}</style><div style="padding: 20px;">${cardContentHtml}</div>`;
    document.body.appendChild(container);

    const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    try {
        const worker = (html2pdf as any)().set(opt).from(container);
        const pdfBlobUrl = await worker.outputPdf('bloburl');
        const win = window.open(pdfBlobUrl, '_blank');
        if (!win) {
            // Si el navegador bloqueó la pestaña emergente, descargar directamente el archivo
            await worker.save();
        }
    } catch (err) {
        console.warn('[rideService] Error generando bloburl de PDF directo, abriendo vista HTML:', err);
        viewRideInNewWindow(comprobante, emisorOverride, buyerOverride);
    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
}

/**
 * Abre el RIDE en una ventana emergente listo para visualizar o imprimir
 */
export function viewRideInNewWindow(
    comprobante: RideComprobanteData,
    emisorOverride?: RideEmisorData,
    buyerOverride?: RideBuyerData
): void {
    const { fullDocHtml } = generateRideParts(comprobante, emisorOverride, buyerOverride);
    const win = window.open('', '_blank');
    if (win) {
        win.document.open();
        win.document.write(fullDocHtml);
        win.document.close();
    } else {
        alert("Por favor permite las ventanas emergentes en tu navegador para ver el RIDE.");
    }
}

/**
 * Construye la URL de WhatsApp con mensaje formal y clave de acceso del comprobante
 */
export function buildWhatsAppInvoiceUrl(
    phone: string,
    clientName: string,
    period: string,
    amount: number,
    claveAcceso: string,
    estab: string = '001',
    ptoEmi: string = '001',
    secuencial: string = '',
    isNotaVenta: boolean = false
): string {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '593' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('593') && cleanPhone.length === 9) {
        cleanPhone = '593' + cleanPhone;
    }

    const secFormatted = secuencial ? `No. ${estab}-${ptoEmi}-${secuencial}` : '';
    const tipoDoc = isNotaVenta ? 'Nota de Venta' : 'Factura Electrónica';

    const text = 
`Estimado/a *${clientName}*, le saludamos del estudio contable de Santiago Córdova.

Se ha generado su *${tipoDoc} ${secFormatted}* autorizada por el SRI correspondiente a sus honorarios contables del período *${cleanInvoiceText(period)}*.

💵 *Total:* $${amount.toFixed(2)} USD
🔑 *Clave de Acceso SRI:*
\`${claveAcceso}\`

_Su comprobante se encuentra disponible para consulta y descarga en el portal del SRI o a través de nuestro portal contable._

¡Muchas gracias por su confianza y preferencia! 🤝`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
