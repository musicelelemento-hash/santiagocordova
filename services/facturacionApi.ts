/**
 * Backend de Facturación (Laravel/Render) — configuración centralizada.
 * El token se obtiene de localStorage, variable de entorno VITE_FACTURACION_API_TOKEN o token por defecto del servidor.
 */
export const DEFAULT_FACTURACION_API_TOKEN = '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir';

export const getFacturacionApiToken = (): string => {
  if (typeof window !== 'undefined') {
    const localToken = localStorage.getItem('sc_facturacion_api_token');
    if (localToken && localToken.trim()) return localToken.trim();
  }
  const envToken = import.meta.env?.VITE_FACTURACION_API_TOKEN as string;
  if (envToken && envToken.trim()) return envToken.trim();
  return DEFAULT_FACTURACION_API_TOKEN;
};

export const setFacturacionApiToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sc_facturacion_api_token', token.trim());
  }
};

export const FACTURACION_API_TOKEN: string = getFacturacionApiToken();

export const facturacionAuthHeaders = (): Record<string, string> => {
  const token = getFacturacionApiToken();
  return token ? { 'Authorization': token } : {};
};
