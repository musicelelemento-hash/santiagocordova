
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
        isArtisan: !!c.isArtisan,
        establishmentCount: c.establishmentCount || 1,
        jurisdiction: c.jurisdiction || '',
        electronicSignaturePassword: c.electronicSignaturePassword || '',
        signatureFile: c.signatureFile || undefined,
        rucPdf: c.rucPdf || undefined,
        sharedAccessKey: c.sharedAccessKey || '',
        notes: c.notes || '',
        createdAt: c.createdAt || new Date().toISOString()
    })) as Client[];
};

interface AppState {
  clients: Client[];
  tasks: Task[];
  serviceFees: ServiceFeesConfig;
  isLoaded: boolean;
  setClients: (value: Client[] | ((prev: Client[]) => Client[])) => void;
  setTasks: (value: Task[] | ((prev: Task[]) => Task[])) => void;
  loadFromDB: () => Promise<void>;
  hydrateFromCloud: (data: any) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  clients: mockClients, // Iniciar con mock para evitar undefined inicial
  tasks: mockTasks,
  serviceFees: INITIAL_SERVICE_FEES,
  isLoaded: false,

  setClients: (value) => {
    const currentClients = get().clients || [];
    const newClients = typeof value === 'function' ? value(currentClients) : value;
    const safeClients = sanitizeClients(newClients);
    set({ clients: safeClients });
    db.set('clients', safeClients);
  },

  setTasks: (value) => {
    const currentTasks = get().tasks || [];
    const newTasks = typeof value === 'function' ? value(currentTasks) : value;
    set({ tasks: newTasks });
    db.set('tasks', newTasks);
  },

  hydrateFromCloud: (data: any) => {
      if (!data) return;
      const safeClients = sanitizeClients(data.clients || get().clients);
      set({
          clients: safeClients,
          tasks: data.tasks || get().tasks,
          serviceFees: data.serviceFees || get().serviceFees,
      });
  },

  loadFromDB: async () => {
    try {
      const [clients, tasks] = await Promise.all([
        db.get<Client[]>('clients'),
        db.get<Task[]>('tasks')
      ]);
      set({
        clients: Array.isArray(clients) ? clients : mockClients,
        tasks: Array.isArray(tasks) ? tasks : mockTasks,
        isLoaded: true
      });
    } catch (error) {
      console.error("IDB Load Error:", error);
      set({ isLoaded: true, clients: mockClients, tasks: mockTasks });
    }
  }
}));
