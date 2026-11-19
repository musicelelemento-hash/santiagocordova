---
name: sri-ecuador
description: Normativa tributaria ecuatoriana (SRI) tal como la aplica el estudio Soluciones Contables Pro — vencimientos por 9.º dígito del RUC, RIMPE Negocio Popular y Emprendedor, Régimen General, sociedades, IVA mensual/semestral, Renta anual (102, 102A, 1021), ATS, anexos, REBEFICS, ADI, ICE, SCVS, validación de RUC/cédula y de clave de acceso de 49 dígitos, y los estados de declaración del sistema. Úsala siempre que la conversación toque impuestos de Ecuador, el SRI, fechas de declaración, «cuándo vence», «qué tiene que declarar», regímenes RIMPE, formularios 104/102/102A/1021, multas e intereses, retenciones, comprobantes electrónicos, o el código de cálculo tributario de este repo (services/sri.ts, services/complianceEngine.ts, utils/taxTools.ts), aunque el usuario no diga «SRI».
---

# SRI Ecuador — reglas del estudio

Esta skill existe para que las respuestas sobre impuestos ecuatorianos salgan de
**las reglas que el sistema del estudio ya implementa**, no de lo que recuerde
un modelo. Un contador le reenvía la respuesta a un contribuyente: una fecha
equivocada es una multa real.

## Cómo usarla

1. **Para fechas y validaciones, corre el script** en vez de calcular a mano:
   `python scripts/sri.py --help`. Hace vencimientos por período, valida RUC,
   cédula y clave de acceso. Es la misma lógica que `services/sri.ts`.
2. Para la tabla completa de obligaciones y plazos, lee
   `references/calendario.md`.
3. Si la pregunta es sobre **el código** (un bug en la matriz, un estado raro),
   lee `references/sistema.md`: explica cómo el sistema decide «declarado»,
   «cobrado» y los períodos.

## Reglas centrales (resumen)

**Día de vencimiento = 9.º dígito del RUC o cédula**

| 9.º dígito | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 |
|---|---|---|---|---|---|---|---|---|---|---|
| Día | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 |

Ejemplo: RUC `0702345671001` → 9.º dígito `7` → vence el **22**.

**Qué declara cada régimen**

| Régimen | IVA | Renta anual |
|---|---|---|
| RIMPE Negocio Popular | No declara IVA | Formulario 102A, en **mayo** |
| RIMPE Emprendedor | **Semestral** (salvo que opte por mensual) | 102A, en **marzo** |
| Régimen General (persona natural) | **Mensual** (formulario 104) | 102, en **marzo** |
| Sociedad (3.er dígito del RUC = 9) | Mensual + ATS mensual | 1021, en **abril** (+ REBEFICS, ADI, SCVS) |

**Período → mes en que se declara**
- Mensual: el mes **siguiente** (IVA de octubre → noviembre).
- Semestral: S1 (ene–jun) → **julio**; S2 (jul–dic) → **enero** del año siguiente.
- ATS: el mes **subsiguiente** (ATS de septiembre → noviembre).
- Renta: el año siguiente, en el mes del régimen.

## Lo que hay que decir con cuidado

Estas cosas el código las **simplifica** o no las cubre. Señálalo en vez de
afirmarlas como ley:

- **Fin de semana y feriados.** El código no mueve la fecha si el vencimiento
  cae sábado, domingo o feriado. Por norma general se corre al siguiente día
  hábil. Avísalo cuando la fecha calculada caiga en uno de esos días.
- **Multas e intereses.** La calculadora de la web (`utils/taxTools.ts`)
  usa $30 por mes sin ventas y $45 con ventas, más 1,2 % de interés mensual
  sobre el 15 % de las ventas. Es un **estimado comercial** para la página, no
  el cálculo legal (que depende del impuesto causado, de las ventas y de la
  tasa de interés trimestral vigente que publica el SRI). Para un caso real,
  di que hay que calcularlo en el portal del SRI.
- **Tablas de RIMPE.** Los montos de `calculateDetailedTax` son la tabla
  que usa la web para estimar. Las tablas legales cambian con reformas: antes
  de dar un valor a un cliente, verifica la resolución vigente del SRI.
- **IVA:** el código usa 15 %. Si la pregunta es sobre un período antiguo,
  la tarifa pudo ser otra.
- Cualquier cambio legal posterior a lo que está en el código: dilo como
  «verificar en sri.gob.ec», no lo inventes.

## Seguridad con las claves del SRI

El SRI **bloquea cuentas por intentos fallidos**. Nunca propongas probar
claves en lote ni automatizar inicios de sesión sobre muchos contribuyentes:
de a uno, y pedido por una persona en el momento.
