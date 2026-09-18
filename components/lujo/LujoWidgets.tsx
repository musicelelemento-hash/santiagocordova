import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Small building blocks shared by `screens/LandingLujoPage.tsx`, ported from
 * the Claude Design prototype's `[data-reveal]` / `[data-count]` /
 * `[data-act-media],[data-hero-media]` behaviors (see `chats/chat1.md` in
 * the design export bundle for the "why").
 */

// ─── REVEAL-ON-SCROLL ───────────────────────────────────────────────────────
// Prototype behavior: content is born visible; if it starts off past 92% of
// the viewport it's set to a hidden (blurred/translated) resting state and
// eased in once it crosses that line — never depends on continuous scroll
// math, so a stalled scroll never leaves it stuck hidden (2.6s safety net).
// Ported here with an IntersectionObserver instead of the prototype's
// per-frame rect check — same guarantee, idiomatic React, no extra work in
// the shared scroll loop.
export const Reveal: React.FC<{
  children: React.ReactNode;
  index?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  style?: React.CSSProperties;
}> = ({ children, index = 0, className, as = 'div', style: extraStyle }) => {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    const safety = window.setTimeout(() => setShown(true), 2600);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [reduced]);

  const delay = (index % 4) * 90;
  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...extraStyle,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(30px) scale(0.985)',
        filter: shown ? 'none' : 'blur(6px)',
        transition: `opacity .95s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 1.05s cubic-bezier(.16,1,.3,1) ${delay}ms, filter .95s ease ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
};

// ─── COUNT-UP ───────────────────────────────────────────────────────────────
export const CountUp: React.FC<{ to: number; suffix?: string; duration?: number }> = ({
  to,
  suffix = '',
  duration = 1600,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref}>
      {val.toLocaleString('es-EC')}
      {suffix}
    </span>
  );
};

// ─── SINGLE-ACTIVE-WEBP MEDIA SWAP ──────────────────────────────────────────
// Prototype behavior (chat1.md — "cinco WebP animados a pantalla completa
// decodificando a la vez bloquean el hilo principal"): every act's media
// starts on its static poster PNG and only swaps to the animated WebP while
// its section is near/in the viewport, swapping back out when it leaves, so
// only one 1080p animated WebP ever decodes at a time. The hero media plays
// immediately (it's the first thing painted) and never swaps back to poster.
export const ActMedia: React.FC<{
  webp: string;
  poster: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
  imgRef?: React.Ref<HTMLImageElement>;
}> = ({ webp, poster, alt = '', className, style, eager, imgRef }) => {
  const localRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (eager) return;
    const img = localRef.current;
    if (!img) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const want = entry.isIntersecting ? webp : poster;
        if (img.getAttribute('src') !== want) img.setAttribute('src', want);
      },
      { rootMargin: '10% 0px' }
    );
    io.observe(img);
    return () => io.disconnect();
  }, [eager, webp, poster]);

  return (
    <img
      ref={(node) => {
        (localRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
        if (typeof imgRef === 'function') imgRef(node);
        else if (imgRef && 'current' in (imgRef as any)) (imgRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
      }}
      src={eager ? webp : poster}
      alt={alt}
      loading={eager ? undefined : 'lazy'}
      // React 18 (this repo's version) doesn't map the camelCase `fetchPriority` prop to the
      // lowercase DOM attribute the way React 19 does, so it's set as a raw attribute here to
      // avoid an "unrecognized DOM prop" warning while still getting the priority hint.
      {...(eager ? { fetchpriority: 'high' } : {})}
      decoding="async"
      className={className}
      style={style}
    />
  );
};
