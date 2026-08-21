/**
 * Backend de Facturación (Laravel/Render) — configuración centralizada.
 * El token vive SOLO en VITE_FACTURACION_API_TOKEN (.env.local local / Environment Variables en Vercel).
 * No hardcodear el token en este archivo ni en ningún componente.
 */
export const FACTURACION_API_TOKEN: string = (import.meta.env?.VITE_FACTURACION_API_TOKEN as string) || '';

export const facturacionAuthHeaders = (): Record<string, string> =>
    FACTURACION_API_TOKEN ? { 'Authorization': FACTURACION_API_TOKEN } : {};
