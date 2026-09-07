# Soluciones Contables Pro - Mapa Neuronal, Visión de Vara Alta y Reglas de Desarrollo

> 🧭 **El tablero de pendientes de TODO el ecosistema está en el
> `.agents/AGENTS.md` de la raíz del workspace, sección §0b.** La mayor parte
> del trabajo pendiente vive en la extensión Nueva Luz 3.0, no acá. Lo que
> se cierra desde ESTE repositorio está en la §7, al final.

Este documento define la **Misión, Mapa de Arquitectura (Neuronas del Sistema), Estado de Módulos y Reglas Operativas** para la plataforma **Soluciones Contables Pro / SantiagoCordova.com**. Sirve como punto de entrada de contexto ultrarrápido para Agentes de IA y desarrolladores, optimizando el consumo de tokens y la velocidad de ejecución.

---

## 🚀 1. Misión y Visión de Vara Alta

* **Misión**: Consolidar la plataforma SaaS definitiva de gestión contable, fiscal, cobranza y automatización tributaria en Ecuador, adaptada 100% a la normativa del SRI (RIMPE, Régimen General, IVA, Impuesto a la Renta, Anexos, Facturación Electrónica y Firmas .p12).
* **Vara Alta (Estándar de Élite)**:
  * **Aesthetic Superiority**: Estética militar/espacial de centro de comando ("Obsidian Navy, Azure Vivid, Kinetic Emerald") con Glassmorphism 2.0 y micro-interacciones de precisión.
  * **Cero Carga Falsa**: Ninguna tarea repetitiva manual para el contador (autocompletado SRI, lectura de PDFs con IA Gemini, inyección vía extensión web).
  * **Claridad Segmentada**: Distinción quirúrgica entre clientes de contabilidad completa (Matriz SRI activa) y clientes de solo compra de software/firmas (Solo Plan).

---

## 🧠 2. Mapa Neuronal del Sistema (Contexto Ultrarrápido)

### A. Núcleo de Estado y Tipos (Core)
* [types/client.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/types/client.ts): Definición completa de `Client`, `Declaration`, `TaxProfile`, `FacturadorConfig`, `TaxRegime`, `clientType` (`completo` | `solo_plan`).
* [store/useAppStore.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/store/useAppStore.ts): Estado global en Zustand para clientes, configuraciones de tarifas, configuraciones del sistema, firma activa y bóveda.
* [services/complianceEngine.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/services/complianceEngine.ts): Motor de cálculo de cumplimiento tributario, vencimientos por 9no dígito RUC, resumen de deudas y atrasos (con desvío automático para clientes `solo_plan`).
* [services/sri.ts](file:///c:/Programacion/Paginas%20Web/SantiagoCordova.com/santiagocordova-main/services/sri.ts): Validaciones de RUC/Cédula, fechas de vencimiento SRI, claves SRI y cálculo de períodos IVA/Renta.

### B. Módulos Principales (Screens & Components)
* 🛡️ **Matriz SRI (`TaxComplianceMatrix.tsx`)**: Cuadrícula de seguimiento mensual/semestral de IVA, Renta y Anexos.
* ⚡ **Venta de Planes (`SalesComboModal.tsx`)**: Asignador de firmas .p12, combos EcuaFact/ZiFact, cobros y selector de modalidad (Solo Plan vs Completo).
* 👥 **Directorio de Clientes (`ClientsScreen.tsx`, `ClientCard.tsx`, `ClientForm.tsx`, `ClientDetailView.tsx`)**: Ficha 360°, credenciales, alertas de firma y portal del cliente.
* 🧾 **Facturación SRI (`FacturacionSriScreen.tsx`, `SriPosTerminalModal.tsx`)**: Emisión de facturas electrónicas, retenciones, notas de crédito y RIDE PDF.
* 💰 **Cobranzas & Caja (`CobranzaScreen.tsx`, `CajaChicaScreen.tsx`)**: Control de honorarios pendientes, recibos y caja chica.
* 🧩 **Extensiones SRI (`SriExtensionsStore.tsx`, `extenciones web/`)**: Catálogo de extensiones y scripts de inyección automática en el SRI.
* 🔄 **Conversor SRI (`AdaptadorConvert.tsx`)**: Importación/exportación masiva Excel/CSV/XML.

---

## 📊 3. Estado de Módulos & Hoja de Ruta (Roadmap)

| Módulo / Proyecto | Estado | Estado Actual / Próximo Paso |
| :--- | :--- | :--- |
| **Aislamiento Solo Plan / Matriz SRI** | 🟢 **100% Completado** | Clientes de solo plan exentos de la matriz y alertas. |
| **Venta de Planes & Combos** | 🟢 **100% Completado** | Registro de .p12, credenciales y emisión comprobante SRI. |
| **Matriz de Cumplimiento SRI** | 🟡 **95% (Casi Listo)** | Funcional. Pendiente: Exportador masivo de reportes en Excel/PDF para auditoría. |
| **Extensiones Web SRI (Chrome/Edge)** | 🟡 **80% (En Proceso)** | Inyección funcional. Pendiente: Empaquetador `manifest.json` v3 listo para distribución e importador 1-click de facturas recibidas del SRI. |
| **Automatización WhatsApp** | 🟡 **95%** | Sala de envío (`SalaDeEnvio.tsx`): de a uno, con el enlace al comprobante en el mensaje. **Nunca se verificó en pantalla con datos reales.** Pendiente: envío 100% automático (§5) y el email con PDF adjunto, que es lo siguiente (§7). |
| **Autocompletado de RUC desde el SRI** | 🔴 **ROTO en producción** | `corsproxy.io` dejó de ser gratuito: `fetchSRIPublicData()` devuelve HTTP 403. Ver §7. |
| **Generador de Anexos (ATS / RDEP)** | 🔴 **Pendiente (Fase 2)** | Generación automática de XMLs de Anexos a partir de comprobantes guardados. |

---

## 🎨 4. Directrices de Estilo Visual y Estética Premium (Obsidian & Azure)

### A. Paleta de Colores
* **Primario (Azure Vivid):** `#2B6AFF`
* **Secundario (Electric Violet):** `#6366F1`
* **Terciario (Kinetic Emerald):** `#04B17B`
* **Fondo Dark (Obsidian Navy):** `#020617` a `#0F172A` (`.gradient-obsidian`)

### B. UI / UX & Eficiencia de Tokens
1. **Componentes Glassmorphism**: Usar `.glass-card-premium` y transiciones suaves.
2. **Tipografía Contable**: Nombres en `Manrope`, RUC/Cédulas en `JetBrains Mono` (`font-mono`).
3. **No Token Wasting**: No realizar lecturas de archivos innecesarias; consultar este mapa para ubicar archivos clave al instante.


---

## 🧰 5. La sala de envío, y lo que sigue

### Lo que hay (07-sep-2026)

`components/features/SalaDeEnvio.tsx`. El botón «💬 Notificar WhatsApp» de la
matriz la abre con los clientes seleccionados.

**Por qué existe.** El envío masivo llamaba a `window.open` una vez por cliente
en el mismo tick. El navegador deja pasar dos o tres y **bloquea el resto sin
avisar** — y el código marcaba a los veintisiete como notificados igual. O sea:
clientes registrados como avisados sin haber recibido nada. Por eso el trabajo
se venía haciendo a mano.

Tres cosas que la sala hace y el masivo no:

1. **Una pestaña por vez.** Dos teclas por cliente (Enter abre, Enter confirma,
   S saltea): veintisiete salen en un par de minutos.
2. **El mensaje lleva el enlace al comprobante.** Eso era el hueco: el texto
   decía «le adjunto el comprobante» y no adjuntaba nada, y había un campo
   `fileUrl` declarado y nunca usado esperando justo eso. El enlace se firma
   por 30 días (`linkDelComprobante` en `services/fileService.ts`) — la hora
   que usa `signPublicStorageUrl` no sobrevive a un chat.
3. **Abrir WhatsApp no es haber enviado.** El código viejo marcaba
   `isNotifiedWhatsApp` al abrir la pestaña, aunque nadie pulsara enviar. Acá
   ese paso lo confirma la persona.

Y los que **no** se pueden mandar no desaparecen de la lista: quedan al final
con el motivo escrito. Un contribuyente que desaparece es uno que nadie vuelve
a mirar.

`notification_count` ahora se guarda en Supabase. Antes se reseteaba al
recargar y todos volvían a recibir el mensaje de bienvenida aunque llevaran
tres avisos.

### Lo que sigue

**Email automático con el PDF adjunto** — decidido con el usuario el
07-sep-2026, para después de la sala. Lo caro ya está hecho:
`telegram-bot/src/gmail.ts:100` envía por la API de Gmail y
`telegram-bot/src/database_ops.ts` ya lee `sri_declaraciones`. Gmail da 500
envíos por día, de sobra para 500 contribuyentes una vez al mes. Es el único
canal donde el comprobante viaja **adjunto** y sin que nadie haga clic.

**WhatsApp Cloud API (Meta)** — el único camino oficial a «un botón y salieron
los 500», y el único que adjunta el PDF por WhatsApp. Necesita cuenta de Meta
Business, número dedicado y plantilla aprobada. Meta cobra por mensaje y sus
condiciones se mueven seguido: **verificar el precio actual antes de
comprometerse**, no confiar en lo que recuerde una IA.

> ⚠️ **`whatsapp-web.js` / Baileys quedan descartados.** Son clientes no
> oficiales que se hacen pasar por WhatsApp Web. Funcionan, son gratis, y son
> la respuesta de cualquier tutorial. Pero violan los términos y el número que
> se banea es **el del estudio**, por donde escriben 500 contribuyentes. No
> construir esto salvo pedido explícito del usuario sabiendo el riesgo.

---

## 💡 6. Ideas del usuario para construir en ocio

> Anotadas el 07-sep-2026, con sus palabras. Son pedidos de producto, no
> conclusiones de una IA: no reinterpretarlas ni recortarlas.

Le gustó mucho la vista previa del comprobante que aparece en el menú de
declaraciones, con su botón para abrir credenciales:

> «me di cuenta que cuando veo el comprobante en menú declaraciones se abre una
> pequeña vista previa y sale un botón de abrir credenciales. Me sorprendió,
> eso me ayudó mucho, me encanta. ¿Podemos hacer más, o un botón así desde el
> cliente, con distintas funcionalidades?»

Las que nombró:

| Idea | Qué haría |
| :--- | :--- |
| **Certificado de RUC** | Sacar el certificado del contribuyente desde el portal |
| **Probar la clave** | Comprobar si la contraseña guardada todavía sirve, sin declarar nada |
| **Traer lo ya declarado** | Buscar y bajar las declaraciones que ya están presentadas |

El patrón que le gustó —y que conviene conservar— es **una acción de un clic,
en contexto, sin salir de donde está**. La ficha del cliente es el lugar
natural para eso.

Dos cuidados al construirlas:

- **Probar la clave toca la bóveda.** El blindaje anti-bloqueo de la extensión
  existe porque el SRI bloquea cuentas por intentos fallidos. Una función de
  «probar clave» que corra sola sobre 500 contribuyentes es una forma rápida
  de bloquearlos a todos. Tiene que ser de a uno y pedido a mano.
- **Traer lo ya declarado ya existe en la extensión**
  (`bajarTodosLosComprobantes()`, botón 🧾). Antes de escribirlo de nuevo en la
  web, mirar si alcanza con dispararlo desde acá por el puente.

## 📋 7. Pendientes de la web — tablero

> Actualizado el **07-sep-2026**.
>
> **El tablero maestro del ecosistema está en el `.agents/AGENTS.md` de la raíz
> del workspace, sección §0b.** Ahí está todo lo de la extensión Nueva Luz 3.0,
> que es donde vive la mayor parte del trabajo pendiente. Esta sección cubre
> sólo lo que se cierra desde este repositorio.

### Lo que está roto en producción

| Qué | Síntoma | Dónde |
| :--- | :--- | :--- |
| **`corsproxy.io` dejó de ser gratuito** | `fetchSRIPublicData()` devuelve **HTTP 403** (`keyless_legacy_url`). Autocompletar al crear un cliente y validar un RUC no funcionan. | `services/sri.ts` |
| **Supabase rechaza la llave anon (401)** | La extensión declara bien y guarda el comprobante, pero **las métricas del panel no llegan**. Hubo además 500 y 521. Revisar el estado del proyecto antes de tocar credenciales. | raíz §0b.2 |

> Sobre el 401: una llave guardada en los Ajustes de la extensión **pisa a la
> del código**. Una llave de repuesto rota tapa a la buena en silencio, y el
> arreglo suele ser **borrarla**, no salir a buscar una nueva. Regla general:
> *una credencial de repuesto que no anda es peor que no tener repuesto.*

### Lo que falta construir

| Qué | Estado | Detalle |
| :--- | :--- | :--- |
| **Email automático con el PDF adjunto** | decidido, no empezado | §5 · **es lo siguiente** |
| **WhatsApp Cloud API (Meta)** | evaluado, no empezado | §5 · necesita cuenta y plantilla |
| **Verificar la sala de envío en pantalla** | nunca se hizo | necesita sesión para llegar a la matriz |
| **Botones de un clic desde la ficha del cliente** | ideas anotadas | §6 |
| **Exportador masivo de la matriz (Excel/PDF)** | pendiente | §3, único hueco de ese módulo |
| **Generador de Anexos (ATS / RDEP)** | fase 2 | §3 |

### Por qué el email va antes que WhatsApp

Lo caro ya está hecho: `telegram-bot/src/gmail.ts:100` envía por la API de
Gmail y `telegram-bot/src/database_ops.ts` ya lee `sri_declaraciones`. Gmail da
**500 envíos por día**, de sobra para 500 contribuyentes una vez al mes. Y es
el único canal donde el comprobante viaja **adjunto**, sin que nadie haga clic.

WhatsApp Cloud API es el único camino oficial a «un botón y salieron los 500»,
pero necesita cuenta de Meta Business, número dedicado y plantilla aprobada, y
Meta cobra por mensaje. **Verificar el precio actual antes de comprometerse**;
no confiar en lo que recuerde una IA.

### Lo que ya está y no hay que reconstruir

- **La sala de envío** (`components/features/SalaDeEnvio.tsx`) — de a uno, con
  el enlace al comprobante firmado por 30 días. Ver §5 para por qué existe.
- **`linkDelComprobante()`** en `services/fileService.ts` — firma el enlace y
  devuelve `null` cuando no hay nada compartible, que **no es un error**:
  mandar «le adjunto el comprobante» sin adjuntar nada es peor que no mandarlo.
- **`notification_count` se guarda en Supabase** — antes se reseteaba al
  recargar y todos volvían a recibir el mensaje de bienvenida.
- **Traer lo ya declarado ya existe en la extensión**
  (`bajarTodosLosComprobantes()`, botón 🧾). Antes de escribirlo de nuevo acá,
  mirar si alcanza con dispararlo por el puente.

---
