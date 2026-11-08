# Qué le falta a un cliente y qué hacer ahora

La Bóveda muestra un panel con **un solo estado y una sola acción** por
cliente. Es la respuesta a “¿y ahora qué hago con éste?”.

---

## Los cuatro estados

| Estado | Qué significa | Acción |
| :--- | :--- | :--- |
| 🔴 **Clave rechazada** | El SRI rechazó la clave guardada (`tax_profile.sriCredencial.estado ≠ ok`). Trae el motivo y la fecha. | **Actualizar la clave** acá mismo y **reintentar** |
| 🟡 **Sin comprobante** | Se declaró, pero el PDF no quedó guardado. | **Recolectar comprobante** (no vuelve a declarar) |
| ⚪ **Sin declarar** | Falta la declaración del período. | **Declarar ahora** |
| 🟢 **Al día** | Presentada con comprobante. | Nada |

---

## Actualizar la clave (sin salir de la web)

El panel rojo muestra las instrucciones y el campo:

1. Entrá al portal del SRI → **Recuperar clave** (llega al correo registrado).
2. Esperá **15 minutos** (el portal bloquea reintentos).
3. Pegá la clave nueva acá → **Guardar y reintentar**.

Al guardar:

- se actualiza `client.sriPassword` y `sriPasswordUpdatedAt` en Supabase;
- se envía la orden a la extensión (`SRI_ENTER_PORTAL_SESSION`) con la clave
  nueva;
- la extensión entra, verifica y continúa el flujo del período.

Si el SRI vuelve a aceptarla, la extensión marca `sriCredencial.estado = 'ok'`
y el panel rojo desaparece solo.

---

## Recolectar comprobante

Cuando la declaración existe pero no tiene PDF, el botón manda
`pendingAction: 'recuperar_comprobante'` con el período. La extensión entra a
**Consulta de declaraciones**, descarga el comprobante y lo sube. **No toca el
formulario** y no vuelve a declarar.

---

## Declarar ahora

Manda el flujo completo (`sendToSRIExtension`) para el período. Es el mismo
camino que “Ejecutar lote”, pero para un cliente puntual.

---

## Por qué así

- **Una acción por vez**: el usuario no tiene que decidir entre un menú de diez.
- **El estado es el dato, no una suposición**: sale de `sriCredencial` (lo
  escribe la extensión al fallar o al entrar bien) y de `declaration_history`.
- **La web ordena, la extensión ejecuta**: la web no puede tocar el portal; la
  extensión sí. La web deja la orden y muestra el estado.
- **Nunca re-declara por error**: “recolectar” y “declarar” son acciones
  distintas.

---

## Pendiente

- Un listado **“Requieren atención”** en Cobranza que junte los cuatro estados
  de todos los clientes (hoy se ve cliente por cliente).
- Botón masivo “Recolectar todos los comprobantes faltantes”.
