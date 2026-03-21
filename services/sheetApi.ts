/// <reference types="vite/client" />
import { Client, Task, TaxRegime, DeclarationStatus, TaskStatus, WebOrder } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Obtiene la URL del backend.
 * Si no hay URL configurada, devuelve null (Modo Offline).
 */
export const getBackendUrl = () => {
    const local = localStorage.getItem('sc_pro_backend_url');
    if (local) return local;

    // Si hay variable de entorno, úsala
    if (import.meta.env.VITE_GOOGLE_SCRIPT_URL && import.meta.env.VITE_GOOGLE_SCRIPT_URL.startsWith('http')) {
        return import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    }

    // Retorna null por defecto para evitar errores CORS con URLs caducadas
    return null;
};

// --- SANITIZATION LAYER ---
const sanitizeClients = (rawClients: any[]): Client[] => {
    if (!Array.isArray(rawClients)) return [];
    return rawClients.map(c => ({
        id: c.id || uuidv4(),
        ruc: c.ruc || '',
        name: c.name || 'Cliente Sin Nombre',
        tradeName: c.tradeName || '',
        sriPassword: c.sriPassword || '',
        email: c.email || '',
        address: c.address || '',
        economicActivity: c.economicActivity || '',
        phones: Array.isArray(c.phones) ? c.phones : [''],
        notes: c.notes || '',
        regime: Object.values(TaxRegime).includes(c.regime) ? c.regime : TaxRegime.General,
        declarationHistory: Array.isArray(c.declarationHistory) ? c.declarationHistory : [],
        taxProfile: c.taxProfile || {
            ivaFrequency: 'Mensual',
            requiresAnnualRenta: false,
            requiresAnexosGastos: false,
            hasActiveDevolucionIva: false,
            requiresIce: false,
            requiresAnexoPvp: false
        },
        // New Fields Preservation
        isDeleted: !!c.isDeleted,
        isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
        customServiceFee: typeof c.customServiceFee === 'number' ? c.customServiceFee : undefined,
        feeStructure: c.feeStructure || undefined,
        rentaCategory: c.rentaCategory || undefined,
        annualRentaStatus: c.annualRentaStatus || undefined,
        iessPassword: c.iessPassword || '',
        signatureExpirationDate: c.signatureExpirationDate || '',
        isArtisan: !!c.isArtisan,
        establishmentCount: typeof c.establishmentCount === 'number' ? c.establishmentCount : 1,
        jurisdiction: c.jurisdiction || '',
        electronicSignaturePassword: c.electronicSignaturePassword || '',
        signatureFile: c.signatureFile || undefined,
        rucPdf: c.rucPdf || undefined,
        rucCertificate: c.rucCertificate || undefined,
        sharedAccessKey: c.sharedAccessKey || '',
    }));
};

const sanitizeTasks = (rawTasks: any[]): Task[] => {
    if (!Array.isArray(rawTasks)) return [];
    return rawTasks.map(t => ({
        id: t.id || uuidv4(),
        title: t.title || 'Tarea sin título',
        description: t.description || '',
        clientId: t.clientId || undefined,
        nonClientName: t.nonClientName || undefined,
        nonClientRuc: t.nonClientRuc || undefined,
        sriPassword: t.sriPassword || undefined,
        dueDate: t.dueDate || new Date().toISOString(),
        status: Object.values(TaskStatus).includes(t.status) ? t.status : TaskStatus.Pendiente,
        cost: typeof t.cost === 'number' ? t.cost : 0,
        advancePayment: typeof t.advancePayment === 'number' ? t.advancePayment : 0,
    }));
};

const sanitizeWebOrders = (rawOrders: any[]): WebOrder[] => {
    if (!Array.isArray(rawOrders)) return [];
    return rawOrders.map(o => ({
        id: o.id || uuidv4(),
        clientName: o.clientName || '',
        clientEmail: o.clientEmail || '',
        clientPhone: o.clientPhone || '',
        clientRuc: o.clientRuc || '',
        items: Array.isArray(o.items) ? o.items : [],
        total: typeof o.total === 'number' ? o.total : 0,
        status: ['pending', 'contacted', 'completed', 'rejected'].includes(o.status) ? o.status : 'pending',
        createdAt: o.createdAt || new Date().toISOString(),
    }));
};

// --- API METHODS ---

export const syncDataToSheet = async (data: any) => {
    const url = getBackendUrl();
    // Modo Offline Silencioso
    if (!url) {
        console.log("Modo Offline: Datos guardados localmente.");
        return { status: 'offline', message: 'Guardado local' };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'sync', data: data })
        });

        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || "Error en el servidor");
        return result;
    } catch (error: any) {
        console.warn('Fallo sincronización nube, manteniendo local:', error);
        // No lanzamos error para no interrumpir al usuario, solo retornamos estado error/offline
        return { status: 'error', message: error.message };
    }
};

export const loadDataFromSheet = async () => {
    const url = getBackendUrl();
    if (!url) {
        console.log("Iniciando en Modo Offline (Sin URL configurada)");
        return { status: 'offline', data: null };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'load' })
        });

        const result = await response.json();
        if (result.status === 'success' && result.data) {
            if (result.data.clients) result.data.clients = sanitizeClients(result.data.clients);
            if (result.data.tasks) result.data.tasks = sanitizeTasks(result.data.tasks);
            if (result.data.webOrders) result.data.webOrders = sanitizeWebOrders(result.data.webOrders);
            return result;
        } else if (result.status === 'success' && !result.data) {
            return { status: 'success', data: null };
        }
        throw new Error(result.message || "Error al cargar datos");
    } catch (error: any) {
        console.warn('No se pudo cargar desde la nube:', error);
        // Fallback gracefully
        return { status: 'offline', data: null };
    }
};
