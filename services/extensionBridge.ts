import { Client } from '../types';
import { getClientIvaFrequency } from './sri';

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
  const pStr = parsedPeriod?.periodStr || '';

  // 🛡️ Filtro estricto preventivo en la Web:
  // Si el cliente ya tiene comprobante guardado para este período, NUNCA debe entrar al lote.
  // Evita entrar a su perfil, descargar y gastar tokens innecesariamente (ej. Camba Paola).
  const validBatchClients = clients.filter(c => {
    if (!c || !c.ruc) return false;
    const decls: any[] = c.declarations || (c as any).declaration_history || [];
    const hasProof = decls.some((d: any) => 
      d && (d.proof_file?.url || d.proof_file?.name || d.pdfUrl) && String(d.period || '').includes(pStr)
    );
    const isDeclared = decls.some((d: any) => 
      d && String(d.period || '').includes(pStr) && (d.status === 'Enviada' || d.status === 'Pagada' || !!d.proof_file)
    );

    if (mode === 'declare' && hasProof) {
      console.log(`🛡️ [BRIDGE BUCLE] ${c.name || c.ruc} ya tiene comprobante para ${pStr}. Omitido preventivamente.`);
      return false;
    }
    if (mode === 'recover_pdf_only' && hasProof) {
      console.log(`🛡️ [BRIDGE BUCLE] ${c.name || c.ruc} ya posee PDF oficial en la nube para ${pStr}. Omitido.`);
      return false;
    }
    return true;
  });

  if (validBatchClients.length === 0) {
    console.log(`🎉 [BRIDGE BUCLE] Todos los ${clients.length} clientes evaluados ya tienen su comprobante para ${pStr || 'el período actual'}. No hay nada pendiente que enviar.`);
    return;
  }

  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_START_BATCH_DECLARATION',
    data: {
      declarationType,
      mode,
      targetPeriod: parsedPeriod ? parsedPeriod.periodStr : undefined,
      workflowPeriod: parsedPeriod ? { year: parsedPeriod.year, monthIndex: parsedPeriod.monthIndex } : undefined,
      clients: validBatchClients.map(c => {
        const decls: any[] = c.declarations || (c as any).declaration_history || [];
        const hasProof = pStr ? decls.some((d: any) => d && (d.proof_file?.url || d.proof_file?.name || d.pdfUrl) && String(d.period || '').includes(pStr)) : false;
        return {
          id: c.id,
          ruc: c.ruc,
          name: c.name,
          sriPassword: c.sriPassword,
          regime: c.regime,
          ivaFrequency: getClientIvaFrequency(c),
          clientStartPeriod: (c as any).clientStartPeriod || (c as any).taxProfile?.clientStartPeriod || '',
          declarations: decls,
          hasPdf: hasProof,
          isDeclared: decls.some((d: any) => d && String(d.period || '').includes(pStr) && (d.status === 'Enviada' || d.status === 'Pagada'))
        };
      }),
      timestamp: new Date().getTime()
    }
  };

  window.postMessage(payload, "*");
  localStorage.setItem('sc_batch_declaration_queue', JSON.stringify(payload.data));
  console.log(`🚀 Lote (${declarationType}, modo: ${mode}${parsedPeriod ? `, período: ${parsedPeriod.periodStr}` : ''}) enviado a la extensión:`, validBatchClients.length, "clientes (se excluyeron", clients.length - validBatchClients.length, "ya completados).");
};

/**
 * 🌐 Enviar credenciales a la extensión para entrar y QUEDARSE adentro del perfil del SRI
 * sin ejecutar ninguna automatización de declaraciones ni descargas en bucle.
 */
export const sendDirectLoginToExtension = (client: Client) => {
  if (!client.ruc || !client.sriPassword) {
    console.warn("Faltan credenciales para ingresar al portal SRI.");
    return;
  }

  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_ENTER_PORTAL_SESSION',
    data: {
      ruc: client.ruc,
      name: client.name || (client as any).razonSocial || 'Cliente SRI',
      password: client.sriPassword,
      soloEstarAdentro: true,
      mode: 'session_only',
      pendingAction: 'solo_perfil',
      timestamp: Date.now()
    }
  };

  // 1. PostMessage hacia content scripts de la extensión
  window.postMessage(payload, "*");

  // 2. Evento personalizado
  window.dispatchEvent(new CustomEvent('sriEnterPortalSession', { detail: payload.data }));

  // 3. LocalStorage de respaldo
  try {
    localStorage.setItem('_sri_autofill_pending', JSON.stringify(payload.data));
    localStorage.setItem('sri_active_credentials', JSON.stringify(payload.data));
    // Guardar para portapapeles rápido
    navigator.clipboard.writeText(`${client.ruc}\t${client.sriPassword}`).catch(() => {});
  } catch (e) {}

  console.log(`🌐 [Sesión Directa SRI] Solicitud de ingreso enviada a Nueva Luz 3.0 para ${client.name} (${client.ruc}).`);
  window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
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

export const sendBatchKeyVerificationToExtension = (clients: Client[]) => {
  if (!Array.isArray(clients) || clients.length === 0) return;

  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_START_BATCH_DECLARATION',
    data: {
      declarationType: 'mensual',
      mode: 'probar_clave',
      testKeysOnly: true,
      clients: clients.map(c => ({
        id: c.id,
        ruc: c.ruc,
        name: c.name,
        sriPassword: c.sriPassword,
        soloProbarClave: true
      })),
      timestamp: Date.now()
    }
  };

  window.postMessage(payload, "*");
  try {
    localStorage.setItem('sc_batch_key_test_queue', JSON.stringify(payload.data));
  } catch (e) {}
  console.log(`🔑 [Pre-Vuelo Claves] Lote de prueba de claves enviado a la extensión: ${clients.length} clientes.`);
};

export const requestPruebaClavesFromExtension = () => {
  window.postMessage({
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_REQUEST_PRUEBA_CLAVES'
  }, "*");
};

export const openSRIPortal = (url?: string) => {
  window.open(url || 'https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
};

export const sendZifactAutoLoginToExtension = (data: { username: string; password: string; clientName?: string }) => {
  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'ZIFAC_AUTOFILL_DATA',
    data: {
      username: data.username,
      password: data.password,
      clientName: data.clientName || '',
      timestamp: Date.now()
    }
  };

  window.postMessage(payload, "*");
  window.dispatchEvent(new CustomEvent('zifactAutofillReady', { detail: payload.data }));
  try {
    localStorage.setItem('_zifact_autofill_pending', JSON.stringify(payload.data));
  } catch (e) {}
  console.log(`⚡ [Auto-Login Zifact] Solicitud enviada a la extensión para ${data.clientName || data.username}.`);
};

export const enterZifactDirect = (client: Client) => {
  const plan = client.billingPlan || client.facturadorConfig || {};
  const user = plan.username || client.ruc;
  const pwd = plan.password || client.sriPassword;

  if (!user || !pwd) {
    return { success: false, reason: 'missing_credentials' as const };
  }

  sendZifactAutoLoginToExtension({
    username: user,
    password: pwd,
    clientName: client.tradeName || client.name
  });

  // Respaldo de seguridad con hash (#autologin=base64), no se envía al servidor web
  let targetUrl = 'https://zifact.com/login';
  try {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({
      username: user,
      password: pwd,
      clientName: client.tradeName || client.name
    }))));
    targetUrl += `#autologin=${b64}`;
  } catch (e) {}

  window.open(targetUrl, '_blank');
  return { success: true };
};

export const enterEcuafactDirect = (client: Client) => {
  const plan = client.billingPlan || client.facturadorConfig || {};
  const user = plan.username || client.ruc;
  const pwd = plan.password || client.sriPassword;

  if (!user) {
    return { success: false, reason: 'missing_credentials' as const };
  }

  // Copiar al portapapeles para acceso inmediato
  if (pwd) {
    try {
      navigator.clipboard.writeText(`${user}\t${pwd}`);
    } catch (e) {}
  }

  // Notificar por postMessage a la extensión o ventanas escuchando
  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'ECUAFACT_AUTOFILL_DATA',
    data: {
      username: user,
      password: pwd || '',
      clientName: client.tradeName || client.name,
      ruc: client.ruc,
      timestamp: Date.now()
    }
  };
  window.postMessage(payload, "*");
  window.dispatchEvent(new CustomEvent('ecuafactAutofillReady', { detail: payload.data }));

  const targetUrl = plan.url || 'https://app.ecuafact.com';
  window.open(targetUrl, '_blank');
  return { success: true, username: user, hasPassword: !!pwd };
};

export const enterTalonarioDirect = (client: Client) => {
  const plan = client.billingPlan || client.facturadorConfig || {};
  const user = plan.username || client.ruc;
  const pwd = plan.password || client.sriPassword;

  if (!user) {
    return { success: false, reason: 'missing_credentials' as const };
  }

  if (pwd) {
    try {
      navigator.clipboard.writeText(`${user}\t${pwd}`);
    } catch (e) {}
  }

  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'TALONARIO_AUTOFILL_DATA',
    data: {
      username: user,
      password: pwd || '',
      clientName: client.tradeName || client.name,
      ruc: client.ruc,
      timestamp: Date.now()
    }
  };
  window.postMessage(payload, "*");
  window.dispatchEvent(new CustomEvent('talonarioAutofillReady', { detail: payload.data }));

  let targetUrl = plan.url || 'https://talonarioamigo.santiagocordova.com';
  // Respaldo hash para auto-login si la web lo soporta
  if (pwd) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ username: user, password: pwd }))));
      targetUrl += `#autologin=${b64}`;
    } catch (e) {}
  }

  window.open(targetUrl, '_blank');
  return { success: true, username: user, hasPassword: !!pwd };
};

export const enterSriDirect = (client: Client) => {
  if (!client.ruc) {
    return { success: false, reason: 'missing_credentials' as const };
  }

  const pwd = client.sriPassword || '';

  // 1. Envío a la extensión Nueva Luz 3.0 para sesión automática y detenerse en el perfil
  const payload = {
    source: 'SC_PRO_DASHBOARD',
    type: 'SRI_ENTER_PORTAL_SESSION',
    data: {
      ruc: client.ruc,
      name: client.tradeName || client.name,
      password: pwd,
      timestamp: Date.now()
    }
  };
  window.postMessage(payload, "*");
  window.dispatchEvent(new CustomEvent('sriEnterPortalReady', { detail: payload.data }));

  // 2. Copiar clave al portapapeles como respaldo
  if (pwd) {
    try {
      navigator.clipboard.writeText(pwd);
    } catch (e) {}
  }

  const targetUrl = 'https://srienlinea.sri.gob.ec/tuportal-internet/';
  window.open(targetUrl, '_blank');
  return { success: true, username: client.ruc, hasPassword: !!pwd };
};

export const enterFacturadorDirect = (client: Client) => {
  const plan = client.billingPlan || client.facturadorConfig || {};
  const prog = (plan.programName || '').toLowerCase();
  const url = (plan.url || '').toLowerCase();

  if (prog.includes('zifac') || url.includes('zifact')) {
    return { ...enterZifactDirect(client), provider: 'zifact' as const };
  }
  if (prog.includes('talonario') || url.includes('talonarioamigo')) {
    return { ...enterTalonarioDirect(client), provider: 'talonario' as const };
  }
  if (prog.includes('sri') || url.includes('sri.gob.ec')) {
    return { ...enterSriDirect(client), provider: 'sri' as const };
  }
  if (prog.includes('ecuafact') || url.includes('ecuafact')) {
    return { ...enterEcuafactDirect(client), provider: 'ecuafact' as const };
  }

  // Facturador genérico
  const user = plan.username || client.ruc;
  const pwd = plan.password || client.sriPassword;
  if (pwd) {
    try {
      navigator.clipboard.writeText(`${user}\t${pwd}`);
    } catch (e) {}
  }
  const target = plan.url || 'https://app.ecuafact.com';
  window.open(target, '_blank');
  return { success: true, provider: 'default' as const, username: user, hasPassword: !!pwd };
};


