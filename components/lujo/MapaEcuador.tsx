import React, { useMemo } from 'react';
import { EC_CAPITALES, EC_CONTINENTE, EC_GALAPAGOS } from './ecuadorMapa';

/**
 * Mapa del Ecuador para el acto «Raíces»: se dibuja con el scroll.
 *
 * Todo cuelga de `--p` (0→1), que `useLujoScroll` pone en la <section> del
 * acto; acá sólo se lee con calc(), sin estado de React por cuadro:
 *   0.00–0.25  se dibuja el contorno del país (y Galápagos)
 *   0.12–0.25  se enciende la chispa de El Oro
 *   0.22–0.80  salen arcos de El Oro a cada capital provincial, de la más
 *              cercana a la más lejana; cada capital se prende al llegarle
 * Una vez dibujado, por cada arco viaja una chispa en bucle.
 * Con «reducir movimiento» se muestra todo dibujado y sin chispas viajeras.
 */

const AZUL = '#6E9BFF';
const VERDE = '#04B17B';
const VERDE_CLARO = '#4edea3';

// Etiquetas que se muestran (todas tendrían el mapa ilegible en un celular).
const CON_ETIQUETA = new Set(['Guayas', 'Pichincha', 'Azuay', 'Manabí', 'Loja', 'Esmeraldas', 'Sucumbíos', 'Pastaza']);
// Hacia qué lado va la etiqueta, para que no pise el arco ni el borde.
const ETIQUETA_IZQ = new Set(['Manabí', 'Guayas', 'Esmeraldas']);

const INICIO = 0.22;
const TRAMO = 0.58;

/** Fracción 0→1 de algo que empieza en `desde` y dura `dura` en unidades de --p. */
const avance = (desde: number, dura: number) =>
  `clamp(0, calc((var(--p, 0) - ${desde.toFixed(3)}) / ${dura.toFixed(3)}), 1)`;

export const MapaEcuador: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  const { hub, arcos } = useMemo(() => {
    const [, hx, hy] = EC_CAPITALES.find(([n]) => n === 'El Oro')!;
    const resto = EC_CAPITALES.filter(([n]) => n !== 'El Oro')
      .map(([n, x, y]) => ({ n, x, y, dist: Math.hypot(x - hx, y - hy) }))
      .sort((a, b) => a.dist - b.dist);
    const arcos = resto.map((c, i) => {
      // Curva que se levanta hacia el norte en proporción a la distancia.
      const mx = (hx + c.x) / 2;
      const my = (hy + c.y) / 2 - Math.min(90, 18 + c.dist * 0.32);
      const desde = INICIO + (TRAMO * i) / (resto.length - 1);
      return { ...c, d: `M${hx} ${hy}Q${mx.toFixed(1)} ${my.toFixed(1)} ${c.x} ${c.y}`, desde, retraso: (i * 0.37) % 2.6 };
    });
    return { hub: { x: hx, y: hy }, arcos };
  }, []);

  return (
    <svg
      viewBox="262 10 372 424"
      className={`mapa-ec ${className ?? ''}`}
      style={style}
      role="img"
      aria-label="Mapa del Ecuador: desde El Oro, conexiones a las 24 provincias"
    >
      <style>{`
        .mapa-ec .dib { stroke-dasharray: 1; }
        .mapa-ec .viaje { stroke-dasharray: 0.07 0.93; animation: mapaViaje 2.6s linear infinite; }
        .mapa-ec .onda { transform-box: fill-box; transform-origin: center; animation: mapaOnda 2.4s cubic-bezier(.16,1,.3,1) infinite; }
        @keyframes mapaViaje { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes mapaOnda { from { transform: scale(.4); opacity: .9; } to { transform: scale(3.2); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .mapa-ec .dib { stroke-dashoffset: 0 !important; }
          .mapa-ec [data-luz] { opacity: 1 !important; }
          .mapa-ec .viaje, .mapa-ec .onda { display: none; }
        }
      `}</style>
      <defs>
        <radialGradient id="mapaHalo">
          <stop offset="0" stopColor={VERDE_CLARO} stopOpacity="0.55" />
          <stop offset="1" stopColor={VERDE} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* País: relleno tenue + contorno que se dibuja */}
      <path d={EC_CONTINENTE} fill="rgba(43,106,255,0.07)" stroke="none" data-luz style={{ opacity: avance(0.05, 0.2) }} />
      <path
        className="dib"
        d={EC_CONTINENTE}
        pathLength={1}
        fill="none"
        stroke={AZUL}
        strokeWidth={1.3}
        strokeLinejoin="round"
        style={{ strokeDashoffset: `calc(1 - ${avance(0, 0.25)})` }}
      />
      {/* Galápagos, en recuadro */}
      <g data-luz style={{ opacity: avance(0.1, 0.15) }}>
        <rect x="491" y="327" width="116" height="100" rx="8" fill="none" stroke="rgba(110,155,255,0.3)" strokeDasharray="4 5" />
        <text x="495" y="320" fontSize={11} fontWeight={600} fill="#9fb3d9" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>Galápagos</text>
        <path d={EC_GALAPAGOS} fill="rgba(43,106,255,0.10)" stroke={AZUL} strokeWidth={1} strokeLinejoin="round" />
      </g>

      {/* Arcos El Oro → capitales */}
      {arcos.map((a) => (
        <g key={a.n}>
          <path
            className="dib"
            d={a.d}
            pathLength={1}
            fill="none"
            stroke={AZUL}
            strokeOpacity={0.55}
            strokeWidth={1}
            style={{ strokeDashoffset: `calc(1 - ${avance(a.desde, 0.1)})` }}
          />
          <path
            className="viaje"
            d={a.d}
            pathLength={1}
            fill="none"
            stroke={VERDE_CLARO}
            strokeWidth={2.4}
            strokeLinecap="round"
            data-luz
            style={{ opacity: avance(a.desde + 0.08, 0.04), animationDelay: `-${a.retraso.toFixed(2)}s` }}
          />
          <g data-luz style={{ opacity: `calc(0.18 + 0.82 * ${avance(a.desde + 0.08, 0.03)})` }}>
            <circle cx={a.x} cy={a.y} r={7} fill="url(#mapaHalo)" />
            <circle cx={a.x} cy={a.y} r={2.6} fill="#dbe6ff" />
            {CON_ETIQUETA.has(a.n) && (
              <text
                x={ETIQUETA_IZQ.has(a.n) ? a.x - 8 : a.x + 8}
                y={a.y + 4}
                textAnchor={ETIQUETA_IZQ.has(a.n) ? 'end' : 'start'}
                fontSize={12}
                fontWeight={600}
                fill="#c4d3ef"
                style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}
              >
                {a.n}
              </text>
            )}
          </g>
        </g>
      ))}

      {/* La chispa de El Oro */}
      <g data-luz style={{ opacity: avance(0.12, 0.1) }}>
        <circle cx={hub.x} cy={hub.y} r={26} fill="url(#mapaHalo)" />
        <circle className="onda" cx={hub.x} cy={hub.y} r={6} fill="none" stroke={VERDE_CLARO} strokeWidth={1.2} />
        <circle className="onda" cx={hub.x} cy={hub.y} r={6} fill="none" stroke={VERDE_CLARO} strokeWidth={1.2} style={{ animationDelay: '-1.2s' }} />
        <circle cx={hub.x} cy={hub.y} r={5.5} fill={VERDE_CLARO} />
        <circle cx={hub.x} cy={hub.y} r={2.2} fill="#ffffff" />
        <text x={hub.x - 12} y={hub.y + 22} textAnchor="end" fontSize={15} fontWeight={800} fill="#ffffff" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
          El Oro
        </text>
      </g>
    </svg>
  );
};
