import { Client, BillingPlan, MonthlyInvoicingRecord } from '../types';

export interface SendResendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    apiKey?: string;
    from?: string;
    replyTo?: string;
}

export interface SendEmailResult {
    success: boolean;
    id?: string;
    error?: string;
    previewHtml?: string;
}

/**
 * Servicio de envío de correos ejecutivos mediante la API de Resend
 */
export async function sendResendEmail(options: SendResendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, apiKey, from, replyTo } = options;

    if (!apiKey || apiKey.trim() === '') {
        return {
            success: false,
            error: 'No se ha configurado una clave de API de Resend en Ajustes. Puedes configurar tu clave en el menú de Ajustes para activar los envíos en tiempo real.',
            previewHtml: html
        };
    }

    try {
        const recipients = Array.isArray(to) ? to : [to];
        const validRecipients = recipients.filter(email => email && email.includes('@'));

        if (validRecipients.length === 0) {
            return {
                success: false,
                error: 'El destinatario no tiene un correo electrónico válido configurado.',
                previewHtml: html
            };
        }

        const sender = from || 'Soluciones Contables Pro <facturacion@santiagocordova.com>';

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: sender,
                to: validRecipients,
                subject,
                html,
                reply_to: replyTo || 'santiagocordova@gmail.com'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.message || `Error del servidor Resend (Código ${response.status})`,
                previewHtml: html
            };
        }

        return {
            success: true,
            id: data.id,
            previewHtml: html
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || 'Error de conexión con la API de Resend.',
            previewHtml: html
        };
    }
}

/**
 * Plantilla HTML de Ultra Lujo (Obsidian & Liquid Gold) para Aviso de Renovación de Plan
 */
export function generatePlanRenewalHtml(client: Client, plan: BillingPlan, daysRemaining: number): string {
    const clientName = client.tradeName || client.name;
    const programName = plan.programName || 'Software de Facturación Electrónica';
    const expirationDate = plan.expirationDate ? new Date(plan.expirationDate).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Próxima a vencer';
    const renewalPrice = (plan.price ?? 45).toFixed(2);
    const portalUrl = `https://santiagocordova.com/portal?ruc=${client.ruc}`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso de Renovación de Facturación Electrónica</title>
  <style>
    body { margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background: #051424; border: 1px solid rgba(201, 169, 110, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
    .header { padding: 40px 30px 20px; text-align: center; background: radial-gradient(circle at top, rgba(201, 169, 110, 0.15) 0%, transparent 70%); }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 50px; background: rgba(201, 169, 110, 0.15); border: 1px solid rgba(201, 169, 110, 0.35); color: #C9A96E; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 16px; }
    .title { margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1.2; }
    .subtitle { margin: 10px 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 30px; }
    .card { background: rgba(2, 6, 23, 0.75); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 24px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #94a3b8; }
    .value { font-weight: 700; color: #ffffff; text-align: right; }
    .value-gold { color: #C9A96E; font-family: monospace; font-size: 14px; }
    .value-alert { color: #f59e0b; font-weight: 800; }
    .cta-button { display: block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(135deg, #C9A96E 0%, #b38f53 100%); color: #020617; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; padding: 16px; border-radius: 14px; margin-top: 24px; box-shadow: 0 10px 25px -5px rgba(201, 169, 110, 0.35); }
    .footer { padding: 24px 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #020617; }
    .footer-text { font-size: 11px; color: #64748b; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <div class="badge">Aviso de Renovación SRI</div>
        <h1 class="title">Tu Plan de Emisión está por Vencer</h1>
        <p class="subtitle">Estimado(a) <strong>${clientName}</strong>, mantén tu facturación activa sin cortes.</p>
      </div>

      <div class="content">
        <div class="card">
          <div class="row">
            <span class="label">RUC Titular:</span>
            <span class="value" style="font-family: monospace;">${client.ruc}</span>
          </div>
          <div class="row">
            <span class="label">Software / Facturador:</span>
            <span class="value">${programName}</span>
          </div>
          <div class="row">
            <span class="label">Fecha de Vencimiento:</span>
            <span class="value">${expirationDate}</span>
          </div>
          <div class="row">
            <span class="label">Días Restantes:</span>
            <span class="value value-alert">${daysRemaining <= 0 ? 'Vencido' : `${daysRemaining} días`}</span>
          </div>
          <div class="row">
            <span class="label">Valor de Renovación Anual:</span>
            <span class="value value-gold">$${renewalPrice} USD</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px;">
          Para garantizar la continuidad de la emisión de tus facturas electrónicas, notas de crédito y retenciones autorizadas por el SRI, te recordamos coordinar la renovación anual de tu suscripción y expediente digital.
        </p>

        <a href="${portalUrl}" class="cta-button">Ver Mi Portal & Coordinar Renovación ➔</a>
      </div>

      <div class="footer">
        <p class="footer-text">
          <strong>Ing. Santiago Córdova</strong> · Soluciones Contables & Tributarias Pro<br>
          Pasaje, El Oro, Ecuador · Asesoría Tributaria & Facturación SRI Certificada<br>
          WhatsApp de Contacto Directo: +593 99 999 9999
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
}

/**
 * Plantilla HTML para Alerta de Comprobantes Agotados (Renovación Anticipada)
 */
export function generateLowDocumentsNoticeHtml(client: Client, plan: BillingPlan, remainingDocs: number): string {
    const clientName = client.tradeName || client.name;
    const programName = plan.programName || 'Software de Facturación';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Aviso de Comprobantes por Agotarse</title>
  <style>
    body { margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; }
    .wrapper { max-width: 600px; margin: 20px auto; background: #051424; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 24px; overflow: hidden; }
    .header { padding: 36px 30px 20px; text-align: center; background: radial-gradient(circle at top, rgba(245, 158, 11, 0.15) 0%, transparent 70%); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 50px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .title { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; }
    .content { padding: 24px 30px; font-size: 13px; line-height: 1.6; color: #cbd5e1; }
    .alert-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 16px; padding: 20px; text-align: center; margin: 20px 0; }
    .alert-number { font-size: 38px; font-weight: 900; color: #fbbf24; font-family: monospace; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">⚠️ Cupo de Facturación Crítico</div>
      <h1 class="title">Tus Comprobantes están por Agotarse</h1>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${clientName}</strong>,</p>
      <p>Te informamos que tu saldo de comprobantes electrónicos en <strong>${programName}</strong> está cerca del límite:</p>
      <div class="alert-box">
        <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Documentos Disponibles</div>
        <div class="alert-number">${remainingDocs}</div>
        <div style="font-size: 11px; color: #fbbf24; margin-top: 4px;">¡Recarga tu paquete anticipadamente para evitar rechazos del SRI!</div>
      </div>
      <p>Puedes adquirir una recarga de 60, 100 o 300 comprobantes con activación inmediata contactando a tu asesor contable.</p>
    </div>
  </div>
</body>
</html>
    `;
}

/**
 * Plantilla HTML para Entrega Segura de Credenciales y Acceso
 */
export function generateCredentialsDispatchHtml(client: Client, config: { programName: string; url: string; username: string; password?: string; sriPassword?: string }): string {
    const clientName = client.tradeName || client.name;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Tus Credenciales de Facturación Electrónica</title>
  <style>
    body { margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; }
    .wrapper { max-width: 600px; margin: 20px auto; background: #051424; border: 1px solid rgba(0, 168, 150, 0.3); border-radius: 24px; overflow: hidden; }
    .header { padding: 36px 30px 20px; text-align: center; background: radial-gradient(circle at top, rgba(0, 168, 150, 0.2) 0%, transparent 70%); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 50px; background: rgba(0, 168, 150, 0.15); border: 1px solid rgba(0, 168, 150, 0.4); color: #00A896; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .title { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; }
    .content { padding: 24px 30px; font-size: 13px; line-height: 1.6; color: #cbd5e1; }
    .cred-card { background: rgba(2, 6, 23, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 20px; margin: 20px 0; }
    .field { margin-bottom: 12px; }
    .field:last-child { margin-bottom: 0; }
    .field-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; }
    .field-val { font-size: 14px; font-family: monospace; color: #ffffff; font-weight: 700; background: rgba(255, 255, 255, 0.05); padding: 8px 12px; border-radius: 8px; margin-top: 4px; display: block; word-break: break-all; }
    .btn { display: block; text-align: center; background: #00A896; color: #ffffff; font-weight: 800; padding: 14px; border-radius: 12px; text-decoration: none; margin-top: 20px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">🔐 Acceso Oficial Habilitado</div>
      <h1 class="title">Tus Credenciales de Facturador</h1>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${clientName}</strong>,</p>
      <p>A continuación te compartimos los accesos oficiales para ingresar a tu plataforma de emisión <strong>${config.programName}</strong>:</p>

      <div class="cred-card">
        <div class="field">
          <div class="field-label">Portal de Acceso / Link:</div>
          <a href="${config.url}" target="_blank" class="field-val" style="color: #38bdf8; text-decoration: underline;">${config.url}</a>
        </div>
        <div class="field">
          <div class="field-label">Usuario:</div>
          <div class="field-val">${config.username}</div>
        </div>
        ${config.password ? `
        <div class="field">
          <div class="field-label">Contraseña Facturador:</div>
          <div class="field-val">${config.password}</div>
        </div>` : ''}
        ${config.sriPassword ? `
        <div class="field">
          <div class="field-label">Clave SRI de Respaldo:</div>
          <div class="field-val">${config.sriPassword}</div>
        </div>` : ''}
      </div>

      <a href="${config.url}" target="_blank" class="btn">Ingresar al Facturador Ahora ➔</a>
      <p style="font-size: 11px; color: #64748b; margin-top: 16px; text-align: center;">Por seguridad, te sugerimos no compartir estas credenciales con terceros no autorizados.</p>
    </div>
  </div>
</body>
</html>
    `;
}

/**
 * Plantilla HTML para Estado de Cuenta / Liquidación de Facturas Llenadas
 */
export function generateMonthlyFillingStatementHtml(client: Client, record: MonthlyInvoicingRecord, periodTitle: string): string {
    const clientName = client.tradeName || client.name;
    const count = record.count || 0;
    const totalFee = (record.totalFee || 0).toFixed(2);
    const modeLabel = 
        record.billingMode === 'monthly_combo_10' ? 'Combo Mensual (Declaración $5 + Facturas $5 = $10)' :
        record.billingMode === 'pack_5' ? 'Paquete hasta 5 Facturas ($5.00)' :
        record.billingMode === 'semestral_batch' ? 'Lote Semestral Acumulado' :
        `Tarifa Unitaria ($${(record.feePerInvoice ?? 2.00).toFixed(2)} por factura)`;

    const invoicesList = record.invoices && record.invoices.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; text-align: left;">
            <th style="padding: 8px 4px;"># Secuencial</th>
            <th style="padding: 8px 4px;">Fecha</th>
            <th style="padding: 8px 4px;">Destinatario</th>
            <th style="padding: 8px 4px; text-align: right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${record.invoices.map((inv, idx) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 8px 4px; font-family: monospace; font-weight: bold; color: #38bdf8;">${inv.secuencial || idx + 1}</td>
              <td style="padding: 8px 4px; color: #cbd5e1;">${inv.date}</td>
              <td style="padding: 8px 4px; color: #ffffff;">${inv.clientRecipient || 'Cliente Final'}</td>
              <td style="padding: 8px 4px; text-align: right; font-family: monospace; color: #C9A96E; font-weight: bold;">$${(inv.amount || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0;">Sin detalle de secuenciales registrado.</p>';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Liquidación de Servicio de Facturación</title>
  <style>
    body { margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; }
    .wrapper { max-width: 600px; margin: 20px auto; background: #051424; border: 1px solid rgba(201, 169, 110, 0.25); border-radius: 24px; overflow: hidden; }
    .header { padding: 36px 30px 20px; text-align: center; background: radial-gradient(circle at top, rgba(201, 169, 110, 0.15) 0%, transparent 70%); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 50px; background: rgba(201, 169, 110, 0.15); border: 1px solid rgba(201, 169, 110, 0.4); color: #C9A96E; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .title { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; }
    .content { padding: 24px 30px; font-size: 13px; line-height: 1.6; color: #cbd5e1; }
    .summary-card { background: rgba(2, 6, 23, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">📄 Resumen de Emisión y Llenado</div>
      <h1 class="title">Liquidación: Período ${periodTitle}</h1>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${clientName}</strong>,</p>
      <p>Presentamos el detalle de los comprobantes electrónicos llenados y emitidos durante el período <strong>${periodTitle}</strong>:</p>

      <div class="summary-card">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Total Facturas Emitidas:</span>
          <strong style="color: #ffffff; font-size: 16px;">${count} comprobantes</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Modalidad de Servicio:</span>
          <span style="color: #C9A96E; font-weight: bold;">${modeLabel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 10px; margin-top: 10px;">
          <span style="color: #ffffff; font-weight: bold;">Total a Cancelar:</span>
          <span style="color: #00A896; font-size: 20px; font-weight: 900; font-family: monospace;">$${totalFee} USD</span>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h3 style="font-size: 13px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Detalle de Comprobantes</h3>
        ${invoicesList}
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Agradecemos coordinar la cancelación a las cuentas bancarias autorizadas. ¡Gracias por confiar en nuestros servicios contables!</p>
    </div>
  </div>
</body>
</html>
    `;
}
