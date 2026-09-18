import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './useReducedMotion';

/**
 * Scroll engine for the "Landing 3D Lujo" page.
 *
 * Ported from the Claude Design prototype's dc-runtime `Component` class
 * (see `chats/chat1.md` in the design export bundle): a single rAF-throttled
 * scroll loop mutates two CSS custom properties directly on each registered
 * "act" section's DOM node — `--p` (0→1 progress through the act, used for
 * parallax translate/scale/clip-path) and `--q` (an entry/exit ease curve,
 * 0 at both edges of the act and 1 at its center, used for content
 * opacity/translate so text eases in AND out instead of cutting off).
 *
 * This deliberately mutates `style` via refs instead of storing progress in
 * React state — a per-frame `setState` here would re-render the whole tree
 * on every scroll tick, which is exactly the jank the original design chat
 * fought hard to eliminate (see the "un solo WebP animado" / "el hilo
 * principal se congelaba" notes in chat1.md).
 *
 * Also verified empirically for this app (see index.tsx / index.css): there
 * is no internal scrolling container — `<body>`/`<html>` scroll normally —
 * so a plain `window`/`document` scroll listener is correct here. It is
 * still attached with `capture: true` as a defensive measure in case this
 * page is ever embedded inside a scrolling ancestor.
 */

function ramp(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

export interface LujoScrollEngine {
  /** Ref callback to attach to a `[data-act]` section that should get --p/--q. */
  registerAct: (id: string) => (el: HTMLElement | null) => void;
  /** Ref callback to attach to any section that should count for nav "active" sync only. */
  registerNav: (id: string) => (el: HTMLElement | null) => void;
  /** Attach to the thin progress bar under the header. */
  progressRef: React.RefObject<HTMLDivElement>;
  /** Attach to the hero background media (subtle scale/translate on scroll). */
  heroMediaRef: React.RefObject<HTMLImageElement>;
  /** Currently active nav section id, for the pill nav + mobile dock highlight. */
  activeId: string;
  /** True while `prefers-reduced-motion: reduce` is set. */
  reduced: boolean;
}

export function useLujoScroll(): LujoScrollEngine {
  const reduced = usePrefersReducedMotion();
  const actNodes = useRef<Map<string, HTMLElement>>(new Map());
  const navNodes = useRef<Map<string, HTMLElement>>(new Map());
  const progressRef = useRef<HTMLDivElement>(null);
  const heroMediaRef = useRef<HTMLImageElement>(null);
  const activeIdRef = useRef('');
  const [activeId, setActiveId] = useState('');

  const registerAct = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) actNodes.current.set(id, el);
      else actNodes.current.delete(id);
    },
    []
  );
  const registerNav = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) navNodes.current.set(id, el);
      else navNodes.current.delete(id);
    },
    []
  );

  useEffect(() => {
    let ticking = false;
    let rafId = 0;

    const scrollTopOf = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollSpan = () =>
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;

      actNodes.current.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const span = rect.height - vh;
        const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
        el.style.setProperty('--p', reduced ? '0.5' : String(p));
        const edge = 0.24;
        const q = reduced ? 1 : Math.min(ramp(p / edge), ramp((1 - p) / edge));
        el.style.setProperty('--q', String(q));
      });

      if (progressRef.current) {
        const total = scrollSpan();
        progressRef.current.style.width = (total > 0 ? (scrollTopOf() / total) * 100 : 0) + '%';
      }

      if (heroMediaRef.current) {
        const y = Math.min(scrollTopOf(), vh);
        heroMediaRef.current.style.transform = `scale(${1.06 + (y / vh) * 0.14}) translateY(${y * 0.12}px)`;
      }

      // Active nav section: whichever registered section straddles 45% of the viewport.
      const mid = vh * 0.45;
      let newActive = '';
      navNodes.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid && rect.bottom > mid) newActive = id;
      });
      if (newActive !== activeIdRef.current) {
        activeIdRef.current = newActive;
        setActiveId(newActive);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [reduced]);

  return { registerAct, registerNav, progressRef, heroMediaRef, activeId, reduced };
}
