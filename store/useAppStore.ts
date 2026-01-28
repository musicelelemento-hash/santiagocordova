
import { create } from 'zustand';
import { db } from '../services/db';
import { Client, Task, WebOrder, ServiceFeesConfig, ReminderConfig, WhatsAppTemplates, BusinessProfile, ClientCategory, TaxRegime, DeclarationStatus } from '../types';
import { mockClients, mockTasks, INITIAL_SERVICE_FEES } from '../constants';
import { v4 as uuidv4 } from 'uuid';

const sanitizeClients = (rawClients: any[]): Client[] => {
    if (!Array.isArray(rawClients)) return [];
    return rawClients.map(c => ({
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
        category: Object.values(ClientCategory).includes(c.category) ? c.category : ClientCategory.InternoMensual,
        regime: Object.values(TaxRegime).includes(c.regime) ? c.regime : TaxRegime.General,
        declarationHistory: Array.isArray(c.declarationHistory) ? c.declarationHistory : [],
        isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
        // Bóveda de Datos
        isArtisan: !!c.isArtisan,
        establishmentCount: c.establishmentCount || 1,
        jurisdiction: c.jurisdiction || '',
        electronicSignaturePassword: c.electronicSignaturePassword || '',
        signatureFile: c.signatureFile || undefined,
        rucPdf: c.rucPdf || undefined,
        sharedAccessKey: c.sharedAccessKey || '',
        notes: c.notes || '',
    })) as Client[];
};

interface AppState {
  clients: Client[];
  tasks: Task[];
  serviceFees: ServiceFeesConfig;
  whatsappTemplates: WhatsAppTemplates;
  businessProfile: BusinessProfile;
  setClients: (clients: Client[] | ((prev: Client[]) => Client[])) => void;
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  loadFromDB: () => Promise<void>;
  isLoaded: boolean;
  hydrateFromCloud: (data: any) => void;
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

export const useAppStore = create<AppState>((set, get) => ({
  clients: [],
  tasks: [],
  serviceFees: INITIAL_SERVICE_FEES,
  whatsappTemplates: defaultWhatsAppTemplates,
  businessProfile: defaultBusinessProfile,
  isLoaded: false,

  setClients: (value) => {
    const newClients = typeof value === 'function' ? value(get().clients) : value;
    const safeClients = sanitizeClients(newClients);
    set({ clients: safeClients });
    db.set('clients', safeClients);
  },

  setTasks: (value) => {
    const newTasks = typeof value === 'function' ? value(get().tasks) : value;
    set({ tasks: newTasks });
    db.set('tasks', newTasks);
  },

  hydrateFromCloud: (data: any) => {
      if (!data || !data.clients) return;
      const safeClients = sanitizeClients(data.clients);
      set({
          clients: safeClients,
          tasks: data.tasks || get().tasks,
          serviceFees: data.serviceFees || get().serviceFees,
          businessProfile: data.businessProfile || get().businessProfile,
      });
  },

  loadFromDB: async () => {
    try {
      const [clients, tasks] = await Promise.all([
        db.get<Client[]>('clients'),
        db.get<Task[]>('tasks')
      ]);
      set({
        clients: clients || mockClients,
        tasks: tasks || mockTasks,
        isLoaded: true
      });
    } catch (error) {
      set({ isLoaded: true, clients: mockClients });
    }
  }
}));
