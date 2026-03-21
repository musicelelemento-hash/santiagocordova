
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
    const BRAND_NAVY = '#0B2149';
    const BRAND_GOLD = '#D4AF37'; // Luxurious Gold
    const BRAND_TEAL = '#14b8a6';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Recibo de Honorarios - ${sequenceStr}</title>
        <style>
            @page { size: A5 landscape; margin: 10mm; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                color: #1e293b; 
                padding: 0; 
                margin: 0; 
                font-size: 11px;
                background-color: #fff;
            }
            .page-container {
                border: 1px solid #e2e8f0;
                padding: 30px;
                position: relative;
                min-height: 120mm;
            }
            .watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-30deg);
                font-size: 80px;
                font-weight: 900;
                color: rgba(0,0,0,0.03);
                white-space: nowrap;
                pointer-events: none;
                z-index: 0;
            }
            .header { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 30px; 
                align-items: flex-start;
                position: relative;
                z-index: 1;
            }
            .brand-section { flex: 1; }
            .brand-name { 
                font-size: 24px; 
                margin: 0; 
                font-weight: 900; 
                color: ${BRAND_NAVY};
                letter-spacing: -1px;
                text-transform: uppercase;
            }
            .brand-subtitle {
                font-size: 10px;
                font-weight: 700;
                color: ${BRAND_TEAL};
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-top: 2px;
            }
            .company-details {
                margin-top: 10px;
                font-size: 9px;
                line-height: 1.4;
                color: #64748b;
            }
            
            .receipt-box { 
                border: 2px solid ${BRAND_NAVY}; 
                border-radius: 12px; 
                text-align: center; 
                width: 220px; 
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .receipt-header { 
                background: ${BRAND_NAVY}; 
                color: white; 
                font-weight: 800; 
                padding: 8px; 
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .receipt-body { padding: 15px; }
            .ruc-number { font-weight: 800; font-size: 14px; color: ${BRAND_NAVY}; display: block; margin-bottom: 5px; }
            .sequence-number { 
                font-size: 22px; 
                color: #ef4444; 
                font-weight: 900; 
                font-family: 'Courier New', monospace;
                display: block;
                margin: 5px 0;
            }
            .auth-number { font-size: 8px; color: #94a3b8; }
            
            .client-card { 
                margin-bottom: 25px; 
                background: #f8fafc; 
                border: 1px solid #f1f5f9;
                border-radius: 12px; 
                padding: 15px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                position: relative;
                z-index: 1;
            }
            .field { display: flex; flex-direction: column; }
            .field-label { 
                font-size: 8px; 
                font-weight: 800; 
                color: #94a3b8; 
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
            }
            .field-value { font-weight: 700; font-size: 11px; color: ${BRAND_NAVY}; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; position: relative; z-index: 1; }
            th { 
                background: #f1f5f9; 
                color: #475569; 
                padding: 10px; 
                font-size: 9px; 
                text-transform: uppercase; 
                text-align: left;
                font-weight: 800;
                border-bottom: 2px solid ${BRAND_NAVY};
            }
            td { padding: 12px 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
            .qty-col { text-align: center; width: 40px; font-weight: 700; }
            .desc-col { font-weight: 600; }
            .price-col { text-align: right; width: 100px; }
            .total-col { text-align: right; width: 100px; font-weight: 800; }
            
            .totals-section { display: flex; justify-content: flex-end; margin-top: 20px; position: relative; z-index: 1; }
            .total-amount-box { 
                background: ${BRAND_NAVY}; 
                color: white; 
                padding: 15px 25px; 
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 20px;
                box-shadow: 0 10px 15px -3px rgba(11, 33, 73, 0.3);
            }
            .total-text { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .total-val { font-size: 24px; font-weight: 900; }
            
            .signatures {
                margin-top: 50px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                text-align: center;
                position: relative;
                z-index: 1;
            }
            .signature-line {
                border-top: 1px solid #cbd5e1;
                padding-top: 8px;
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                color: #64748b;
            }
            
            .footer-info { 
                margin-top: 40px; 
                text-align: center; 
                font-size: 8px; 
                color: #94a3b8; 
                border-top: 1px dashed #e2e8f0; 
                padding-top: 15px;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="watermark">SOLUCIONES CONTABLES</div>
            
            <div class="header">
                <div class="brand-section">
                    <h1 class="brand-name">${businessProfile.businessName}</h1>
                    <div class="brand-subtitle">${businessProfile.tradeName}</div>
                    <div class="company-details">
                        <div>Dir: ${businessProfile.address}</div>
                        <div>Telf: ${businessProfile.phone} | Email: ${businessProfile.email}</div>
                    </div>
                </div>
                <div class="receipt-box">
                    <div class="receipt-header">Nota de Venta</div>
                    <div class="receipt-body">
                        <span class="ruc-number">R.U.C. ${businessProfile.ruc}</span>
                        <span class="sequence-number">${sequenceStr}</span>
                        <div class="auth-number">AUTORIZACIÓN SRI: ${businessProfile.authNumber}</div>
                    </div>
                </div>
            </div>

            <div class="client-card">
                <div class="field">
                    <span class="field-label">Cliente / Razón Social</span>
                    <span class="field-value">${data.clientName}</span>
                </div>
                <div class="field">
                    <span class="field-label">Identificación (RUC/CI)</span>
                    <span class="field-value">${data.clientRuc}</span>
                </div>
                <div class="field">
                    <span class="field-label">Fecha de Emisión</span>
                    <span class="field-value">${data.paymentDate}</span>
                </div>
                <div class="field">
                    <span class="field-label">Método de Pago</span>
                    <span class="field-value">Transferencia / Depósito / Efectivo</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="qty-col">Cant.</th>
                        <th class="desc-col">Descripción de Servicios Profesionales</th>
                        <th class="price-col">V. Unitario</th>
                        <th class="total-col">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.paidPeriods.map(p => `
                        <tr>
                            <td class="qty-col">1</td>
                            <td class="desc-col">GESTIÓN TRIBUTARIA INTEGRAL - PERIODO: ${p.period}</td>
                            <td class="price-col">$${p.amount.toFixed(2)}</td>
                            <td class="total-col">$${p.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    ${Array.from({length: Math.max(0, 3 - data.paidPeriods.length)}).map(() => `
                        <tr>
                            <td class="qty-col">&nbsp;</td>
                            <td class="desc-col">&nbsp;</td>
                            <td class="price-col">&nbsp;</td>
                            <td class="total-col">&nbsp;</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="total-amount-box">
                    <div class="total-text">Valor Total a Pagar</div>
                    <div class="total-val">$${data.totalAmount.toFixed(2)}</div>
                </div>
            </div>

            <div class="signatures">
                <div class="field">
                    <div style="height: 40px;"></div>
                    <div class="signature-line">Firma Autorizada</div>
                </div>
                <div class="field">
                    <div style="height: 40px;"></div>
                    <div class="signature-line">Firma Cliente</div>
                </div>
            </div>

            <div class="footer-info">
                Este documento es un comprobante de pago de honorarios profesionales. 
                Válido para sustentar gastos personales y de actividad económica. 
                Generado por Gestiones Tributarias PRO v500k.
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
