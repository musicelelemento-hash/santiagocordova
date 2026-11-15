# Recursos para compañías · inventario y mapeo técnico

Carpeta de referencia: `RECURSOS PARA COMPANIAS O SOC` (raíz del workspace).
Contenido: **31 archivos, ~10 MB**, entre ejemplos reales de la S.A.S. y fichas
técnicas oficiales del SRI.

---

## 1 · Inventario

### 1.1 · Certificados y datos de la empresa

| Archivo | Qué es | Uso en el sistema |
|---|---|---|
| `873025600145.pdf`, `873030483441.pdf`, `873086967267.pdf` | Comprobantes/consultas del RUC | Fuente para cargar datos de la compañía |
| `RCR1794753519557496.pdf` | RUC por establecimiento (RCR) | Establecimientos de la sociedad |
| `RET179475352576151.pdf` | RUC / establecimientos | Idem |

El sistema ya sabe leer el PDF del RUC (`extractDataFromSriPdf`) para personas; se
reutiliza para sociedades y se guarda en `clients.ruc_certificate`.

### 1.2 · Ejemplos reales de anexos (¡los más valiosos!)

| Archivo | Contenido real | Formato |
|---|---|---|
| `Anexo_IVA_78120012.zip` … `80709785.zip` (7) | **ATS enero a julio 2026** (`ATS-ENERO-2026.xml`, …) | XML + ZIP |
| `Anexo_APS_78194660.zip` | **APS / REBEFICS 2025** (`APS-20-2-2026.xml`) | XML + ZIP |

> Aclaración importante: el portal llama “Anexo_IVA” al archivo del **ATS** porque va
> por el operativo IVA. El XML real es `<iva>` con `<compras>` y `<ventas>`.

### 1.3 · Declaraciones presentadas (ejemplos)

`Declaracion_872980685326.pdf` … `Declaracion_873086967267.pdf` (10 PDF) — declaraciones
ya presentadas por el contador anterior, con su **CEP**. Sirven como referencia de
formato y para cargar el histórico en la plataforma.

### 1.4 · Fichas técnicas y catálogos oficiales

| Archivo | Uso |
|---|---|
| `Ficha Tecnica Transaccional Simplificado ATS.pdf` | Reglas y validaciones del ATS |
| `Ficha Técnica REBEFICS.pdf` | Reglas del reporte de beneficiarios finales (APS) |
| `Ficha_Tecnica_ADI.pdf` | Reglas del Anexo de Dividendos |
| `Catalogo_ATS.xls` | Tablas de códigos del ATS (país, tipo comprobante, sustento, etc.) |
| `Catalogo_anexo_de_dividendos.xlsx` | Campos del ADI (esquema 2020 en adelante) |
| `Catálogo REBEFICS.xlsx` | Tablas del APS/REBEFICS (en realidad es un .xls OLE2) |
| `SRI - SISTEMA DE RECEPCION DE ANEXOS POR INTERNET *.pdf` | Instructivos del sistema de anexos (ATF, comprobantes, beneficiarios) |

---

## 2 · Estructura real del **ATS** (`<iva>`)

Ejemplo: `ATS-MAYO-2026.xml` (VIMARBO). Cabecera:

```xml
<iva>
  <TipoIDInformante>R</TipoIDInformante>
  <IdInformante>0791844669001</IdInformante>
  <razonSocial>VIMARBO COMPANY SAS</razonSocial>
  <Anio>2026</Anio>
  <Mes>05</Mes>
  <numEstabRuc>001</numEstabRuc>
  <totalVentas>0.00</totalVentas>
  <codigoOperativo>IVA</codigoOperativo>
  <compras>
    <detalleCompras>
      <codSustento>01</codSustento>
      <tpIdProv>01</tpIdProv>
      <idProv>0791774802001</idProv>
      <tipoComprobante>01</tipoComprobante>
      <parteRel>NO</parteRel>
      <fechaRegistro>02/05/2026</fechaRegistro>
      <establecimiento>001</establecimiento>
      <puntoEmision>050</puntoEmision>
      <secuencial>004434868</secuencial>
      <fechaEmision>02/05/2026</fechaEmision>
      <autorizacion>0205202601079177480200120010500044348681234567811</autorizacion>
      <baseNoGraIva>0</baseNoGraIva>
      <baseImponible>0</baseImponible>
      <baseImpGrav>17.39</baseImpGrav>
      <baseImpExe>0</baseImpExe>
      <montoIce>0</montoIce>
      <montoIva>2.61</montoIva>
      <valRetBien10>0</valRetBien10>
      <valRetServ20>0</valRetServ20>
      <valorRetBienes>0</valorRetBienes>
      <valRetServ50>0</valRetServ50>
      <valorRetServicios>0</valorRetServicios>
      <valRetServ100>0</valRetServ100>
      <totbasesImpReemb>0.00</totbasesImpReemb>
      <pagoExterior>
        <pagoLocExt>01</pagoLocExt>
        …
      </pagoExterior>
    </detalleCompras>
    …
  </compras>
</iva>
```

Campos por línea de compra (los 20 que repite el ejemplo): `codSustento`, `tpIdProv`,
`idProv`, `tipoComprobante`, `parteRel`, `fechaRegistro`, `establecimiento`,
`puntoEmision`, `secuencial`, `fechaEmision`, `autorizacion`, `baseNoGraIva`,
`baseImponible`, `baseImpGrav`, `baseImpExe`, `montoIce`, `montoIva`,
`valRetBien10`, `valRetServ20`, `valorRetBienes`, `valRetServ50`, `valorRetServicios`,
`valRetServ100`, `totbasesImpReemb`, `pagoExterior` (`pagoLocExt`, `paisEfecPago`,
`aplicConvDobTrib`, `pagExtSujRetNorLeg`, `pagoRegFis`).

**Lo que esto habilita:** el ATS se puede **generar desde los comprobantes** que ya
extrae la extensión (compras del mes), con las mismas reglas del 104:
tarifa por factura, sustento, parte relacionada, retenciones.

## 3 · Estructura real del **APS / REBEFICS** (`<aps>`)

Ejemplo: `APS-20-2-2026.xml` (año 2025). Cabecera y accionistas:

```xml
<aps>
  <TipoIDInformante>R</TipoIDInformante>
  <IdInformante>0791844669001</IdInformante>
  <TipoSociedad>01</TipoSociedad>
  <Anio>2025</Anio>
  <Mes>00</Mes>
  <PorcentajeAccionarioNoBolsa>0.00</PorcentajeAccionarioNoBolsa>
  <codigoOperativo>APS</codigoOperativo>
  <PorcentajeAccionarioBolsa>0.00</PorcentajeAccionarioBolsa>
  <Anticipada>NO</Anticipada>
  <TipoDeclaracion>01</TipoDeclaracion>
  <accionistas>
    <accionista>
      <tipoSujeto>01</tipoSujeto>
      <tipoIdentificacion>C</tipoIdentificacion>
      <identificacionInformantePadre>0791844669001</identificacionInformantePadre>
      <numeroIdentificacion>0704708718</numeroIdentificacion>
      <primerNombre>BORIS</primerNombre>
      <segundoNombre>ANDRE</segundoNombre>
      <primerApellido>RODRIGUEZ</primerApellido>
      <segundoApellido>VALVERDE</segundoApellido>
      …
      <esBeneficiarioFinal>…</esBeneficiarioFinal>
      <porcentajeParticipacion>…</porcentajeParticipacion>
      …
    </accionista>
  </accionistas>
</aps>
```

**Corrección al informe anterior:** el REBEFICS **sí se puede generar como XML** (el
SRI lo recibe como anexo APS, ZIP). No es solo formulario web. Eso permite generar el
APS desde los datos de socios que se carguen en la ficha de la empresa.

## 4 · Qué construir con estos recursos

| Recurso | Constructor |
|---|---|
| ATS XMLs de 7 meses | **Generador ATS**: cabecera + detalle de compras/ventas desde los comprobantes extraídos |
| APS/REBEFICS XML | **Generador APS**: cabecera + accionistas desde la ficha de la sociedad |
| `Catalogo_ATS.xls` | Tablas de validación (códigos de sustento, tipo de comprobante, país) |
| `Catalogo_anexo_de_dividendos.xlsx` | Campos del **ADI** para el generador |
| Fichas técnicas PDF | Validaciones y reglas (longitudes, obligatoriedad) |
| Declaraciones PDF + CEP | Histórico por empresa; extraer CEP y estado para la matriz |
| RUC / RCR PDFs | Alta automática de la empresa y sus establecimientos |

## 5 · Regla de detección: ¿es compañía?

En Ecuador el **tercer dígito del RUC** identifica la naturaleza:

| 3.er dígito | Tipo |
|---|---|
| **9** | **Persona jurídica / sociedad** |
| 6 | Entidad pública |
| 0, 1, 2, 3, 4, 5, 7, 8 | Persona natural / otros |

Implementado como **`esRucSociedad(ruc)`**: si el 3.er dígito es 9, el cliente es
sociedad y corresponde habilitar **1021, REBEFICS, ADI** (anuales) y **ATS** (mensual),
además del IVA 2011.

## 6 · Siguiente paso

1. Cargar VIMARBO con sus socios (BORIS ANDRE RODRIGUEZ VALVERDE, C.I. 0704708718).
2. Generar el **APS 2026** (REBEFICS) desde la ficha — vence 28 del mes siguiente a la
   constitución si es nueva sociedad.
3. Generar el **ATS** de cada mes desde las compras extraídas y validarlo contra los
   catálogos.
4. Guardar cada archivo generado y su CEP en la nube (R2) para la bóveda de la empresa.
