# Informe: llevar sociedades (S.A.S.) en la plataforma

**Cliente:** VIMARBO COMPANY S.A.S.
**RUC:** `0791844669001` · **Correo:** vimarbocompanysas@gmail.com · **Teléfono:** 0997455763
**Representante legal:** `0704708718` — RODRIGUEZ VALVERDE BORIS ANDRE
**Objetivo:** adaptar el sistema (personas → sociedades) y llevar sus obligaciones,
empezando por **todo en cero** el primer año.

> Aviso: este informe es técnico y de planificación. Las fechas y reglas se basan
> en la normativa vigente a noviembre 2026 (Resolución REBEFICS NAC-DGERCGC24-00000033,
> resoluciones de ATS y ADI, calendario SRI 2026). Antes de presentar, confirmar el
> calendario del año en el portal del SRI.

---

## 1 · Resumen ejecutivo

Una S.A.S. tiene **5 obligaciones**, no 2:

| # | Obligación | Código | Periodicidad | Vence |
|---|---|---|---|---|
| 1 | Declaración de Impuesto a la Renta Sociedades | **1021** | Anual | **10–28 de abril** (11 si es especial) |
| 2 | REBEFICS (Beneficiarios Finales y Composición Societaria) | — | Anual | **10–28 de febrero** |
| 3 | Anexo de Dividendos, Utilidades o Beneficios | **ADI** | Anual | **mayo** (calendario por 9.º dígito) |
| 4 | Declaración de IVA | **2011** | Mensual | 10–28 del mes siguiente |
| 5 | Anexo Transaccional Simplificado | **ATS** | Mensual | según 9.º dígito |

**Respuestas directas a tus preguntas:**

- **¿La declaración de IVA es igual que en Régimen General?** **Sí, idéntica**: mismo
  formulario 2011, mismos casilleros, misma periodicidad mensual y mismo procedimiento.
  Lo que cambia son las obligaciones **anuales** y los **anexos**.
- **¿Se sube un XML?** Depende:
  - **ATS** → **sí, XML comprimido (.zip)** (DIMM Anexos o sistema propio).
  - **ADI** → **sí, XML/ZIP** (formato del SRI).
  - **1021, 2011 y REBEFICS** → **formulario web en el portal**, no XML.
- **¿Se puede llevar todo en cero?** Se puede **presentar en cero**, pero **no es
  “no presentar”**: la obligación existe y el incumplimiento tiene multa. Además
  REBEFICS **no admite “sin movimiento”**: hay que declarar socios y beneficiarios
  finales aunque la empresa no facture.

---

## 2 · Detalle de cada obligación

### 2.1 · Formulario 1021 — Renta Sociedades (anual)

- **Qué es:** declaración anual del impuesto a la renta de sociedades por el ejercicio
  fiscal anterior (enero–diciembre).
- **Cuándo:** 10 al 28 de abril según el 9.º dígito del RUC; contribuyentes especiales
  hasta el 11.
- **Cómo se presenta:** en SRI en Línea → **Declaraciones → Impuesto a la Renta →
  Sociedades**, formulario web (no XML).
- **Qué pide:** ingresos, costos y gastos, conciliación tributaria, activos/pasivos,
  impuesto causado, retenciones, anticipos, datos del representante legal.
- **En cero:** se puede presentar “sin actividad” con base imponible en 0, **pero**
  exige coherencia con los estados financieros (todos en cero) y las obligaciones de
  contabilidad. Si hay gastos, ya no es cero.
- **Se guarda:** comprobante de la declaración (PDF/CEP) en la ficha del cliente.

### 2.2 · REBEFICS — Beneficiarios Finales y Composición Societaria (anual)

- **Qué es:** reporte anual de **quién está detrás de la compañía** (accionistas,
  porcentajes, beneficiarios finales) con corte al 31 de diciembre, exigido por la
  Resolución NAC-DGERCGC24-00000033.
- **Quién:** sociedades nacionales y extranjeras domiciliadas (esta S.A.S. incluida).
- **Cuándo:**
  - Régimen general: **10 al 28 de febrero**, según el 9.º dígito del RUC.
  - **Sociedad recién constituida:** hasta el **28 del mes siguiente** a la
    constitución (o al cambio de composición societaria).
- **Cómo se presenta:** anexo **APS** (`<aps>`) en **XML + ZIP** por el sistema de
  anexos; también existe el formulario web REBEFICS.
- **En cero:** **no existe “en cero”**: aunque no facture, debe informar composición
  societaria y beneficiario final. Omitirlo es una de las faltas más observadas.
- **Qué pide:** accionistas (nombre, tipo, país, %), beneficiarios finales,
  representantes legales, y la calidad de “obligado a llevar contabilidad”.
- **Para esta empresa:** socios y porcentajes de VIMARBO; el representante legal es
  RODRIGUEZ VALVERDE BORIS ANDRE (0704708718), que puede o no ser beneficiario final.

### 2.3 · ADI — Anexo de Dividendos, Utilidades o Beneficios (anual)

- **Qué es:** informe anual de dividendos repartidos a socios y de utilidades.
- **Cuándo:** **mayo** (calendario por 9.º dígito, mismo esquema 10–28).
- **Cómo se presenta:** DIMM Anexos → **XML comprimido (.zip)** (formato ADI del SRI).
- **Obligatorio:** cuando la compañía **distribuye dividendos/beneficios**.
- **En cero:** si el primer año **no reparte** utilidades, normalmente **no aplica** la
  presentación; conviene dejar el registro “no aplica” con el fundamento. Confirmar con
  el contador porque el SRI puede exigir el anexo “sin movimiento” según el caso.

### 2.4 · Formulario 2011 — IVA (mensual)

- **Qué es:** declaración mensual del IVA.
- **Cuándo:** mes siguiente, 10–28 según 9.º dígito.
- **Cómo se presenta:** portal del SRI, formulario web (igual que una persona natural
  de Régimen General). **La extensión 01 ya automatiza este flujo.**
- **En cero:** se presenta en ceros cuando no hubo ventas ni compras; es el único de
  los mensuales que la plataforma hoy sabe preparar.

### 2.5 · ATS — Anexo Transaccional Simplificado (mensual)

- **Qué es:** detalle de compras, ventas, notas de crédito/débito, anulados,
  exportaciones, importaciones y retenciones del mes.
- **Quién está obligado:** incluye expresamente a las **Sociedades por Acciones
  Simplificadas (S.A.S.)**, empresas en general y obligados a llevar contabilidad.
- **Cómo se presenta:** **archivo XML comprimido en .zip** (DIMM Anexos o sistema
  propio). Hay ficha técnica con validaciones XSD.
- **En cero:** si no hubo movimiento **no hay obligación estricta**, pero si no se
  presenta hay que enviar al SRI una **justificación**. En la práctica se presenta el
  **ATS en cero** cada mes para no quedar con justificaciones pendientes.
- **Dato técnico:** las facturas, NC y ND electrónicas **no** se repiten en el módulo
  de ventas del ATS; los comprobantes de retención electrónicos **no** se repiten en
  compras desde enero 2018.

---

## 3 · Qué significa “todo en cero” (importante)

| Obligación | ¿Puede ir en cero? | Riesgo si no se presenta |
|---|---|---|
| IVA 2011 | Sí, en ceros | Multa por no declarar; intereses si hubiera impuesto |
| ATS | Sí, en cero (XML) | Justificación pendiente, posibles multas |
| 1021 Renta | Sí, pero con estados financieros en cero | Multa; la sociedad no queda eximida |
| REBEFICS | **No existe en cero** | Una de las faltas más sancionadas |
| ADI | No aplica si no hay dividendos | Solo si reparte |

**Conclusión:** “en cero” no es “sin obligaciones”. Lo que se puede hacer es
**presentar declaraciones sin valores**, y en REBEFICS declarar la composición real.
Además una S.A.S., por ser sociedad, **debe llevar contabilidad**, aunque esté inactiva.

**Otras obligaciones societarias a considerar** (no tributarias):
estados financieros y nómina de administradores a la **Superintendencia de Compañías
(SCVS)** cuando la compañía esté bajo su control, y pago de **utilidades** si tiene
empleados en relación de dependencia.

---

## 4 · Adaptación del sistema: modelo de datos

Hoy el sistema está pensado para **personas naturales** (cédula/RUC de persona). Hay
que agregar el concepto **persona jurídica**.

### 4.1 · Nuevos campos en `clients`

```sql
alter table public.clients
  add column if not exists entity_type text not null default 'natural'
    check (entity_type in ('natural', 'sociedad')),
  add column if not exists company_type text,            -- 'SAS', 'CIA_LTDA', 'EP', ...
  add column if not exists constitution_date date,
  add column if not exists legal_representative jsonb,   -- { nombre, identificacion, email, telefono }
  add column if not exists partners jsonb,               -- [{ nombre, identificacion, pais, porcentaje, tipo }]
  add column if not exists keeps_accounting boolean default true,
  add column if not exists special_taxpayer boolean default false,
  add column if not exists scvs_controlled boolean default false;
```

### 4.2 · Catálogo de obligaciones (tabla nueva o constante)

```sql
create table if not exists public.tax_obligations_catalog (
  code           text primary key,   -- '1021', '2011', 'REBEFICS', 'ADI', 'ATS'
  name           text not null,
  frequency      text not null check (frequency in ('mensual','anual','eventual')),
  format         text not null check (format in ('formulario','xml','formulario_xml')),
  applies_to     text not null default 'ambos',   -- natural | sociedad | ambos
  starts_from    text,               -- 'constitucion' | 'ejercicio'
  notes          text
);
```

Carga inicial:

| code | name | frequency | format | applies_to |
|---|---|---|---|---|
| 2011 | Declaración de IVA | mensual | formulario | ambos |
| ATS | Anexo Transaccional Simplificado | mensual | xml | sociedad / obligados |
| 1021 | Impuesto a la Renta Sociedades | anual | formulario | sociedad |
| REBEFICS | Beneficiarios finales (APS) | anual | xml | sociedad |
| ADI | Anexo de Dividendos | anual | xml | sociedad (si reparte) |
| 104 | IVA persona natural | mensual/semestral | formulario | natural |

### 4.3 · Vencimientos

- Mensuales y anuales se calculan por **9.º dígito del RUC** (tabla ya existente para
  IVA). Añadir:
  - ATS: mismo calendario mensual que el IVA (día 10–28 del mes siguiente).
  - 1021: abril 10–28 (11 si `special_taxpayer`).
  - REBEFICS: febrero 10–28; **excepción**: constitución nueva → 28 del mes siguiente.
  - ADI: mayo 10–28 (solo si hubo dividendos).

---

## 5 · Adaptación del sistema: pantallas

1. **Alta de empresa**: formulario nuevo (RUC, razón social, tipo societario, fecha
   de constitución, representante legal, socios con % y correo/teléfono).
2. **Ficha de la empresa**: pestañas como el cliente natural + **Composición
   societaria** + **Documentos societarios** (estados financieros, acuse REBEFICS).
3. **Matriz de Declaraciones**: hoy tiene columnas mensuales; agregar **fila de
   obligaciones anuales** (1021, REBEFICS, ADI) y columna **ATS** (mensual, XML).
   Semáforo por obligación, no solo por cliente.
4. **Anexos**: botones para generar/descargar **XML de ATS** y **XML de ADI**, con
   validador de estructura y ZIP con nombre del SRI.
5. **Cumplimiento**: contador de obligaciones presentadas/pendientes por año; alerta
   temprana de REBEFICS (febrero) y 1021 (abril).
6. **Portal del cliente** (`/portal`): la empresa ve sus comprobantes y estados.

---

## 6 · Automatización (extensión 01)

Lo que se puede automatizar, en orden de esfuerzo:

| Flujo | Viabilidad | Notas |
|---|---|---|
| IVA 2011 | ✅ ya funciona | mismo wizard |
| **1021 Renta** | 🟡 media | mismo wizard de declaraciones (`recibirDeclaracion.jsf`) con obligación `1021`; el formulario es más grande (conciliación) → automatizar solo cuando esté en cero |
| **Anexo ADI** | 🟢 alta | igual que el Anexo ICE: XML + ZIP; ficha técnica del SRI |
| **ATS mensual** | 🟢 alta | XML + ZIP por DIMM; validar XSD antes de subir |
| REBEFICS (APS) | 🟢 alta | **XML `<aps>` + ZIP**, como el ejemplo del contador anterior |

Recomendación: reutilizar lo ya construido para ICE (generar XML, ZIP y subir por
`input[type=file]`) para **ADI** y **ATS**. Para **1021** usar el mismo wizard que IVA
eligiendo la obligación por **texto** (`1021`), y detenerse antes de enviar para que el
contador revise la conciliación.

---

## 7 · Plan por fases (estimación)

| Fase | Contenido | Estimación |
|---|---|---|
| **F0** | Alta de VIMARBO en la web (empresa, representante, socios) y verificación de RUC en el SRI | 1 día |
| **F1** | Modelo de datos (SQL) + tipos TS + formulario de empresa | 2–3 días |
| **F2** | Catálogo de obligaciones + vencimientos (incluye REBEFICS y 1021) + matriz | 3 días |
| **F3** | Generadores XML **ATS** y **ADI** con validador y ZIP | 4–5 días |
| **F4** | Automatización de navegación (1021 por texto, ADI/ATS por ZIP) | 3–4 días |
| **F5** | Notificaciones por vencimiento y reporte de cumplimiento anual | 2 días |
| **F6** | Pruebas en cero con VIMARBO y documentación | 2 días |

Total: **~3 semanas** de desarrollo; F0 se puede hacer **hoy** para no perder el
vencimiento de REBEFICS.

---

## 8 · Checklist de conceptos a implementar

- [ ] `entity_type` y datos societarios en `clients`.
- [ ] Socios/accionistas con porcentaje y beneficiario final.
- [ ] Representante legal como contacto y firmante.
- [ ] Catálogo de obligaciones con formatos (`formulario` vs `xml`).
- [ ] Calendario: 1021 (abril), REBEFICS (febrero / constitución), ADI (mayo), ATS (mensual).
- [ ] Aviso especial REBEFICS para sociedad nueva (28 días).
- [ ] Matriz con obligaciones anuales y ATS.
- [ ] Generador + validador **ATS XML** (ficha técnica SRI).
- [ ] Generador + validador **ADI XML**.
- [ ] Subida de ZIP desde la extensión (reutilizar el patrón del Anexo ICE).
- [ ] Guardar comprobantes/acuses de cada obligación en la nube (R2).
- [ ] Recordatorios automáticos (correo/WhatsApp) por vencimiento.
- [ ] Reporte anual de cumplimiento por empresa.
- [ ] Estados financieros y SCVS como documentos del cliente.
- [ ] Utilidades y relación de dependencia (si hay empleados).

---

## 9 · Datos que faltan para arrancar F0

1. Fecha de constitución de VIMARBO (define el plazo de REBEFICS).
2. Socios/accionistas y porcentajes (para REBEFICS).
3. ¿El representante legal es beneficiario final?
4. ¿La empresa tiene empleados en relación de dependencia?
5. ¿Está bajo control de la SCVS (constituida en Superintendencia de Compañías)?
6. ¿Es contribuyente especial? (cambia vencimientos de 1021 y ATS).
7. Actividad económica y si emitirá facturas electrónicas desde el inicio.
8. Correo y teléfono ya dados: `vimarbocompanysas@gmail.com` · `0997455763`.

---

## 10 · Fuentes y referencias

- SRI — [Ficha Técnica del Anexo de Dividendos (ADI)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/7dc34f69-78af-4753-ad4b-db546ab713c5/Ficha_Tecnica_ADI.pdf)
- SRI — [Tríptico de obligaciones de sociedades](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/af37fe46-29ca-426b-84cb-5ff39ae92dfb/TRIPTICO-SOCIEDADES.pdf)
- SRI — [REBEFICS: trámite oficial](https://www.gob.ec/sri/tramites/reporte-beneficiarios-finales-composicion-societaria-rebefics-antiguo-aps)
- Almeida Guzmán & Asociados — [Calendario REBEFICS 2026](https://almeidaguzman.com/sri-reporte-de-beneficiarios-finales-y-de-composicion-societaria-rebefics-2/)
- JEZL Auditores — [Anexo Transaccional Simplificado (ATS)](https://www.jezl-auditores.com/tributario/80-anexo-transaccional-simplificado-ats)
- ERB — [Obligaciones de abril 2026 (Renta Sociedades)](https://erb.com.ec/obligaciones-tributarias-societarias-y-laborales-para-el-mes-de-abril-2026/)
