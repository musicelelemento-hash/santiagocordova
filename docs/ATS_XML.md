# ATS · Anexo Transaccional Simplificado (generador validado)

El **ATS** es el anexo mensual de compras y ventas. Se presenta como **XML comprimido
(.zip)** por el sistema de anexos del SRI.

En este proyecto hay **generador validado**: `tools/anexo_ats.mjs` reproduce
**byte a byte** los **7 ATS reales** que presentó el contador anterior de VIMARBO
(enero a julio 2026) — 7/7 idénticos.

---

## 1 · Uso

```powershell
node "extenciones web/tools/anexo_ats.mjs" --json "ats.json" --zip
```

Salida:

```
ATS-2026-05.xml
Anexo_IVA_0791844669001.zip
```

## 2 · Estructura XML (orden exacto)

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
      … 24 campos + pagoExterior (+ formasDePago / docModificado opcionales) …
    </detalleCompras>
  </compras>
  <ventasEstablecimiento>
    <ventaEst>
      <codEstab>001</codEstab>
      <ventasEstab>0</ventasEstab>
      <ivaComp>0</ivaComp>
    </ventaEst>
  </ventasEstablecimiento>
</iva>
```

### 2.1 · Campos obligatorios por compra (24)

`codSustento` · `tpIdProv` · `idProv` · `tipoComprobante` · `parteRel` ·
`fechaRegistro` · `establecimiento` · `puntoEmision` · `secuencial` · `fechaEmision` ·
`autorizacion` · `baseNoGraIva` · `baseImponible` · `baseImpGrav` · `baseImpExe` ·
`montoIce` · `montoIva` · `valRetBien10` · `valRetServ20` · `valorRetBienes` ·
`valRetServ50` · `valorRetServicios` · `valRetServ100` · `totbasesImpReemb`

### 2.2 · Bloque `pagoExterior` (siempre)

`pagoLocExt` (01 local / 02 exterior) · `paisEfecPago` · `aplicConvDobTrib` ·
`pagExtSujRetNorLeg` · `pagoRegFis`. En los ejemplos: `01`, `NA`, `NA`, `NA`, `NA`.

### 2.3 · Bloques opcionales

| Bloque | Cuándo | Ejemplo observado |
|---|---|---|
| `formasDePago` → `formaPago` | Cuando el comprobante declara forma de pago | `20` (otros medios) |
| `docModificado`, `estabModificado`, `ptoEmiModificado`, `secModificado`, `autModificado` | Comprobantes modificados (NC/ND sobre otro documento) | solo 1 caso en junio |

## 3 · Formato del JSON de entrada

```json
{
  "cabecera": {
    "IdInformante": "0791844669001",
    "razonSocial": "VIMARBO COMPANY SAS",
    "Anio": 2026,
    "Mes": 5,
    "numEstabRuc": "001",
    "totalVentas": "0.00"
  },
  "compras": [
    {
      "codSustento": "01",
      "tpIdProv": "01",
      "idProv": "0791774802001",
      "tipoComprobante": "01",
      "parteRel": "NO",
      "fechaRegistro": "02/05/2026",
      "establecimiento": "001",
      "puntoEmision": "050",
      "secuencial": "004434868",
      "fechaEmision": "02/05/2026",
      "autorizacion": "0205202601079177480200120010500044348681234567811",
      "baseNoGraIva": "0",
      "baseImponible": "0",
      "baseImpGrav": "17.39",
      "baseImpExe": "0",
      "montoIce": "0",
      "montoIva": "2.61",
      "valRetBien10": "0",
      "valRetServ20": "0",
      "valorRetBienes": "0",
      "valRetServ50": "0",
      "valorRetServicios": "0",
      "valRetServ100": "0",
      "totbasesImpReemb": "           0.00",
      "pagoExterior": { "pagoLocExt": "01", "paisEfecPago": "NA", "aplicConvDobTrib": "NA", "pagExtSujRetNorLeg": "NA", "pagoRegFis": "NA" },
      "formasDePago": ["20"]
    }
  ],
  "ventasEstablecimiento": [{ "codEstab": "001", "ventasEstab": "0", "ivaComp": "0" }]
}
```

> `totbasesImpReemb` en los archivos reales viene **con relleno** (`           0.00`).
> El generador lo respeta tal cual si se lo pasás así.

## 4 · De dónde salen los datos

| Campo | Origen |
|---|---|
| Cabecera | Ficha de la empresa + período |
| `idProv`, `tpIdProv`, `autorizacion`, `secuencial`, bases, IVA | **Comprobantes de compra** (facturación electrónica / XML del proveedor) |
| `codSustento` | Catálogo del SRI (01 = crédito tributario, etc.) |
| `parteRel` | Si el proveedor es parte relacionada |
| Retenciones | Comprobantes de retención emitidos al proveedor |
| `ventasEstablecimiento` | Resumen de ventas por establecimiento (0 si no hubo) |

La extensión **01** ya extrae las compras del mes desde el portal
(`Extraer datos → compras`). El siguiente paso es volcar eso al JSON del ATS.

## 5 · Validación (2026)

| Mes | Compras | Resultado |
|---|---|---|
| Enero | 20 | ✅ idéntico (26.309 B) |
| Febrero | 25 | ✅ idéntico (32.824 B) |
| Marzo | 26 | ✅ idéntico (34.107 B) |
| Abril | 18 | ✅ idéntico (23.823 B) |
| Mayo | 20 | ✅ idéntico (26.302 B) |
| Junio | 34 | ✅ idéntico (44.773 B) |
| Julio | 12 | ✅ idéntico (15.950 B) |

**7/7 byte a byte.** Con eso el formato está garantizado contra el criterio del SRI.

## 6 · Pendiente

1. Volcar las compras extraídas al JSON (mapear `codSustento`, `parteRel`, retenciones).
2. Validador de códigos contra `Catalogo_ATS.xls` (catálogo en formato antiguo).
3. Botón **“Generar ATS”** en la web (mismo patrón que el APS) y subida por ZIP desde la extensión.
4. Los campos de ventas (`<ventas>` por comprobante) para empresas que facturan: en los
   ejemplos de VIMARBO el módulo de ventas va en cero porque las facturas electrónicas
   no se repiten en el ATS; solo se informa `ventasEstablecimiento`.
