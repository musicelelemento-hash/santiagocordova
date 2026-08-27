---
name: auditor-modulo-sri
description: Auditoría sistemática de módulos de Soluciones Contables Pro (React 18 + TS + SRI Ecuador) en este repo. Use when auditing/reviewing any screens/*.tsx module, hunting stale-memo/perf bugs, leaked secrets or hardcoded credentials, fixing without breaking, or verifying with typecheck/build before committing. Trigger words: auditar, revisar módulo, bug, useMemo, secretos, facturador, cobranza.
---

# Auditor de Módulos — Soluciones Contables Pro

Checklist destilado de una auditoría completa real (agosto 2026): 9 módulos, 4 commits de fixes.
Regla de oro del owner: **solucionar sin dañar** — fix quirúrgico, verificar, y commitear SOLO con aprobación explícita.

## Comandos verificados (PowerShell 5.1 — Windows)

```powershell
# Typecheck (npx.ps1 está BLOQUEADO por execution policy — no usar npm run typecheck vía npx)
node node_modules\typescript\bin\tsc --noEmit

# Build completo (~2-3 min; obligatorio si se tocó cálculo SRI/cobranza/facturación)
npm.cmd run build

# Buscar patrón en un archivo concreto (la herramienta Grep busca directorios, no archivos sueltos)
Select-String -Path "screens\X.tsx" -Pattern "patron" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }

# Ver contexto por rango de líneas sin leer el archivo entero
Get-Content $f | Select-Object -Skip ($l-1) -First N
```

## Ahorro de tokens (protocolo obligatorio)

1. Primero **censo por patrones** con Select-String/grep (conteo por pattern), NO leer el archivo completo.
2. Solo leer rangos de líneas alrededor de los hallazgos (`Select-Object -Skip/-First`).
3. Inventarios amplios multi-carpeta → subagente `explore`.
4. Nunca imprimir valores de `.env*`, tokens ni contraseñas en el chat.

## Patrones-bug validados (con caso real encontrado)

| # | Patrón | Cómo detectar | Caso real |
|---|--------|---------------|-----------|
| 1 | Parámetro ignorado en función de búsqueda | Leer firma vs cuerpo; buscar usos | `findSriInvoice(ruc, period)` ignoraba `period` → factura equivocada vinculada al cobro (CobranzaScreen) |
| 2 | `useMemo` con dependencia faltante | Listar cada `\}, \[` y contrastar con identificadores externos usados en el cuerpo | Filtro por proveedor que no recalcula |
| 3 | `new Date()` en render path o usado como dep inestable | `= new Date()` fuera de handlers/memos/inicializadores | Matriz: `today` nuevo por render mataba TODOS los memo deps downstream |
| 4 | `.sort()` sobre estado directo (mutación) | Buscar `.sort(` sin spread previo | Correcto: `[...arr].sort(...)` |
| 5 | Scroll/rerender por pixel | `setState` dentro de `onScroll` | Fix imperativo: manipular DOM via ref + booleano de estado |
| 6 | Secretos hardcodeados como fallback | Ver barrido abajo | `'Santiago2026'` ×5, token API ×15 |
| 7 | Credenciales en texto plano (localStorage/Supabase) | grep `password` + `localStorage`/schema.sql | Bóveda de firmas .p12 + passwords planas — reportar como decisión de diseño, NO cambiar sin aprobar |

## Barrido de secretos (ejecutar al empezar cualquier auditoría)

```
(PASS\w*|CLAVE\w*|TOKEN\w*|SECRET\w*|API_?KEY)\s*(=|\|\|)\s*['"][A-Za-z0-9@#$_\-]{8,}['"]
(AIza[A-Za-z0-9_\-]{20,}|eyJ[A-Za-z0-9_\-]{15,}\.|Bearer\s+[A-Za-z0-9_\-]{16,})
0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir     ← token quemado en historial git
Santiago2026                          ← contraseña quemada en historial git
```

Config centralizada existente: `services/facturacionApi.ts` (`VITE_FACTURACION_API_TOKEN`).

## Backend (mapa vivo)

- **Laravel API Render**: `https://facturador-sri-api.onrender.com/api/v1/ping` — código NO está en este repo (pedir visibilidad/respaldo).
- **Supabase**: RLS en `database/sri_comprobantes_schema.sql`; schema aplicado al live DB es tarea pendiente del owner.
- **telegram-bot/**: backend Node/TS completo (agent IA, cron, Gmail, visión/voz, PDF). Sin config de deploy en repo — probablemente corre local.
- **Vercel**: solo SPA (`vercel.json`), sin serverless functions.

## Pendientes del owner (recordar, no ejecutar)

1. 🔴 Vercel env vars ANTES de deploy: `VITE_ADMIN_PASS`, `VITE_FACTURACION_API_TOKEN` (si faltan → lockout/fallo facturación).
2. 🟡 Rotar contraseña .p12 + admin pass + token API (viven en historial git).
3. ⚪ Decisiones de diseño: cifrar bóveda de firmas, `p12_password` plano en Supabase, gráfico de Reportes ignora filtro de rango.

## Modo incremental — auditar solo la última sesión

Por defecto NO re-auditar todo el repo. El alcance es lo tocado recientemente:

```powershell
git log --oneline -4                                  # commits recientes (sesión ago-2026: 04af539, 392cd6e, 5af6604, 1ba8ee9)
git diff --name-only HEAD~4..HEAD -- "*.ts" "*.tsx"   # archivos exactos a auditar
git diff HEAD~4..HEAD -- <archivo>                    # revisar el diff, no el archivo completo
```

Aplicar los patrones-bug y el barrido de secretos SOLO sobre esa lista de archivos.
Comando rápido: `/auditar-sesion [N]` (creado en `.opencode/command/auditar-sesion.md`).

## Protocolo de entrega

1. Escaneo → 2. contexto quirúrgico → 3. fix mínimo (fallback seguro al comportamiento anterior cuando haya riesgo de datos) → 4. `tsc --noEmit` + `npm.cmd run build` → 5. informe con tabla módulo/veredicto → 6. preguntar antes de commitear. Estilo de commit: `fix(scope): descripción en español`, una línea.
