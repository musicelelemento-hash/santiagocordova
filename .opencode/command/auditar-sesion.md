---
description: Audita incrementalmente solo los archivos modificados en los últimos N commits (default 4) usando el checklist auditor-modulo-sri.
agent: build
---

Auditoría incremental de la última sesión de este repo (santiagocordova-main).

N = primer argumento ($1); si no se indica, usa 4 (los commits de la sesión ago-2026).

Pasos estrictos:

1. **Alcance** — ejecuta y muestra:
   ```
   git log --oneline -<N>
   git diff --name-only HEAD~<N>..HEAD -- "*.ts" "*.tsx"
   ```
   Esa lista de archivos es el ÚNICO alcance. No leer ni escanear nada fuera de ella salvo que un hallazgo exija contexto vecino.

2. **Patrones** — sobre cada archivo del alcance (Select-String con números de línea, sin leer archivos completos):
   - Secretos: `(PASS\w*|CLAVE\w*|TOKEN\w*|SECRET\w*|API_?KEY)\s*(=|\|\|)\s*['"][A-Za-z0-9@#$_\-]{8,}['"]` y `(AIza[A-Za-z0-9_\-]{20,}|eyJ[A-Za-z0-9_\-]{15,}\.|Bearer\s+[A-Za-z0-9_\-]{16,})`
   - Memo deps: listar `\}, \[` y contrastar contra identificadores externos del cuerpo de cada useMemo/useCallback
   - Fechas: `= new Date()` que NO esté dentro de handler/memo/inicializador useState
   - Mutación: `\.sort\(` sin `[...spread]` previo
   - Parámetros ignorados: funciones `find*/get*/calc*` cuyos args no aparecen en el cuerpo

3. **Verificación** — si existen cambios SIN commitear en los archivos del alcance:
   `node node_modules\typescript\bin\tsc --noEmit`; y `npm.cmd run build` solo si se tocaron cálculos SRI/cobranza/facturación.

4. **Informe** — tabla: `archivo → veredicto → hallazgo → acción propuesta`. Marca explícitamente qué archivos quedaron limpios. NO commitear nada sin aprobación explícita del usuario.

$ARGUMENTS
