
import { create } from 'zustand';
import { db } from '../services/db';
import { loadDataFromSheet } from '../services/sheetApi';
import { Client, Task, WebOrder, ServiceFeesConfig, ReminderConfig, WhatsAppTemplates, BusinessProfile, TaxRegime, DeclarationStatus, Declaration, AuditLog, ClientNote, NoteCategory, SystemSettings } from '../types';
import { mockClients, mockTasks, INITIAL_SERVICE_FEES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { ClientSchema } from '../services/schemas/clientSchema';
import { SupabaseService } from '../services/supabaseClientService';
import { sendFullClientsMatrixToExtension } from '../services/extensionBridge';

import { isPeriodBeforeClientStart } from '../services/complianceEngine';

const sanitizeSingleClient = (c: any): Client => {
  // Normalizar el régimen de forma robusta
  let normalizedRegime = c.regime as TaxRegime;
  if (c.regime) {
    const r = c.regime.toString().toUpperCase().replace(/_/g, ' ');
    if (r.includes('POPULAR')) {
      normalizedRegime = TaxRegime.RimpeNegocioPopular;
    } else if (r.includes('EMPRENDEDOR')) {
      normalizedRegime = TaxRegime.RimpeEmprendedor;
    } else if (r.includes('GENERAL')) {
      normalizedRegime = TaxRegime.General;
    }
  }

  // Pre-calcular el taxProfile con fallbacks correctos
  const rawTaxProfile = c.taxProfile || {};
  const taxProfile = {
    ivaFrequency: rawTaxProfile.ivaFrequency || (
      normalizedRegime === TaxRegime.RimpeEmprendedor || c.category?.includes('Semestral') 
        ? 'Semestral' 
        : (normalizedRegime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual')
    ),
    requiresAnnualRenta: rawTaxProfile.requiresAnnualRenta ?? (
      c.rentaCategory === 'Suscripción Renta' || 
      c.category?.includes('Renta') || 
      c.category?.includes('Popular') || 
      normalizedRegime === TaxRegime.RimpeEmprendedor || 
      normalizedRegime === TaxRegime.RimpeNegocioPopular
    ),
    requiresAnexosGastos: rawTaxProfile.requiresAnexosGastos ?? false,
    hasActiveDevolucionIva: rawTaxProfile.hasActiveDevolucionIva ?? (c.category?.includes('Devolución') || false),
    hasActiveElderlyDevolucionIva: rawTaxProfile.hasActiveElderlyDevolucionIva ?? false,
    requiresIce: rawTaxProfile.requiresIce ?? false,
    requiresAnexoPvp: rawTaxProfile.requiresAnexoPvp ?? false,
    clientStartPeriod: rawTaxProfile.clientStartPeriod || c.clientStartPeriod
  };

  // Forzar consistencia estricta e inviolable según el régimen o cliente específico
  if ((c.name && c.name.toUpperCase().includes('CHALCO')) || (c.tradeName && c.tradeName.toUpperCase().includes('CHALCO'))) {
    taxProfile.ivaFrequency = 'Semestral';
  }

  if (normalizedRegime === TaxRegime.RimpeNegocioPopular) {
    taxProfile.ivaFrequency = 'Ninguno';
    taxProfile.requiresAnnualRenta = true;
  } else if (normalizedRegime === TaxRegime.RimpeEmprendedor) {
    taxProfile.ivaFrequency = 'Semestral';
    taxProfile.requiresAnnualRenta = true;
  }

  let initialDecls: Declaration[] = Array.isArray(c.declarations) ? c.declarations.map((d: any) => ({
    ...d,
    is_paid: typeof d.is_paid === 'boolean' ? d.is_paid : d.status === DeclarationStatus.Pagada
  })) : [];

  // Rellenar comprobantes y pagos de semestres pasados (2025-S1, 2025-S2, 2024-S1, 2024-S2) para clientes semestrales
  if (taxProfile.ivaFrequency === 'Semestral' || normalizedRegime === TaxRegime.RimpeEmprendedor) {
    const pastSemestralPeriods = ['2025-S2', '2025-S1', '2024-S2', '2024-S1'];
    const declMap = new Map<string, Declaration>();
    
    for (const d of initialDecls) {
      if (d && d.period) declMap.set(d.period, d);
    }

    const defaultProof = {
      name: 'Comprobante_Semestral_SRI.pdf',
      type: 'application/pdf',
      size: 2048,
      lastModified: Date.now(),
      content: 'data:application/pdf;base64,JVBERi0xLjQ...'
    };

    const tempClient = { ...c, clientStartPeriod: c.clientStartPeriod || rawTaxProfile.clientStartPeriod };

    for (const period of pastSemestralPeriods) {
      if (tempClient.clientStartPeriod && isPeriodBeforeClientStart(tempClient as Client, period)) continue;

      const existing = declMap.get(period);
      if (existing) {
        declMap.set(period, {
          ...existing,
          status: existing.status || (existing.proof_file ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente),
          is_paid: typeof existing.is_paid === 'boolean' ? existing.is_paid : false,
          proof_file: existing.proof_file
        });
      }
    }

    initialDecls = Array.from(declMap.values());
  }

  const client = {
    id: c.id || uuidv4(),
    ruc: c.ruc || '',
    name: c.name || 'Sin Nombre',
    tradeName: c.tradeName || '',
    sriPassword: c.sriPassword || '',
    iessPassword: c.iessPassword || '',
    email: c.email || '',
    phones: Array.isArray(c.phones) ? c.phones : [c.phone || ''],
    address: c.address || '',
    economicActivity: c.economicActivity || '',
    clientStartPeriod: c.clientStartPeriod || rawTaxProfile.clientStartPeriod,
    declarations: initialDecls,
    isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
    // Bóveda de Datos
    isArtisan: !!c.isArtisan,
    establishmentCount: c.establishmentCount || 1,
    jurisdiction: c.jurisdiction || '',
    electronicSignaturePassword: c.electronicSignaturePassword || '',
    signatureFile: c.signatureFile || undefined,
    rucPdf: c.rucPdf || undefined,
    rucCertificate: c.rucCertificate || undefined, // Support both naming variants if needed
    sharedAccessKey: c.sharedAccessKey || '',
    notes: c.notes || '',
    // Fee Structure Preservation
    fee_structure: c.fee_structure ? {
      ...c.fee_structure,
      semestral: (c.fee_structure.semestral === 5 || !c.fee_structure.semestral) ? 10 : c.fee_structure.semestral
    } : undefined,
    rentaCategory: c.rentaCategory || undefined,
    signatureExpirationDate: c.signatureExpirationDate || '',
    vault: Array.isArray(c.vault) ? c.vault : [],
    needsVerification: typeof c.needsVerification === 'boolean' ? c.needsVerification : false,
    verificationReason: c.verificationReason || '',
    structuredNotes: Array.isArray(c.structuredNotes) ? c.structuredNotes : [],
    hasRentaRefund: !!c.hasRentaRefund,
    rentaRefundAmount: c.rentaRefundAmount || 0,
    rentaRefundStatus: c.rentaRefundStatus || 'Pendiente',
    hasElderlyDevolucionIva: !!c.hasElderlyDevolucionIva,
    elderlyDevolucionIvaStatus: c.elderlyDevolucionIvaStatus || 'Pendiente',
    taxProfile,
    regime: normalizedRegime,
    advanceCredits: c.advanceCredits || 0,
    isDeleted: !!c.isDeleted,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };

  return client as Client;
};

const sanitizeClients = (rawClients: any[]): Client[] => {
  if (!Array.isArray(rawClients)) return [];

  // Deduplicate and sanitize in a single pass
  const uniqueClients = new Map<string, Client>();

  for (let i = 0; i < rawClients.length; i++) {
    const raw = rawClients[i];
    const sanitized = sanitizeSingleClient(raw);
    
    // If no RUC, use ID as key so it doesn't collide
    const key = (sanitized.ruc && sanitized.ruc.trim() !== '') ? sanitized.ruc.trim() : sanitized.id;

    if (!uniqueClients.has(key)) {
      uniqueClients.set(key, sanitized);
    } else {
      const existing = uniqueClients.get(key)!;
      // Resolve collision: Keep the one with the most declaration history.
      const clientHistoryStr = sanitized.declarations ? sanitized.declarations.length : 0;
      const existingHistoryStr = existing.declarations ? existing.declarations.length : 0;

      if (clientHistoryStr > existingHistoryStr) {
        uniqueClients.set(key, sanitized);
      } else if (clientHistoryStr === existingHistoryStr) {
        // If same history length, prefer the one that is NOT deleted or is active
        if (sanitized.isActive && !existing.isActive) {
          uniqueClients.set(key, sanitized);
        } else if (!sanitized.isDeleted && existing.isDeleted) {
          uniqueClients.set(key, sanitized);
        }
      }
    }
  }

  return Array.from(uniqueClients.values());
};

const sanitizeReminderConfig = (c: any): ReminderConfig => {
  return {
    isEnabled: typeof c?.isEnabled === 'boolean' ? c.isEnabled : true,
    daysBefore: typeof c?.daysBefore === 'number' ? c.daysBefore : 3,
    onDueDate: typeof c?.onDueDate === 'boolean' ? c.onDueDate : true,
    overdueInterval: typeof c?.overdueInterval === 'number' ? c.overdueInterval : 7,
    template: c?.template || '',
  };
};

interface AppState {
  clients: Client[];
  tasks: Task[];
  webOrders: WebOrder[];
  sriCredentials: Record<string, string>;
  serviceFees: ServiceFeesConfig;
  whatsappTemplates: WhatsAppTemplates;
  businessProfile: BusinessProfile;
  reminderConfig: ReminderConfig;
  auditLogs: AuditLog[];
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  setClients: (clients: Client[] | ((prev: Client[]) => Client[])) => void;
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  setWebOrders: (orders: WebOrder[] | ((prev: WebOrder[]) => WebOrder[])) => void;
  setSriCredentials: (creds: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setServiceFees: (fees: ServiceFeesConfig) => void;
  setReminderConfig: (config: ReminderConfig | ((prev: ReminderConfig) => ReminderConfig)) => void;
  loadFromDB: () => Promise<void>;
  isLoaded: boolean;
  hydrateFromCloud: (data: any) => Promise<void>;
  exportData: () => Promise<Record<string, any>>;
  importData: (jsonData: any) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addClient: (client: Client) => void;
  removeClient: (id: string, permanent?: boolean) => void;
  restoreClient: (id: string) => void;
  purgeTrash: () => void;
  bulkAddClients: (clients: Client[]) => void;
  bulkUpdateClients: (ids: string[], updates: Partial<Client>) => void;
  getClientByRuc: (ruc: string) => Client | undefined;
  addClientNote: (clientId: string, note: Omit<ClientNote, 'id' | 'createdAt'>) => void;
  removeClientNote: (clientId: string, noteId: string) => void;
  syncFromFirebase: () => void;
  syncFromSheets: () => Promise<void>;
  resetApp: () => Promise<void>;
  systemSettings: SystemSettings;
  setSystemSettings: (settings: SystemSettings) => void;
  cloudStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline';
  setCloudStatus: (status: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline') => void;
}

const defaultBusinessProfile: BusinessProfile = {
  ruc: '0700000000001',
  businessName: 'Santiago Cordova',
  tradeName: 'Soluciones Tributarias Estratégicas',
  address: 'Colon y Sucre / Pasaje - El Oro',
  phone: '+593 978 980 722',
  email: 'info@santiagocordova.com',
  authNumber: '1132667438'
};

const defaultWhatsAppTemplates: WhatsAppTemplates = {
  paymentReminder: `Estimado/a {clientName}, le recordamos que su declaración de {period} vence el {dueDate}. Saludos, Santiago Cordova.`,
  paymentConfirmation: `¡Gracias {clientName}! Pago recibido por {amount}.`,
  declarationNotice: `Hola {clientName}, su declaración de {period} ha sido enviada exitosamente al SRI.`
};

const defaultReminderConfig: ReminderConfig = {
  isEnabled: true,
  daysBefore: 3,
  onDueDate: true,
  overdueInterval: 7,
  template: `Estimado/a {clientName}, le recordamos amablemente que su declaración de {period} por un valor de {amount} vence el {dueDate}. Saludos, Soluciones Contables Pro`,
};

export const useAppStore = create<AppState>((set, get) => ({
  clients: [],
  tasks: [],
  webOrders: [],
  sriCredentials: {},
  serviceFees: INITIAL_SERVICE_FEES,
  whatsappTemplates: defaultWhatsAppTemplates,
  businessProfile: defaultBusinessProfile,
  reminderConfig: defaultReminderConfig,
  auditLogs: [],
  isLoaded: false,
  cloudStatus: 'idle',
  systemSettings: {
    combos: [
      { id: 'combo-ecuafact-60', name: 'Combo ECUAFACT 60 docs', price: 45, category: 'ecuafact', isActive: true, accessUrl: 'https://www.ecuafact.com', notes: 'Plan anual 60 documentos' },
      { id: 'combo-ecuafact-120', name: 'Combo ECUAFACT 120 docs', price: 65, category: 'ecuafact', isActive: true, accessUrl: 'https://www.ecuafact.com', notes: 'Plan anual 120 documentos' },
      { id: 'combo-zifact', name: 'Combo ZIFACT', price: 55, category: 'zifact', isActive: true, accessUrl: 'https://app.zifact.com', notes: 'Plan anual Zifact' },
      { id: 'solo-firma', name: 'Solo Firma Electrónica', price: 25, category: 'firma', isActive: true, notes: 'Token USB incluido' },
    ],
    ecuafactUrl: 'https://www.ecuafact.com',
    zifactUrl: 'https://app.zifact.com',
    sriUrl: 'https://srienlinea.sri.gob.ec',
    fingerprintDeviceId: '',
  },

  setCloudStatus: (status) => set({ cloudStatus: status }),

  setClients: (value) => {
    const currentClients = get().clients;
    const newClients = typeof value === 'function' ? value(currentClients) : value;

    // Performance Optimization: Only sanitize if the length changed significantly or if it's a full replace
    // For large lists, we trust individual update methods to maintain sanity.
    const safeClients = (newClients.length > 500 && Math.abs(newClients.length - currentClients.length) < 2)
      ? newClients
      : sanitizeClients(newClients);

    set({ clients: safeClients });

    // BACKUP: Solo guardamos la lista completa localmente como snapshot ocasional
    // o si el usuario explícitamente pide persistencia total.
    db.setLocal('clients', safeClients);
    sendFullClientsMatrixToExtension(safeClients);
  },

  setTasks: (value) => {
    const currentTasks = get().tasks;
    const newTasks = typeof value === 'function' ? value(currentTasks) : value;
    set({ tasks: newTasks });
    db.setLocal('tasks', newTasks);

    // FIX: Sync tasks to cloud. Since setTasks overwrites the array, we bulk sync or update individual tasks.
    // For safety, we use bulkUpdate (will require db.ts support for sc_pro_tasks)
    get().setCloudStatus('saving');
    db.bulkUpdate('sc_pro_tasks', newTasks)
      .then(() => get().setCloudStatus('saved'))
      .catch(err => {
        console.error("Cloud sync failed for tasks:", err);
        get().setCloudStatus('error');
      });
  },

  updateClient: async (id, updates) => {
    const currentClients = get().clients;
    const clientIndex = currentClients.findIndex(c => c.id === id);
    if (clientIndex === -1) return;

    const nowIso = new Date().toISOString();
    // IMPORTANT: Do NOT force isDeleted:false here — let updates control it
    const updatedClient = { ...currentClients[clientIndex], ...updates, updatedAt: nowIso };
    const newClients = [...currentClients];
    newClients[clientIndex] = updatedClient;

    set({ clients: newClients });

    // FAST LOCAL PERSISTENCE
    await db.setLocal('clients', newClients);

    // CLOUD SYNC
    get().setCloudStatus('saving');
    db.updateRecord('sc_pro_clients', id, updatedClient)
      .then(() => get().setCloudStatus('saved'))
      .catch(err => {
        console.error("Cloud sync failed for client:", id, err);
        get().setCloudStatus('error');
      });

    get().addAuditLog({
      type: 'client',
      action: 'Actualización Cliente',
      details: `${updatedClient.name} - RUC: ${updatedClient.ruc}`,
      severity: 'info'
    });
  },

  addClient: (client) => {
    const currentClients = get().clients;
    // Evitar duplicados por RUC, pero si existe uno borrado, recuperarlo y actualizarlo
    const existingIndex = currentClients.findIndex(c => c.ruc === client.ruc);
    if (existingIndex !== -1) {
      if (currentClients[existingIndex].isDeleted) {
        console.log("Restaurando cliente previamente borrado via addClient sync.");
        const updates = { ...client, isDeleted: false };
        get().updateClient(currentClients[existingIndex].id, updates);
      } else {
        console.warn("RUC ya existe y está activo.");
      }
      return;
    }

    const nowIso = new Date().toISOString();
    const newClient = { ...client, isDeleted: false, createdAt: nowIso, updatedAt: nowIso };
    const newClients = [newClient, ...currentClients];
    set({ clients: newClients });

    // SYNC
    db.updateRecord('sc_pro_clients', newClient.id, newClient);
    db.setLocal('clients', newClients);

    get().addAuditLog({
      type: 'client',
      action: 'Nuevo Cliente',
      details: `${newClient.name} - RUC: ${newClient.ruc}`,
      severity: 'info'
    });
  },

  removeClient: async (id, permanent = false) => {
    const currentClients = get().clients;
    const client = currentClients.find(c => c.id === id);
    const clientName = client?.name || 'Cliente desconocido';
    
    if (permanent) {
      const newClients = currentClients.filter(c => c.id !== id);
      set({ clients: newClients });
      await db.setLocal('clients', newClients);
      // Actual deletion from Cloud to stop the "ghost" sync
      try {
        await (db as any).deleteRecord('sc_pro_clients', id);
        get().setCloudStatus('saved');
        get().addAuditLog({
          type: 'client',
          action: 'Eliminación Permanente',
          details: `${clientName}`,
          severity: 'warning'
        });
      } catch (err) {
        console.error("Cloud delete failed for client:", id, err);
        get().setCloudStatus('error');
      }
    } else {
      // Soft deletion
      const clientIndex = currentClients.findIndex(c => c.id === id);
      if (clientIndex === -1) return;

      const nowIso = new Date().toISOString();
      const updatedClient = { ...currentClients[clientIndex], isDeleted: true, updatedAt: nowIso };
      const newClients = [...currentClients];
      newClients[clientIndex] = updatedClient;

      set({ clients: newClients });
      await db.setLocal('clients', newClients);

      get().setCloudStatus('saving');
      db.updateRecord('sc_pro_clients', id, updatedClient)
        .then(() => {
          get().setCloudStatus('saved');
          get().addAuditLog({
            type: 'client',
            action: 'Movido a Papelera',
            details: `${clientName}`,
            severity: 'info'
          });
        })
        .catch(err => {
          console.error("Cloud sync failed for client deletion:", id, err);
          get().setCloudStatus('error');
        });
    }
  },

  restoreClient: async (id) => {
    const currentClients = get().clients;
    const clientIndex = currentClients.findIndex(c => c.id === id);
    if (clientIndex === -1) return;

    const nowIso = new Date().toISOString();
    const updatedClient = { ...currentClients[clientIndex], isDeleted: false, updatedAt: nowIso };
    const newClients = [...currentClients];
    newClients[clientIndex] = updatedClient;

    set({ clients: newClients });
    await db.setLocal('clients', newClients);

    get().setCloudStatus('saving');
    db.updateRecord('sc_pro_clients', id, updatedClient)
      .then(() => get().setCloudStatus('saved'))
      .catch(err => {
        console.error("Cloud sync failed for client restoration:", id, err);
        get().setCloudStatus('error');
      });
  },

  purgeTrash: async () => {
    const currentClients = get().clients;
    const clientsToDelete = currentClients.filter(c => c.isDeleted);
    const newClients = currentClients.filter(c => !c.isDeleted);
    
    set({ clients: newClients });
    await db.setLocal('clients', newClients);

    // Bulk delete from Cloud
    for (const client of clientsToDelete) {
      try {
        await (db as any).deleteRecord('sc_pro_clients', client.id);
      } catch (err) {
        console.error("Failed to purge client from cloud:", client.id, err);
      }
    }
    get().setCloudStatus('saved');
    get().addAuditLog({
      type: 'system',
      action: 'Limpieza de Papelera',
      details: `Se eliminaron permanentemente ${clientsToDelete.length} registros.`,
      severity: 'warning'
    });
  },

  addAuditLog: (log) => {
    const newLog: AuditLog = {
      ...log,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };
    set(state => ({
      auditLogs: [newLog, ...state.auditLogs].slice(0, 1000) // Keep last 1000
    }));
    db.setLocal('audit_logs', get().auditLogs);
    
    // Cloud Sync
    SupabaseService.addAuditLog(newLog).catch(err => console.error("Supabase audit log error:", err));
  },

  bulkAddClients: async (newClientsList) => {
    const currentClients = get().clients;
    const combined = [...newClientsList, ...currentClients];
    set({ clients: combined });
    await db.setLocal('clients', combined);

    // SYNC: Use granular bulk update
    db.bulkUpdate('sc_pro_clients', newClientsList).catch(err => {
      console.error("Bulk add cloud sync failed:", err);
    });
  },

  bulkUpdateClients: async (ids, updates) => {
    const currentClients = get().clients;
    const clientsToSync: Client[] = [];

    const newClients = currentClients.map(c => {
      if (ids.includes(c.id)) {
        const updated = { ...c, ...updates };
        clientsToSync.push(updated);
        return updated;
      }
      return c;
    });

    set({ clients: newClients });
    await db.setLocal('clients', newClients);

    // SYNC: Use granular bulk update
    if (clientsToSync.length > 0) {
      db.bulkUpdate('sc_pro_clients', clientsToSync).catch(err => {
        console.error("Bulk update cloud sync failed:", err);
      });
    }
  },
  
  getClientByRuc: (ruc) => {
    return get().clients.find(c => c.ruc === ruc);
  },

  addClientNote: (clientId, note) => {
    const clients = get().clients;
    const clientIndex = clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;

    const newNote: ClientNote = {
      ...note,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };

    const updatedClient = {
      ...clients[clientIndex],
      structuredNotes: [newNote, ...(clients[clientIndex].structuredNotes || [])]
    };

    get().updateClient(clientId, { structuredNotes: updatedClient.structuredNotes });
  },

  removeClientNote: (clientId, noteId) => {
    const clients = get().clients;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const updatedNotes = (client.structuredNotes || []).filter(n => n.id !== noteId);
    get().updateClient(clientId, { structuredNotes: updatedNotes });
  },
  
  syncFromFirebase: () => {
    return db.syncCollection('sc_pro_clients', (changes) => {
      if (!changes || changes.length === 0) return;

      const currentClients = [...get().clients];
      let hasChanges = false;

      // OPTIMIZACIÓN O(1): Usar Mapas para búsquedas instantáneas
      const idMap = new Map(currentClients.map((c, i) => [c.id, i]));
      const rucMap = new Map(currentClients.filter(c => c.ruc).map((c, i) => [c.ruc, i]));

      changes.forEach(change => {
        const item = sanitizeSingleClient(change.data);
        if (change.type === 'added' || change.type === 'modified') {
          let idx = idMap.get(item.id) ?? -1;

          // RECONCILIACIÓN DE IDENTIDAD: Si no coincide el ID pero sí el RUC
          if (idx === -1 && item.ruc) {
            const rucIdx = rucMap.get(item.ruc) ?? -1;
            if (rucIdx !== -1) {
              console.log(`🤝 Reconciliando cliente ${item.ruc}: Adoptando ID de Nube.`);
              idx = rucIdx;
            }
          }

          if (idx !== -1) {
            currentClients[idx] = item;
          } else {
            currentClients.push(item);
            // Actualizar mapas para el resto de cambios en este lote
            idMap.set(item.id, currentClients.length - 1);
            if (item.ruc) rucMap.set(item.ruc, currentClients.length - 1);
          }
          hasChanges = true;
        } else if (change.type === 'removed') {
          const idx = idMap.get(item.id) ?? -1;
          if (idx !== -1) {
            currentClients.splice(idx, 1);
            // Re-mapear no es necesario si solo son pocos cambios, pero si es masivo sí.
            // Para "ligeresa", asumimos pocos cambios por ráfaga.
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        set({ clients: currentClients });
        db.setLocal('clients', currentClients);
        console.log(`🚀 Sync v7 (Auto-Reconciled): ${changes.length} cambios.`);
      }
    });
  },

  syncFromSheets: async () => {
    try {
      const result = await loadDataFromSheet();
      if (result.status === 'success' && result.data) {
        await get().hydrateFromCloud(result.data);
        return;
      }
      throw new Error(result.message || 'No se pudieron cargar los datos de Sheets.');
    } catch (error) {
      console.error('Error in syncFromSheets:', error);
      throw error;
    }
  },

  setWebOrders: (value) => {
    const newOrders = typeof value === 'function' ? value(get().webOrders) : value;
    set({ webOrders: newOrders });
    db.set('webOrders', newOrders);
  },

  setSriCredentials: (value) => {
    const newCreds = typeof value === 'function' ? value(get().sriCredentials) : value;
    set({ sriCredentials: newCreds });
    db.set('sriCredentials', newCreds);
  },

  setServiceFees: (fees) => {
    set({ serviceFees: fees });
    db.set('serviceFees', fees);
  },

  setReminderConfig: (value) => {
    const newConfig = typeof value === 'function' ? value(get().reminderConfig) : value;
    set({ reminderConfig: newConfig });
    db.set('reminderConfig', newConfig);
  },

  setSystemSettings: (settings) => {
    const updated = { ...settings, lastUpdated: new Date().toISOString() };
    set({ systemSettings: updated });
    db.set('systemSettings', updated);
  },

  hydrateFromCloud: async (data: any) => {
    if (!data) return;

    const currentClients = get().clients;
    const incomingClients = data.clients ? sanitizeClients(data.clients) : [];

    // PROTECCIÓN ELITE: No permitir que una hidratación vacía borre datos locales valiosos
    if (incomingClients.length === 0 && currentClients.length > 5) {
      console.warn("🛡️ Hidratación rechazada: Se intentó cargar 0 clientes sobre una base local ya poblada.");
      return;
    }

    const updates: Partial<AppState> = {};
    if (data.clients) {
      // SMART MERGE: Proteger datos enriquecidos locales (PDFs, Bóveda) frente a data plana de Sheets
      const mergedClients = incomingClients.map(incomingClient => {
        const existingClient = currentClients.find(c => c.ruc === incomingClient.ruc || c.id === incomingClient.id);
        if (existingClient) {
          // Merge declarations by period, keeping local proof_files and payment status
          const mergedHistory: Declaration[] = (incomingClient.declarations || []).map((incDecl: Declaration) => {
            const existingDecl = (existingClient.declarations || []).find((d: Declaration) => d.period === incDecl.period);
            if (existingDecl) {
              return {
                ...incDecl,
                is_paid: existingDecl.is_paid ?? incDecl.is_paid,
                paidAt: existingDecl.paidAt || incDecl.paidAt,
                transactionId: existingDecl.transactionId || incDecl.transactionId,
                amount: existingDecl.amount || incDecl.amount,
                proof_file: existingDecl.proof_file || incDecl.proof_file,
                status: (existingDecl.status === DeclarationStatus.Pagada ? DeclarationStatus.Pagada : existingDecl.proof_file ? (existingDecl.status || incDecl.status) : incDecl.status) as DeclarationStatus,
                reminders: existingDecl.reminders || incDecl.reminders,
              };
            }
            return incDecl;
          });
          
          // Add any existing declarations that might not be in the incoming data
          (existingClient.declarations || []).forEach(existingDecl => {
            if (!mergedHistory.some(d => d.period === existingDecl.period)) {
              mergedHistory.push(existingDecl);
            }
          });

          return {
            ...incomingClient,
            id: existingClient.id, // Mantener ID original
            declarations: mergedHistory,
            vault: existingClient.vault?.length > 0 ? existingClient.vault : incomingClient.vault,
            signatureFile: existingClient.signatureFile || incomingClient.signatureFile,
            rucPdf: existingClient.rucPdf || incomingClient.rucPdf,
            rucCertificate: existingClient.rucCertificate || incomingClient.rucCertificate,
            notes: incomingClient.notes ? incomingClient.notes : existingClient.notes,
          };
        }
        return incomingClient;
      });

      // Añadir clientes locales que no vinieron en la sabana (prevención de borrado accidental)
      currentClients.forEach(localClient => {
        if (!mergedClients.some(mc => mc.ruc === localClient.ruc || mc.id === localClient.id)) {
          mergedClients.push(localClient);
        }
      });

      updates.clients = mergedClients;
    }
    if (data.webOrders) updates.webOrders = data.webOrders;
    if (data.sriCredentials) updates.sriCredentials = data.sriCredentials;
    if (data.serviceFees) {
      const mergedFees = { ...INITIAL_SERVICE_FEES, ...data.serviceFees };
      if (mergedFees.ivaSemestral === 5) mergedFees.ivaSemestral = 10;
      updates.serviceFees = mergedFees;
    }
    if (data.businessProfile) updates.businessProfile = data.businessProfile;
    if (data.reminderConfig) updates.reminderConfig = sanitizeReminderConfig(data.reminderConfig);

    set(updates);

    // PERSISTENCIA CRÍTICA: Guardamos en bloque
    const persistPromises: Promise<any>[] = Object.entries(updates).map(([key, value]) => {
      if (key !== 'isLoaded' && key !== 'clients') return db.set(key, value);
      if (key === 'clients') return db.setLocal('clients', value);
      return Promise.resolve();
    });

    // MIGRACIÓN ELITE VELOZ: Usamos bulkUpdate para miles de registros a la vez
    if (updates.clients && updates.clients.length > 0) {
      console.log(`🚀 Sincronización Masiva: Subiendo ${updates.clients.length} registros en ráfaga granular...`);
      persistPromises.push(db.bulkUpdate('sc_pro_clients', updates.clients));
    }

    await Promise.all(persistPromises);
    console.log("✅ Ciclo de sincronización y protección completado.");
  },

  loadFromDB: async () => {
    try {
      const t0 = performance.now();

      const selfHealChavez = (clientsList: Client[]) => {
        const idx = clientsList.findIndex(c => c.ruc === '0702706813002' || c.ruc === '0702706821001' || (c.ruc === '0706482023001' && !c.clientStartPeriod));
        if (idx !== -1) {
          const client = clientsList[idx];
          console.log("🛠️ selfHealChavez: Corrigiendo datos de Chavez...");
          setTimeout(() => {
            get().updateClient(client.id, { 
              ruc: '0706482023001', 
              clientStartPeriod: '2026-05' 
            });
          }, 500);
        }
      };

      // ── FASE 1: Carga local instantánea (IndexedDB) ──────────
      // Prioridad: mostrar la UI lo antes posible con datos locales
      const [localClients, tasks, webOrders, sriCredentials, serviceFees, reminderConfig, systemSettings] = await Promise.all([
        db.getLocal('clients'),
        db.get<Task[]>('tasks'),
        db.get<WebOrder[]>('webOrders'),
        db.get<Record<string, string>>('sriCredentials'),
        db.get<ServiceFeesConfig>('serviceFees'),
        db.get<ReminderConfig>('reminderConfig'),
        db.get<SystemSettings>('systemSettings'),
      ]);

      const localData = localClients && Array.isArray(localClients) && localClients.length > 0
        ? localClients
        : null;

      // Mostrar datos locales INMEDIATAMENTE si existen
      if (localData) {
        set({
          clients: localData,
          tasks: tasks || [],
          webOrders: webOrders || [],
          serviceFees: serviceFees ? { ...INITIAL_SERVICE_FEES, ...serviceFees, ivaSemestral: (serviceFees.ivaSemestral === 5 ? 10 : serviceFees.ivaSemestral) } : INITIAL_SERVICE_FEES,
          reminderConfig: sanitizeReminderConfig(reminderConfig),
          ...(systemSettings ? { systemSettings: { ...get().systemSettings, ...systemSettings } } : {}),
          isLoaded: true
        });
        console.log(`⚡ Fase 1 (Local): ${localData.length} clientes en ${(performance.now() - t0).toFixed(0)}ms`);
        selfHealChavez(localData);
      }

      // ── FASE 2: Sincronización con la nube (background) ──────
      // Esto NO bloquea la UI — el usuario ya puede trabajar
      const cloudRefresh = async () => {
        try {
          const t1 = performance.now();
          
          // Audit logs en paralelo con datos de clientes y tareas
          const [granularClients, cloudAuditLogs, cloudTasks] = await Promise.all([
            (db as any).getAll('sc_pro_clients').catch(() => []),
            SupabaseService.getAuditLogs(200).catch(() => []),
            (db as any).getAll('sc_pro_tasks').catch(() => [])
          ]);

          // LEGACY FALLBACK: Solo si no hay suficientes clientes granulares
          let legacyClients: Client[] = [];
          if (!granularClients || granularClients.length < 5) {
            try {
              const oldBackup = await db.get<Client[]>('clients');
              if (oldBackup && Array.isArray(oldBackup)) {
                legacyClients = oldBackup;
                console.log(`☁️ Legacy fallback: ${legacyClients.length} clientes recuperados.`);
              }
            } catch (e) {
              // Silent — legacy no es crítico
            }
          }

          const mergedCloudClients = [...legacyClients, ...(granularClients || [])];

          if (mergedCloudClients.length > 0) {
            const cloudClients = sanitizeClients(mergedCloudClients);
            
            // Solo actualizar si la nube tiene datos diferentes/más completos
            const currentClients = get().clients;
            if (cloudClients.length >= currentClients.length || currentClients.length === 0) {
              set({ 
                clients: cloudClients, 
                auditLogs: cloudAuditLogs || [],
                ...(cloudTasks && cloudTasks.length > 0 ? { tasks: cloudTasks } : {})
              });
              db.setLocal('clients', cloudClients);
              if (cloudTasks && cloudTasks.length > 0) db.setLocal('tasks', cloudTasks);
              console.log(`☁️ Fase 2 (Nube): ${cloudClients.length} clientes, ${cloudTasks?.length || 0} tareas sincronizadas en ${(performance.now() - t1).toFixed(0)}ms`);
            } else {
              // La nube tiene menos — solo actualizar audit logs
              set({ auditLogs: cloudAuditLogs || [] });
              console.log(`☁️ Fase 2: Nube tiene menos datos (${cloudClients.length} vs ${currentClients.length} local). Manteniendo local.`);
            }
          } else if (!localData) {
            // Sin datos locales ni en la nube — usar mock
            set({ clients: mockClients, isLoaded: true });
          }
        } catch (cloudErr) {
          console.warn("⚠️ Cloud Fetch failed, using local data:", cloudErr);
        }
      };

      // Si no había datos locales, esperar a la nube
      if (!localData) {
        await cloudRefresh();
        if (get().clients.length === 0) {
          set({ clients: mockClients });
        }
        if (!get().isLoaded) {
          set({
            isLoaded: true,
            tasks: tasks || [],
            webOrders: webOrders || [],
            serviceFees: serviceFees ? { ...INITIAL_SERVICE_FEES, ...serviceFees, ivaSemestral: (serviceFees.ivaSemestral === 5 ? 10 : serviceFees.ivaSemestral) } : INITIAL_SERVICE_FEES,
            reminderConfig: sanitizeReminderConfig(reminderConfig),
          });
        }
      } else {
        // Datos locales existen — nube en background
        cloudRefresh();
      }

    } catch (error) {
      console.error("Critical Load Error:", error);
      set({
        isLoaded: true,
        clients: mockClients,
        reminderConfig: defaultReminderConfig,
        serviceFees: INITIAL_SERVICE_FEES
      });
    }
  },

  exportData: async () => {
    return await db.exportData();
  },

  importData: async (jsonData: any) => {
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Formato de datos inválido');
    }

    console.log("📥 Iniciando importación masiva de JSON...");

    // 1. Guardar localmente primero (Blindaje de emergencia)
    if (jsonData.clients) {
      const sanitized = sanitizeClients(jsonData.clients);
      await db.setLocal('clients', sanitized);
      set({ clients: sanitized });
    }

    // 2. Hidratar el resto (y subir a Firebase Granular)
    await get().hydrateFromCloud(jsonData);

    // Final force sync
    await db.set('isLastSyncManual', true);
    console.log("🏁 Importación finalizada exitosamente.");
  },

  resetApp: async () => {
    console.log("🔥 Iniciando Hard Reset del Sistema...");

    // 1. Borrar Base de Datos IndexedDB
    await db.hardReset();

    // 2. Limpiar LocalStorage de configuraciones persistentes
    localStorage.removeItem('sc_pro_admin_session');
    // Mantenemos sc_pro_backend_url para no perder la conexión a la nube

    // 3. Resetear el estado de Zustand al valor inicial
    set({
      clients: [],
      webOrders: [],
      sriCredentials: {},
      serviceFees: INITIAL_SERVICE_FEES,
      isLoaded: false
    });

    // 4. Recargar la página para limpiar memoria y re-hidratar desde la nube
    window.location.reload();
  }
}));
