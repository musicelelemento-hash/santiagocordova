# ADI · Anexo de Dividendos, Utilidades o Beneficios

**Obligación:** anual · se presenta en **mayo** (10–28 según 9.º dígito).
**Formato:** XML comprimido (.zip) por el sistema de anexos del SRI.
**Aplica:** solo cuando la compañía **distribuye dividendos/utilidades**. Si no reparte,
no aplica (se registra como “no aplica”).

> Fuente: ficha técnica oficial del SRI `Catalogo_anexo_de_dividendos.xlsx`
> (hoja “Esquema 2020 en adelante”), leída del catálogo que dejó el contador anterior.
> **Aún no hay un XML real de ADI** para validar byte a byte: el generador se
> implementará cuando consigamos un ejemplo o el archivo generado por el SRI.

---

## 1 · Secciones del anexo

| Sección | Contenido |
|---|---|
| **A** | Datos básicos: año, tipo de informante, identificación, razón social |
| **B** | Información de utilidades (9 campos) |
| **C** | Información del dividendo |
| C.1 | Datos del beneficiario (varios registros) |
| C.2 | Detalle de la distribución / pago (26 campos) |
| **D** | Préstamo a los accionistas |
| D.1 | Datos del accionista que recibe el préstamo |
| D.2 | Información del préstamo (9 campos) |
| **E** | Dividendos anticipados |
| E.1 | Datos del accionista que recibe el anticipo |
| E.2 | Información del dividendo anticipado (5 campos) |
| **F** | Dividendos provenientes del exterior |
| F.1 | Datos de la sociedad extranjera |
| F.2 | Detalle del dividendo exterior |

---

## 2 · Sección A — datos básicos

| # | Campo | XML | Long. | Tipo | Requisito |
|---|---|---|---|---|---|
| 1 | Año | `Anio` | 4 | numérico `aaaa` | obligatorio |
| 2 | Tipo de informante | `tipoInformante` | 2 | Tabla 7 | obligatorio |
| 3 | Tipo de identificación | `tipoIdInformante` | 1 | Tabla 1 (R/C/P) | obligatorio |
| 4 | Número de identificación | `IdInformante` | 3–13 | alfanumérico | obligatorio |
| 5 | Razón social / nombres | `razonSocial` | 5–500 | texto | obligatorio |

## 3 · Sección B — información de utilidades

| # | Campo | XML | Requisito |
|---|---|---|---|
| 1 | Utilidad del ejercicio informado | `utilidadEjercicioInformado` | opcional |
| 2 | Utilidad distribuida distinta de la reinvertida | `utilidadDistribuidaDistintaReinv` | condicional |
| 3 | Utilidad reinvertida **con** derecho a reducción (art. 37 LRTI) | `utilidadReinvertidaConDerechoReduccion` | condicional |
| 4 | Utilidad reinvertida **sin** derecho a reducción | `utilidadReinvertidaSinDerechoReduccion` | condicional |
| 5 | Utilidad distribuida por anticipado | `utilidadPagadaAnticipado` | opcional |
| 6 | Utilidad no distribuida del ejercicio | `utilidadNoDistribuidaEjerInfor` | condicional |
| 7 | Utilidad de ejercicios anteriores pendiente al inicio | `utilidadNoDistribEjerAntPeriodoInfor` | opcional |
| 8 | Utilidad distribuida en el período de ejercicios anteriores | `utilidadDistribEjerciciosAnteriores` | condicional |

**Validación del SRI:** la suma de los campos **2 + 3 + 4 + 6** debe ser **igual** al
campo **1** (utilidad del ejercicio informado). Si no cuadra → error.

## 4 · Sección C.1 — beneficiario del dividendo

| # | Campo | XML |
|---|---|---|
| — | Secuencial | `secuencialDD` |
| 1 | Tipo de identificación | `tipoIdPerceptor` |
| 2 | Número de identificación | `numeroIdPerceptor` |
| 3 | Tipo de beneficiario (Tabla 2) | `tipoBeneficiarioDD` |
| 4 | País de residencia (Tabla 3) | `paisResidenciaDD` |
| 5 | ¿Gravado en el estado de residencia? (SI/NO) | `regimenFiscalPreferenteDD` |
| 6 | Tipo de ID del beneficiario efectivo | `tipoIdBeneficiarioEfectivo` |
| 7 | Número de ID del beneficiario efectivo | `numeroIdBeneficiarioEfectivo` |

## 5 · Sección C.2 — detalle de la distribución / pago

| # | Campo | XML | Formato |
|---|---|---|---|
| 1 | Año que generó la utilidad | `anioGeneraUtilidadAtribuibles` | aaaa |
| 2 | Tipo de dividendo (Tabla 9) | `tipoDividendoDistribuido` | 1–2 |
| 3 | Fecha registro contable | `fechaRegistroContable` | dd/mm/aaaa |
| 4 | Monto del dividendo distribuido | `montoDividendoDistribuido` (divDistGrav) | 10 enteros + 2 dec |
| 5 | Tarifa de renta aplicada | `tarifaUtilidadesDividendo` | 2 enteros + 2 dec |
| 6 | ¿Generado por la informante o por una sociedad anterior? (Tabla 10) | `dividendoDistribuidoSociedad` | 1 |
| 7 | Tipo ID primera sociedad | `tipoIdPrimeraSociedad` | 1 |
| 8 | Número ID primera sociedad | `numeroIdPrimeraSociedad` | 3–13 |
| 9 | Renta pagada por la primera sociedad | `impuestoPagadoPrimeraSociedad` | 10+2 |
| 10 | Renta pagada por la informante | `impuestoPagadoSociedadAtribuible` | 10+2 |
| 11 | Ingreso gravado por dividendos | `ingresoGravadoDividendos` | 10+2 |
| 12 | Porcentaje de retención | `PorcentajeRetencion` | 3 enteros + 2 dec |
| 13 | Crédito tributario informado al accionista (arts. 136/137 RALRTI) | `valorInformadoAccionista` | 10+2 |
| 14 | Monto de la retención | `MontoRetencion` | 10+2 |
| 15 | ¿Dividendo pagado? (SI/NO) | `dividendopagdo` | 2 |
| 16 | ISD pagado | `midPagaDividendo` | 10+2 |
| 17 | Forma de pago (Tabla 5) | `formaPago` | 1–2 |
| 18 | Fecha de pago | `fechaPago` | dd/mm/aaaa |
| 19 | Valor pagado localmente | `valorDividendoPagado` | 10+2 |
| 20 | Valor transferido al exterior | `valorDividendoTransferExterior` | 10+2 |
| 21 | ISD pagado (transferencia) | `isdPagado` | 10+2 |
| 22 | Fecha de la transferencia | `fechaTransferencia` | dd/mm/aaaa |
| 23 | Nro. cuenta acreditada | `numeroCuentaAcreditada` | 3–13 |
| 24 | Banco del exterior | `bancoExterior` | 5–500 |
| 25 | Código ABA | `codigoAba` | 11–60 |
| 26 | Código BIC | `codigoBic` | 21–60 |

**Validación del SRI:** la suma de `montoDividendoDistribuido` de todos los registros
debe ser **igual** al campo B.8 (`utilidadDistribEjerciciosAnteriores`). Si no → error grave.

## 6 · Secciones D y E — préstamos y dividendos anticipados

**D.1** (`secuencialDP`, `tipoIdentificacionDP`, `numeroIdentificacionDP`,
`tipoBeneficiarioDP`, `paisResidenciaDP`, `regimenFiscalPreferenteDP`,
`tipoIdentificacionBeneficiarioEfefectivoDP`, `numeroIdentificacionBeneficiarioEfectivoDP`)

**D.2** (`fechaPrestamo`, `montoPrestamo`, `tasasInteres`, `plazoMeses`,
`tarifaRetencionDividendosAnticipadosDP`, `valorRetencionCtDP`,
`baseImponibleRetencionAccionistaDP`, `porcentajeRetencionAccionista`,
`valorRetencionAccionistaDP`)

**E.1** (`secuencialDA`, `tipoIdentificacionDA`, `numeroIdentificacionDA`,
`tipoBeneficiarioDA`, `paisResidenciaDA`, `regimenFiscalPreferenteDA`,
`tipoIdentificacionBeneficiarioEfefectivoDA`, `numeroIdentificacionBeneficiarioEfectivoDA`)

**E.2** (`fechaReparticionDividendoAnticipado`, `montoDividendoAnticipado`,
`tarifaRetencionDividendosAnticipadosDA`, `valorRetencionCtDA`,
`baseImponibleRetencionAccionistaDA`, `porcentajeRetencionAccionistaDA`,
`valorRetencionAccionistaDA`)

**Validación:** la suma de D.2 `montoPrestamo` + E.2 `montoDividendoAnticipado` debe
cuadrar con B.5 (`utilidadPagadaAnticipado`): si es menor → advertencia; si es mayor → error.

## 7 · Sección F — dividendos del exterior

**F.1** (`tipoIdentificacionPE`, `numeroIdentificacionPE`, `razonSocial`,
`paisResidenciaPE`, `regimenFiscalPreferentePE`, `utilidadGravadaPaisResidencia`,
`impuestoPagadoPaisResidencia`, `tarifaImpuestoRentaPaisResidencia`)

**F.2** (`tieneRelacionSociedadEcuatoriana`, `numeroIdSociedadEcuatorianaRelacionada`,
`porcentajeParticipacionSociedadExterior`, `porcentajeParticipacionPersonaNaturalExterior`,
`valorDividendoDistribuido`, `tarifaRetencionAplicadaDividendo`,
`montoImpuestoRetenidoExterior`, `declaradoIngresoExentoImpuestoRenta`)

> En F **todos los valores van en dólares de EE. UU.**

---

## 8 · Aplicación práctica para VIMARBO

- **Primer año sin reparto de utilidades** → el ADI **no aplica**. Dejarlo registrado
  como “no aplica” con el fundamento (no hubo distribución).
- Si en el futuro reparte: los datos salen de la **ficha societaria** que ya guarda la
  plataforma (socios y porcentajes) + el monto distribuido y su retención.
- Tablas de códigos oficiales (Tabla 1, 2, 3, 4, 5, 7, 9, 10) están en la hoja
  **“Tablas”** del catálogo.

## 9 · Qué falta para el generador

1. Confirmar la **raíz y el anidamiento del XML** (ficha técnica / ejemplo real).
2. Volcar las **tablas de códigos** a constantes del sistema.
3. Implementar `tools/anexo_adi.mjs` y el botón en la web, con las 3 validaciones
   cruzadas de la ficha.
4. Validar contra un ADI real presentado.
