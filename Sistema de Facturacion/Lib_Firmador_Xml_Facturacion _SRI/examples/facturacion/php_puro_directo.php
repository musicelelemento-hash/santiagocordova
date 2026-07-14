<?php

use LibreriasSri\FacturacionElectronicaLibrary;

require __DIR__.'/../../vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Ejemplo PHP puro
|--------------------------------------------------------------------------
|
| Este archivo usa la libreria directamente. No levanta Laravel, no consume
| rutas HTTP y no necesita controladores. Ejecuta:
|
| php examples/facturacion/php_puro_directo.php
|
| Para firmar, define estas variables de entorno antes de ejecutar:
|
| Windows PowerShell:
| $env:DEMO_CERTIFICADO_P12="C:\ruta\certificado.p12"
| $env:DEMO_CERTIFICADO_CLAVE="claveDelCertificado"
|
| Linux/macOS:
| DEMO_CERTIFICADO_P12=/ruta/certificado.p12 DEMO_CERTIFICADO_CLAVE=clave php examples/facturacion/php_puro_directo.php
*/

$facturacion = new FacturacionElectronicaLibrary();

$payload = json_decode(file_get_contents(__DIR__.'/factura.json'), true);

if (!is_array($payload)) {
    throw new RuntimeException('No se pudo leer examples/facturacion/factura.json');
}

$outputDir = __DIR__.'/../../storage/app/demo_php_puro';

if (!is_dir($outputDir)) {
    mkdir($outputDir, 0775, true);
}

$xml = $facturacion->generarXml($payload['tipo'], $payload['data']);
$claveAcceso = extraerClaveAcceso($xml);

file_put_contents($outputDir.'/factura-generada.xml', $xml);

echo "XML generado correctamente.".PHP_EOL;
echo "Clave de acceso: {$claveAcceso}".PHP_EOL;
echo "Archivo: {$outputDir}/factura-generada.xml".PHP_EOL;

$certificadoPath = getenv('DEMO_CERTIFICADO_P12');
$certificadoClave = getenv('DEMO_CERTIFICADO_CLAVE');

if (!$certificadoPath || !$certificadoClave) {
    echo "Firma omitida: define DEMO_CERTIFICADO_P12 y DEMO_CERTIFICADO_CLAVE.".PHP_EOL;
    exit(0);
}

if (!is_file($certificadoPath)) {
    throw new RuntimeException("No existe el certificado: {$certificadoPath}");
}

$xmlFirmado = $facturacion->firmarXml(
    $payload['tipo'],
    $xml,
    file_get_contents($certificadoPath),
    $certificadoClave
);

file_put_contents($outputDir.'/factura-firmada.xml', $xmlFirmado);

echo "XML firmado correctamente.".PHP_EOL;
echo "Archivo: {$outputDir}/factura-firmada.xml".PHP_EOL;

function extraerClaveAcceso($xml)
{
    preg_match('/<claveAcceso>(.*?)<\/claveAcceso>/', $xml, $matches);

    return $matches[1] ?? '';
}
