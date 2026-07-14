# Demo API Postman - flujo completo de facturacion

Este demo permite validar el flujo completo de factura electronica usando las rutas reales del proyecto:

1. Validar identificacion del comprador.
2. Generar clave de acceso.
3. Generar XML de factura.
4. Firmar XML con certificado `.p12`.
5. Enviar XML firmado al SRI.
6. Consultar autorizacion en el SRI.

No depende de otros proyectos. Todo se prueba contra esta API Laravel.

## Archivos del demo

```text
examples/facturacion/factura.json
examples/facturacion/postman_collection.json
examples/facturacion/postman_environment.json
examples/facturacion/uso_libreria.php
```

## Levantar el proyecto

Desde la raiz del proyecto:

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

La URL base del ambiente Postman queda:

```text
http://127.0.0.1:8000
```

## Importar en Postman

1. Importa `examples/facturacion/postman_environment.json`.
2. Importa `examples/facturacion/postman_collection.json`.
3. Selecciona el ambiente `Facturacion SRI Demo Local`.
4. Ejecuta los requests en orden.

Los primeros requests no necesitan certificado. Para firmar sin enviar el certificado por Postman, configura el `.p12` y su clave en `.env`:

```text
FACTURACION_CERTIFICADO_P12=certificados/JUAN GABRIEL GUALOTUNA GUACHAMIN 1721854675-080825131942.p12
FACTURACION_CERTIFICADO_CLAVE=claveDelCertificado
```

La ruta anterior es relativa a `public`. Es decir, apunta a:

```text
public/certificados/JUAN GABRIEL GUALOTUNA GUACHAMIN 1721854675-080825131942.p12
```

Luego reinicia el servidor Laravel si ya estaba levantado.

## Orden recomendado en Postman

### 00 - Tipos soportados

Valida que la API responda y muestra los tipos disponibles.

### 01 - Validar identificacion comprador

Usa:

```json
{
  "tipo": "cedula",
  "numero": "1710034065"
}
```

### 02 - Generar clave de acceso factura

Genera una clave con los mismos datos de `factura.json`. El script de Postman guarda:

```text
clave_acceso
```

### 03 - Generar XML factura

Envia el payload completo de factura. La API retorna:

```text
data.xml
data.xml_base64
```

El script guarda automaticamente:

```text
xml_base64
clave_acceso
```

### 04 - Firmar XML generado

Usa el `xml_base64` guardado en el paso anterior. El certificado y la clave se toman del `.env`. La API retorna el XML firmado y Postman guarda:

```text
xml_firmado_base64
```

### 05 - Generar y firmar factura en un solo paso

Alternativa para validar que el servicio puede generar y firmar en una sola llamada enviando solo el JSON de la factura. Tambien guarda:

```text
xml_firmado_base64
clave_acceso
```

### 06 - Enviar XML firmado al SRI

Envia el XML firmado al ambiente configurado:

```text
ambiente = 1 pruebas
ambiente = 2 produccion
```

### 07 - Consultar autorizacion SRI

Consulta la autorizacion usando `clave_acceso`.

## Validacion rapida sin Postman

Tambien puedes ejecutar:

```bash
php examples/facturacion/uso_libreria.php
```

Ese script genera el XML localmente y lo guarda en:

```text
storage/app/demo_facturacion/factura-generada.xml
storage/app/demo_facturacion/factura-firmada.xml
```

Para que tambien firme, configura estas variables antes de ejecutar:

```powershell
$env:DEMO_CERTIFICADO_P12="C:\ruta\certificado.p12"
$env:DEMO_CERTIFICADO_CLAVE="claveDelCertificado"
php examples/facturacion/uso_libreria.php
```

## Notas para pruebas

- Usa `ambiente = 1` mientras estes validando.
- El XML se puede generar sin certificado.
- Para firmar se necesita un `.p12` real en `public/certificados` y su clave configurada en `.env`.
- Para enviar y autorizar se necesita conexion al SRI y extension SOAP habilitada.
- Si el SRI rechaza, revisa que la factura este firmada, que la clave tenga 49 digitos y que el ambiente corresponda.
