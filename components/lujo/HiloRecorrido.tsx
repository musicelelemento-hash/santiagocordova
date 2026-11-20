import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/useReducedMotion';

/**
 * El «lazo» de la portada: una línea de luz que nace debajo del hero, baja
 * por los márgenes ondulando, cruza de un lado al otro en cada cambio de
 * sección dando una vuelta (un rulo) y termina en la llamada final. Se va
 * dibujando con el scroll; la punta es una chispa con estela y cada sección
 * que alcanza enciende su nudo.
 *
 * Va encima de las secciones (z 4) pero debajo del menú (z 90), sin recibir
 * clics. La geometría se recalcula sólo cuando cambia el tamaño de la página
 * (ResizeObserver); el scroll únicamente mueve dashoffset y la chispa.
 */

interface P {
  x: number;
  y: number;
}

/** Un tramo del trazo: comando SVG desde `desde`, y hasta qué altura de scroll («v») lo cubre. */
interface Tramo {
  desde: P;
  cmd: string;
  v: number;
}

interface Geo {
  W: number;
  H: number;
  d: string;
  tramos: Tramo[];
  v0: number;
  nudos: { x: number; y: number; nombre: string; lado: 0 | 1 }[];
  conNombres: boolean;
  fin: P;
}

const MAX_CONTENIDO = 1160;
const ESTELA = 170; // largo de la estela de luz detrás de la chispa (px)

/** Nombre de cada parada: `data-parada` de la sección, o éste según su id. */
const PARADAS: Record<string, string> = {
  blindaje: 'Blindaje',
  sistema: 'El sistema',
  herramientas: 'Herramientas',
  resultados: 'Resultados',
  cobertura: 'Cobertura',
  raices: 'El Oro',
  criterio: 'Criterio',
  servicios: 'Servicios',
  faq: 'Preguntas',
};

const f = (n: number) => n.toFixed(1);
const unidad = (a: P, b: P): P => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

export const HiloRecorrido: React.FC<{ raiz: React.RefObject<HTMLElement> }> = ({ raiz }) => {
  const reducido = usePrefersReducedMotion();
  const [geo, setGeo] = useState<Geo | null>(null);
  const trazoRef = useRef<SVGPathElement>(null);
  const brilloRef = useRef<SVGPathElement>(null);
  const estelaRef = useRef<SVGPathElement>(null);
  const medidorRef = useRef<SVGPathElement>(null);
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
    const vaiven = W >= 1100 ? Math.min(18, margen * 0.35) : 5; // cuánto ondula en el margen
    const radio = Math.max(24, Math.min(62, W * 0.045)); // tamaño de cada vuelta

    const hero = secciones[0];
    const cta = secciones[secciones.length - 1];
    const medio = secciones.slice(1, -1);

    // Nace al pie del hero, por debajo de los botones y la lista de beneficios.
    const inicio: P = { x: W / 2, y: hero.offsetTop + hero.offsetHeight - 16 };
    const cruce = Math.min(vh * 0.55, 420);

    const tramos: Tramo[] = [];
    let prev = inicio;
    const agregar = (cmd: string, fin: P, v: number) => {
      tramos.push({ desde: prev, cmd, v });
      prev = fin;
    };

    /**
     * Cruce de `prev` a `b` con una vuelta (rulo) en el camino. El rulo es una
     * cúbica cuyos controles se cruzan; los tramos que llegan y salen siguen su
     * tangente para que la línea no quiebre. Mientras se recorre el rulo, el
     * scroll avanza `giro` px: la chispa da la vuelta sin apurarse.
     */
    const cruzar = (b: P) => {
      const a = prev;
      const dir = Math.sign(b.x - a.x) || 1;
      const dy = b.y - a.y;
      const r = Math.min(radio, Math.max(14, dy * 0.12));
      const c = { x: (a.x + b.x) / 2, y: a.y + dy * 0.3 };
      const m1 = { x: c.x - dir * r * 0.7, y: c.y - r * 0.15 };
      const m2 = { x: c.x + dir * r * 0.7, y: c.y + r * 0.15 };
      const k1 = { x: c.x + dir * r * 2.4, y: c.y + r * 2.0 };
      const k2 = { x: c.x - dir * r * 2.4, y: c.y + r * 2.0 };
      const uIn = unidad(m1, k1);
      const uOut = unidad(k2, m2);
      const l1 = Math.min(160, Math.hypot(m1.x - a.x, m1.y - a.y) * 0.4);
      const l2 = Math.min(160, Math.hypot(b.x - m2.x, b.y - m2.y) * 0.4);
      const giro = Math.min(r * 4.5, dy * 0.4);
      agregar(`C${f(a.x)} ${f(a.y + (m1.y - a.y) * 0.55)} ${f(m1.x - uIn.x * l1)} ${f(m1.y - uIn.y * l1)} ${f(m1.x)} ${f(m1.y)}`, m1, m1.y);
      agregar(`C${f(k1.x)} ${f(k1.y)} ${f(k2.x)} ${f(k2.y)} ${f(m2.x)} ${f(m2.y)}`, m2, m1.y + giro);
      agregar(`C${f(m2.x + uOut.x * l2)} ${f(m2.y + uOut.y * l2)} ${f(b.x)} ${f(b.y - (b.y - m2.y) * 0.5)} ${f(b.x)} ${f(b.y)}`, b, b.y);
    };

    const nudos: Geo['nudos'] = [];
    medio.forEach((s, i) => {
      const x = xs[i % 2];
      const top = s.offsetTop;
      const bottom = top + s.offsetHeight;
      const entra = { x, y: top + Math.min(cruce * 0.5, s.offsetHeight * 0.25) };
      const sale = { x, y: Math.max(entra.y + 40, bottom - Math.min(cruce * 0.5, s.offsetHeight * 0.25)) };
      cruzar(entra);
      // Baja por el margen ondulando suave, no en línea recta.
      const h = sale.y - entra.y;
      const lado = i % 2 === 0 ? 1 : -1;
      agregar(`C${f(x + vaiven * lado)} ${f(entra.y + h / 3)} ${f(x - vaiven * lado)} ${f(entra.y + (2 * h) / 3)} ${f(sale.x)} ${f(sale.y)}`, sale, sale.y);
      nudos.push({ ...entra, nombre: s.dataset.parada || PARADAS[s.id] || '', lado: (i % 2) as 0 | 1 });
    });
    const fin = { x: W / 2, y: cta.offsetTop + Math.min(70, cta.offsetHeight * 0.1) };
    cruzar(fin);

    const d = `M${f(inicio.x)} ${f(inicio.y)}` + tramos.map((t) => t.cmd).join('');
    // Los nombres van de costado, en el margen: sólo si hay margen para ellos.
    setGeo({ W, H, d, tramos, v0: inicio.y, nudos, fin, conNombres: W >= 1100 });
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
    const medidor = medidorRef.current;
    const root = raiz.current;
    if (!geo || !trazo || !medidor || !root) return;
    const L = trazo.getTotalLength();
    // Anclas (altura de scroll → largo dibujado), una por tramo. Entre dos
    // anclas se interpola: así el rulo, que sube y baja, avanza parejo.
    const anclas: { v: number; l: number }[] = [{ v: geo.v0, l: 0 }];
    let acumulado = 0;
    for (const t of geo.tramos) {
      medidor.setAttribute('d', `M${f(t.desde.x)} ${f(t.desde.y)}${t.cmd}`);
      acumulado += medidor.getTotalLength();
      anclas.push({ v: Math.max(t.v, anclas[anclas.length - 1].v + 1), l: Math.min(acumulado, L) });
    }
    const brillo = brilloRef.current;
    const estela = estelaRef.current;
    for (const t of [trazo, brillo]) if (t) t.style.strokeDasharray = `${L} ${L}`;
    if (estela) estela.style.strokeDasharray = `${ESTELA} ${L + ESTELA}`;

    if (reducido) {
      for (const t of [trazo, brillo]) if (t) t.style.strokeDashoffset = '0';
      if (estela) estela.style.opacity = '0';
      nudosRef.current.forEach((n) => n?.classList.add('on'));
      return;
    }

    const largoPara = (meta: number) => {
      if (meta <= anclas[0].v) return 0;
      for (let i = 1; i < anclas.length; i++) {
        const a = anclas[i - 1];
        const b = anclas[i];
        if (meta < b.v) return a.l + ((b.l - a.l) * (meta - a.v)) / (b.v - a.v);
      }
      return L;
    };

    let raf = 0;
    let llego = false;
    const pintar = () => {
      raf = 0;
      const rootTop = root.getBoundingClientRect().top + window.scrollY;
      const meta = window.scrollY + window.innerHeight * 0.6 - rootTop;
      const largo = largoPara(meta);
      for (const t of [trazo, brillo]) if (t) t.style.strokeDashoffset = `${L - largo}`;
      if (estela) estela.style.strokeDashoffset = `${ESTELA - largo}`;
      const punta = puntaRef.current;
      if (punta) {
        const p = trazo.getPointAtLength(largo);
        punta.style.transform = `translate(${p.x}px, ${p.y}px)`;
        punta.style.opacity = largo > 0 && largo < L - 1 ? '1' : '0';
      }
      geo.nudos.forEach((n, i) => nudosRef.current[i]?.classList.toggle('on', n.y <= meta));
      const alFinal = largo >= L - 1;
      nudosRef.current[geo.nudos.length]?.classList.toggle('on', alFinal);
      // Al llegar al final, el lazo «anuda» y el botón de la llamada final brilla una vez.
      if (alFinal && !llego) {
        const boton = root.querySelector<HTMLElement>('[data-cta-final]');
        if (boton) {
          boton.classList.remove('lujo-cta-brillo');
          void boton.offsetWidth; // reinicia la animación
          boton.classList.add('lujo-cta-brillo');
        }
      }
      llego = alFinal;
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
        .hilo-recorrido .nombre { opacity: 0; transition: opacity .6s ease .15s; }
        .hilo-recorrido .nudo.on .nombre { opacity: .85; }
        .hilo-recorrido .estallido { opacity: 0; transform-box: fill-box; transform-origin: center; }
        .hilo-recorrido .nudo.on .estallido { animation: hiloEstallido 1.5s cubic-bezier(.16,1,.3,1) 1 both; }
        .hilo-recorrido .nudo.on .estallido + .estallido { animation-delay: .25s; }
        @keyframes hiloEstallido { from { transform: scale(.3); opacity: .95; } to { transform: scale(5); opacity: 0; } }
        .hilo-recorrido .punta-halo { animation: hiloLatido 1.6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
        @keyframes hiloLatido { from { transform: scale(.75); opacity: .55; } to { transform: scale(1.15); opacity: .9; } }
        @media (prefers-reduced-motion: reduce) { .hilo-recorrido .punta-halo, .hilo-recorrido .nudo.on .estallido { animation: none; } }
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
      <path ref={trazoRef} d={geo.d} fill="none" stroke="url(#hiloColor)" strokeWidth={1.8} strokeLinecap="round" />
      {/* Estela: el último tramo recorrido, más brillante, como la cola de un cometa */}
      <path ref={estelaRef} d={geo.d} fill="none" stroke="#c9f7e4" strokeOpacity={0.85} strokeWidth={2.6} strokeLinecap="round" />
      {/* Sólo para medir tramos; no se ve */}
      <path ref={medidorRef} fill="none" stroke="none" />
      {geo.nudos.map((n, i) => (
        <g key={i} ref={(el) => (nudosRef.current[i] = el)} className="nudo">
          <circle className="anillo" cx={n.x} cy={n.y} r={7} fill="none" stroke="#4edea3" strokeWidth={1.2} />
          <circle className="centro" cx={n.x} cy={n.y} r={3} fill="#dbe6ff" />
          {geo.conNombres && n.nombre && (
            // De costado, pegado a la línea y dentro del margen (rotate 90: la letra queda a la derecha de la base).
            <text
              className="nombre"
              transform={`translate(${n.lado === 0 ? n.x + 9 : n.x - 20} ${n.y + 16}) rotate(90)`}
              fontSize={11}
              fontWeight={600}
              letterSpacing="0.02em"
              fill="#a9bcdf"
              style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}
            >
              {n.nombre}
            </text>
          )}
        </g>
      ))}
      <g ref={(el) => (nudosRef.current[geo.nudos.length] = el)} className="nudo">
        <circle className="estallido" cx={geo.fin.x} cy={geo.fin.y} r={10} fill="none" stroke="#4edea3" strokeWidth={1.4} />
        <circle className="estallido" cx={geo.fin.x} cy={geo.fin.y} r={10} fill="none" stroke="#6E9BFF" strokeWidth={1.2} />
        <circle className="anillo" cx={geo.fin.x} cy={geo.fin.y} r={11} fill="none" stroke="#4edea3" strokeWidth={1.4} />
        <circle className="centro" cx={geo.fin.x} cy={geo.fin.y} r={4.5} fill="#dbe6ff" />
      </g>
      <g ref={puntaRef} style={{ opacity: 0 }}>
        <circle className="punta-halo" r={24} fill="url(#hiloPunta)" />
        <circle r={3.2} fill="#ffffff" />
      </g>
    </svg>
  );
};
