import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Reemplaza el scroll nativo por uno con inercia (Lenis) y lo sincroniza
 * con el ticker de GSAP para que ScrollTrigger quede listo para usarse.
 * Lenis sigue moviendo el scrollTop real, así que cualquier código que
 * lea `window.scrollY` / escuche 'scroll' sigue funcionando igual.
 */
export function useSmoothScroll(enabled: boolean = true) {
    useEffect(() => {
        if (!enabled) return;
        if (typeof window === 'undefined') return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const lenis = new Lenis({
            duration: 1.15,
            easing: (t: number) => Math.min(1, 1 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            touchMultiplier: 1.6,
        });

        lenis.on('scroll', ScrollTrigger.update);

        if (import.meta.env.DEV) {
            (window as any).__lenis = lenis;
            (window as any).__ScrollTrigger = ScrollTrigger;
        }

        const tick = (time: number) => {
            lenis.raf(time * 1000);
        };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        return () => {
            gsap.ticker.remove(tick);
            lenis.destroy();
        };
    }, [enabled]);
}
