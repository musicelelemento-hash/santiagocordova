import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';

/**
 * El «lazo» de la portada: una línea de luz que nace debajo del hero, baja
 * por los márgenes cruzando de un lado al otro en cada cambio de sección y
 * termina en la llamada final. Se va dibujando con el scroll; la punta lleva
 * una chispa y cada sección que alcanza enciende su nudo.
 *
 * Va encima de las secciones (z 4) pero debajo del menú (z 90), sin recibir
 * clics. La geometría se recalcula sólo cuando cambia el tamaño de la página
 * (ResizeObserver); el scroll únicamente mueve dashoffset y la chispa.
 */

interface Geo {
  W: number;
  H: number;
  d: string;
  nudos: { x: number; y: number }[];
  fin: { x: number; y: number };
}

const MAX_CONTENIDO = 1160;

export const HiloRecorrido: React.FC<{ raiz: React.RefObject<HTMLElement> }> = ({ raiz }) => {
  const reducido = usePrefersReducedMotion();
  const [geo, setGeo] = useState<Geo | null>(null);
  const trazoRef = useRef<SVGPathElement>(null);
  const brilloRef = useRef<SVGPathElement>(null);
  const puntaRef = useRef<SVGGElement>(null);
  const nudosRef = useRef<(SVGGElement | null)[]>([]);

  const medir = useCallback(() => {
    const root = raiz.current;
    if (!root) return;
    const secciones = Array.from(root.querySelectorAll<HTMLElement>(':scope > section'));
    if (secciones.length < 3) return;
    const W = root.clientWidth;
    const H = root.scrollHeight;
    const vh = window.innerHeight;
    const margen = W >= 1100 ? Math.max(26, (W - MAX_CONTENIDO) / 4) : W >= 768 ? 20 : 9;
    const xs = [margen, W - margen];

    const hero = secciones[0];
    const cta = secciones[secciones.length - 1];
    const medio = secciones.slice(1, -1);

    // Nace al pie del hero, por debajo de los botones y la lista de beneficios.
    const inicio = { x: W / 2, y: hero.offsetTop + hero.offsetHeight - 16 };
    // Cuánto ocupa el cruce de un lado al otro (más largo en pantallas anchas).
    const cruce = Math.min(vh * 0.55, 420);

    let d = `M${inicio.x.toFixed(1)} ${inicio.y.toFixed(1)}`;
    let prev = inicio;
    const nudos: Geo['nudos'] = [];
    const curva = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const k = (b.y - a.y) * 0.55;
      return `C${a.x.toFixed(1)} ${(a.y + k).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - k).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    };

    medio.forEach((s, i) => {
      const x = xs[i % 2];
      const top = s.offsetTop;
      const bottom = top + s.offsetHeight;
      const entra = { x, y: top + Math.min(cruce * 0.5, s.offsetHeight * 0.25) };
      const sale = { x, y: Math.max(entra.y + 40, bottom - Math.min(cruce * 0.5, s.offsetHeight * 0.25)) };
      d += curva(prev, entra);
      d += `L${sale.x.toFixed(1)} ${sale.y.toFixed(1)}`;
      nudos.push(entra);
      prev = sale;
    });
    const fin = { x: W / 2, y: cta.offsetTop + Math.min(70, cta.offsetHeight * 0.1) };
    d += curva(prev, fin);
    setGeo({ W, H, d, nudos, fin });
  }, [raiz]);

  // Medir al montar y cada vez que cambie el tamaño de la página.
  useEffect(() => {
    const root = raiz.current;
    if (!root) return;
    let raf = 0;
    const pedir = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };
    pedir();
    const ro = new ResizeObserver(pedir);
    ro.observe(root);
    window.addEventListener('resize', pedir);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', pedir);
    };
  }, [raiz, medir]);

  // Dibujar según el scroll.
  useEffect(() => {
    const trazo = trazoRef.current;
    const root = raiz.current;
    if (!geo || !trazo || !root) return;
    const L = trazo.getTotalLength();
    // Muestras (largo, y) para pasar de «altura en la página» a «largo dibujado».
    // El trazo siempre baja, así que y crece con el largo.
    const N = 600;
    const muestras: { l: number; y: number; x: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const l = (L * i) / N;
      const p = trazo.getPointAtLength(l);
      muestras.push({ l, y: p.y, x: p.x });
    }
    const brillo = brilloRef.current;
    for (const t of [trazo, brillo]) {
      if (!t) continue;
      t.style.strokeDasharray = `${L} ${L}`;
    }

    if (reducido) {
      for (const t of [trazo, brillo]) if (t) t.style.strokeDashoffset = '0';
      nudosRef.current.forEach((n) => n?.classList.add('on'));
      return;
    }

    let raf = 0;
    const pintar = () => {
      raf = 0;
      const rootTop = root.getBoundingClientRect().top + window.scrollY;
      const meta = window.scrollY + window.innerHeight * 0.6 - rootTop;
      // Búsqueda binaria en las muestras.
      let lo = 0;
      let hi = N;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (muestras[mid].y < meta) lo = mid + 1;
        else hi = mid;
      }
      const m = muestras[Math.min(lo, N)];
      const largo = meta <= muestras[0].y ? 0 : m.l;
      for (const t of [trazo, brillo]) if (t) t.style.strokeDashoffset = `${L - largo}`;
      const punta = puntaRef.current;
      if (punta) {
        punta.style.transform = `translate(${m.x}px, ${m.y}px)`;
        punta.style.opacity = largo > 0 && largo < L - 1 ? '1' : '0';
      }
      geo.nudos.forEach((n, i) => nudosRef.current[i]?.classList.toggle('on', n.y <= meta));
      nudosRef.current[geo.nudos.length]?.classList.toggle('on', largo >= L - 1);
    };
    const alScroll = () => {
      if (!raf) raf = requestAnimationFrame(pintar);
    };
    pintar();
    window.addEventListener('scroll', alScroll, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', alScroll, { capture: true });
    };
  }, [geo, raiz, reducido]);

  if (!geo) return null;
  return (
    <svg
      aria-hidden="true"
      className="hilo-recorrido"
      width={geo.W}
      height={geo.H}
      viewBox={`0 0 ${geo.W} ${geo.H}`}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, pointerEvents: 'none', overflow: 'visible' }}
    >
      <style>{`
        .hilo-recorrido .nudo circle { transition: opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1); transform-box: fill-box; transform-origin: center; }
        .hilo-recorrido .nudo .anillo { opacity: 0; transform: scale(.3); }
        .hilo-recorrido .nudo .centro { opacity: .25; }
        .hilo-recorrido .nudo.on .anillo { opacity: .9; transform: scale(1); }
        .hilo-recorrido .nudo.on .centro { opacity: 1; }
        .hilo-recorrido .punta-halo { animation: hiloLatido 1.6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
        @keyframes hiloLatido { from { transform: scale(.75); opacity: .55; } to { transform: scale(1.15); opacity: .9; } }
        @media (prefers-reduced-motion: reduce) { .hilo-recorrido .punta-halo { animation: none; } }
      `}</style>
      <defs>
        <linearGradient id="hiloColor" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={geo.H}>
          <stop offset="0" stopColor="#04B17B" />
          <stop offset="0.3" stopColor="#2B6AFF" />
          <stop offset="0.55" stopColor="#04B17B" />
          <stop offset="0.8" stopColor="#6E9BFF" />
          <stop offset="1" stopColor="#04B17B" />
        </linearGradient>
        <radialGradient id="hiloPunta">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#4edea3" stopOpacity="0.6" />
          <stop offset="1" stopColor="#04B17B" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* El camino que falta, apenas insinuado */}
      <path d={geo.d} fill="none" stroke="rgba(110,155,255,0.07)" strokeWidth={1} />
      {/* Halo ancho y trazo fino: lo ya recorrido */}
      <path ref={brilloRef} d={geo.d} fill="none" stroke="url(#hiloColor)" strokeOpacity={0.18} strokeWidth={7} strokeLinecap="round" />
      <path ref={trazoRef} d={geo.d} fill="none" stroke="url(#hiloColor)" strokeWidth={1.6} strokeLinecap="round" />
      {[...geo.nudos, geo.fin].map((n, i) => (
        <g key={i} ref={(el) => (nudosRef.current[i] = el)} className="nudo">
          <circle className="anillo" cx={n.x} cy={n.y} r={i === geo.nudos.length ? 11 : 7} fill="none" stroke="#4edea3" strokeWidth={1.2} />
          <circle className="centro" cx={n.x} cy={n.y} r={i === geo.nudos.length ? 4.5 : 3} fill="#dbe6ff" />
        </g>
      ))}
      <g ref={puntaRef} style={{ opacity: 0 }}>
        <circle className="punta-halo" r={16} fill="url(#hiloPunta)" />
        <circle r={2.6} fill="#ffffff" />
      </g>
    </svg>
  );
};
