# ATS · cómo lo generan en el mercado y si nuestro sistema sirve

**Fecha:** 15-nov-2026 · **Alcance:** Anexo Transaccional Simplificado (ATS), generación
técnica, validaciones y subida. Comparación con lo que ya tenemos en Nueva Luz / la web.

---

## 1 · Resumen ejecutivo

- El ATS **no tiene formulario web**: se presenta como **archivo XML comprimido (.zip)**
  por el sistema de anexos del SRI. Todo el mercado (SRI, Odoo, sistemas contables,
  gestorías) hace lo mismo: **construir un XML con la estructura del catálogo del SRI,
  validarlo y subirlo**.
- El SRI ofrece **tres vías oficiales**: (1) **DIMM Anexos + programa ATS** (escritorio),
  (2) **plantilla Excel** que genera el XML con el programa ATS, y (3) subir el ZIP
  directo por **Anexos → Envío y consulta**.
- Los sistemas contables profesionales (ej. el módulo **Odoo `l10n_ec_sri_ats`**,
  USD 269) hacen exactamente lo mismo que nosotros, con más cobertura: consolidan
  facturas/notas de crédito, generan `compras`, `ventas`, `ventasEstablecimiento`,
  `anulados` y retenciones (`air`), validan reglas y suben con credenciales.
- **Nuestro generador ya produce el XML nativo `<iva>` y es byte a byte idéntico al
  que el SRI aceptó** (7 ATS reales de VIMARBO, enero–julio 2026). El enfoque es el
  correcto y funciona **para el caso actual**: compras con IVA, sin retenciones
  informadas y con las ventas resumidas por establecimiento.
- **Lo que falta para cobertura total:** `air` (retenciones de renta por compra),
  `<ventas>` detallada por contraparte, `<anulados>`, validación de dígitos
  verificadores y validación XSD previa. No es que “no funcione”: es alcance.

---

## 2 · Cómo se genera técnicamente (las 3 vías del SRI)

Según el **instructivo oficial** “Generar Anexo ATS desde Excel”
([SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/5e50914d-aa3f-4b47-9795-6d8c5766c7ae/Instructivo_Generar_AnexoATS_Excel.pdf)):

1. **DIMM Anexos** (herramienta de escritorio multiplataforma) + **Programa ATS
   v1.3.0 (2020)** instalado.
2. **Plantilla Excel** con hojas por sección. El programa ATS **lee el Excel y
   exporta el XML**, que el DIMM comprime y envía.
3. Alternativa: subir el **ZIP del XML** directo por el portal
   (*Anexos → Envío y consulta de anexos*), con **límite de 8 MB**
   ([SRI anexos](https://www.sri.gob.ec/web/intersri/formularios-e-instructivos1)).

> Es decir: **en el fondo todas las herramientas construyen un XML** y lo suben.
> La “plantilla Excel” es solo la interfaz de carga del SRI, no un formato distinto.

---

## 3 · Anatomía técnica (lo que el catálogo exige)

La plantilla oficial lo divide en **secciones que corresponden a nodos del XML**:

| Sección del instructivo | Nodo del XML | Qué lleva |
|---|---|---|
| Compras **detalladas** | `<compras><detalleCompras>` | factura de compra: proveedor, comprobante, bases por tarifa, IVA |
| Compras **formas de pago** | `<formasDePago><formaPago>` | **solo compras > USD 1.000**; se relaciona por código de compra |
| Compras **retenciones** | `air` / `detalleAir` | código de retención, base del IR, porcentaje y valor retenido |
| Compras **reembolsos** | `totbasesImpReemb` | base de reembolsos |
| **Ventas** | `<ventas>` | consolidado por tipo de identificación del cliente (`tpIdCliente`) |
| **Ventas por establecimiento** | `ventasEstablecimiento/ventaEst` | resumen por establecimiento |
| **Anulados** | `<anulados>` | comprobantes anulados del período |

Datos finos que el instructivo agrega y conviene tener mapeados:

- Casos de **dividendos** dentro de compras: `codSustento` **10**,
  `tipoComprobante` **19**, retenciones **345/346**, más “fecha de pago de dividendos”,
  “impuesto a la renta asociado” y “año de utilidad dividendo”.
- La **relación** entre hojas se hace por un **código de compra** interno en la plantilla;
  en el XML esa relación se resuelve por el propio detalle del comprobante.

> El catálogo completo (códigos de sustento, tipo de comprobante, país, formas de pago)
> está en la [ficha técnica del ATS](https://www.sri.gob.ec/) y en el catálogo
> `Catalogo_ATS.xls` que tenemos en `RECURSOS PARA COMPANIAS O SOC`.

---

## 4 · Qué hacen las herramientas del mercado

### 4.1 · Módulo Odoo `l10n_ec_sri_ats` (referencia profesional, USD 269)

Según su ficha oficial ([Odoo Apps](https://apps.odoo.com/apps/modules/18.0/l10n_ec_sri_ats)):

- Genera el **XML nativo del SRI** (raíz `<iva>`): `compras` con IVA y **retenciones de
  renta (`air`/`detalleAir`)**, `ventas` **consolidado por `tpIdCliente` (04–08)**,
  `ventasEstablecimiento` y **`anulados`**.
- **Recolecta el período desde la contabilidad**: facturas de cliente → ventas;
  facturas de proveedor → compras con sustento y retenciones; **notas de crédito** →
  códigos de comprobante automáticos.
- **Valida dígitos verificadores ecuatorianos**: cédula módulo-10 y las tres familias
  de RUC (natural módulo-10, público módulo-11 con coeficientes 3-2, privado módulo-11
  con 4-3-2).
- **Validaciones de negocio**: RUC del informante, códigos de sustento y comprobante,
  tipos de identificación, **coherencia de IVA 15 %** y **coherencia retención vs base**.
- **Subida BYOK** (credenciales propias del contribuyente) con reintentos y backoff, o
  entrega del XML para el **DIMM**.

### 4.2 · DIMM + Programa ATS (vía oficial)

- Valida estructura y catálogos al importar el Excel y al generar el XML.
- Genera el `.zip` y lo sube; devuelve el **acuse** del SRI.

### 4.3 · Gestorías / plantillas Excel

- Llenan la plantilla del SRI (o una propia) a mano, aplican fórmulas y usan el
  programa ATS. Es la vía más lenta y con más errores de tipeo, pero es lo que hace
  la mayoría de los estudios contables pequeños.

**Patrón común del mercado:** XML nativo + validaciones previas + subida y acuse.
Nada de “formulario web”.

---

## 5 · Nuestro sistema frente al estándar

### 5.1 · Lo que ya está y coincide con el mercado

| Pieza | Estado |
|---|---|
| XML nativo con raíz `<iva>` y orden exacto de campos | ✅ validado **byte a byte** con 7 ATS reales (ene–jul 2026) |
| `compras/detalleCompras` con los 24 campos | ✅ |
| `pagoExterior` y `formasDePago` (compras > 1.000) | ✅ soportados |
| `docModificado` (notas de crédito/débito) | ✅ soportado |
| `totbasesImpReemb` | ✅ (se conserva el formato del SRI) |
| `totalVentas` y `ventasEstablecimiento` | ✅ desde las ventas declaradas en el 104 |
| ZIP con nombre del SRI (`Anexo_IVA_<ruc>.zip`) | ✅ |
| Subida por el portal + **acuse** guardado | ✅ nuevo uploader (v3.3.5) con `Cargar` → `Aceptar` |
| Generador APS/REBEFICS | ✅ byte a byte contra el APS real |
| Guía de orden (IVA → ATS) | ✅ Círculo mensual + “ATS pendientes” |

### 5.2 · Lo que falta para cobertura total (ordenado por impacto)

| # | Falta | Por qué importa | Esfuerzo |
|---|---|---|---|
| 1 | **`air`/`detalleAir`** (retenciones de renta por compra) | Sin esto, un ATS con retenciones queda incompleto | M |
| 2 | **`<ventas>` detallada** por `tpIdCliente` | Hoy informamos ventas solo por establecimiento | M |
| 3 | **`<anulados>`** | Comprobantes anulados del período | S |
| 4 | **Validación de dígitos verificadores** (cédula/RUC) | Evita rechazos por tipeo antes de subir | S |
| 5 | **Validación XSD / catálogos** (sustento, comprobante, país, forma de pago) | Detecta errores antes del portal | M |
| 6 | **Subida con acuse a la bóveda** (R2 + `sri_declaraciones`) | Hoy el acuse queda en la extensión; falta persistirlo | S |

> Los puntos 1–3 son los que separan “nos funciona para VIMARBO” de “nos funciona para
> cualquier cliente”. Nuestro XML ya es el correcto; lo que falta es **más cobertura de
> secciones**, no rehacer el motor.

---

## 6 · Veredicto: ¿funciona nuestro sistema?

**Sí, y por la razón correcta.**

1. **El formato es el del SRI**: el generador reproduce **byte a byte** los 7 ATS que el
   contador anterior presentó y el SRI aceptó. No es una aproximación.
2. **El enfoque coincide con el mercado profesional**: XML nativo, compras detalladas,
   ZIP, subida por el portal y acuse.
3. **Para VIMARBO hoy alcanza**: su ATS real va sin retenciones informadas y con las
   ventas resumidas; el generador produce exactamente eso.

**Límite honesto:** si mañana un cliente trae **retenciones de renta** en sus compras o
necesita **ventas detalladas por contraparte** o **anulados**, el archivo saldría
incompleto. Eso no es un error de formato; es alcance pendiente (tabla 5.2).

---

## 7 · Plan de cierre técnico (lo que yo haría)

1. **`air`/`detalleAir`**: extender `atsDesdeCompras` para aceptar retenciones por factura
   (código, base, %, valor) y validar contra la ficha técnica.
2. **`<ventas>`**: agrupar por `tpIdCliente` desde las facturas emitidas (la extensión ya
   extrae comprobantes; agregar la contraparte de ventas).
3. **`<anulados>`**: leer los comprobantes anulados del mes desde el portal.
4. **Validadores**: dígitos verificadores + catálogos + coherencia (IVA 15 %, retención vs base).
5. **Persistir el acuse** en R2 y en `sri_declaraciones` para que la matriz quede “con
   comprobante”.
6. **Validar contra un ATS con retenciones** real (como hicimos con los 7 de VIMARBO).

---

## 8 · Fuentes

- SRI — [Instructivo para generar Anexo ATS desde Excel](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/5e50914d-aa3f-4b47-9795-6d8c5766c7ae/Instructivo_Generar_AnexoATS_Excel.pdf)
- SRI — [Anexos y guías (límite de 8 MB para el portal)](https://www.sri.gob.ec/web/intersri/formularios-e-instructivos1)
- SRI — [Ficha técnica del ATS (local: `Ficha Tecnica Transaccional Simplificado ATS.pdf`)](https://www.sri.gob.ec/)
- Russell Bedford — [Presentación de Anexos Transaccionales (Resolución NAC-DGERCGC12-00001 y reformas)](http://russellbedford.com.ec/wp-content/uploads/2023/04/Anexo-ATS-2023-.pdf)
- Odoo Apps — [Ecuador SRI ATS (`l10n_ec_sri_ats`): XML nativo, validaciones y subida BYOK](https://apps.odoo.com/apps/modules/18.0/l10n_ec_sri_ats)
- SRI — [Guía de compensación automática (valida “ATS presentado”)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/d0a11dfc-4ad8-4aff-b6b8-d20d34dc8e60/Gu%C3%ADa%20Pr%C3%A1ctica%20de%20Acceso%20y%20Uso%20para%20la%20Compensaci%C3%B3n%20Autom%C3%A1tica%20con%20Retenciones%20IVA.pdf)
- Evidencia propia: `_EVIDENCIA_SRI/RECORRIDO DE TODOS ANEXO` (mapa del módulo de anexos) y los 7 ATS reales de VIMARBO.
