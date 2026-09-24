import html2pdf from 'html2pdf.js';

export interface RideComprobanteData {
    id?: string;
    tipo?: string;
    secuencial: string;
    claveAcceso: string;
    rucReceptor?: string;
    nombreReceptor?: string;
    fechaEmision?: string;
    total: number;
    xml?: string;
    ambiente?: string;
    mensajeError?: string;
}

export interface RideEmisorData {
    ruc?: string;
    razonSocial?: string;
    nombreComercial?: string;
    dirMatriz?: string;
    estab?: string;
    ptoEmi?: string;
    regimen?: string;
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
 * Genera el SVG del código de barras para la Clave de Acceso de 49 dígitos del SRI
 */
export function generateBarcodeBars(clave: string): string {
    if (!clave) return '';
    let x = 10;
    const height = 30;
    const rects: string[] = [];
    
    // Guard bars iniciales
    rects.push(`<rect x="${x}" y="0" width="2.2" height="${height}" fill="#000000"/>`); x += 3.5;
    rects.push(`<rect x="${x}" y="0" width="1.2" height="${height}" fill="#000000"/>`); x += 2.5;
    rects.push(`<rect x="${x}" y="0" width="2.2" height="${height}" fill="#000000"/>`); x += 3.5;

    for (let i = 0; i < clave.length; i++) {
        const digit = parseInt(clave[i], 10) || 0;
        const w = ((digit * 7 + i) % 3) * 0.8 + 1.2;
        const space = ((digit * 3 + i) % 2) * 0.8 + 1.5;
        rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="#000000"/>`);
        x += w + space;
    }

    // Guard bars finales
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="2.2" height="${height}" fill="#000000"/>`); x += 3.5;
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="1.2" height="${height}" fill="#000000"/>`); x += 2.5;
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="2.2" height="${height}" fill="#000000"/>`); x += 10;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(x)} ${height}" width="100%" height="28" style="display:block;max-width:320px;margin:0 auto;" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

/**
 * Procesa un comprobante electrónico y genera el documento HTML oficial RIDE (SRI Ecuador)
 */
export function generateRideParts(
    comprobante: RideComprobanteData,
    emisorOverride?: RideEmisorData,
    buyerOverride?: RideBuyerData
) {
    const emisor = {
        razonSocial: emisorOverride?.razonSocial || localStorage.getItem('sc_emisor_razon') || 'CORDOVA RAMIREZ ROBERTO SANTIGO',
        nombreComercial: emisorOverride?.nombreComercial || localStorage.getItem('sc_emisor_comercial') || 'SOLUCIONES TRIBUTARIAS PRO',
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
        razonSocial: buyerOverride?.razonSocial || comprobante.nombreReceptor || 'CONSUMIDOR FINAL',
        identificacion: buyerOverride?.identificacion || comprobante.rucReceptor || '9999999999999',
        direccion: buyerOverride?.direccion || 'Ecuador',
        fechaEmision: buyerOverride?.fechaEmision || comprobante.fechaEmision || new Date().toISOString().split('T')[0],
        email: buyerOverride?.email || '',
        phone: buyerOverride?.phone || ''
    };

    let itemsHtml = '';
    let subtotal15 = 0;
    let subtotal0 = comprobante.total;
    let iva15 = 0;
    const total = comprobante.total;
    let formaPagoDesc = 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
    let formaPagoTotal = comprobante.total;
    const xmlCamposAdicionales: { nombre: string; valor: string }[] = [];

    // Parsear XML si está presente
    if (comprobante.xml) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(comprobante.xml, "text/xml");
            
            const rz = xmlDoc.getElementsByTagName("razonSocial")[0]?.textContent;
            if (rz) emisor.razonSocial = rz;
            const nc = xmlDoc.getElementsByTagName("nombreComercial")[0]?.textContent;
            if (nc) emisor.nombreComercial = nc;
            const ruc = xmlDoc.getElementsByTagName("ruc")[0]?.textContent;
            if (ruc) emisor.ruc = ruc;
            const dm = xmlDoc.getElementsByTagName("dirMatriz")[0]?.textContent;
            if (dm) emisor.dirMatriz = dm;
            const est = xmlDoc.getElementsByTagName("estab")[0]?.textContent;
            if (est) emisor.estab = est;
            const pe = xmlDoc.getElementsByTagName("ptoEmi")[0]?.textContent;
            if (pe) emisor.ptoEmi = pe;

            const rzReceptor = xmlDoc.getElementsByTagName("razonSocialComprador")[0]?.textContent;
            if (rzReceptor) receptor.razonSocial = rzReceptor;
            const idReceptor = xmlDoc.getElementsByTagName("identificacionComprador")[0]?.textContent;
            if (idReceptor) receptor.identificacion = idReceptor;
            const dirReceptor = xmlDoc.getElementsByTagName("direccionComprador")[0]?.textContent;
            if (dirReceptor) receptor.direccion = dirReceptor;
            const fEmi = xmlDoc.getElementsByTagName("fechaEmision")[0]?.textContent;
            if (fEmi) receptor.fechaEmision = fEmi;

            // Detalles de productos/servicios
            const detalles = xmlDoc.getElementsByTagName("detalle");
            if (detalles.length > 0) {
                for (let i = 0; i < detalles.length; i++) {
                    const det = detalles[i];
                    const cod = det.getElementsByTagName("codigoPrincipal")[0]?.textContent || '001';
                    const desc = det.getElementsByTagName("descripcion")[0]?.textContent || 'Servicios Contables';
                    const cant = det.getElementsByTagName("cantidad")[0]?.textContent || '1.00';
                    const pu = det.getElementsByTagName("precioUnitario")[0]?.textContent || total.toFixed(2);
                    const descVal = det.getElementsByTagName("descuento")[0]?.textContent || '0.00';
                    const pt = det.getElementsByTagName("precioTotalSinImpuesto")[0]?.textContent || total.toFixed(2);

                    itemsHtml += `
                    <tr>
                        <td style="font-family: 'JetBrains Mono', monospace; font-size: 8px;">${cod}</td>
                        <td style="text-align: center; font-weight: 700;">${cant}</td>
                        <td style="font-weight: 600;">${desc}</td>
                        <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${parseFloat(pu).toFixed(2)}</td>
                        <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${parseFloat(descVal).toFixed(2)}</td>
                        <td style="text-align: right; font-weight: 800; font-family: 'JetBrains Mono', monospace;">$${parseFloat(pt).toFixed(2)}</td>
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
                if (fp === '01') formaPagoDesc = 'SIN UTILIZACION DEL SISTEMA FINANCIERO';
                else if (fp === '19') formaPagoDesc = 'TARJETA DE CREDITO';
                else if (fp === '20') formaPagoDesc = 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO (TRANSFERENCIA/DEPOSITO)';
            }

            // Campos adicionales
            const campos = xmlDoc.getElementsByTagName("campoAdicional");
            for (let i = 0; i < campos.length; i++) {
                const nombre = campos[i].getAttribute("nombre") || `Campo ${i + 1}`;
                const valor = campos[i].textContent || '';
                xmlCamposAdicionales.push({ nombre, valor });
            }
        } catch (e) {
            console.warn('[rideService] Error parseando XML del comprobante:', e);
        }
    }

    if (!itemsHtml) {
        itemsHtml = `
        <tr>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 8px;">001</td>
            <td style="text-align: center; font-weight: 700;">1.00</td>
            <td style="font-weight: 600;">Servicios Profesionales de Asesoría Contable y Tributaria</td>
            <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${total.toFixed(2)}</td>
            <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$0.00</td>
            <td style="text-align: right; font-weight: 800; font-family: 'JetBrains Mono', monospace;">$${total.toFixed(2)}</td>
        </tr>`;
    }

    const isRimpePopular = emisor.regimen === '3';
    const regimeLabel = isRimpePopular
        ? `<div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-left: 3px solid #00a896; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 8px; font-weight: 800; color: #0f172a; margin-top: 6px;">CONTRIBUYENTE RÉGIMEN RIMPE · NEGOCIO POPULAR</div>`
        : emisor.regimen === '2'
            ? `<div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-left: 3px solid #2b6aff; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 8px; font-weight: 800; color: #0f172a; margin-top: 6px;">CONTRIBUYENTE RÉGIMEN RIMPE · EMPRENDEDOR</div>`
            : '';

    const softwareProviderRuc = localStorage.getItem('sc_software_provider_ruc') || '0705787745001';
    const numAutorizacion = comprobante.claveAcceso;
    const authDateStr = receptor.fechaEmision;
    const filename = `RIDE_Factura_${emisor.estab}_${emisor.ptoEmi}_${comprobante.secuencial}.pdf`;

    const cardContentHtml = `
    <div class="invoice-card">
        <div class="ride-editorial-header">
            <div class="ride-brand-group">
                <div class="ride-brand-badge">ST<span style="color: #00a896;">+</span></div>
                <div>
                    <div class="ride-brand-title">SOLUCIONES TRIBUTARIAS <span class="ride-pro-pill">PRO</span></div>
                    <div class="ride-brand-sub">SISTEMA INTEGRAL DE GESTIÓN TRIBUTARIA & FACTURACIÓN ELECTRÓNICA · SRI ECUADOR</div>
                </div>
            </div>
            <div class="ride-tech-meta-box">
                <div class="ride-tech-chip">
                    <span class="ride-tech-dot"></span>
                    <span>COMPROBANTE ELECTRÓNICO OFICIAL · RIDE</span>
                </div>
                <div class="ride-tech-norma">RUC PROVEEDOR: ${softwareProviderRuc} · RES. SRI NAC-027</div>
            </div>
        </div>

        <div class="header-grid">
            <div class="emisor-box">
                <div class="emisor-name">${emisor.razonSocial}</div>
                <div style="color: #475569; font-weight: 700; font-size: 10px; text-transform: uppercase; margin-bottom: 3px;">${emisor.nombreComercial}</div>
                <div style="margin-top: 4px; font-size: 9px; color: #475569;"><strong>Dirección Matriz:</strong> ${emisor.dirMatriz}</div>
                <div style="font-size: 9px; color: #475569;"><strong>OBLIGADO A LLEVAR CONTABILIDAD:</strong> NO</div>
                ${regimeLabel}
            </div>

            <div class="auth-box">
                <div class="auth-title">R.U.C.: <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700;">${emisor.ruc}</span></div>
                <div class="auth-doc-type">FACTURA ELECTRÓNICA</div>
                <div class="auth-secuencial">No. ${emisor.estab}-${emisor.ptoEmi}-${comprobante.secuencial}</div>
                <div style="font-size: 8px; margin-bottom: 1px; color: #475569;"><strong>NÚMERO DE AUTORIZACIÓN:</strong></div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 7.8px; font-weight: 800; color: #0f172a; word-break: break-all; margin-bottom: 4px; line-height: 1.15;">${numAutorizacion}</div>
                <div style="font-size: 8px; margin-bottom: 2px;"><strong>FECHA/HORA AUTORIZACIÓN:</strong> ${authDateStr}</div>
                <div style="font-size: 8px; margin-bottom: 2px;"><strong>AMBIENTE:</strong> <span style="color: #2b6aff; font-weight: 800;">${emisor.ambiente}</span></div>
                <div style="font-size: 8px; margin-bottom: 4px;"><strong>EMISIÓN:</strong> NORMAL</div>
                <div class="barcode-container">
                    <div style="margin-bottom: 4px;">
                        ${generateBarcodeBars(comprobante.claveAcceso)}
                    </div>
                    <div style="font-size: 7px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1px;">CLAVE DE ACCESO</div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 7.8px; font-weight: 800; letter-spacing: 0.4px; color: #0f172a; word-break: break-all; line-height: 1.15;">${comprobante.claveAcceso}</div>
                </div>
            </div>
        </div>

        <div class="receptor-box">
            <div>
                <strong style="color: #64748b; font-size: 8px;">RAZÓN SOCIAL / CLIENTE:</strong>
                <div class="receptor-val">${receptor.razonSocial}</div>
            </div>
            <div>
                <strong style="color: #64748b; font-size: 8px;">RUC / CÉDULA:</strong>
                <div class="receptor-val" style="font-family: 'JetBrains Mono', monospace;">${receptor.identificacion}</div>
            </div>
            <div style="margin-top: 4px;">
                <strong style="color: #64748b; font-size: 8px;">FECHA EMISIÓN:</strong>
                <div style="font-weight: 700; color: #0f172a;">${receptor.fechaEmision}</div>
            </div>
            <div style="margin-top: 4px;">
                <strong style="color: #64748b; font-size: 8px;">GUÍA DE REMISIÓN:</strong>
                <div style="font-weight: 700; color: #0f172a;">S/N</div>
            </div>
            <div style="grid-column: span 2; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 2px;">
                <strong style="color: #64748b; font-size: 8px;">DIRECCIÓN DEL COMPRADOR:</strong>
                <div style="font-weight: 700; color: #0f172a; text-transform: uppercase;">${receptor.direccion}</div>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 75px;">Cod. Principal</th>
                    <th style="width: 45px; text-align: center;">Cant.</th>
                    <th>Descripción</th>
                    <th style="width: 75px; text-align: right;">Precio Unit.</th>
                    <th style="width: 60px; text-align: right;">Descuento</th>
                    <th style="width: 80px; text-align: right;">Precio Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="bottom-grid">
            <div>
                <div class="info-box">
                    <div class="box-title">Información Adicional</div>
                    <div style="font-size: 8px; color: #475569; margin-bottom: 2px;"><strong>Email:</strong> ${receptor.email || 'contacto@santiagocordova.com'}</div>
                    <div style="font-size: 8px; color: #475569; margin-bottom: 2px;"><strong>Teléfono:</strong> ${receptor.phone || '+593 978 980 722'}</div>
                    <div style="font-size: 8px; color: #475569; margin-bottom: 2px;"><strong>Estudio:</strong> Santiago Córdova - Soluciones Tributarias Pro</div>
                    ${xmlCamposAdicionales.map(c => `<div style="font-size: 8px; color: #475569; margin-bottom: 2px;"><strong>${c.nombre}:</strong> ${c.valor}</div>`).join('')}
                </div>

                <div class="pago-box">
                    <div class="box-title">Forma de Pago</div>
                    <div style="display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 700; color: #0f172a;">
                        <span style="max-width: 75%;">${formaPagoDesc}</span>
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px;">$${formaPagoTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="totals-box">
                <table class="totals-table">
                    <tbody>
                        <tr><td>SUBTOTAL 15%:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${subtotal15.toFixed(2)}</td></tr>
                        <tr><td>SUBTOTAL 0%:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${subtotal0.toFixed(2)}</td></tr>
                        <tr><td>SUBTOTAL NO OBJETO DE IVA:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$0.00</td></tr>
                        <tr><td>SUBTOTAL EXENTO DE IVA:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$0.00</td></tr>
                        <tr><td>SUBTOTAL SIN IMPUESTOS:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${(subtotal15 + subtotal0).toFixed(2)}</td></tr>
                        <tr><td>TOTAL DESCUENTO:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$0.00</td></tr>
                        <tr><td>IVA 15%:</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$${iva15.toFixed(2)}</td></tr>
                        <tr><td>PROPINA (10%):</td><td style="text-align: right; font-family: 'JetBrains Mono', monospace;">$0.00</td></tr>
                        <tr style="border-top: 1.5px solid #0f172a; font-weight: 900; font-size: 11px; color: #0f172a;">
                            <td style="padding-top: 6px;">VALOR TOTAL:</td>
                            <td style="padding-top: 6px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #00a896;">$${total.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    const cssStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700;800&family=Manrope:wght@600;700;800;900&display=swap');
    
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 12px; background: #f8fafc; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-card { background: #ffffff; border: 1.5px solid #0f172a; border-radius: 12px; padding: 16px 20px; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .ride-editorial-header { background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #f0fdf9 100%); border: 1px solid #cbd5e1; border-top: 3.5px solid #2b6aff; border-radius: 8px; padding: 6px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .ride-brand-group { display: flex; align-items: center; gap: 8px; }
    .ride-brand-badge { width: 24px; height: 24px; border-radius: 5px; background-color: #0b2149; color: #ffffff; font-family: 'Manrope', sans-serif; font-weight: 900; font-size: 10px; display: flex; align-items: center; justify-content: center; letter-spacing: 0.5px; flex-shrink: 0; }
    .ride-brand-title { font-family: 'Manrope', sans-serif; font-size: 12px; font-weight: 900; color: #0b2149; letter-spacing: 0.4px; line-height: 1.15; display: flex; align-items: center; gap: 6px; }
    .ride-pro-pill { background-color: #2b6aff; color: #ffffff; font-family: 'JetBrains Mono', monospace; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.5px; }
    .ride-brand-sub { font-family: 'Inter', sans-serif; font-size: 6.8px; font-weight: 600; color: #64748b; letter-spacing: 0.25px; margin-top: 1px; }
    .ride-tech-meta-box { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .ride-tech-chip { display: inline-flex; align-items: center; gap: 4px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-left: 2.5px solid #00a896; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 7.2px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; }
    .ride-tech-dot { width: 5px; height: 5px; border-radius: 50%; background-color: #00a896; display: inline-block; }
    .ride-tech-norma { font-family: 'JetBrains Mono', monospace; font-size: 6.8px; color: #0f172a; font-weight: 700; }
    .header-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; margin-bottom: 12px; }
    .emisor-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #ffffff; }
    .emisor-name { font-family: 'Manrope', sans-serif; font-weight: 900; font-size: 13px; color: #0b2149; text-transform: uppercase; line-height: 1.2; margin-bottom: 4px; }
    .auth-box { border: 1.5px solid #0f172a; border-radius: 10px; padding: 10px 12px; background: #ffffff; }
    .auth-title { font-family: 'Manrope', sans-serif; font-weight: 900; font-size: 12px; color: #0f172a; margin-bottom: 2px; }
    .auth-doc-type { font-family: 'Manrope', sans-serif; font-weight: 900; font-size: 14px; color: #00a896; text-transform: uppercase; margin-bottom: 2px; }
    .auth-secuencial { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 6px; }
    .barcode-container { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; margin-top: 6px; }
    .receptor-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; background: #ffffff; display: grid; grid-template-columns: 1.5fr 1fr; gap: 8px; }
    .receptor-val { font-size: 11px; font-weight: 800; color: #0b2149; text-transform: uppercase; margin-top: 2px; }
    .items-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; border: 1.5px solid #0f172a; border-radius: 8px; overflow: hidden; }
    .items-table th { background-color: #0f172a; color: #ffffff; font-family: 'Manrope', sans-serif; text-transform: uppercase; font-size: 8px; font-weight: 800; padding: 7px 10px; text-align: left; }
    .items-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #0f172a; }
    .items-table tr:last-child td { border-bottom: none; }
    .bottom-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; }
    .info-box, .pago-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; background: #ffffff; }
    .box-title { font-family: 'Manrope', sans-serif; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 6px; font-size: 8.5px; color: #0f172a; }
    .totals-box { border: 1.5px solid #0f172a; border-radius: 12px; padding: 10px 12px; background: #f8fafc; }
    .totals-table { width: 100%; border-collapse: collapse; }
    .totals-table td { padding: 3px 2px; border-bottom: 1px dashed #cbd5e1; font-size: 9px; color: #475569; }
    
    @media print {
        body { padding: 0; background: #ffffff; }
        .no-print { display: none !important; }
        .invoice-card { border: 1.5px solid #0f172a; box-shadow: none; width: 100%; max-width: 100%; }
    }
    `;

    const fullDocHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>RIDE_${emisor.estab}_${emisor.ptoEmi}_${comprobante.secuencial}</title>
        <style>${cssStyles}</style>
    </head>
    <body>
        <div class="no-print" style="max-width: 820px; margin: 0 auto 12px; padding: 8px 12px; background: #0b1326; color: #ffffff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', sans-serif;">
            <div>
                <span style="font-weight: 800; font-size: 12px;">RIDE Oficial · SRI Ecuador</span>
                <span style="font-size: 10px; opacity: 0.7; margin-left: 8px;">Factura No. ${emisor.estab}-${emisor.ptoEmi}-${comprobante.secuencial}</span>
            </div>
            <button onclick="window.print()" style="background: #00a896; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer;">
                🖨️ Imprimir / Guardar PDF
            </button>
        </div>
        ${cardContentHtml}
    </body>
    </html>
    `;

    return { cardContentHtml, cssStyles, fullDocHtml, filename, emisor, receptor };
}

/**
 * Descarga directamente el PDF en el navegador del usuario utilizando html2pdf
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
    container.style.width = '800px';
    container.innerHTML = `<style>${cssStyles}</style>${cardContentHtml}`;
    document.body.appendChild(container);

    const opt = {
        margin: [8, 8, 8, 8] as [number, number, number, number],
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
    secuencial: string = ''
): string {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '593' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('593') && cleanPhone.length === 9) {
        cleanPhone = '593' + cleanPhone;
    }

    const secFormatted = secuencial ? `No. ${estab}-${ptoEmi}-${secuencial}` : '';

    const text = 
`Estimado/a *${clientName}*, le saludamos del estudio contable de Santiago Córdova.

Se ha generado su *Factura Electrónica ${secFormatted}* autorizada por el SRI correspondiente a sus honorarios contables del período *${period}*.

💵 *Total:* $${amount.toFixed(2)} USD
🔑 *Clave de Acceso SRI:*
\`${claveAcceso}\`

_Su comprobante está disponible para consulta y descarga en el portal del SRI o a través de nuestro sistema contable._

¡Muchas gracias por su preferencia! 🤝`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
