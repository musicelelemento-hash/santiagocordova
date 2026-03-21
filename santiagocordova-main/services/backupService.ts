
import { Client, Task, ServiceFeesConfig, ReminderConfig, WebOrder } from '../types';

export interface BackupData {
    version: string;
    timestamp: string;
    clients: Client[];
    tasks: Task[];
    serviceFees: ServiceFeesConfig;
    reminderConfig: ReminderConfig;
    sriCredentials: Record<string, string>;
    webOrders: WebOrder[];
}

/**
 * Generates and downloads a JSON backup file containing the entire application state.
 */
export const generateBackupFile = (data: BackupData) => {
    try {
        const fileName = `SC_PRO_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error("Backup generation failed:", error);
        throw new Error("No se pudo generar el archivo de respaldo.");
    }
};

/**
 * Parses and validates a backup JSON file.
 */
export const parseBackupFile = async (file: File): Promise<BackupData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                // Basic structural validation
                if (!data.version || !Array.isArray(data.clients) || !data.serviceFees) {
                    throw new Error("El archivo no tiene un formato de respaldo válido (SC Pro).");
                }
                
                resolve(data);
            } catch (error: any) {
                reject(new Error("Error al leer el archivo: " + error.message));
            }
        };
        
        reader.onerror = () => reject(new Error("Error de lectura de archivo."));
        reader.readAsText(file);
    });
};
