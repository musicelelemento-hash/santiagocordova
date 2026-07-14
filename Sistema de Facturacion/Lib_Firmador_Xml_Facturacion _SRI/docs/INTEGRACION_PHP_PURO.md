# Integracion con PHP puro

Esta guia muestra como usar la libreria directamente desde un proyecto PHP sin Laravel. No es necesario consumir endpoints HTTP ni levantar esta aplicacion como API.

La clase recomendada es:

```php
LibreriasSri\FacturacionElectronicaLibrary
```

Esa fachada permite:

- generar XML de comprobantes SRI
- generar clave de acceso
- firmar XML con certificado `.p12`
- validar cedula/RUC
- enviar y autorizar en SRI si tienes `soap` habilitado

## Requisitos

- PHP 8.1 o superior.
- Composer.
- Extensiones PHP: `openssl`, `dom`, `simplexml`.
- Extension `soap` solo si vas a enviar/autorizar en SRI.
- `openssl` disponible en consola si tu `.p12` es legacy y usas OpenSSL 3.
- `cacert.pem` configurado si vas a consumir los WSDL del SRI.

Verifica extensiones:

```bash
php -m
```

## Instalacion rapida

Si vas a trabajar dentro de este repositorio:

```bash
composer install
composer dump-autoload
```

Luego ejecuta el ejemplo directo:

```bash
php examples/facturacion/php_puro_directo.php
```

El ejemplo genera:

```text
storage/app/demo_php_puro/factura-generada.xml
```

## Ejemplo minimo: generar XML

```php
<?php

use LibreriasSri\FacturacionElectronicaLibrary;

require __DIR__.'/vendor/autoload.php';

$facturacion = new FacturacionElectronicaLibrary();

$payload = json_decode(file_get_contents(__DIR__.'/factura.json'), true);

$xml = $facturacion->generarXml($payload['tipo'], $payload['data']);

file_put_contents(__DIR__.'/factura-generada.xml', $xml);
```

`factura.json` debe tener esta forma:

```json
{
  "tipo": "factura",
  "data": {
    "infoTributaria": {},
    "infoFactura": {},
    "detalle": [],
    "infoAdicional": {}
  }
}
```

Puedes partir de:

```text
examples/facturacion/factura.json
examples/facturacion/retencion.json
examples/facturacion/CONTRATOS_PAYLOAD.md
```

## Firmar XML

La libreria recibe el contenido binario del `.p12`, no una ruta.

```php
<?php

use LibreriasSri\FacturacionElectronicaLibrary;

require __DIR__.'/vendor/autoload.php';

$facturacion = new FacturacionElectronicaLibrary();

$xml = file_get_contents(__DIR__.'/factura-generada.xml');
$p12 = file_get_contents(__DIR__.'/certificado.p12');

$xmlFirmado = $facturacion->firmarXml(
    'factura',
    $xml,
    $p12,
    'claveDelCertificado'
);

file_put_contents(__DIR__.'/factura-firmada.xml', $xmlFirmado);
```

## Generar y firmar en un solo paso

```php
$payload = json_decode(file_get_contents(__DIR__.'/factura.json'), true);
$p12 = file_get_contents(__DIR__.'/certificado.p12');

$xmlFirmado = $facturacion->generarYFirmarXml(
    $payload['tipo'],
    $payload['data'],
    $p12,
    'claveDelCertificado'
);
```

## Obtener clave de acceso desde el XML

```php
preg_match('/<claveAcceso>(.*?)<\/claveAcceso>/', $xml, $matches);
$claveAcceso = $matches[1] ?? null;
```

La clave se genera automaticamente si no viene en `infoTributaria.claveAcceso` y el payload trae:

```text
infoTributaria.codDoc
infoTributaria.ruc
infoTributaria.ambiente
infoTributaria.estab
infoTributaria.ptoEmi
infoTributaria.secuencial
infoTributaria.codigoNumerico
infoTributaria.tipoEmision
fechaEmision del comprobante
```

## Enviar y autorizar en SRI desde PHP puro

Para usar SOAP sin Laravel:

```php
$recepcion = $facturacion->enviarSri($xmlFirmado, '1');
$autorizacion = $facturacion->autorizarSri($claveAcceso, '1');
```

Ambientes:

```text
1 = pruebas
2 = produccion
```

Si necesitas un `cacert.pem` especifico o cambiar timeout, instancia el servicio SOAP y pasalo a la fachada:

```php
use LibreriasSri\FacturacionElectronicaLibrary;
use LibreriasSri\FacturacionElectronicaService;

$sri = new FacturacionElectronicaService(
    'C:\laragon\etc\ssl\cacert.pem',
    30
);

$facturacion = new FacturacionElectronicaLibrary(null, $sri);
```

## Validar identificacion

```php
$okCedula = $facturacion->validarIdentificacion('cedula', '1710034065');
$okRuc = $facturacion->validarIdentificacion('ruc_natural', '1710034065001');
```

Tipos aceptados:

```text
cedula
ruc_natural
ruc_privado
ruc_publico
```

## Tipos de comprobante soportados

```php
$tipos = $facturacion->tiposSoportados();
```

Resultado:

```text
factura
comprobanteRetencion
guiaRemision
notaDebito
notaCredito
liquidacionCompra
```

Aliases:

```text
retencion           => comprobanteRetencion
guia                => guiaRemision
nota_debito         => notaDebito
nota_credito        => notaCredito
liquidacion_compra  => liquidacionCompra
```

## Errores comunes

### `Class ... requires the certificate path and password`

En esta libreria el primer parametro de firma es el contenido del `.p12`. Revisa que estés haciendo:

```php
$p12 = file_get_contents(__DIR__.'/certificado.p12');
```

### `digital envelope routines::unsupported`

Tu certificado probablemente fue creado con algoritmos antiguos y PHP usa OpenSSL 3. La libreria intenta usar:

```bash
openssl pkcs12 -legacy
```

Por eso `openssl` debe estar disponible en consola.

### `SOAP-ERROR: Parsing WSDL`

Normalmente es problema de certificados CA. Configura `openssl.cafile` en `php.ini` o pasa un `cacert.pem` al crear `FacturacionElectronicaService`.

### El SRI rechaza el XML

Revisa:

- ambiente correcto: `1` pruebas, `2` produccion
- `codDoc` correcto para el tipo de comprobante
- clave de acceso de 49 digitos
- XML firmado antes de enviar
- certificado vigente
- fecha de emision en formato valido

## Archivos recomendados para empezar

- `examples/facturacion/php_puro_directo.php`
- `examples/facturacion/factura.json`
- `examples/facturacion/retencion.json`
- `examples/facturacion/CONTRATOS_PAYLOAD.md`
- `docs/FACTURACION_ELECTRONICA.md`
