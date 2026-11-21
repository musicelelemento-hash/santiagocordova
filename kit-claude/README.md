# kit-santiago — el equipo de agentes y las skills, para cualquier proyecto

Plugin de Claude Code con lo que funcionó en santiagocordova.com, listo para
reutilizar en otros proyectos.

## Qué trae

| Pieza | Qué es |
|---|---|
| `agents/explorador.md` | Agente Haiku que sólo lee y devuelve un mapa `archivo:línea`. |
| `agents/implementador.md` | Agente Sonnet que hace cambios ya decididos en los archivos asignados. |
| `agents/verificador.md` | Agente Haiku que corre los chequeos del proyecto y da un veredicto corto. |
| `skills/equipo-lider` | Cómo trabaja el líder: cuándo delegar, el encargo, paralelo, revisión. |
| `skills/sri-ecuador` | Normativa vigente del SRI y calculadora de vencimientos (copia; ver abajo). |

Los agentes no pueden lanzar otros agentes y tienen tope de pasos. Leen las
reglas de cada proyecto desde su `CLAUDE.md` (paleta, qué no se toca, comandos).

## Instalar en otro proyecto

Desde Claude Code, en la carpeta del otro proyecto:

```
/plugin marketplace add musicelelemento-hash/santiagocordova
/plugin install kit-santiago@santiagocordova
```

(El repositorio es privado: la máquina tiene que tener acceso a GitHub con tu
cuenta, por ejemplo con `gh auth login`.)

Después, en el `CLAUDE.md` de ese proyecto conviene anotar qué es «lógica
delicada» ahí (lo que sólo hace el líder) y qué comando verifica los cambios.

## Otras herramientas que no van dentro del plugin

- **Hallmark** (revisión de diseño de páginas, de terceros): se instala aparte,
  una vez por máquina: `npx skills add nutlope/hallmark -g`.
- **Conectores (MCP)** de claude.ai —Supabase, Vercel, Render, GitHub, Gmail,
  Drive, Calendar, Notion, Cloudflare, etc.— son de tu cuenta: ya están en todos
  tus proyectos, no hace falta copiarlos.

## Mantener la skill sri-ecuador

La fuente es `.claude/skills/sri-ecuador` de santiagocordova (ahí la usa ese
proyecto). Esta carpeta es una copia: si cambias la normativa allá, corre
`scripts/sync-kit.sh` desde la raíz del repo y sube la versión en
`.claude-plugin/plugin.json` y en el `marketplace.json` de la raíz.
