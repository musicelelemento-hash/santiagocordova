
import { Client, Task, ClientCategory, TaxRegime, DeclarationStatus, TaskStatus, WebOrder } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * URL del script de Google Apps Script (Backend)
 */
const SCRIPT_URL = process.env.GOOGLE_SHEET_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwFApmOIDGorJYz61LlJprB6uQj-YnsxEfg7iHAGsCpSGFGvqp01P46Aew0bbQ_yAqr/exec';

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
        category: Object.values(ClientCategory).includes(c.category) ? c.category : ClientCategory.SuscripcionMensual,
        isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
        declarationHistory: Array.isArray(c.declarationHistory) ? c.declarationHistory : [],
        // New Fields Preservation
        isArtisan: !!c.isArtisan,
        establishmentCount: typeof c.establishmentCount === 'number' ? c.establishmentCount : 1,
        jurisdiction: c.jurisdiction || '',
        electronicSignaturePassword: c.electronicSignaturePassword || '',
        signatureFile: c.signatureFile || undefined,
        rucPdf: c.rucPdf || undefined,
        sharedAccessKey: c.sharedAccessKey || '',
    }));
};

// --- API METHODS ---

export const syncDataToSheet = async (data: any) => {
    if (!SCRIPT_URL) throw new Error("No hay URL de backend configurada.");

    try {
        const response = await fetch(SCRIPT_URL, {
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
        console.error('Error en syncDataToSheet:', error);
        throw error;
    }
};

export const loadDataFromSheet = async () => {
    if (!SCRIPT_URL) throw new Error("No hay URL de backend configurada.");

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'load' })
        });

        const result = await response.json();
        if (result.status === 'success' && result.data) {
            if (result.data.clients) result.data.clients = sanitizeClients(result.data.clients);
            return result;
        } else if (result.status === 'success' && !result.data) {
            console.warn("La base de datos en la nube está vacía.");
            return { status: 'success', data: null };
        }
        throw new Error(result.message || "Error al cargar datos");
    } catch (error: any) {
        console.error("Error en loadDataFromSheet:", error);
        throw error;
    }
};