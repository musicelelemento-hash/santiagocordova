
import { Client, Task, ClientCategory, TaxRegime, DeclarationStatus, TaskStatus, WebOrder } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Obtiene la URL del backend.
 * Si no hay URL configurada, devuelve null (Modo Offline).
 */
export const getBackendUrl = () => {
    const local = localStorage.getItem('sc_pro_backend_url');
    if (local) return local;
    
    // Si hay variable de entorno, úsala
    if (process.env.GOOGLE_SHEET_SCRIPT_URL && process.env.GOOGLE_SHEET_SCRIPT_URL.startsWith('http')) {
        return process.env.GOOGLE_SHEET_SCRIPT_URL;
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

/**
 * Realiza un backup automático una vez al día.
 * Verifica en localStorage si ya se realizó el backup hoy para evitar redundancia.
 */
export const autoBackupToSheets = async (data: any) => {
    const BACKUP_KEY = 'sc_pro_last_backup_date';
    const today = new Date().toISOString().split('T')[0];
    const lastBackup = localStorage.getItem(BACKUP_KEY);

    if (lastBackup === today) {
        // Backup ya realizado hoy, no es necesario forzar otro "evento" de backup
        // (La sincronización normal sigue ocurriendo en segundo plano)
        return { performed: false, message: 'Backup diario ya completado' };
    }

    try {
        console.log("🔄 Ejecutando Backup Diario Automático...");
        const result = await syncDataToSheet(data);
        
        if (result.status === 'success' || result.status === 'saved') {
            localStorage.setItem(BACKUP_KEY, today);
            console.log("✅ Backup diario registrado con éxito.");
            return { performed: true, message: 'Backup diario completado' };
        }
        return { performed: false, message: 'No se pudo completar el backup' };
    } catch (error) {
        console.error('Error en backup automático:', error);
        return { performed: false, message: 'Error de conexión' };
    }
};
