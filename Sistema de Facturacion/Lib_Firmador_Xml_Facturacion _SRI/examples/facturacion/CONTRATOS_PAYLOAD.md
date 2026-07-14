# Contratos de payload

Este archivo resume la estructura que debe tener `data` cuando llamas:

```php
$xml = $facturacion->generarXml($tipo, $data);
```

Para empezar rapido, usa `factura.json` o `retencion.json` y modifica valores. Para integrar en un sistema real, construye estos arrays desde tu venta, cliente, impuestos y configuracion del emisor.

Los generadores actuales usan dos estilos internos:

- Objeto: `factura`, `notaCredito`, `liquidacionCompra`.
- Array: `comprobanteRetencion`, `guiaRemision`, `notaDebito`.

La fachada `FacturacionElectronicaLibrary` acepta arrays normales y convierte al estilo que cada generador necesita. Por eso, desde tu controlador o servicio puedes trabajar con arrays sin preocuparte de ese detalle.

## Campos comunes `infoTributaria`

```json
{
  "ambiente": "1",
  "tipoEmision": "1",
  "razonSocial": "EMPRESA DEMO S.A.",
  "nombreComercial": "EMPRESA DEMO",
  "ruc": "1790012345001",
  "codigoNumerico": "12345678",
  "codDoc": "01",
  "estab": "001",
  "ptoEmi": "001",
  "secuencial": "000000001",
  "dirMatriz": "Quito",
  "regimen": "0"
}
```

`claveAcceso` es opcional en la fachada. Si no viene, se genera con `FacturacionElectronica::GenerarClaveDeAccesos()`.

Para que se genere automaticamente, incluye `codigoNumerico`. Si no lo incluyes, la fachada usa los ultimos 8 digitos del `secuencial`.

## Factura

Raices:

- `infoTributaria`
- `infoFactura`
- `detalle`
- `infoAdicional`

Ver `factura.json`.

Uso:

```php
$payload = json_decode(file_get_contents('examples/facturacion/factura.json'), true);
$xml = $facturacion->generarXml('factura', $payload['data']);
```

## Retencion

Raices:

- `infoTributaria`
- `infoCompRetencion`
- `impuestos`
- `infoAdicional`

Ver `retencion.json`.

Uso:

```php
$payload = json_decode(file_get_contents('examples/facturacion/retencion.json'), true);
$xml = $facturacion->generarXml('comprobanteRetencion', $payload['data']);
```

## Guia de remision

Raices:

- `infoTributaria`
- `infoGuiaRemision`
- `destinatarios`
- `infoAdicional`

Campos principales de `infoGuiaRemision`:

- `fechaEmision`
- `dirEstablecimiento`
- `dirPartida`
- `razonSocialTransportista`
- `tipoIdentificacionTransportista`
- `rucTransportista`
- `obligadoContabilidad`
- `fechaIniTransporte`
- `fechaFinTransporte`
- `placa`

Cada destinatario usa:

- `identificacionDestinatario`
- `razonSocialDestinatario`
- `dirDestinatario`
- `motivoTraslado`
- `detalles`

Cada detalle usa:

- `codigoInterno`
- `descripcion`
- `cantidad`

## Nota de debito

Raices:

- `infoTributaria`
- `infoNotaDebito`
- `motivos`
- `infoAdicional`

Campos principales de `infoNotaDebito`:

- `fechaEmision`
- `dirEstablecimiento`
- `tipoIdentificacionComprador`
- `razonSocialComprador`
- `identificacionComprador`
- `obligadoContabilidad`
- `codDocModificado`
- `numDocModificado`
- `fechaEmisionDocSustento`
- `totalSinImpuestos`
- `impuestos`
- `valorTotal`
- `pagos`

Cada motivo usa:

- `razon`
- `valor`

## Nota de credito

Raices:

- `infoTributaria`
- `infoNotaCredito`
- `detalle`
- `infoAdicional`

Campos principales de `infoNotaCredito`:

- `fechaEmision`
- `dirEstablecimiento`
- `tipoIdentificacionComprador`
- `razonSocialComprador`
- `identificacionComprador`
- `obligadoContabilidad`
- `codDocModificado`
- `numDocModificado`
- `fechaEmisionDocSustento`
- `totalSinImpuestos`
- `valorModificacion`
- `moneda`
- `totalConImpuestos`
- `motivo`

## Liquidacion de compra

Raices:

- `infoTributaria`
- `infoLiquidacionCompra`
- `detalle`
- `infoAdicional`

Campos principales de `infoLiquidacionCompra`:

- `fechaEmision`
- `dirEstablecimiento`
- `obligadoContabilidad`
- `tipoIdentificacionProveedor`
- `razonSocialProveedor`
- `identificacionProveedor`
- `direccionProveedor`
- `totalSinImpuestos`
- `totalDescuento`
- `totalConImpuestos`
- `importeTotal`
- `moneda`
- `pagos`
