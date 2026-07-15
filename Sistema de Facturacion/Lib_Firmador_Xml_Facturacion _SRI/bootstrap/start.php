#!/usr/bin/env php
<?php
/**
 * bootstrap/start.php
 * Se ejecuta antes de arrancar la app en Render.
 * Decodifica el certificado .p12 desde la variable de entorno P12_BASE64
 * y lo escribe en storage/app/firma.p12 para que Laravel lo encuentre.
 */

// Solo correr si estamos en producción y la variable existe
$p12Base64 = getenv('FACTURACION_CERTIFICADO_P12_BASE64');

if (!empty($p12Base64)) {
    $targetDir = __DIR__ . '/../storage/app';
    $targetFile = $targetDir . '/firma.p12';

    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0775, true);
    }

    $decoded = base64_decode($p12Base64, true);
    if ($decoded === false) {
        fwrite(STDERR, "[BOOT] ERROR: FACTURACION_CERTIFICADO_P12_BASE64 no es base64 válido.\n");
        exit(1);
    }

    file_put_contents($targetFile, $decoded);
    chmod($targetFile, 0600);
    fwrite(STDOUT, "[BOOT] Certificado .p12 escrito en storage/app/firma.p12\n");
} else {
    fwrite(STDOUT, "[BOOT] ADVERTENCIA: FACTURACION_CERTIFICADO_P12_BASE64 no está definida.\n");
}
