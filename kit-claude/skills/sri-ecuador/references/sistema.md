# Cómo el sistema del estudio interpreta las declaraciones

Lee esto antes de tocar o explicar la matriz, la cobranza o `/cierre` del bot.

## Estados

`DeclarationStatus`: Pendiente → Enviada → Pagada (más Cancelada y Vencida).
La extensión también deja un estado `completado` en algunas filas: significa
**enviada**.

- **Declarado** (`isDeclared`): hay `proof_file`, o el estado es Enviada o Pagada.
- **Cobrado** (`isPaid`): estado Pagada **o** `is_paid = true`. Los clientes
  de cortesía cuentan siempre como cobrados.

Trampa conocida: históricamente `Pagada` se ponía **al cobrar los honorarios**,
haya o no declaración. Por eso hay filas `Pagada` sin declaración real. Desde
el 15-nov-2026 el bot marca `is_paid` y no sube a `Pagada` una fila
`Pendiente`. La web todavía no se corrigió del todo. Si alguien pregunta
«¿está declarado?», no te quedes solo con `Pagada`: busca el comprobante.

## Dónde está el comprobante

En **dos** lugares que no son espejo:
- `sri_declaraciones.proof_file`
- `clients.declaration_history`

Para saber si hay comprobante de un período, mira los dos.

## Colores de la matriz

| Color | Cuándo |
|---|---|
| Verde | declarado y cobrado |
| Amarillo | declarado sin cobrar, o vence en ≤ 5 días |
| Naranja | vence hoy, o listo para declarar sin enviar |
| Rojo | vencido sin declarar |
| Gris | sin fecha o con tiempo |

## Clientes «solo plan»

Los clientes con `clientType = 'solo_plan'` compraron software o firma, no
contabilidad. Quedan **fuera** de la matriz y de las alertas de vencimiento.
No les calcules obligaciones salvo que lo pidan.

## Validaciones

- **RUC:** 13 dígitos y termina en `001`. 3.er dígito `9` = sociedad privada,
  `6` = pública, 0–5 = persona natural.
- **Cédula:** 10 dígitos, provincia 01–24 (o 30), verificador por módulo 10.
- **Clave de acceso:** 49 dígitos con verificador por módulo 11 (pesos 2–7
  desde la derecha; 11→0, 10→1). Posiciones: fecha ddmmaaaa (1–8), tipo de
  comprobante (9–10: 01 factura, 04 nota de crédito, 05 nota de débito,
  06 guía de remisión, 07 retención), RUC del emisor (11–23), ambiente
  (24: 1 pruebas, 2 producción), serie (25–30), secuencial (31–39),
  código numérico (40–47), tipo de emisión (48), verificador (49).
