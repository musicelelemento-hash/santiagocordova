<?php

use App\Services\FacturacionElectronicaLibrary;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$facturacion = app(FacturacionElectronicaLibrary::class);

echo "Tipos soportados: ".implode(', ', $facturacion->tiposSoportados()).PHP_EOL;

$payload = json_decode(file_get_contents(__DIR__.'/factura.json'), true);
$outputDir = storage_path('app/demo_facturacion');

if (!is_dir($outputDir)) {
    mkdir($outputDir, 0775, true);
}

$xml = $facturacion->generarXml($payload['tipo'], $payload['data']);
preg_match('/<claveAcceso>(.*?)<\/claveAcceso>/', $xml, $matches);
$claveAcceso = $matches[1] ?? '';
file_put_contents($outputDir.'/factura-generada.xml', $xml);

echo "Clave acceso: {$claveAcceso}".PHP_EOL;
echo "XML generado: ".strlen($xml)." bytes".PHP_EOL;
echo "Archivo XML generado: {$outputDir}/factura-generada.xml".PHP_EOL;
echo "Cedula valida: ".($facturacion->validarIdentificacion('cedula', '1710034065') ? 'SI' : 'NO').PHP_EOL;

$certificadoPath = getenv('DEMO_CERTIFICADO_P12');
$certificadoClave = getenv('DEMO_CERTIFICADO_CLAVE');

if ($certificadoPath && $certificadoClave) {
    $p12 = file_get_contents($certificadoPath);
    $xmlFirmado = $facturacion->firmarXml('factura', $xml, $p12, $certificadoClave);
    file_put_contents($outputDir.'/factura-firmada.xml', $xmlFirmado);

    echo "XML firmado: ".strlen($xmlFirmado)." bytes".PHP_EOL;
    echo "Archivo XML firmado: {$outputDir}/factura-firmada.xml".PHP_EOL;

    if (getenv('DEMO_ENVIAR_SRI') === '1') {
        $ambiente = getenv('DEMO_AMBIENTE') ?: '1';
        $recepcion = $facturacion->enviarSri($xmlFirmado, $ambiente);
        $autorizacion = $facturacion->autorizarSri($claveAcceso, $ambiente);

        echo "Respuesta recepcion SRI:".PHP_EOL;
        print_r($recepcion);
        echo "Respuesta autorizacion SRI:".PHP_EOL;
        print_r($autorizacion);
    }
} else {
    echo "Firma omitida. Define DEMO_CERTIFICADO_P12 y DEMO_CERTIFICADO_CLAVE para firmar.".PHP_EOL;
    echo "Envio SRI omitido. Para envio real define DEMO_ENVIAR_SRI=1 despues de firmar.".PHP_EOL;
}
