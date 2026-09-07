# Soluciones Contables Pro - Mapa Neuronal, Visión de Vara Alta y Reglas de Desarrollo

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
| **Automatización WhatsApp** | 🟢 **95%** | Sala de envío (`SalaDeEnvio.tsx`): de a uno, con el enlace al comprobante en el mensaje. Pendiente: envío 100% automático (ver §5). |
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
