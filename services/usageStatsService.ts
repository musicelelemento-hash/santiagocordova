import { Screen } from '../types';

const STORAGE_KEY_USAGE = 'sc_module_usage_stats';
const STORAGE_KEY_DEFAULT_SCREEN = 'sc_default_start_screen';

export interface ModuleUsageStat {
    screen: Screen;
    count: number;
    lastVisited: string;
}

/**
 * Obtiene el mapa completo de estadísticas de uso por pantalla/módulo
 */
export const getUsageStats = (): Record<string, ModuleUsageStat> => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_USAGE);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
};

/**
 * Registra una visita a un módulo o pantalla
 */
export const recordScreenVisit = (screen: Screen): void => {
    if (!screen) return;
    try {
        const stats = getUsageStats();
        const current = stats[screen] || { screen, count: 0, lastVisited: new Date().toISOString() };
        stats[screen] = {
            screen,
            count: current.count + 1,
            lastVisited: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(stats));
    } catch (e) {
        console.warn('Error saving screen visit:', e);
    }
};

/**
 * Retorna los módulos más utilizados ordenados de mayor a menor frecuencia
 */
export const getMostUsedScreens = (limit: number = 5): ModuleUsageStat[] => {
    const stats = getUsageStats();
    return Object.values(stats)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
};

/**
 * Obtiene la pantalla de inicio configurada (por defecto 'declaraciones' a pedido del usuario)
 */
export const getDefaultStartScreen = (): Screen => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_DEFAULT_SCREEN) as Screen | null;
        if (saved) return saved;
    } catch {}
    return 'declaraciones';
};

/**
 * Establece la pantalla de inicio predeterminada
 */
export const setDefaultStartScreen = (screen: Screen): void => {
    try {
        localStorage.setItem(STORAGE_KEY_DEFAULT_SCREEN, screen);
    } catch (e) {
        console.warn('Error saving default start screen:', e);
    }
};
