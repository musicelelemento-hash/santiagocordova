# Notificaciones (web)

Módulo para gestionar los avisos a los clientes: **correo, WhatsApp y notas**,
con **un mensaje a varios clientes**, **quién falta**, **plantillas**,
**mensajes libres** y **programación**.

Ruta: **Notificaciones** en el menú.

---

## Las tres vistas

### 1 · Faltan por avisar

Clientes que **tienen declaración con comprobante** en el período y a los que
todavía **no se les avisó**. Es la respuesta a “¿a quién me olvidé?”.

- Botón **“Avisar a los N”**: marca a todos y abre el compositor con la
  plantilla cargada.
- También se pueden marcar de a uno.

### 2 · Bandeja

Todo lo armado: pendiente, programado, enviado, fallido o cancelado.
Muestra **canal**, **destino** (correo o teléfono), asunto, estado y cuándo.
Acciones: marcar enviada ✅ y cancelar ✕.

### 3 · Componer

**Un mensaje, muchos destinatarios.** El botón dice a cuántos va:
`Encolar · 12`.

- **Destinatarios**: lista con búsqueda y casillas.
- **Atajos**: `Faltan` (los del período), `Marcados` (los que tienen
  recordatorio pendiente, la marca que se pone en Declaraciones), `Con WhatsApp`
  (los que tienen teléfono), `Ninguno`.
- **Canal**: correo, WhatsApp o nota. En WhatsApp **no se pide asunto** y se
  valida el teléfono: si alguien no tiene, avisa en ámbar.
- **Tipo**: declaración, recordatorio, valor a pagar, cobro, bienvenida o libre.
  Trae la plantilla editable.
- **Programar**: fecha y hora; sin fecha, entra a la cola del momento.

---

## Un solo número, varios clientes

El canal de WhatsApp es **uno** (el del bot). Cada destinatario genera **una
fila** en `notifications` con su `destinatario` (teléfono normalizado a dígitos y
`+`). El despachador recorre las filas y manda todas desde ese mismo número.

Al encolar por WhatsApp (sin programar) se marca al cliente:
`is_notified_whatsapp = true` y `notified_whatsapp_at` — así la ficha sabe que
ya se le avisó por ese canal.

---

## La marca de Declaraciones

`client.reminders` guarda los recordatorios (`date`, `channel`, `type`) que se
marcan desde Declaraciones/Agenda. El atajo **Marcados** trae justo esos
clientes (pendientes de fecha, opcionalmente filtrados por canal), para
convertir la marca en un mensaje sin volver a buscarlos.

---

## Dónde queda

Tabla `notifications` (Supabase). Corré una vez
`database/notifications.sql`.

| Campo | Qué guarda |
| :--- | :--- |
| `ruc`, `cliente_nombre` | a quién |
| `canal` | email / whatsapp / nota |
| `tipo` | declaracion / recordatorio / pago / cobro / anulacion / bienvenida / libre |
| `destinatario` | correo o teléfono al momento de armar |
| `asunto`, `cuerpo` | el mensaje tal cual se envía |
| `estado` | pendiente / programado / enviado / fallido / cancelado |
| `programada_para`, `enviada_en` | cuándo |
| `error` | por qué falló |

---

## Quién envía

**El bot.** Ya está implementado en `telegram-bot/src/dispatcher.ts`:

1. Cada **60 s** lee `notifications` con `estado = 'pendiente'` o
   (`programado` y `programada_para <= now()`), hasta 50 por vuelta.
2. Envía según `canal`:
   - `email` → Gmail del bot, con el **PDF adjunto** si el tipo es `declaracion`
     y el comprobante está en `declaration_history`.
   - `whatsapp` → `POST` al gateway (`WHATSAPP_API_URL` + `WHATSAPP_TOKEN`).
     Un solo número manda a todos: cada fila trae su destinatario.
   - `nota` → no se envía; queda como registro interno.
3. Marca `enviado` + `enviada_en`, o `fallido` + `error`.

**Despacho manual** (para probar sin esperar el minuto):

```bash
curl -X POST https://<bot>/notificaciones/despachar \
  -H "Authorization: Bearer $EMAIL_ROUTE_TOKEN"
```

### Correo: Resend (recomendado)

Resend es el que ya usa la web en Facturadores (`services/resendEmailService.ts`).

1. Crear la API key en <https://resend.com/api-keys>.
2. Verificar el dominio `santiagocordova.com` en Resend (registros DNS: SPF, DKIM).
3. En Render (bot): `RESEND_API_KEY`, y opcional `RESEND_FROM`
   (por defecto `Soluciones Contables Pro <facturacion@santiagocordova.com>`) y
   `RESEND_REPLY_TO`.

Ventaja: no depende de un Gmail autorizado por chat. El correo sale con el PDF
adjunto si es una declaración.

*Sin `RESEND_API_KEY`, cae al Gmail del bot (`EMAIL_CHAT_ID`).*

### WhatsApp: elegí el proveedor

| `WHATSAPP_PROVIDER` | Variables | Notas |
| :--- | :--- | :--- |
| `meta` (recomendado) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | API oficial. Gratis hasta 1.000 conversaciones/mes. Un número manda a todos. Fuera de la ventana de 24 h hay que usar plantilla aprobada. |
| `ultramsg` | `WHATSAPP_INSTANCE`, `WHATSAPP_TOKEN` | La más simple de configurar. Después del trial es paga. |
| `generic` (default) | `WHATSAPP_API_URL`, `WHATSAPP_TOKEN` | Contrato propio: `POST { to, message }` con `Bearer`. |

**Meta, paso a paso**

1. En <https://developers.facebook.com> → crear app → producto **WhatsApp**.
2. Te da un **número de prueba** y un **token** (temporal, 24 h; para producción
   usá un token permanente de un usuario del sistema).
3. Copiá el **Phone number ID** → `WHATSAPP_PHONE_ID`.
4. Para escribirle a un cliente que no te escribió antes, Meta exige una
   **plantilla aprobada**; dentro de 24 h de su último mensaje, el texto libre
   funciona.

**UltraMsg, paso a paso**

1. <https://ultramsg.com> → crear instancia (escaneás el QR con el número).
2. Copiá **Instance ID** y **Token**.
3. `WHATSAPP_PROVIDER=ultramsg`.

### Otras variables

| Variable | Para qué |
| :--- | :--- |
| `EMAIL_CHAT_ID` | chat de Telegram con el Gmail autorizado (respaldo si no hay Resend) |
| `NOTIF_DISPATCHER=off` | apaga el despacho automático |

Si un canal no está configurado, la fila **queda pendiente** (no se marca
como fallida) y el bot lo avisa en el log: cuando se configure, sale sola.

**Nunca** se marca enviado desde la web sin que el servicio lo haya hecho: el
botón “marcar enviada” es para el caso de haberlo mandado a mano.

---

## Diseño (pasada minimalista)

- **Una acción primaria por vista**: “Componer” en la cabecera; el resto en atajos.
- **Indicadores** con icono + número (pendientes, programadas, enviadas, con error).
- **Bandeja agrupada por día** (Hoy / Ayer / fecha), con icono del canal, destino,
  estado y hora; acciones aparecen al pasar el mouse.
- **Destinatarios** con contador, atajos (`Faltan · n`, `Marcados · n`,
  `Con WhatsApp · n`) y teléfono visible por cliente.
- **Estados vacíos con salida**: “La bandeja está vacía → Componer el primero”.
- Microcopy de consecuencia en el botón: `Encolar · 12`.

## Resend (verificado)

La clave cargada en `telegram-bot/.env` funciona. **No hay dominio verificado**:
hasta verificar `santiagocordova.com` (SPF + DKIM), el remitente debe ser
`onboarding@resend.dev`, que **sólo puede enviar al correo de la cuenta** de
Resend (sirve para probar, no para clientes reales).

## Pendiente

- Elegir el gateway de WhatsApp y cargar las dos variables en Render.
- WhatsApp con plantillas aprobadas si se usa la API oficial de Meta.
- Reintentos con espera (hoy un fallo queda `fallido` con el motivo; se
  reencola a mano o se vuelve a marcar la fila).
