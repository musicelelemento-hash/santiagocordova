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
