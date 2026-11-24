# Encargo para la sesión local · rediseñar el panel flotante de Nueva Luz

> Escrito el 24-nov-2026 desde la sesión en la nube, que no puede ver la
> extensión. Lo hace la sesión **local**, que tiene la extensión y puede
> probarla en Chrome. Lee también `.agents/AGENTS.md` (paleta y reglas).

## Objetivo
Que el panel flotante que la extensión pone sobre las páginas del SRI se vea
como parte de santiagocordova.com: minimalista, claro y rápido de usar en el
día a día. **Sólo se cambia la apariencia y el orden.** La lógica queda igual:
sincronización, llaves de Supabase, inicio de sesión y manejo de claves del SRI.
El cierre de seguridad sigue en `docs/ENCARGO_SESION_LOCAL.md` y es aparte.

## Antes de tocar nada
1. Captura del panel como está hoy: cerrado, abierto y en cada pestaña o estado
   (cargando, error, sin sesión).
2. Lista de lo que muestra y de cada botón, con qué hace. No se quita ninguna
   función. Si algo sobra o se repite, se anota y se le pregunta a Santiago.

## Dirección visual
- **Paleta del estudio y ninguna otra.** Fondo Obsidian `#0F172A` con borde
  `#1E293B`. Acción principal en Azure `#2B6AFF`. Correcto o declarado en
  Emerald `#04B17B`. Violet `#6366F1` sólo como acento secundario. Los errores
  en rojo suave, siempre con texto que diga qué pasó y qué hacer.
- **Letras**: Manrope para el texto, JetBrains Mono para RUC, períodos y montos.
  Si la extensión no puede cargar fuentes de Google, usar las del sistema
  (`system-ui`, `ui-monospace`); no incrustar archivos pesados.
- **Cerrado**: una pastilla pequeña en una esquina, con un indicador de estado
  (verde sincronizado, ámbar pendiente, rojo error). Se puede arrastrar y
  recuerda dónde quedó.
- **Abierto**: unos 360 px de ancho, con este orden:
  1. Arriba, el cliente activo: nombre y RUC en mono, y su estado del período.
  2. La acción principal del momento: un solo botón Azure grande.
  3. Las demás acciones como botones secundarios.
  4. Abajo, la última sincronización («hace 2 min») y el botón de minimizar.
- Sin sombras pesadas ni degradados de adorno. Bordes de 12 px en el panel y
  8 px en los botones. Una sola animación corta (≈150 ms) al abrir y cerrar,
  que se desactiva con `prefers-reduced-motion`.
- No tapar los botones del SRI: probar en las pantallas donde se usa
  (declaraciones, comprobantes). Que siempre se pueda minimizar.
- Accesible: foco visible con el teclado, contraste suficiente y botones de al
  menos 32 px de alto.
- Textos en español simple: los botones dicen exactamente lo que hacen
  («Marcar declarada», no «Enviar»).

## Reglas
- Probar claves del SRI de a una y a mano (el SRI bloquea cuentas).
- No subir datos de clientes en capturas al repositorio.
- No tocar permisos del `manifest.json` salvo que haga falta, y avisar si hace falta.

## Entrega
- Capturas de antes y de después, en los mismos estados.
- Commit en el repositorio de la extensión. Recargarla en `chrome://extensions`
  y probar sincronizar, marcar una declaración y subir un comprobante.
- Un resumen corto para Santiago: qué cambió, qué se movió de lugar y qué
  quedó pendiente.
