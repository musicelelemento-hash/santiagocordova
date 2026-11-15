# Círculo mensual · el orden que importa

El proceso de un mes NO es “declarar todo junto”. El SRI y los anexos dependen
unos de otros. Este es el orden que sigue la plataforma (y el panel
**Círculo mensual** que aparece en Cliente → Declaraciones).

```
① EXTRAER        comprobantes del mes (compras)  ← extensión, tabla del portal
② IVA (104)      formulario con VENTAS prellenadas desde Facturación Electrónica
                 + COMPRAS + RETENCIONES; se confirman notas de crédito y se envía
③ ATS            se genera con las MISMAS compras del paso ① y las ventas
                 confirmadas en ② → XML + ZIP
④ SUBIR ZIP      popup de la extensión → Anexos SRI → 📤 Subir ZIP del anexo
                 (adjunta → Cargar → Aceptar)
⑤ ACUSE          el portal responde; la extensión guarda acuse + mensaje y la web
                 lo muestra; con eso se marca el ATS como presentado
```

## Por qué el IVA va primero

1. **El 104 trae las ventas prellenadas** desde Facturación Electrónica. Al
   confirmar la declaración quedan fijadas las ventas del período.
2. **Las retenciones** que le efectuaron también se reflejan en el 104.
3. El **ATS** no puede “inventar” ventas: usa las que ya se declararon. Por eso
   generar el ATS antes del IVA deja un anexo inconsistente.
4. El ATS tiene además un plazo **posterior**: vence el **mes subsiguiente**
   (ATS de septiembre → noviembre), mientras el IVA vence el mes siguiente
   (IVA de octubre → noviembre). Es decir: **el IVA siempre se declara antes**.

## Qué datos viajan de un paso a otro

| Sale de | Dato | Llega a |
|---|---|---|
| Extracción de comprobantes | factura, RUC, fecha, clave de acceso, base, IVA | ATS (detalle) y 104 (casilleros de compras) |
| Declaración 104 | ventas por tipo, notas de crédito, retenciones | ATS (`ventasEstablecimiento`) y proyección de renta |
| Portal al subir el ATS | mensaje + acuse | Bóveda del cliente y matriz (tile ATS) |

## Estados del panel

| Paso | Se pone verde cuando |
|---|---|
| ① Extraer | hay compras registradas para el período |
| ② IVA | existe la declaración del período (con CEP si lo tiene) |
| ③ ATS | se generó el XML/ZIP en esta sesión o hay acuse |
| ④ Subir | hay acuse del portal |
| ⑤ Acuse | el acuse tiene período coincidente |

## Para sociedades

Además del círculo mensual, la sociedad tiene en el mismo panel:

- **REBEFICS (APS)** — anual, febrero (o 28 días tras constituirse)
- **1021 Renta Sociedades** — anual, abril
- **ADI** — anual, mayo
- **Vencimientos informados por el SRI** — se pega el texto del portal y queda el semáforo

## Regla práctica

> Si tenés dudas del orden: **primero la declaración, después el anexo.**
> El anexo describe con detalle lo que la declaración ya resumió.
