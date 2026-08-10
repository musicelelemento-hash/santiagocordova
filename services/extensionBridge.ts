import { Client } from '../types';

/**
 * Bridge para comunicarse con la extensión de Chrome "SRI Auto-fill".
 * Envía un mensaje que la extensión puede capturar mediante un content script.
 */
export const sendToSRIExtension = (client: Client) => {
  if (!client.ruc || !client.sriPassword) {
    console.warn("Faltan credenciales para el autocompletado.");
    return;
  }

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

export const sendBatchDeclarationToExtension = (clients: Client[], declarationType: 'mensual' | 'semestral' | 'renta' = 'mensual') => {
  if (!Array.isArray(clients) || clients.length === 0) return;
  
  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_START_BATCH_DECLARATION',
    data: {
      declarationType,
      clients: clients.map(c => ({
        id: c.id,
        ruc: c.ruc,
        name: c.name,
        sriPassword: c.sriPassword,
        regime: c.regime,
        ivaFrequency: c.taxProfile?.ivaFrequency || c.category || 'Mensual'
      })),
      timestamp: new Date().getTime()
    }
  };

  window.postMessage(payload, "*");
  localStorage.setItem('sc_batch_declaration_queue', JSON.stringify(payload.data));
  console.log(`🚀 Lote de Declaraciones (${declarationType}) enviado a la extensión:`, clients.length, "clientes.");
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
