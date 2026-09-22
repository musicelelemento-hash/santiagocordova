/**
 * Utilidades de gestión de ventanas y pantallas independientes (Pop-out windows).
 * Permite abrir el expediente de un cliente en una ventana dedicada del navegador,
 * ideal para estaciones de trabajo con doble monitor o multitarea fluida sin perder el
 * contexto de la Matriz de Declaraciones ni recargar la pestaña principal.
 */

export const openClientInNewWindow = (clientId: string, initialTab?: string): Window | null => {
    if (typeof window === 'undefined') return null;

    const tabParam = initialTab ? `&initialTab=${encodeURIComponent(initialTab)}` : '';
    const url = `/dashboard?screen=clients&clientId=${encodeURIComponent(clientId)}&standalone=true${tabParam}`;

    // Dimensiones óptimas para un expediente completo (92% de pantalla disponible o hasta 1500x950)
    const availWidth = window.screen.availWidth || window.innerWidth;
    const availHeight = window.screen.availHeight || window.innerHeight;
    
    const width = Math.min(1500, Math.floor(availWidth * 0.92));
    const height = Math.min(950, Math.floor(availHeight * 0.92));
    const left = Math.max(0, Math.floor((availWidth - width) / 2));
    const top = Math.max(0, Math.floor((availHeight - height) / 2));

    const windowFeatures = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
        'resizable=yes',
        'scrollbars=yes'
    ].join(',');

    const win = window.open(url, `sc_client_${clientId}`, windowFeatures);
    if (win) {
        win.focus();
    }
    return win;
};
