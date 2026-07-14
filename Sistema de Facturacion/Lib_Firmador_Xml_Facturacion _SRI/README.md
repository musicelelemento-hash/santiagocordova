# Libreria Firmador XML Facturacion SRI Ecuador

Libreria PHP/Laravel para generar, firmar, enviar y autorizar comprobantes electronicos del SRI Ecuador.

Este proyecto no debe integrarse obligatoriamente como API HTTP. La forma recomendada es usar la clase:

```php
LibreriasSri\FacturacionElectronicaLibrary
```

## Que puedes hacer

- Generar XML de factura, retencion, guia, nota de debito, nota de credito y liquidacion de compra.
- Generar clave de acceso SRI.
- Firmar XML con certificado `.p12`.
- Enviar comprobantes firmados al SRI.
- Consultar autorizacion.
- Validar cedula y RUC.

## Requisitos

- PHP 8.1 o superior.
- Composer.
- Extensiones PHP: `openssl`, `dom`, `simplexml`.
- Extension `soap` para enviar/autorizar en SRI.
- `openssl` disponible en consola para certificados `.p12` legacy con OpenSSL 3.

## Instalacion

```bash
composer install
composer dump-autoload
```

En Laravel configura `.env` si vas a usar los controladores de ejemplo o guardar credenciales ahi:

```env
FACTURACION_CERTIFICADO_P12=certificados/certificado.p12
FACTURACION_CERTIFICADO_CLAVE=claveDelCertificado
FACTURACION_AMBIENTE=1
FACTURACION_CA_FILE=
FACTURACION_SOAP_TIMEOUT=30
```

## Uso rapido en Laravel

El adapter Laravel de ejemplo es `App\Services\FacturacionElectronicaLibrary`; internamente hereda de `LibreriasSri\FacturacionElectronicaLibrary`.

```php
use App\Services\FacturacionElectronicaLibrary;

class FacturaController
{
    public function emitir(FacturacionElectronicaLibrary $facturacion)
    {
        $payload = json_decode(file_get_contents(base_path('examples/facturacion/factura.json')), true);

        $xml = $facturacion->generarXml($payload['tipo'], $payload['data']);

        $p12 = file_get_contents(storage_path('app/certificados/mi_certificado.p12'));
        $xmlFirmado = $facturacion->firmarXml('factura', $xml, $p12, config('services.facturacion.clave_certificado'));

        return [
            'xml_base64' => base64_encode($xml),
            'xml_firmado_base64' => base64_encode($xmlFirmado),
        ];
    }
}
```

## Uso rapido en PHP puro

```php
use LibreriasSri\FacturacionElectronicaLibrary;

require __DIR__.'/vendor/autoload.php';

$facturacion = new FacturacionElectronicaLibrary();
$payload = json_decode(file_get_contents(__DIR__.'/examples/facturacion/factura.json'), true);

$xml = $facturacion->generarXml($payload['tipo'], $payload['data']);

file_put_contents(__DIR__.'/factura-generada.xml', $xml);
```

Ejemplo ejecutable:

```bash
php examples/facturacion/php_puro_directo.php
```

## Documentacion

- `docs/FACTURACION_ELECTRONICA.md`: guia completa Laravel y conceptos de la libreria.
- `docs/INTEGRACION_PHP_PURO.md`: integracion directa desde PHP sin Laravel.
- `examples/facturacion/php_puro_directo.php`: ejemplo ejecutable sin levantar Laravel.
- `examples/facturacion/uso_libreria.php`: ejemplo usando bootstrap Laravel.
- `examples/facturacion/CONTRATOS_PAYLOAD.md`: estructura esperada de payloads.
- `examples/facturacion/factura.json`: payload base para factura.
- `examples/facturacion/retencion.json`: payload base para retencion.

## Tipos soportados

```text
factura
comprobanteRetencion
guiaRemision
notaDebito
notaCredito
liquidacionCompra
```

## API HTTP opcional

El proyecto conserva rutas API para pruebas o integraciones remotas, pero no son necesarias si tu aplicacion esta en PHP o Laravel. Para integracion local usa `FacturacionElectronicaLibrary`.

## Problemas comunes

- `digital envelope routines::unsupported`: certificado `.p12` legacy con OpenSSL 3. Instala o habilita `openssl` en consola.
- `SOAP-ERROR: Parsing WSDL`: configura `FACTURACION_CA_FILE` o `openssl.cafile` con un `cacert.pem` valido.
- SRI rechaza XML: valida ambiente, clave de acceso, `codDoc`, certificado vigente y XML firmado.
