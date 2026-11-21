# Calendario de obligaciones (según el código del estudio)

Fuente: `services/sri.ts`, `services/complianceEngine.ts`, `constants.ts`.
«Día 9.º» = día según el 9.º dígito del RUC (1→10, 2→12 … 9→26, 0→28),
trasladado al siguiente día hábil si cae en fin de semana o feriado (ver
normativa-2026.md §6). Las fechas de esta tabla son las nominales.

## Personas naturales

| Obligación | Período | Se presenta | Día |
|---|---|---|---|
| IVA mensual (104) | mes M | mes M+1 | 9.º dígito |
| IVA semestral (104) | S1 ene–jun | julio | 9.º dígito |
| IVA semestral (104) | S2 jul–dic | enero siguiente | 9.º dígito |
| Renta Régimen General (102) | año A | marzo A+1 | 9.º dígito |
| Renta RIMPE persona natural, Emprendedor y Negocio Popular | año A | mayo A+1 | 9.º dígito |
| Anexo de gastos personales | año A | febrero A+1 | el código fija el 28 |
| Anexo PVP | año A | enero, hasta el 5 | 5 |
| ICE + Anexo ICE (solo si `requiresIce`) | mes M | mes M+1 | 9.º dígito |
| Devolución IVA tercera edad/discapacidad | mes M | último día del mes M | — |

## Sociedades (RUC con 3.er dígito = 9)

| Obligación | Se presenta | Día |
|---|---|---|
| IVA mensual + ATS | IVA: mes siguiente · ATS: mes subsiguiente | 9.º dígito |
| Renta sociedades (1021) | abril | 9.º dígito (11 si contribuyente especial) |
| REBEFICS | febrero (la 1.ª vez: 28 días desde la constitución) | 9.º dígito |
| ADI (anexo de dividendos) | mayo | 9.º dígito |
| SCVS · nómina de socios | fin de febrero | — |
| SCVS · estados financieros y actas | hasta el 30 de abril | — |

ATS también aplica a obligados a llevar contabilidad, o cuando el perfil del
cliente tiene `requiresAts = true` (el flag manda sobre la regla del RUC).

## Formato de períodos en el sistema

| Formato | Significado |
|---|---|
| `2026-10` | mes (IVA mensual) |
| `2026-S1`, `2026-S2` | semestre (también acepta `2026-1S`) |
| `2025` | año (renta, anexos anuales) |
| `2026-10:ICE`, `:ANEXO`, `:PVP` | obligación distinta del IVA del mismo período |

## Ventana activa

El sistema habilita el semestre un mes antes del vencimiento: en junio ya
muestra `S1` del año y en diciembre `S2`.
