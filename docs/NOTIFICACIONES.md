# Notificaciones (web)

Módulo para gestionar los avisos a los clientes: **correo, WhatsApp y notas**,
con **quién falta**, **plantillas**, **mensajes libres** y **programación**.

Ruta: **Notificaciones** en el menú (entre Tareas y Cobranza).

---

## Las tres vistas

### 1 · Faltan por avisar

Clientes que **tienen declaración con comprobante** en el período y a los que
todavía **no se les envió** el aviso de declaración. Es la lista que responde
“¿a quién me olvidé?”.

- Se calcula con `faltanPorNotificar(clientes, periodo, notificaciones)`.
- Botón **Notificar** → abre el compositor con la plantilla ya cargada.

### 2 · Bandeja

Todo lo que se armó: pendiente, programado, enviado, fallido o cancelado.

- Filtros por estado (contadores arriba).
- Acciones: **marcar enviada** ✅ y **cancelar** ✕.
- Muestra cuándo se envió o para cuándo está programado.

### 3 · Componer

- **Cliente** (buscable en el selector).
- **Canal**: correo, WhatsApp o nota.
- **Tipo**: declaración presentada, recordatorio, valor a pagar, cobro,
  bienvenida o mensaje libre.
- **Plantilla** automática según el tipo (editable).
- **Programar**: fecha y hora; sin fecha, entra a la cola del momento.
- **Nota libre**: cualquier asunto y texto, para casos que no tienen plantilla.

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
| `asunto`, `cuerpo` | el mensaje tal como se va a enviar |
| `estado` | pendiente / programado / enviado / fallido / cancelado |
| `programada_para`, `enviada_en` | cuándo |
| `error` | por qué falló |

---

## Quién envía

**El bot.** La web arma, encola y registra. El despachador (bot o un cron)
debe:

1. Leer `notifications` con `estado = 'pendiente'` o
   (`estado = 'programado'` y `programada_para <= now()`).
2. Enviar según `canal`:
   - `email` → Gmail del bot (`sendEmailWithAttachment`; con adjunto si
     `metadata.pdfUrl`).
   - `whatsapp` → el canal de WhatsApp del bot.
3. Marcar `estado = 'enviado'`, `enviada_en = now()` o
   `estado = 'fallido'` con `error`.

**Nunca** se marca enviado desde la web sin que el servicio lo haya hecho: el
botón “marcar enviada” existe sólo para el caso de haberlo mandado a mano.

---

## Lo que sigue

- Despachador en el bot (poll cada minuto).
- Adjunto del PDF automático en el tipo `declaracion` (tomar el
  `declaration_history.proof_file` del período).
- WhatsApp: plantillas aprobadas por Meta si el envío es por API oficial.
