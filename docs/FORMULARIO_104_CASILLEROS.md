# Formulario 104 / 2011 · mapa de casilleros (IVA)

Transcripción estructurada del formulario oficial que se presenta en SRI en Línea
(Declaraciones → IVA). Es el mismo formulario para persona natural y para sociedad
(S.A.S. incluida): cambia el RUC, no el formulario.

> Guardado como conocimiento del proyecto el 2026-11-15 a partir del formulario real
> de **VIMARBO COMPANY S.A.S.** (`0791844669001`), período octubre 2026, tipo ORIGINAL.

**Dato clave del portal:** *el valor de ventas y de compras que se muestra en
“Información Fiscal” proviene de Facturación Electrónica* y corresponde al total de
las transacciones. El contribuyente lo **distribuye** en los casilleros según su
necesidad. Por eso el sistema puede leer los comprobantes y proponer el reparto.

---

## 1 · Ventas

Tres columnas por casillero: **valor bruto** · **valor neto (bruto − N/C)** ·
**impuesto generado**. En el XML/formulario, cada casillero se ingresa con sus dos
primeros dígitos como concepto.

| Concepto | Casillero | Descripción |
|---|---|---|
| Gravadas tarifa diferente de cero | **401 / 411 / 421** | Ventas locales, excluye activos fijos |
| Gravadas tarifa diferente de cero (activos fijos) | **402 / 412 / 422** | |
| Gravadas tarifa 5% | **425 / 435 / 445** | Ventas locales con tarifa 5% |
| Ajuste a pagar por diferencia de tarifas | **423** | IVA generado |
| Ajuste a favor por diferencia de tarifas | **424** | IVA a favor |
| 0% sin derecho a crédito tributario | **403 / 413** | Ventas locales |
| 0% sin derecho (activos fijos) | **404 / 414** | |
| 0% con derecho a crédito tributario | **405 / 415** | Ventas locales |
| 0% con derecho (activos fijos) | **406 / 416** | |
| Exportaciones de bienes | **407 / 417** | |
| Exportaciones de servicios y/o derechos | **408 / 418** | |
| **TOTAL VENTAS Y OTRAS OPERACIONES** | **409 / 419 / 429** | Suma de las filas |
| Transferencias no objeto o exentas de IVA | **431 / 441** | |
| Notas de crédito 0% por compensar | **442** | Próximo mes |
| Notas de crédito tarifa ≠ 0 por compensar | **443 / 453** | |
| Ingresos por reembolso como intermediario (informativo) | **434 / 444 / 454** | Operadoras de transporte / sociedades de gestión colectiva |

## 2 · Liquidación del IVA en el mes

| Casillero | Descripción |
|---|---|
| **480** | Total transferencias gravadas tarifa ≠ 0 **a contado** este mes |
| **481** | Total transferencias gravadas tarifa ≠ 0 **a crédito** este mes |
| **482** | Total impuesto generado (se traslada del **429**) |
| **483** | Impuesto ventas netas a liquidar de meses anteriores (debe coincidir con el 485 del mes anterior) |
| **484** | Impuesto a liquidar en este mes |
| **485** | Impuesto ventas netas a liquidar en próximos meses por crédito (**482 − 484**) |
| **486** | Mes a pagar el IVA ≠ 0 por ventas a crédito de este mes |
| **487** | Tamaño COPCI |
| **499** | **TOTAL IMPUESTO A LIQUIDAR EN ESTE MES (483 + 484)** |

## 3 · Compras

| Concepto | Casillero | Descripción |
|---|---|---|
| Gravadas ≠ 0 con derecho a crédito | **500 / 510 / 520** | Adquisiciones y pagos, excluye activos fijos |
| Activos fijos ≠ 0 con derecho a crédito | **501 / 511 / 521** | |
| Gravadas 5% con derecho a crédito | **540 / 550 / 560** | Adquisiciones locales |
| ≠ 0 **sin** derecho a crédito | **502 / 512 / 522** | |
| Importaciones de servicios ≠ 0 | **503 / 513 / 523** | |
| Importaciones de bienes ≠ 0 (sin activos fijos) | **504 / 514 / 524** | |
| Importaciones de activos fijos ≠ 0 | **505 / 515 / 525** | |
| Ajuste positivo al crédito por diferencia de tarifas | **526** | |
| Ajuste negativo al crédito por diferencia de tarifas | **527** | |
| Importaciones 0% (incluye activos fijos) | **506 / 516** | |
| Adquisiciones y pagos 0% (incluye activos fijos) | **507 / 517** | |
| Compras a RISE (hasta 2021) / Negocios Populares | **508 / 518** | |
| **TOTAL ADQUISICIONES Y PAGOS** | **509 / 519 / 529** | |
| Adquisiciones no objeto de IVA | **531 / 541** | |
| Adquisiciones exentas de IVA | **532 / 542** | |
| Notas de crédito 0% por compensar | **543** | |
| Notas de crédito ≠ 0 por compensar | **544 / 554** | |
| Pagos netos por reembolso como intermediario (informativo) | **535 / 545 / 555** | |
| **Factor de proporcionalidad** | **563** | `(411+412+420+435+415+416+417+418) / 419` |
| **Crédito tributario aplicable** | **564** | `(520+521+534+560+523+524+525+526−527) × 563` |
| **IVA no considerado crédito por factor** | **565** | |

## 4 · Resumen impositivo

| Casillero | Descripción |
|---|---|
| **601** | Impuesto causado (si 499 − 564 > 0) |
| **602** | Crédito tributario aplicable (si 499 − 564 < 0) |
| **603** | (−) Compensación por ventas con medio electrónico / adulto mayor / discapacidad |
| **605** | (−) Saldo crédito tributario del mes anterior — adquisiciones (campo **615** del mes previo) |
| **606** | (−) Saldo crédito del mes anterior — retenciones (campo **617** previo) |
| **607** | (−) Saldo por compensación de ventas con medio electrónico (campo 618 previo) |
| **608** | (−) Saldo por zonas afectadas / restitución (campo 619 previo) |
| **609** | (−) Retenciones de IVA que le efectuaron **en este período** |
| **622** | (−) IVA devuelto/descontado adulto mayor o discapacidad |
| **610** | (+) Ajuste por IVA devuelto en adquisiciones con medio electrónico |
| **612** | (+) Ajuste por IVA devuelto/rechazado (adquisiciones e importaciones) |
| **613** | (+) Ajuste por IVA devuelto/rechazado (retenciones) |
| **614** | (+) Ajuste por IVA devuelto por otras instituciones públicas |
| **615** | Saldo crédito tributario próximo mes — adquisiciones e importaciones |
| **617** | Saldo crédito próximo mes — retenciones |
| **618** | Saldo crédito próximo mes — compensación ventas medio electrónico |
| **619** | Saldo crédito próximo mes — zonas afectadas |
| **624** | IVA pagado y no compensado que se carga al gasto de Renta |
| **625** | Ajuste de crédito de IVA pagado hace más de 5 años |
| **620** | SUBTOTAL A PAGAR (si 601−602−603−604−605−606−607−608−623−609−622+610+611+612+613+614 > 0) |
| **699** | TOTAL A PAGAR por percepción y retenciones en ventas (620 + 621) |

## 5 · Devolución de ISD por exportaciones

| Casillero | Descripción |
|---|---|
| **700** | Importaciones de materias primas/insumos/bienes de capital incorporados a bienes exportados |
| **701** | ISD pagado |
| **702** | Porcentaje: ingreso neto de divisas / total de exportaciones netas |

## 6 · Retenciones (solo si retuvo IVA en compras)

| Casillero | Descripción |
|---|---|
| **721 / 723 / 725 / 727 / 729 / 731** | Retención del 10% / 20% / 30% / 50% / 70% / 100% |
| **799** | TOTAL IMPUESTO RETENIDO (suma de las anteriores) |
| **800** | Devolución provisional de IVA por compensación con retenciones |
| **801** | TOTAL A PAGAR POR RETENCIÓN (799 − 800 − 802) |

## 7 · Totales

| Casillero | Descripción |
|---|---|
| **859** | TOTAL CONSOLIDADO DE IVA (699 + 801) |
| **902** | TOTAL IMPUESTO A PAGAR (859 − 898) |

---

## 8 · Cómo se lee esto (estrategia)

1. **El formulario es de arrastre**: el 605/606/615/617 vienen del mes anterior. Si el
   mes anterior cerró con crédito, este mes se descuenta.
2. **Las ventas y compras llegan prellenadas** desde Facturación Electrónica; el
   trabajo real es **repartir** cada comprobante en su casillero correcto (tarifa,
   activo fijo, derecho a crédito, no objeto, etc.).
3. **La tarifa** se obtiene de la factura: 15% / 5% / 0%. El **derecho a crédito**
   depende del uso (actividad) y del proveedor (los “sin derecho” van a 502/512/522).
4. **El factor 563** reparte el crédito cuando hay ventas gravadas y no gravadas a la
   vez; en una empresa sin actividad (todo en cero) el factor es 0 y el crédito se
   arrastra íntegro.
5. **Sin movimiento**: se presenta en cero; 601 y 602 en 0 y los saldos 605/606
   arrastran lo que había. Es exactamente lo que muestra el borrador de VIMARBO:
   `605 = 209.99` y `606 = 155.15` prellenados, con 615/617 en 0 a la espera de
   trasladarlos.
