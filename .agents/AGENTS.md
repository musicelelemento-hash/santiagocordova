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
| **Matriz de Cumplimiento SRI** | 🟢 **100%** | Exportar a Excel desde la barra de la matriz (21-nov-2026): hoja «Matriz» (cliente × período: Declarado / Enviado sin PDF / Pendiente / VENCIDO / No aplica · cobrado o por cobrar) y hoja «Resumen» por período. Exporta lo que está en pantalla (filtros, modo, año). PDF: el botón de imprimir. |
| **Extensiones Web SRI (Chrome/Edge)** | 🟡 **80% (En Proceso)** | Inyección funcional. Pendiente: Empaquetador `manifest.json` v3 listo para distribución e importador 1-click de facturas recibidas del SRI. |
| **Automatización WhatsApp** | 🟡 **95%** | Sala de envío (`SalaDeEnvio.tsx`): de a uno, con el enlace al comprobante en el mensaje. **Nunca se verificó en pantalla con datos reales.** Pendiente: envío 100% automático (§5) y el email con PDF adjunto, que es lo siguiente (§7). |
| **Autocompletado de RUC desde el SRI** | 🟢 **Restaurado 19-nov-2026** | Proxy propio: Cloudflare Worker `sri-ruc-proxy` (`workers/sri-ruc-proxy/worker.js`, https://sri-ruc-proxy.santiagocordova.workers.dev/ruc/<ruc>), plan gratis. Sólo consulta el padrón público del SRI; CORS para santiagocordova.com, Vercel del proyecto y localhost. El servicio `movil-servicios` del SRI rechaza desde Cloudflare; responde el de catastro (el mismo que usa la página «Consulta de RUC»). Probado con un RUC real. Falta verlo en la web publicada. |
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

**Email automático con el PDF adjunto** — HECHA el 11-sep-2026. Decidido con
el usuario el 07-sep-2026. `telegram-bot/src/gmail.ts` sumó
`sendEmailWithAttachment()` (arma el MIME multipart con el adjunto);
`telegram-bot/src/database_ops.ts` sumó `prepareProofEmailForClient(ruc,
period, type)`, que reutiliza `downloadClientProofFile` (ya probado, con su
manejo de `__SPLIT__:STORAGE:` y firma de URL) para juntar cliente + email +
comprobante. `agent.ts` conecta las dos con la tool `send_proof_email`,
mismo patrón que `download_client_proof`: Santiago se lo pide a Baku por
chat ("mándale el comprobante de [cliente] del periodo [X] por correo"), de
a uno — **no es un cron masivo**, sigue el mismo criterio de la sala de envío
de WhatsApp (§5, arriba): nunca sin que alguien lo pida en el momento.
`npx tsc --noEmit` limpio. Falta la primera prueba real (con un cliente que
tenga email cargado) antes de confiar en esto para el flujo mensual.
Gmail da 500 envíos por día, de sobra para 500 contribuyentes una vez al mes.

**El cron del lunes 08:00 ya no manda correos solo** — corregido el 13-nov-2026.
`telegram-bot/src/cron.ts` recorría los deudores con email y les enviaba el
recordatorio de honorarios sin que nadie lo pidiera, y después un texto de IA
le decía a Santiago cuántos «se habían enviado automáticamente». Contradecía
la regla de arriba. Ahora `proponerCobranzaSemanal()`
(`telegram-bot/src/cobranza_semanal.ts`) arma la lista —cuántos, cuánto, los
cinco más grandes, cuántos no tienen correo— y pregunta con tres botones:
«📧 Mandar a los N» · «👀 Uno por uno» (paginado, marca ✅ al que ya se le
mandó esta semana) · «⏭️ Esta semana no». El correo al cliente es el mismo de
antes; lo que cambió es que sale con un toque, no solo. `/lunes` dispara la
propuesta a mano para probarla sin esperar al lunes. Sin prueba real todavía.

**`EMAIL_ROUTE_TOKEN` es obligatorio desde el 13-nov-2026.** Antes, si la
variable faltaba en Render, `POST /email/declaracion` y
`POST /notificaciones/despachar` quedaban **abiertas**: cualquiera con la URL
podía hacer que el Gmail del estudio mandara un correo con el destinatario, el
asunto y el PDF que quisiera. Ahora `rutaAutorizada()` (`telegram-bot/src/index.ts`)
responde **503** sin token en el servidor y **401** con token equivocado, y el
arranque lo avisa en el log. **Antes de desplegar**: la variable tiene que
estar en Render y el mismo valor en Ajustes de la extensión → «Token del
servicio». Si no, la copia del comprobante por correo deja de salir (la
declaración y la subida a R2 no se enteran). `GET /notificaciones/estado`
sigue sin token a propósito: la consulta la web desde el navegador y no
devuelve secretos.

**El error interno ahora sí avisa** — mismo día. `bot.catch` respondía
«Santiago ya fue notificado» y sólo escribía en el log. Ahora manda el detalle
al chat del admin (qué comando o botón falló y el mensaje del error). De un
comando va **sólo el nombre**, nunca los argumentos: pueden traer una clave.

**Los botones personalizados de la web ya llegan a Baku** — mismo día. El
editor de `screens/TelegramBotScreen.tsx` los guardaba sólo en `localStorage`
y el bot nunca los leía; tres de los seis por defecto apuntaban a comandos que
no existían. Ahora:

- Viven en la tabla **`bot_web_config`** (`database/bot_web_config.sql`, fila
  `custom_buttons`). **No en `bot_settings`**: ahí el bot guarda los tokens
  OAuth de Gmail y esa tabla no se le abre al navegador. La web escribe con
  sesión iniciada (política `authenticated`); el bot lee con la service key.
- Los activos (hasta 6) salen al final de `/menu`
  (`telegram-bot/src/botones_web.ts`). Una acción con `/` ejecuta ese comando;
  un texto sin barra se le pide a Baku **como si Santiago lo hubiera escrito**
  (mismo camino que un mensaje: atajos directos, diálogos, agente).
- Sólo valen los comandos de `telegram-bot/src/comandos.ts` — la misma lista
  que se publica en Telegram con `setMyCommands`. La web tiene su copia
  (`BAKU_COMMANDS`) para autocompletar y avisar antes de guardar un botón
  muerto. **Son dos listas a mano**: `npm test` dentro de `telegram-bot/` falla
  si se separan.
- Si la tabla no existe o Supabase no deja guardar, la pantalla lo dice («Sólo
  en este navegador, Baku no los ve») con qué hacer, y el menú del bot sale
  igual, sin botones extra. Nunca un silencio.
- De paso `/comprobantes` pasó a ser un comando real (abre el mismo diálogo
  que el botón «Comprobantes» del hub).

`npm test` (16 comprobaciones, verdes el 13-nov-2026) usa grammY real con un
bot desechable, sin red. El SQL ya está corrido (la tabla responde). **Falta**
verlo en Telegram y en la pantalla con sesión iniciada.

**`/cierre` — el cruce honorarios × SRI del período** — mismo día,
`telegram-bot/src/cierre.ts`. Cuatro cuadrantes para el período activo (el mes
anterior; para semestrales, el semestre vigente), cada uno con su lista
paginada:

| Cuadrante | Criterio |
| :--- | :--- |
| ✅ Al día | tiene comprobante **y** está cobrado |
| 💰 Declarado sin cobrar | declarado (estado o comprobante) y sin cobrar — un botón por cliente abre el cobro |
| ⚠️ Cobrado sin comprobante | figura cobrado, pero no hay comprobante que pruebe la declaración |
| ⏳ Sin declarar ni cobrar | los vencidos primero, por día del noveno dígito |

El botón «📊 Matriz de Obligaciones» del hub tributario ahora abre esto: la
matriz vieja (`getComplianceMatrixSummary`, borrada) contaba «al día» a
cualquiera que alguna vez hubiera subido un PDF por el bot.

Tres cosas que salieron de correrlo contra la base real, y que el banco
(`scripts/test-cierre.js`, 31 comprobaciones) deja fijadas:

- **El comprobante del período puede estar sólo en `clients.declaration_history`**
  y no en `sri_declaraciones.proof_file`: pasaba en 56 de 113 clientes. Las
  dos fuentes **no son espejo**; quien pregunte «¿hay comprobante?» tiene que
  mirar las dos.
- **Traer `*` son 16 MB y 9 s** por los PDF embebidos. `/cierre` pide columnas
  justas y sólo las declaraciones del período (~2 s) y guarda el resultado un
  minuto para paginar. Las otras vistas del bot siguen con `*`.
- Hay períodos con sufijo (`2026-10:ICE`, `:ANEXO`) que **no son el IVA**, y
  un estado `completado` que la extensión dejó en 4 filas y sí significa
  enviada.

Primera corrida real (13-nov-2026, período 2026-10): 113 con obligación ·
65 al día · 45 declarados sin cobrar ($237) · 2 cobrados sin comprobante ·
1 sin declarar, vencido.

**Parte del día de Baku** — 21-nov-2026, `telegram-bot/src/parte_diario.ts`.
Lun–vie 07:45 le llega a Santiago un solo mensaje: vencen hoy / mañana / esta
semana / ya vencidos (sin declarar), declarados sin comprobante, declarados con
comprobante a los que falta avisar por WhatsApp (`isNotifiedWhatsApp` del
historial, el que marca la sala de envío) y firmas que vencen en ≤15 días.
A las 17:00 sólo escribe si algo vence hoy y sigue sin declarar. `/hoy` lo pide
a mano. **No escribe a los clientes.** Reusa `clasificarCierre` (/cierre) y
`calcularVencimiento` (traslado por fin de semana; por feriado sólo con la
variable `FERIADOS_EC` en Render, AAAA-MM-DD separadas por coma — **falta
cargarla con el calendario oficial**, la skill sri-ecuador lo tiene en «falta
verificar»). `scripts/test-parte.js` (17 comprobaciones, fechas cruzadas con
`scripts/sri.py` de la skill). **Anexos: no se listan** — la base no guarda por
período qué anexo falta (sólo columnas anuales `anexo_*_status` que nadie
evalúa); hace falta definir ese dato antes de avisar «falta el anexo».

### Propuesta · El estado `Pagada` no distingue «cobrado» de «declarado»

**Quién la propone**: Claude · 13-nov-2026
**Qué se vio**: `DeclarationStatus` es una escalera (Pendiente → Enviada →
Pagada) y todo el sistema lee `Pagada` como «declarada»
(`NotificationBell.tsx:32`, `ClientDetailView.tsx:265`, los reportes del bot).
Pero `Pagada` se pone **al cobrar**, haya o no declaración: la web crea la
fila ya en `Pagada` al cobrar un período sin fila (`ClientsScreen.tsx:843`,
`CobranzaScreen.tsx:558`) y `markPaymentAsPaid()` del bot la sube a `Pagada`
aunque estuviera en `Pendiente` cuando se le pasa el período a mano. En la
base, 1.077 de 1.218 filas están en `Pagada`. Un cliente que pagó por
adelantado queda, para todas las pantallas, como declarado.
**Qué se propone**: que cobrar marque `is_paid` y **no toque `status`** salvo
que la fila ya esté enviada. Primero en el bot (un `if` en
`markPaymentAsPaid`), después en las dos pantallas de la web.
**Qué cuesta / qué rompe**: toca el registro de cobros, que no tiene pruebas.
Hay pantallas de la web que suponen cobrado ⇒ `Pagada`; habría que revisar
cada una. No sé cuántas filas históricas están hoy en ese estado falso:
`/cierre` muestra 2 en el período activo, no mira los anteriores.
**Estado**: implementada en el bot el 15-nov-2026. Al registrar un pago (`markPaymentAsPaid`), se marca `is_paid = true` y no se sube a `Pagada` si la declaración está `Pendiente` (evita que un pago adelantado figure engañosamente como presentado ante el SRI). Si la fila no existía para ese período, se crea con el estado real consultando también `declaration_history`. En `/cierre` se agregaron acciones interactivas completas: cobro con confirmación en 1 toque (`baku_cierre:pay` y `conf`), acceso directo al expediente 360° para pendientes (`baku_sel`) y consulta de comprobantes para verificaciones (`baku_hub_proofs`).

**En la web, el 21-nov-2026**: misma regla en las pantallas de Cobranza y Clientes con `estadoAlCobrar()` (`services/complianceEngine.ts`): 14 lugares de cobro dejaron de poner `Pagada` a ciegas (las filas nuevas por cobro adelantado quedan `Pendiente` + `is_paid`). Reportes suma ingresos por `is_paid`. Las filas históricas que ya quedaron en `Pagada` sin declarar **no se tocaron**: arreglarlas pide revisar la base.

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
| ~~`corsproxy.io` dejó de ser gratuito~~ | **CERRADA el 19-nov-2026**: reemplazado por el Worker propio `sri-ruc-proxy` (ver §3). | `services/sri.ts`, `workers/sri-ruc-proxy/` |
| ~~Supabase rechaza la llave anon (401)~~ | **CERRADA el 07-sep-2026** (ver raíz §0b.2): no era la llave, era permiso de columna (`is_deleted`, 42501) + falta de política RLS de SELECT en `sri_declaraciones`. Documentado acá por si esta fila se leía como vigente. | raíz §0b.2 |

> Sobre el 401 (histórico): una llave guardada en los Ajustes de la extensión
> **pisa a la del código**. Una llave de repuesto rota tapa a la buena en
> silencio, y el
> arreglo suele ser **borrarla**, no salir a buscar una nueva. Regla general:
> *una credencial de repuesto que no anda es peor que no tener repuesto.*

### Lo que falta construir

| Qué | Estado | Detalle |
| :--- | :--- | :--- |
| **Email automático con el PDF adjunto** | hecho, sin prueba real | §5 · falta un envío real de prueba |
| **WhatsApp Cloud API (Meta)** | evaluado, no empezado | §5 · necesita cuenta y plantilla |
| **Verificar la sala de envío en pantalla** | nunca se hizo | necesita sesión para llegar a la matriz |
| **Botones de un clic desde la ficha del cliente** | ideas anotadas | §6 |
| ~~**Exportador masivo de la matriz (Excel/PDF)**~~ | **hecho 21-nov-2026** | §3. Nota: `ComplianceReportExport.tsx` (reporte imprimible viejo) no se usa en ningún lado y tiene un RUC equivocado (0105822994001); no confiar en él. |
| **Correo `contacto@santiagocordova.com`** | pendiente (21-nov-2026) | Ya figura en los datos para Google (`index.html`) pero no existe. El dominio está en **Namecheap** y Santiago ya usa otros correos con él: antes de crear el reenvío hay que ver qué servicio de correo usa (los registros MX) para no romperlos. Él lo revisa desde la computadora. |
| **Generador de Anexos (ATS / RDEP)** | fase 2 | §3 |
| **Pruebas automáticas de la web** | hecho 22-nov-2026 | `npm test` (vitest, carpeta `tests/`): vencimientos por 9.º dígito, períodos, RUC, clave de 49 dígitos, regla de cobro, clientes con RUC repetido, cortesía. Corren dentro de `npm run build` y en GitHub (`calidad.yml`, que ahora también corre `npm test` del bot). |
| **Aviso de errores de la web** | código hecho 22-nov-2026, **falta crear la tabla** | `services/errorReporter.ts` anota los errores del panel (sólo con sesión, uno por mensaje, máx. 20 por pestaña) en `web_errors` (`database/web_errors.sql`); el parte diario de Baku los cuenta. Mientras la tabla no exista, no pasa nada. |
| **Inicio «Hoy» y menú simple** | hecho 22-nov-2026 | `screens/HoyScreen.tsx` es el inicio (una vez para todos; quien elija otro lo conserva): vencidos, vencen en 7 días, por cobrar, «Tus pendientes» y 4 atajos. El menú muestra sólo «Lo esencial» (`MENU_ESENCIAL` en `App.tsx`, grupo en `NAV_GROUPS`); «Más herramientas» despliega el resto (`sc_menu_completo`). Si la nube no respondió y el store puso `mockClients`, «Hoy» no muestra números (el resto de pantallas sí: pendiente aparte). |
| **Pendientes con Baku** | hecho 22-nov-2026, sin prueba real en Telegram | «anota…», «recuérdame mañana a las 10…», `/anota`, `/pendientes`, «mis pendientes» (`telegram-bot/src/pendientes.ts`, sin IA). Tabla `tasks` (la misma de la web). Sin hora = 23:59 de Ecuador (sale en el parte de la mañana y la tarde pregunta «¿ya lo hiciste?»); con hora, aviso a esa hora (revisión cada 2 min) con ✅ Ya lo hice / ⏰ En 1 hora / 📅 Mañana. La regla de fecha está en dos copias (`services/pendientes.ts` de la web): las pruebas de ambos lados la fijan. Se quitó `clear_tasks` de la IA (podía borrar todo). |
| **Menú «Más herramientas» depurado** | hecho 22-nov-2026 | Eliminadas (el código queda en git): Licencias SaaS (códigos al azar, repetía Venta de planes), Refinanciación (repetía Cobranza), Studio 3D (no contable, lo más pesado) y Notificaciones (repetía la sala de envío y el parte de Baku). Agenda sale del menú: botón «Ver en calendario» en Tareas. «Migración Zifact» → «Conversor Excel». Firmas sube a «Lo esencial». CRM, Cotizaciones y Caja chica se quedan, ahora en la nube (`db.get`/`db.set` → `files` como `config_sc_*_history`) y sin datos de ejemplo (`services/datosDeEjemplo.ts` saca los que ya se habían guardado). CRM ya no inventa un RUC al azar al convertir un prospecto: pide el RUC. Pendiente aparte: el Facturador SRI guarda la clave del .p12 en el navegador (`FacturacionSriScreen.tsx:284`). |
| **Crecer (marketing)** | hecho 22-nov-2026 | `screens/CrecerScreen.tsx`, en «Lo esencial». Meta 3.000 clientes de IVA mensual (base real 22-nov: 52 mensuales + 69 semestrales): calculadora con supuestos editables (costo por conversación de Meta = supuesto, no precio de Meta) → nuevos/mes, conversaciones/día, presupuesto, personas para declarar. Anuncios para Meta (3 ángulos × 5 servicios) con enlace de WhatsApp y código de campaña `[IVA-M1]` para saber de qué anuncio vino cada cliente; guiones de video 9:16 con prompt para generador de IA; calendario de publicaciones por día de vencimiento del 9.º dígito (fin de semana → lunes; feriados no); tarjeta y volantes (A5, post, historia) con QR y descarga PNG a tamaño real. Lógica en `services/marketing.ts` (13 pruebas); sólo datos del SRI verificados (multa: 3 % por mes, Art. 100 LRTI). Nada se publica ni se envía solo. Medición (22-nov): el CRM tiene «Mensaje que te llegó» (detecta el código `[IVA-M1]` solo, `extraerCodigo`), guarda `codigoCampana` y muestra «Qué anuncio trae clientes» (prospectos, clientes y % de cierre por código). Pestaña «Responder»: fecha exacta de vencimiento desde el RUC (`proximoVencimientoIva`) y respuestas listas con los precios de Ajustes. |
