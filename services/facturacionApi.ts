/**
 * Backend de Facturación (Laravel/Render) — configuración centralizada.
 * El token se obtiene de localStorage, variable de entorno VITE_FACTURACION_API_TOKEN o token por defecto del servidor.
 */
export const DEFAULT_FACTURACION_API_TOKEN = '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir';

export const isValidApiToken = (token: any): boolean => {
  if (!token || typeof token !== 'string') return false;
  const cleaned = token.trim();
  return cleaned.length >= 10 && cleaned !== 'undefined' && cleaned !== 'null' && cleaned !== '[object Object]';
};

export const getFacturacionApiToken = (): string => {
  if (typeof window !== 'undefined') {
    const localToken = localStorage.getItem('sc_facturacion_api_token');
    if (isValidApiToken(localToken)) return (localToken as string).trim();
  }
  const envToken = import.meta.env?.VITE_FACTURACION_API_TOKEN as string;
  if (isValidApiToken(envToken)) return envToken.trim();
  return DEFAULT_FACTURACION_API_TOKEN;
};

export const setFacturacionApiToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    const valid = isValidApiToken(token) ? token.trim() : DEFAULT_FACTURACION_API_TOKEN;
    localStorage.setItem('sc_facturacion_api_token', valid);
  }
};

export const FACTURACION_API_TOKEN: string = getFacturacionApiToken();

export const facturacionAuthHeaders = (): Record<string, string> => {
  const token = getFacturacionApiToken();
  return { 'Authorization': token || DEFAULT_FACTURACION_API_TOKEN };
};
