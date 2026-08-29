import { useEffect, useState } from 'react';

/**
 * Devuelve `true` si el usuario prefiere reducir el movimiento
 * (`prefers-reduced-motion: reduce`). Se usa para desactivar el 3D
 * y las animaciones pesadas por accesibilidad.
 */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return reduced;
}
