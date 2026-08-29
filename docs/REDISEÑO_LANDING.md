# Informe de Rediseño — Página Pública (Landing) SantiagoCordova.com

Fecha: 2026-08 · Objetivo: diferenciación + estética "nivel 100K" + 3D reactivo al scroll.

## 1. Estado actual (lo que ya existe)

La landing NO parte de cero: ya es una página de alta densidad con:

- **Intro cinematográfica fijada al scroll** (`CinematicIntro`) — Problema → Solución → Marca.
- **Héroe 3D "Blindaje"** con escudo 3D interactivo (`TaxShieldHero3D`) y panel de **Telemetría Fiscal** (stats animadas: 12,548+ declaraciones, 99.9% precisión).
- **`Scroll3DCanvas`**: campo de partículas + escultura de cristal que **muta de geometría con el scroll** (icosaedro → toro nudo → dodecaedro → octaedro), anillos de oro líquido y esmeralda, material vítreo con `transmission`, reacción al puntero.
- Scroll suave con **Lenis + GSAP ScrollTrigger** (inercia profesional), cursor custom, barra de progreso, tarjetas con spotlight 3D, auroras, grid táctico, contadores animados (CountUp), parallax de framer-motion.
- Paleta Obsidian/Azure/Emerald + acentos oro (`#C9A96E`) — coherente y premium.

**Conclusión:** la base visual ya es sólida. El "100K" se logra afinando narrativa, rendimiento y detalles; no rehaciendo todo.

## 2. Diagnóstico — qué falta para sentirse "100K"

| Área | Hallazgo | Impacto |
|---|---|---|
| Narrativa 3D | El 3D existe pero no cuenta una historia: la escultura muta sin explicar *por qué* | Medio-alto |
| Primer impacto | El héroe compite con 3D + telemetría + auroras (sobrecarga de estímulos) | Medio |
| Rendimiento | `transmission` (cristal) + dpr 1.5 + partículas se ejecuta siempre, incluso con `prefers-reduced-motion` | Alto en laptops |
| Cohesión tipográfica | Mezcla de fuentes/signos sin jerarquía clara en algunas secciones | Medio |
| CTA | Buenos CTAs pero falta un "camino" claro tras la intro | Medio |
| Carga | 3D montado aunque no esté en viewport | Medio |

## 3. Mejoras implementadas (esta iteración)

1. **NUEVA sección "EL SISTEMA EN 4 ESTADOS"** (`components/3d/ScrollNarrative3D.tsx`):
   - Sección **fijada al scroll (pin de ~4 pantallas)** donde la escultura 3D muta por etapa y el texto cambia: **OBSIDIAN (cifrado) → QUANTUM (cálculo) → GOLD (optimización) → EMERALD CORE (crecimiento)**.
   - Número de etapa gigante de fondo, badge con acento por etapa, rail de progreso clicable, hint de scroll.
   - Montaje del Canvas **solo cuando la sección entra en viewport** (`useInView`) → ahorro de GPU.
   - Respeta el `theme` claro/oscuro.

## 4. Roadmap recomendado (siguiente nivel "100K")

Prioridad P1 (diferenciadores):
1. **Hero más limpio**: reducir densidad (menos badges simultáneos), dar respiro, una sola idea por pantalla.
2. **Scroll-velocity en el 3D**: acelerar/frenar rotación según la velocidad del scroll (efecto "fricción" táctil).
3. **Micro-interacciones de marca**: los contadores/estadísticas reaccionan al hover; los CTAs con "magnetic" ya existen — extender a tarjetas.

P2 (rendimiento = percepción 100K):
4. **`prefers-reduced-motion`**: desactivar Canvas y animaciones pesadas para usuarios que lo piden.
5. **Code-split del 3D** (lazy `React.lazy` del Canvas) para no cargar three.js en el primer paint.
6. **dpr dinámico** por dispositivo y `frameloop="demand"` cuando la sección no es visible.

P3 (conversión):
7. **Sticky CTA final** con número de WhatsApp y "agendar consulta" persistente.
8. **Social proof real**: logos/regiones de clientes (El Oro, Pasaje, Machala) en vez de solo números.
9. **SEO/meta**: title, description, Open Graph y JSON-LD local (contador/estudio contable).

P4 (mantenimiento):
10. Extraer los acentos de color a variables CSS (hoy hardcodeados `#00A896`, `#C9A96E`, `#4edea3`).
11. Componentizar secciones (el Landing ya tiene 2000+ líneas).

## 5. Verificación

- `npm run typecheck` — 0 errores (strict).
- Build de producción pendiente de confirmar tras esta iteración.
