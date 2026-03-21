
import { Client, BusinessProfile, ReceiptData } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const printSalesNote = (data: ReceiptData, businessProfile: BusinessProfile) => {
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (!printWindow) {
        alert('Por favor, permita las ventanas emergentes para imprimir el comprobante.');
        return;
    }

    const sequenceStr = (businessProfile.currentSequence || 1).toString().padStart(9, '0');
    
    // Configuración de colores
    const BRAND_NAVY = '#0B2149'; // Using Navy from theme
    const BRAND_TEAL = '#14b8a6'; // Using Gold/Teal from theme

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Nota de Venta - ${sequenceStr}</title>
        <style>
            @page { size: A5 landscape; margin: 0; }
            body { font-family: 'Arial', sans-serif; color: ${BRAND_NAVY}; padding: 20px; margin: 0; font-size: 12px; }
            .container { border: 2px solid ${BRAND_NAVY}; border-radius: 10px; padding: 20px; position: relative; min-height: 90vh; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: start; }
            .company-info h1 { font-size: 22px; margin: 0 0 5px 0; font-weight: 900; letter-spacing: -0.5px; }
            .company-info p { margin: 2px 0; font-size: 10px; color: #555; }
            
            .ruc-box { 
                border: 2px solid ${BRAND_NAVY}; 
                border-radius: 10px; 
                text-align: center; 
                padding: 0; 
                width: 200px; 
                overflow: hidden;
            }
            .ruc-header { background: ${BRAND_NAVY}; color: white; font-weight: bold; padding: 5px; font-size: 11px; }
            .ruc-body { padding: 10px; }
            .sequence { font-size: 20px; color: #ef4444; font-weight: 900; margin: 5px 0; display: block; font-family: 'Courier New', monospace; }
            
            .client-info { margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; border-radius: 8px; background: #f9fafb; }
            .info-row { display: flex; margin-bottom: 5px; }
            .info-row:last-child { margin-bottom: 0; }
            .label { font-weight: 800; width: 80px; font-size: 10px; color: ${BRAND_TEAL}; text-transform: uppercase; }
            .value { flex: 1; font-weight: 600; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: ${BRAND_NAVY}; color: white; padding: 8px; font-size: 10px; text-transform: uppercase; text-align: left; }
            td { border-bottom: 1px solid #eee; padding: 8px; font-size: 11px; color: #333; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            
            .total-box { display: flex; justify-content: flex-end; margin-top: 20px; }
            .total-container { border: 2px solid ${BRAND_TEAL}; border-radius: 8px; overflow: hidden; }
            .total-label { background: ${BRAND_TEAL}; color: white; padding: 8px 15px; font-weight: 900; font-size: 12px; }
            .total-value { background: white; color: ${BRAND_NAVY}; padding: 8px 20px; font-size: 16px; font-weight: 900; text-align: right; }
            
            .footer { position: absolute; bottom: 20px; left: 20px; right: 20px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="company-info">
                    <h1>${businessProfile.businessName}</h1>
                    <p style="font-weight: bold; color: ${BRAND_TEAL}; text-transform: uppercase;">${businessProfile.tradeName}</p>
                    <p>${businessProfile.address}</p>
                    <p>TELF: ${businessProfile.phone} | EMAIL: ${businessProfile.email}</p>
                </div>
                <div class="ruc-box">
                    <div class="ruc-header">R.U.C. ${businessProfile.ruc}</div>
                    <div class="ruc-body">
                        <span style="display: block; font-weight: 900; font-size: 12px; margin-bottom: 5px;">NOTA DE VENTA</span>
                        <span class="sequence">${sequenceStr}</span>
                        <span style="display: block; font-size: 8px; color: #666; margin-top: 5px;">AUT. SRI ${businessProfile.authNumber}</span>
                    </div>
                </div>
            </div>

            <div class="client-info">
                <div class="info-row"><span class="label">CLIENTE:</span><span class="value">${data.clientName}</span></div>
                <div class="info-row"><span class="label">RUC/CI:</span><span class="value">${data.clientRuc}</span></div>
                <div class="info-row"><span class="label">FECHA:</span><span class="value">${data.paymentDate}</span></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;">CANT.</th>
                        <th>DESCRIPCIÓN</th>
                        <th style="width: 100px; text-align: right;">V. UNIT</th>
                        <th style="width: 100px; text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.paidPeriods.map(p => `
                        <tr>
                            <td align="center" style="font-weight: bold;">1</td>
                            <td>HONORARIOS PROFESIONALES - ${p.period}</td>
                            <td align="right">$${p.amount.toFixed(2)}</td>
                            <td align="right" style="font-weight: bold;">$${p.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    ${Array.from({length: Math.max(0, 4 - data.paidPeriods.length)}).map(() => `
                        <tr>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="total-box">
                <div class="total-container">
                    <div style="display: flex;">
                        <div class="total-label">TOTAL A PAGAR</div>
                        <div class="total-value">$${data.totalAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="footer">
                Documento Generado Electrónicamente por Soluciones Contables Pro • Documento sin validez tributaria oficial hasta su emisión en SRI
            </div>
        </div>
        <script>
            window.onload = function() { 
                setTimeout(function() {
                    window.print(); 
                    window.close(); 
                }, 500);
            }
        </script>
    </body>
    </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
