---
name: sri-ecuador
description: Normativa tributaria VIGENTE de Ecuador (SRI) verificada en fuentes oficiales, más las reglas del estudio Soluciones Contables Pro — vencimientos por 9.º dígito del RUC con traslado por fin de semana y feriado, RIMPE Negocio Popular y Emprendedor (tablas oficiales), Régimen General, sociedades, IVA 15 % mensual/semestral, Renta anual (102, 102A, 1021) y en qué mes la declara cada régimen, ATS, anexos, REBEFICS, ADI, ICE, SCVS, multas del Art. 100 e interés de mora, validación de RUC/cédula y clave de acceso de 49 dígitos, y los estados de declaración del sistema. Úsala siempre que la conversación toque impuestos de Ecuador, el SRI, «cuándo vence», «qué tiene que declarar», «cuánto paga», RIMPE, RISE, microempresas, formularios 104/102/102A/1021, multas, retenciones, comprobantes electrónicos, o el código tributario de este repo (services/sri.ts, services/complianceEngine.ts, utils/taxTools.ts, telegram-bot), aunque el usuario no diga «SRI».
---

# SRI Ecuador — normativa vigente y reglas del estudio

Un contador le reenvía la respuesta a un contribuyente: una fecha o un monto
equivocado es una multa real o un cliente perdido. Esta skill existe para que
las respuestas salgan de **fuentes oficiales verificadas** y del **código del
estudio**, no de la memoria de un modelo, que mezcla años y regímenes.

## Cómo usarla

1. **Fechas y validaciones: corre el script**, no calcules a mano.
   `python scripts/sri.py vence RUC PERIODO --regimen ...` ya aplica el
   traslado por fin de semana y, con `--feriados`, por feriado.
   `python scripts/sri.py --help` muestra todo.
2. **Montos, tablas, multas, plazos legales** → `references/normativa-2026.md`.
   Cada dato tiene su fuente. Lo que no esté ahí, no lo inventes: dilo.
3. **Calendario completo de obligaciones** → `references/calendario.md`.
4. **Preguntas sobre el código** (matriz, cobranza, bot, estados) →
   `references/sistema.md`.

## Antes de responder, ubica el período

La norma depende del ejercicio. Mezclar años es el error más común:
- **RISE** y **régimen de microempresas** están derogados. Si alguien los
  nombra, aclara que hoy es RIMPE, salvo que la consulta sea de un período viejo.
- Negocio Popular pagó **USD 60 fijos** sólo en 2022 y 2023. Desde 2024 es una
  tabla de 0 a 60 según ingresos.
- El IVA fue 12 % hasta marzo de 2024; desde abril de 2024 es **15 %**.

## Reglas centrales

**Día de vencimiento = 9.º dígito del RUC o cédula**

| 9.º dígito | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 |
|---|---|---|---|---|---|---|---|---|---|---|
| Día | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 |

Si cae sábado, domingo o feriado, pasa al **siguiente día hábil**. Si ese
traslado lo llevaría al mes siguiente, se **adelanta al último día hábil** del
mes de vencimiento.

**Qué declara cada régimen**

| Régimen | IVA | Renta anual |
|---|---|---|
| RIMPE Negocio Popular (≤ USD 20.000) | No declara | Cuota por tabla · **mayo** |
| RIMPE Emprendedor, persona natural (≤ USD 300.000) | **Semestral** (puede ir mensual) | Tabla RIMPE · **mayo** |
| Régimen General, persona natural | **Mensual** (104) | 102 · **marzo** |
| Sociedad (3.er dígito del RUC = 9), incluida RIMPE | Mensual + ATS | 1021 · **abril** (+ REBEFICS, ADI, SCVS) |

**Período → mes en que se declara**
- Mensual: el mes siguiente. Semestral: S1 → julio, S2 → enero.
- ATS: el mes subsiguiente. Renta: el año siguiente, en el mes del régimen.

## Cómo responder

- Da la fecha con el **día de la semana**, como lo imprime el script.
- Cita la fuente cuando des un monto o una tarifa («tabla oficial RIMPE del SRI»).
- Si el dato está en «Lo que falta verificar» de la normativa, dilo así y
  remite a sri.gob.ec. Un «no lo tengo confirmado» es mejor que un número inventado.
- Separa siempre **norma** de **estimado**: la calculadora de multas de la web
  del estudio es comercial, no legal.

## Diferencias conocidas entre la norma y el código

Señálalas cuando toquen la respuesta. No asumas que el código tiene razón:
- **Traslado por fin de semana o feriado:** `services/sri.ts` no lo aplica,
  y la matriz puede mostrar un domingo como vencimiento. El script sí.
- **Mayúsculas en el bot:** el bot (`telegram-bot/src`) compara el régimen con
  `'Rimpe Negocio Popular'` / `'Rimpe Emprendedor'`, pero la base guarda
  `'RIMPE …'`. Esas comparaciones fallan y los RIMPE se tratan como Régimen
  General: IVA mensual y renta en marzo.
- **Mes de renta de Emprendedores:** corregido en la web el 19-nov-2026
  (ahora mayo). El bot todavía dice marzo.

## Seguridad con las claves del SRI

El SRI **bloquea cuentas por intentos fallidos**. Nunca propongas probar
claves en lote ni automatizar inicios de sesión sobre muchos contribuyentes:
de a uno, y pedido por una persona en el momento.
