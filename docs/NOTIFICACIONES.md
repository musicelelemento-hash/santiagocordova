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

**El bot.** La web arma, encola y registra. El despachador debe:

1. Leer `notifications` con `estado = 'pendiente'` o
   (`programado` y `programada_para <= now()`).
2. Enviar según `canal`: `email` por Gmail; `whatsapp` por el número del bot.
3. Marcar `enviado` + `enviada_en`, o `fallido` + `error`.

**Nunca** se marca enviado desde la web sin que el servicio lo haya hecho: el
botón “marcar enviada” es para el caso de haberlo mandado a mano.

---

## Pendiente

- Despachador en el bot (poll cada minuto) con el PDF adjunto para `declaracion`.
- Adjunto automático del comprobante en el tipo `declaracion`.
- WhatsApp con plantillas aprobadas si se usa la API oficial de Meta.
