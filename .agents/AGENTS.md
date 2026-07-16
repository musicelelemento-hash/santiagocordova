# Soluciones Contables Pro - Reglas de Desarrollo y Diseño Premium

Este documento define las reglas y directrices de diseño y comportamiento para el desarrollo de la plataforma Soluciones Contables Pro. El objetivo es mantener una estética visual de élite ("que se vea y se sienta bien") y asegurar un flujo de trabajo eficiente en tokens.

---

## 1. Directrices de Estilo Visual y Estética Premium (Obsidian & Azure)

Para que el software se sienta premium, moderno y profesional, se deben seguir estrictamente las siguientes reglas visuales basadas en [index.css](file:///c:/Users/Administrator/Documents/santiagocordova/index.css):

### A. Paleta de Colores y Degradados
* **Primario (Azure Vivid):** `#2B6AFF` (usado para acciones principales y estados activos).
* **Secundario (Electric Violet):** `#6366F1` (detalles y acentos tecnológicos).
* **Terciario (Kinetic Emerald):** `#04B17B` (estados de éxito, validaciones y pagos completados).
* **Fondo / Dark Mode (Obsidian Navy):** `#020617` a `#0F172A` (degradado `.gradient-obsidian` para una presencia de comando limpia).
* **Degradados Recomendados:**
  * `--gradient-azure` para elementos activos/destacados.
  * `--gradient-emerald` para estados completados o aprobados.
  * `--gradient-obsidian` para fondos de contenedores oscuros principales.

### B. Contenedores y Profundidad (Glassmorphism 2.0)
* **Tarjetas Estándar:** Usar siempre la clase `.glass-card-premium` en lugar de bordes planos y fondos opacos simples.
* **Efecto Hover:** Las tarjetas interactivas deben admitir transiciones suaves con la clase `.glass-card-premium:hover` (que desplaza la tarjeta hacia arriba `translate-y-[-4px]` y resalta el borde con un brillo primario).
* **Efectos de Brillo:** Utilizar `.tactical-glow-primary` y `.tactical-glow-emerald` para destacar elementos críticos.
* **Textura:** Emplear el fondo `.bg-noise-animated` con opacidad ultrabaja (4%) para dar textura de grano fino a la interfaz en fondos oscuros.

### C. Tipografía Profesional
* **Títulos y Encabezados:** Usar la fuente **Manrope** (`font-family: 'Manrope'`) con peso `font-weight: 700` o superior para una presencia editorial fuerte.
* **Textos de Datos e Identificaciones (RUC, Cédula):** Usar siempre fuentes monoespaciadas, preferentemente **JetBrains Mono** (`font-mono`) con espaciado de letras aumentado (`tracking-wider`) para legibilidad contable.
* **Cuerpo de Texto:** Usar la fuente **Inter** para comodidad de lectura prolongada.

---

## 2. Reglas de Interacción y UX (Micro-interacciones)

* **Estados de Carga:** Usar micro-animaciones en botones de envío (p. ej., rotación de iconos de recarga `<RefreshCw className="animate-spin" />`).
* **Copiar al Portapapeles:** Al copiar datos confidenciales o repetitivos (como RUC o contraseñas), el icono debe cambiar temporalmente a un check verde (`<Check size={...} className="text-emerald-500" />`) con un toast de confirmación inmediato.
* **Modales:** Deben tener fondos difuminados (`backdrop-blur-md`) y transiciones de entrada escalables para que la apertura se sienta fluida.

---

## 3. Políticas de Desarrollo y Eficiencia de Tokens (No Token Wasting)

Para asegurar un desarrollo eficiente y centrado en el usuario, el asistente de IA debe seguir estas reglas operativas:

1. **Evitar Exploración Innecesaria:** No realizar búsquedas recursivas intensivas de archivos ni abrir el navegador/subagente a menos que sea estrictamente necesario para depurar un error visual complejo.
2. **Preguntar en Caso de Alternativas:** Si existe más de una manera viable de implementar un cambio o enlace (como la elección de enlaces del SRI), se debe utilizar la herramienta `ask_question` para presentar las opciones de forma interactiva en lugar de adivinar o iterar repetidamente.
3. **Consolidación de Ediciones:** Al modificar archivos, realizar cambios específicos y agrupados mediante `replace_file_content` o `multi_replace_file_content` en lugar de reescribir archivos enteros de gran tamaño.
