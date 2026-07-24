import puppeteer from 'puppeteer';

export async function generateRidePdfBuffer(
    comprobante: any,
    emisor: any,
    receptor: any,
    items: any[],
    totals: any
): Promise<Buffer> {
    const logoHtml = emisor.emisorLogo 
        ? `<img src="${emisor.emisorLogo}" class="logo-img" alt="Logo" />` 
        : '';
        
    const regimeLabel = emisor.emisorRegimen === '3' 
        ? '<div style="font-weight: 800; font-size: 10px; margin-top: 8px; color: #2b6aff; background: #eff6ff; padding: 4px 8px; border-radius: 4px; display: inline-block;">CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</div>' 
        : (emisor.emisorRegimen === '4' 
            ? '<div style="font-weight: 800; font-size: 10px; margin-top: 8px; color: #2b6aff; background: #eff6ff; padding: 4px 8px; border-radius: 4px; display: inline-block;">CONTRIBUYENTE EMPRENDEDOR - RÉGIMEN RIMPE</div>' 
            : '');

    let itemsHtml = '';
    for (const item of items) {
        itemsHtml += `
        <tr>
            <td style="font-family: monospace;">${item.codigoPrincipal}</td>
            <td style="text-align: center;">${item.cantidad}</td>
            <td>${item.descripcion}</td>
            <td style="text-align: right; font-family: monospace;">$${item.precioUnitario}</td>
            <td style="text-align: right; font-family: monospace;">$${item.precioTotalSinImpuesto}</td>
        </tr>`;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <title>RIDE_${comprobante.tipo}_${emisor.emisorEstab}_${emisor.emisorPtoEmi}_${comprobante.secuencial}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Manrope:wght@700;800;900&display=swap');
    @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
    * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
    body { margin: 0; padding: 12px; background: #ffffff; color: #0f172a; font-size: 10px; line-height: 1.3; }
    .print-actions { margin-bottom: 12px; text-align: right; display: none; }
    .btn-print { background: #2b6aff; color: #ffffff; border: none; padding: 8px 16px; font-weight: 800; font-size: 11px; border-radius: 8px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; }
    @media print { .print-actions { display: none !important; } }
    .invoice-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #ffffff; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
    .emisor-box { padding-right: 12px; border-right: 1px dashed #e2e8f0; }
    .logo-img { max-height: 55px; width: auto; object-fit: contain; margin-bottom: 8px; }
    .emisor-title { font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .emisor-razon { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; margin-bottom: 8px; }
    .auth-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .auth-title { font-size: 11px; font-weight: 900; color: #2b6aff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .auth-secuencial { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .barcode-container { font-family: 'JetBrains Mono', monospace; font-size: 8.5px; font-weight: 700; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; word-break: break-all; margin-top: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .items-table th { background: #f1f5f9; color: #475569; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
    .items-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9.5px; font-weight: 500; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 240px; gap: 16px; }
    .totales-table { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .totales-table td { padding: 5px 10px; font-size: 9px; font-weight: 600; border-bottom: 1px solid #f1f5f9; }
    .totales-table tr.total-row td { font-size: 11px; font-weight: 900; color: #2b6aff; background: #eff6ff; border-bottom: none; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header-grid">
      <div class="emisor-box">
        ${logoHtml}
        <div class="emisor-razon">${emisor.emisorRazonSocial}</div>
        <div><strong>RUC:</strong> <span style="font-family: monospace;">${emisor.emisorRuc}</span></div>
        <div><strong>Matriz:</strong> ${emisor.emisorDirMatriz}</div>
        ${regimeLabel}
      </div>
      <div class="auth-box">
        <div class="auth-title">${comprobante.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'COMPROBANTE DE RETENCIÓN'}</div>
        <div class="auth-secuencial">No. ${emisor.emisorEstab}-${emisor.emisorPtoEmi}-${comprobante.secuencial}</div>
        <div><strong>CLAVE DE ACCESO SRI:</strong></div>
        <div class="barcode-container">${comprobante.claveAcceso}</div>
        <div style="margin-top: 6px;"><strong>ESTADO:</strong> <span style="color: #04b17b; font-weight: 800;">${comprobante.estado.toUpperCase()}</span></div>
      </div>
    </div>
    <div class="info-grid">
      <div><strong>Razon Social / Nombre Comprador:</strong> <br/><span style="font-weight: 700; text-transform: uppercase;">${receptor.razonSocial}</span></div>
      <div><strong>RUC / CI:</strong> <span style="font-family: monospace; font-weight: 700;">${receptor.identificacion}</span></div>
      <div style="grid-column: span 2;"><strong>Dirección:</strong> <br/><span style="font-weight: 700; text-transform: uppercase;">${receptor.direccion}</span></div>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Cod. Principal</th>
          <th style="text-align: center;">Cant.</th>
          <th>Descripción / Detalle del Servicio</th>
          <th style="text-align: right;">P. Unitario</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <div class="bottom-grid">
      <div></div>
      <div>
        <table class="totales-table">
          <tr><td>SUBTOTAL 15%</td><td style="text-align: right; font-family: monospace;">$${totals.subtotal15.toFixed(2)}</td></tr>
          <tr><td>SUBTOTAL 0%</td><td style="text-align: right; font-family: monospace;">$${totals.subtotal0.toFixed(2)}</td></tr>
          <tr><td>IVA 15%</td><td style="text-align: right; font-family: monospace; font-weight: 700; color: #2b6aff;">$${totals.iva15.toFixed(2)}</td></tr>
          <tr class="total-row"><td>VALOR TOTAL</td><td style="text-align: right; font-family: monospace;">$${totals.total.toFixed(2)}</td></tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Initialize Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfUint8Array = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '12mm', bottom: '12mm', left: '12mm' }
        });
        
        return Buffer.from(pdfUint8Array);
    } finally {
        await browser.close();
    }
}
