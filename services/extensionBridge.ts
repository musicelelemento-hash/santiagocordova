import { Client } from '../types';

/**
 * Bridge para comunicarse con la extensión de Chrome "SRI Auto-fill".
 * Envía un mensaje que la extensión puede capturar mediante un content script.
 */
export const parsePeriodToWorkflowPeriod = (targetPeriod?: { year: number; monthIndex: number } | string): { year: number; monthIndex: number; periodStr: string } | null => {
  if (!targetPeriod) return null;
  if (typeof targetPeriod === 'object' && targetPeriod.year && typeof targetPeriod.monthIndex === 'number') {
    const periodStr = `${targetPeriod.year}-${String(targetPeriod.monthIndex + 1).padStart(2, '0')}`;
    return { year: targetPeriod.year, monthIndex: targetPeriod.monthIndex, periodStr };
  }
  if (typeof targetPeriod === 'string') {
    const clean = targetPeriod.split(':')[0].trim();
    const match = clean.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      return { year, monthIndex, periodStr: clean };
    }
  }
  return null;
};

export const sendToSRIExtension = (client: Client, targetPeriod?: { year: number; monthIndex: number } | string) => {
  if (!client.ruc || !client.sriPassword) {
    console.warn("Faltan credenciales para el autocompletado.");
    return;
  }

  const parsedPeriod = parsePeriodToWorkflowPeriod(targetPeriod);

  // Estructura de datos para la extensión
  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_AUTOFILL_DATA',
    data: {
      ruc: client.ruc,
      name: client.name || (client as any).razonSocial || 'Cliente SRI',
      password: client.sriPassword,
      pdfStatus: (client as any).pdfDeclarationStatus || (client as any).pdfStatus || ((client as any).hasPdf ? 'CON_PDF' : 'SIN_PDF'),
      declarationsHistory: client.declarations || [],
      period: parsedPeriod ? parsedPeriod.periodStr : undefined,
      workflowPeriod: parsedPeriod ? { year: parsedPeriod.year, monthIndex: parsedPeriod.monthIndex } : undefined,
      timestamp: new Date().getTime()
    }
  };

  // 1. Enviamos mediante PostMessage (estándar para hablar con content scripts)
  window.postMessage(payload, "*");

  // 2. Disparamos un evento personalizado por si la extensión usa EventListeners
  const event = new CustomEvent('sriAutofillReady', { detail: payload.data });
  window.dispatchEvent(event);

  // 3. Opcional: Guardamos en una clave temporal de localStorage que la extensión pueda leer
  // (Muchas extensiones usan este método para persistencia entre dominios si tienen permisos)
  localStorage.setItem('_sri_autofill_pending', JSON.stringify(payload.data));
  localStorage.setItem('sri_active_credentials', JSON.stringify(payload.data));
};

export const transformPasswordForSri = (oldPass: string): string => {
  if (!oldPass) return '';
  const trimmed = oldPass.trim();
  return trimmed + '@';
};

export const sendSRIPasswordChangeToExtension = (ruc: string, oldPassword: string, newPassword: string) => {
  if (!ruc || !oldPassword) {
    console.warn("Faltan credenciales para el cambio de clave SRI.");
    return;
  }

  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_CHANGE_PASSWORD_DATA',
    data: {
      ruc,
      oldPassword,
      newPassword,
      timestamp: new Date().getTime()
    }
  };

  window.postMessage(payload, "*");
  const event = new CustomEvent('sriChangePasswordReady', { detail: payload.data });
  window.dispatchEvent(event);
  localStorage.setItem('_sri_change_password_pending', JSON.stringify(payload.data));
  console.log("🔑 Cambio de Clave SRI enviado a la extensión para RUC:", ruc);
};

export const sendFullClientsMatrixToExtension = (clients: Client[]) => {
  if (!Array.isArray(clients) || clients.length === 0) return;
  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_FULL_MATRIX_DATA',
    data: clients
  };
  window.postMessage(payload, "*");
  try {
    localStorage.setItem('sc_clients_history', JSON.stringify(clients));
  } catch (e) {}
  console.log("⚡ Matriz completa de clientes enviada a la extensión:", clients.length);
};

export const sendBatchDeclarationToExtension = (
  clients: Client[], 
  declarationType: 'mensual' | 'semestral' | 'renta' = 'mensual',
  mode: 'declare' | 'recover_pdf_only' = 'declare',
  targetPeriod?: { year: number; monthIndex: number } | string
) => {
  if (!Array.isArray(clients) || clients.length === 0) return;
  
  const parsedPeriod = parsePeriodToWorkflowPeriod(targetPeriod);

  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_START_BATCH_DECLARATION',
    data: {
      declarationType,
      mode,
      targetPeriod: parsedPeriod ? parsedPeriod.periodStr : undefined,
      workflowPeriod: parsedPeriod ? { year: parsedPeriod.year, monthIndex: parsedPeriod.monthIndex } : undefined,
      clients: clients.map(c => ({
        id: c.id,
        ruc: c.ruc,
        name: c.name,
        sriPassword: c.sriPassword,
        regime: c.regime,
        ivaFrequency: c.taxProfile?.ivaFrequency || c.category || 'Mensual',
        clientStartPeriod: (c as any).clientStartPeriod || (c as any).taxProfile?.clientStartPeriod || ''
      })),
      timestamp: new Date().getTime()
    }
  };

  window.postMessage(payload, "*");
  localStorage.setItem('sc_batch_declaration_queue', JSON.stringify(payload.data));
  console.log(`🚀 Lote (${declarationType}, modo: ${mode}${parsedPeriod ? `, período: ${parsedPeriod.periodStr}` : ''}) enviado a la extensión:`, clients.length, "clientes.");
};

export const listenForDeclarationCompleted = (onCompleted: (data: { ruc: string; success: boolean; pdfUrl?: string; timestamp: number }) => void) => {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.source === 'SC_PRO_EXTENSION' && data.type === 'SRI_DECLARATION_COMPLETED_SYNC') {
      console.log("✅ Declaración completada recibida desde la extensión para RUC:", data.data?.ruc);
      onCompleted(data.data);
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
};

export const openSRIPortal = (url?: string) => {
  window.open(url || 'https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
};
