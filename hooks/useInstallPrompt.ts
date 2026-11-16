import { useCallback, useEffect, useState } from 'react';

/**
 * Instalación de la app en el celular (PWA "como APK").
 *
 * Chrome/Edge en Android disparan `beforeinstallprompt`; lo guardamos para
 * mostrar nuestro propio botón en vez del mini-banner del navegador.
 * En iPhone no existe ese evento: hay que guiar al usuario con Compartir →
 * "Añadir a pantalla de inicio".
 */
export function useInstallPrompt() {
    const [evento, setEvento] = useState<any>(null);
    const [instalada, setInstalada] = useState(false);

    const standalone = (() => {
        try {
            return (
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true
            );
        } catch {
            return false;
        }
    })();

    const esIOS = (() => {
        try {
            return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
        } catch {
            return false;
        }
    })();

    useEffect(() => {
        const alPoderInstalar = (e: Event) => {
            e.preventDefault();
            setEvento(e);
        };
        const alInstalar = () => {
            setEvento(null);
            setInstalada(true);
        };
        window.addEventListener('beforeinstallprompt', alPoderInstalar as EventListener);
        window.addEventListener('appinstalled', alInstalar);
        return () => {
            window.removeEventListener('beforeinstallprompt', alPoderInstalar as EventListener);
            window.removeEventListener('appinstalled', alInstalar);
        };
    }, []);

    const instalar = useCallback(async () => {
        if (!evento) return false;
        try {
            await evento.prompt();
            const eleccion = await evento.userChoice;
            const acepto = eleccion?.outcome === 'accepted';
            if (acepto) setEvento(null);
            return acepto;
        } catch {
            return false;
        }
    }, [evento]);

    const puedeInstalar = !!evento && !standalone && !instalada;
    const esApp = standalone || instalada;

    return { puedeInstalar, instalar, esIOS, esApp };
}
