# Libreria de facturacion electronica Ecuador

Esta libreria genera, firma, envia y autoriza comprobantes electronicos para el SRI Ecuador.

No necesitas consumirla como API. En Laravel se usa por inyeccion de dependencias y en PHP puro se usa con `vendor/autoload.php`.

## Clase principal

```php
LibreriasSri\FacturacionElectronicaLibrary
```

Usa esta fachada para casi todo. Internamente coordina:

- `LibreriasSri\FacturacionElectronica`: genera XML y clave de acceso.
- `LibreriasSri\SignDOcumentToSRI`: firma XAdES-BES.
- `LibreriasSri\FacturacionElectronicaService`: comunica con servicios SOAP del SRI.
- `LibreriasSri\Validadores`: valida cedula y RUC.

## Instalacion en Laravel

1. Copia la libreria dentro de tu proyecto o usa este repositorio como base.
2. Instala dependencias:

```bash
composer install
composer dump-autoload
```

3. Configura `.env`:

```env
FACTURACION_CERTIFICADO_P12=certificados/certificado.p12
FACTURACION_CERTIFICADO_CLAVE=claveDelCertificado
FACTURACION_AMBIENTE=1
FACTURACION_CA_FILE=
FACTURACION_SOAP_TIMEOUT=30
```

`FACTURACION_CERTIFICADO_P12` es relativo a `public/` cuando usas los controladores existentes. Para uso como libreria puedes leer el certificado desde cualquier ruta con `file_get_contents()`.

4. En Laravel el adapter de ejemplo `App\Services\FacturacionElectronicaLibrary` queda registrado como singleton en `AppServiceProvider`. Ese adapter hereda de `LibreriasSri\FacturacionElectronicaLibrary`, asi que puedes inyectarlo:

```php
use App\Services\FacturacionElectronicaLibrary;

class EmitirFacturaService
{
    private $facturacion;

    public function __construct(FacturacionElectronicaLibrary $facturacion)
    {
        $this->facturacion = $facturacion;
    }

    public function generar(array $payload)
    {
        return $this->facturacion->generarXml('factura', $payload);
    }
}
```

## Uso Laravel en controlador

```php
use App\Services\FacturacionElectronicaLibrary;
use Illuminate\Http\Request;

class FacturaController
{
    public function emitir(Request $request, FacturacionElectronicaLibrary $facturacion)
    {
        $data = $request->input('data');

        $xml = $facturacion->generarXml('factura', $data);

        $p12 = file_get_contents(storage_path('app/certificados/mi_certificado.p12'));
        $xmlFirmado = $facturacion->firmarXml('factura', $xml, $p12, config('services.facturacion.clave_certificado'));

        preg_match('/<claveAcceso>(.*?)<\/claveAcceso>/', $xml, $matches);
        $claveAcceso = $matches[1] ?? null;

        return [
            'clave_acceso' => $claveAcceso,
            'xml_base64' => base64_encode($xml),
            'xml_firmado_base64' => base64_encode($xmlFirmado),
        ];
    }
}
```

## Uso recomendado en produccion

En un sistema real conviene separar pasos:

1. Generar XML.
2. Guardar XML y clave de acceso en base de datos.
3. Firmar XML.
4. Guardar XML firmado.
5. Enviar al SRI.
6. Consultar autorizacion en un Job con reintentos.
7. Guardar respuesta de autorizacion.

Ejemplo de Job:

```php
use App\Services\FacturacionElectronicaLibrary;

class AutorizarComprobanteJob
{
    public function handle(FacturacionElectronicaLibrary $facturacion)
    {
        $respuesta = $facturacion->autorizarSri($this->claveAcceso, '1');

        // Guarda la respuesta en tu tabla de comprobantes.
    }
}
```

## Uso PHP puro

Revisa:

```text
docs/INTEGRACION_PHP_PURO.md
examples/facturacion/php_puro_directo.php
```

Ejemplo minimo:

```php
use LibreriasSri\FacturacionElectronicaLibrary;

require __DIR__.'/vendor/autoload.php';

$facturacion = new FacturacionElectronicaLibrary();
$payload = json_decode(file_get_contents(__DIR__.'/factura.json'), true);

$xml = $facturacion->generarXml($payload['tipo'], $payload['data']);
```

## Metodos principales

### `tiposSoportados()`

```php
$tipos = $facturacion->tiposSoportados();
```

### `generarXml($tipo, $data)`

```php
$xml = $facturacion->generarXml('factura', $data);
```

### `firmarXml($tipo, $xml, $certificadoP12, $claveCertificado)`

```php
$p12 = file_get_contents('certificado.p12');
$xmlFirmado = $facturacion->firmarXml('factura', $xml, $p12, 'clave');
```

### `generarYFirmarXml($tipo, $data, $certificadoP12, $claveCertificado)`

```php
$xmlFirmado = $facturacion->generarYFirmarXml('factura', $data, $p12, 'clave');
```

### `enviarSri($xmlFirmado, $ambiente)`

```php
$recepcion = $facturacion->enviarSri($xmlFirmado, '1');
```

### `autorizarSri($claveAcceso, $ambiente)`

```php
$autorizacion = $facturacion->autorizarSri($claveAcceso, '1');
```

### `generarClaveAcceso(...)`

```php
$claveAcceso = $facturacion->generarClaveAcceso(
    '2026-06-01',
    '01',
    '1790012345001',
    '1',
    '001001',
    '000000001',
    '12345678',
    '1'
);
```

### `validarIdentificacion($tipo, $numero)`

```php
$ok = $facturacion->validarIdentificacion('cedula', '1710034065');
```

## Tipos de comprobante

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

## Payloads y contratos

Empieza por estos archivos:

```text
examples/facturacion/factura.json
examples/facturacion/retencion.json
examples/facturacion/CONTRATOS_PAYLOAD.md
```

La libreria genera automaticamente `claveAcceso` cuando el payload tiene los datos tributarios y la fecha de emision.

## Ambiente SRI

```text
1 = pruebas
2 = produccion
```

WSDL usados:

```text
Pruebas recepcion:     https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
Pruebas autorizacion:  https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
Produccion recepcion:  https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
Produccion autoriz.:   https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
```

## API HTTP opcional

El proyecto conserva controladores y rutas API para pruebas, Postman o integraciones remotas. Pero la integracion recomendada dentro de PHP/Laravel es usar la libreria directamente.

Rutas disponibles:

```text
GET  /api/v1/facturacion/tipos
POST /api/v1/facturacion/clave-acceso
POST /api/v1/facturacion/validar-identificacion
POST /api/v1/facturacion/xml
POST /api/v1/facturacion/firmar
POST /api/v1/facturacion/generar-firmar
POST /api/v1/facturacion/sri/enviar
POST /api/v1/facturacion/sri/autorizar
```

## Problemas comunes

### `SOAP-ERROR: Parsing WSDL`

Configura `FACTURACION_CA_FILE` o `openssl.cafile` con un `cacert.pem` valido.

### `digital envelope routines::unsupported`

Es un `.p12` legacy con OpenSSL 3. La libreria intenta fallback con `openssl pkcs12 -legacy`; asegúrate de tener `openssl` disponible en consola.

### El SRI rechaza el XML

Revisa clave de acceso de 49 digitos, `codDoc`, ambiente, certificado vigente y que el XML tenga `id="comprobante"` antes de firmar.
