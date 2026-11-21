# Soluciones Contables Pro — santiagocordova-main

@.agents/AGENTS.md

## Comandos
- `npm run dev` — servidor de desarrollo (Vite)
- `npm run typecheck` — solo chequeo de tipos (`tsc --noEmit`)
- `npm run build` — typecheck + build de producción
- `npm run preview` — previsualizar build

## Stack
React 18 + TypeScript estricto + Vite + Tailwind + Zustand + Supabase + Firebase + Google Gemini AI + react-three-fiber. Backend adicional en Google Apps Script y Laravel (`VITE_FACTURACION_API_URL`).

## Reglas de trabajo
- Antes de dar un cambio por cerrado: mínimo `npm run typecheck`; `npm run build` si se tocó algo crítico (cálculos SRI, cobranza, facturación).
- `.env.local` nunca se commitea (ya cubierto por `.gitignore`) ni se imprime su contenido.
- Repo conectado a `github.com/musicelelemento-hash/santiagocordova` (rama `main`). Revisar `git status` al empezar — suele haber trabajo en progreso sin commitear.
- Estilo visual: paleta Obsidian/Azure/Emerald definida en el mapa neuronal — no inventar otra paleta.

## Equipo (líder + agentes)
Pedido por Santiago el 21-nov-2026: un modelo líder que piensa y revisa, y agentes más chicos que hacen el trabajo.
- **Líder** (sesión principal): entiende el pedido, divide, decide, revisa lo que entregan los agentes, verifica y publica. La lógica delicada (cálculos SRI, cobros/`is_paid`, facturación, credenciales) la hace siempre el líder.
- **`implementador`** (`.claude/agents/implementador.md`, Sonnet): cambios concretos ya decididos — animaciones, estilos, textos, refactors mecánicos en varias pantallas. No hace commit.
- **`explorador`** (`.claude/agents/explorador.md`, Haiku): sólo lee y responde dónde está algo.
- Lo que entrega un agente no se publica sin que el líder lo revise y corra typecheck/build.

## Regla de cobro (21-nov-2026)
Cobrar no es declarar: al cobrar se marca `is_paid`; el estado sólo sube a `Pagada` si ya estaba declarada. Usar siempre `estadoAlCobrar()` de `services/complianceEngine.ts` (misma regla que `markPaymentAsPaid` del bot).
