<?php
namespace App\Librerias;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use GuzzleHttp\Client;


class FacturacionElectronica
{
    /**
     *leer factura o documento
     */
    public function leerDocumentoXml($xml){
      $myxmlfilecontent = $xml;
      $text = trim(preg_replace('/\s+/', ' ', $myxmlfilecontent));
      $text = preg_replace("/(?<=\>)(\r?\n)|(\r?\n)(?=\<\/)/", '', $text);
      $text = trim(str_replace('> <', '><', $text));
      $text = utf8_encode($text);
      $xml = simplexml_load_string($text);
      $text = utf8_decode($text);
      if ($xml->attributes()->version) {
        $version = $xml->attributes()->version;
        $id = $xml->attributes()->id;

        // Agregar Encabezados
        $text = trim(preg_replace('/<factura version="' . $version . '" id="' . $id . '">/', '<factura id="' . $id . '" version="' . $version . '">', $text));
        $text = trim(preg_replace('/<notaCredito version="' . $version . '" id="' . $id . '">/', '<notaCredito id="' . $id . '" version="' . $version . '">', $text));
        $text = trim(preg_replace('/<notaDebito version="' . $version . '" id="' . $id . '">/', '<notaDebito id="' . $id . '" version="' . $version . '">', $text));
        $text = trim(preg_replace('/<comprobanteRetencion version="' . $version . '" id="' . $id . '">/', '<comprobanteRetencion id="' . $id . '" version="' . $version . '">', $text));
        $text = trim(preg_replace('/<guiaRemision version="' . $version . '" id="' . $id . '">/', '<guiaRemision id="' . $id . '" version="' . $version . '">', $text));
        $text = trim(preg_replace('/<liquidacionCompra version="' . $version . '" id="' . $id . '">/', '<liquidacionCompra id="' . $id . '" version="' . $version . '">', $text));

        $text = str_replace(
                array('á', 'à', 'ä', 'â', 'ª', 'Á', 'À', 'Â', 'Ä'), array('a', 'a', 'a', 'a', 'a', 'A', 'A', 'A', 'A'), $text
        );

        $text = str_replace(
                array('é', 'è', 'ë', 'ê', 'É', 'È', 'Ê', 'Ë'), array('e', 'e', 'e', 'e', 'E', 'E', 'E', 'E'), $text);

        $text = str_replace(
                array('í', 'ì', 'ï', 'î', 'Í', 'Ì', 'Ï', 'Î'), array('i', 'i', 'i', 'i', 'I', 'I', 'I', 'I'), $text);

        $text = str_replace(
                array('ó', 'ò', 'ö', 'ô', 'Ó', 'Ò', 'Ö', 'Ô'), array('o', 'o', 'o', 'o', 'O', 'O', 'O', 'O'), $text);

        $text = str_replace(
                array('ú', 'ù', 'ü', 'û', 'Ú', 'Ù', 'Û', 'Ü'), array('u', 'u', 'u', 'u', 'U', 'U', 'U', 'U'), $text);

        $text = str_replace(
                array('ñ', 'Ñ', 'ç', 'Ç'), array('n', 'N', 'c', 'C'), $text
        );
        $no_permitidas = array("á", "é", "í", "ó", "ú", "Á", "É", "Í", "Ó", "Ú", "ñ", "À", "Ã", "Ì", "Ò", "Ù", "Ã™", "Ã ", "Ã¨", "Ã¬", "Ã²", "Ã¹", "ç", "Ç", "Ã¢", "ê", "Ã®", "Ã´", "Ã»", "Ã",
            "ÃŠ", "ÃŽ", "Ã", "Ã›", "ü", "Ã¶", "Ã–", "Ã¯", "Ã¤", "«", "Ò", "Ã", "Ã", "Ã‹", "Ñ", "*", "%");
        $permitidas = array("a", "e", "i", "o", "u", "A", "E", "I", "O", "U", "n", "N", "A", "E", "I", "O", "U", "a", "e", "i", "o", "u", "c", "C", "a", "e", "i", "o", "u", "A", "E", "I", "O", "U", "u", "o", "O", "i", "a", "e", "U", "I", "A", "E", "N", ".", ".");
        $text = str_replace($no_permitidas, $permitidas, $text);
    }
      return $text;
    }
    /**
     * archivo p12
     */
    public function leerCertificado($ruta){
      $certificado_p12 = file_get_contents($ruta);
      if ($this->readPkcs12($certificado_p12, $pkcs12, 'Jes120396')) {
      $certificado = $pkcs12["extracerts"][1];
      $certificado = str_replace('-----BEGIN CERTIFICATE-----', '', $certificado);
      $certificado = str_replace('-----END CERTIFICATE-----', '', $certificado);
      $certificado=trim($certificado);
      echo $certificado;
    }
  }



/**
 * valida fecha de vigencia certificado
 */
    public function validarFechaCertificado($fechaInicio,$fechaFin){
        $fechaInicio = substr($fechaInicio,4, 11);
        $fechaInicio = date('Y-m-d',strtotime($fechaInicio));
        $fechaFin = substr($fechaFin,4, 11);
        $fechaFin= date('Y-m-d',strtotime($fechaFin));
        $fechaActual=date('Y-m-d');
        if($fechaActual <= $fechaFin){
            return "Certificado Vigente";
        }else{
          //  $file = fopen("../error_log", "a+");
            $date = date('m/d/Y h:i:s a', time());
            fwrite($file, "Error: " .$date. ' Fecha vencimiento del certificado excedida'. PHP_EOL);
            return "Valide las fechas de vencimiento del certificado";
        }
    }



public function firmarXml($clavecertificado, $cert,$documento){
  try {
    $cert=  public_path("certificados/".$cert);
    $almacen_cert = file_get_contents($cert);
            if ($this->readPkcs12($almacen_cert, $info_cert, $clavecertificado)) {


               $ruta_no_firmados = public_path("facturacion/facturacionphp/comprobantes/no_firmados/".$documento);
              $ruta_si_firmados = public_path("facturacion/facturacionphp/comprobantes/si_firmados/");
              $ruta_autorizados = public_path("acturacion/facturacionphp/comprobantes/autorizados/");
              $pathPdf = public_path("facturacion/facturacionphp/comprobantes/pdf/");
              $tipo = 'FV';
              date_default_timezone_set("America/Guayaquil");
              $fecha_actual = date('d-m-Y H:m:s', time());

              $acceso_no_firmados = simplexml_load_file($ruta_no_firmados);
              $claveAcceso_no_firmado['claveAccesoComprobante'] = substr($acceso_no_firmados->infoTributaria[0]->claveAcceso, 0, 49);
              $clave_acc_guardar = implode($claveAcceso_no_firmado);

              $nuevo_xml = ''.$clave_acc_guardar.'.xml';
              $resp="";
              //VERIFICAMOS SI EXISTE EL XML NO FIRMADO CREAD
                if (file_exists($ruta_no_firmados)) {

                  $argumentos = $ruta_no_firmados . ' ' . $ruta_si_firmados . ' ' . $nuevo_xml . ' ' . $cert . ' ' . $clavecertificado;

                  $pathJar = public_path("facturacion/firmaComprobanteElectronico/dist/firmaComprobanteElectronico.jar");
                  $comando = ('java -jar '.$pathJar.' ' . $argumentos);
                  $resp = shell_exec($comando);
                  //return $resp;
                  if(!is_null($resp)){
                    return true;
                  }
                  return false;
                }

                return  false;
          }
    return false;
  } catch (\Throwable $th) {
    return false;
  }

}

private function readPkcs12($pkcs12Content, &$certs, $password)
{
    if (openssl_pkcs12_read($pkcs12Content, $certs, $password)) {
        return true;
    }

    $openSslError = $this->getOpenSslErrors();

    if (stripos($openSslError, 'unsupported') === false) {
        return false;
    }

    $openssl = $this->findOpenSslBinary();

    if (is_null($openssl)) {
        return false;
    }

    $tmpP12 = tempnam(sys_get_temp_dir(), 'sri_p12_');

    if (false === $tmpP12 || false === file_put_contents($tmpP12, $pkcs12Content)) {
        return false;
    }

    try {
        $pem = $this->extractPkcs12Pem($openssl, $tmpP12, $password, true);

        if (is_null($pem)) {
            $pem = $this->extractPkcs12Pem($openssl, $tmpP12, $password, false);
        }

        if (is_null($pem)) {
            return false;
        }

        return $this->loadCertsFromPem($pem, $certs);
    } finally {
        @unlink($tmpP12);
    }
}

private function extractPkcs12Pem($openssl, $p12Path, $password, $legacy)
{
    $command = [
        $openssl,
        'pkcs12',
        '-in',
        $p12Path,
        '-nodes',
        '-passin',
        'env:PKCS12_PASSWORD',
    ];

    if ($legacy) {
        array_splice($command, 2, 0, '-legacy');
    }

    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptorSpec, $pipes, null, [
        'PKCS12_PASSWORD' => $password,
    ]);

    if (!is_resource($process)) {
        return null;
    }

    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);

    if (0 !== $exitCode || empty($output)) {
        return null;
    }

    return $output;
}

private function loadCertsFromPem($pem, &$certs)
{
    if (!preg_match('/-----BEGIN (?:RSA |ENCRYPTED |EC |)PRIVATE KEY-----.*?-----END (?:RSA |ENCRYPTED |EC |)PRIVATE KEY-----/s', $pem, $privateKeyMatch)) {
        return false;
    }

    if (!preg_match_all('/-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----/s', $pem, $certificateMatches)) {
        return false;
    }

    if (false === openssl_pkey_get_private($privateKeyMatch[0])) {
        return false;
    }

    $certs = [
        'cert' => $certificateMatches[0][0],
        'pkey' => $privateKeyMatch[0],
    ];

    if (count($certificateMatches[0]) > 1) {
        $certs['extracerts'] = array_slice($certificateMatches[0], 1);
    }

    return true;
}

private function findOpenSslBinary()
{
    $candidates = ['openssl'];

    if (defined('PHP_WINDOWS_VERSION_BUILD')) {
        $candidates[] = 'openssl.exe';
        $candidates = array_merge($candidates, glob('C:\laragon\bin\apache\*\bin\openssl.exe') ?: []);
    }

    foreach ($candidates as $candidate) {
        if ($this->isOpenSslUsable($candidate)) {
            return $candidate;
        }
    }

    return null;
}

private function isOpenSslUsable($openssl)
{
    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open([$openssl, 'version'], $descriptorSpec, $pipes);

    if (!is_resource($process)) {
        return false;
    }

    fclose($pipes[0]);
    stream_get_contents($pipes[1]);
    stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    return 0 === proc_close($process);
}

private function getOpenSslErrors()
{
    $errors = [];

    while ($error = openssl_error_string()) {
        $errors[] = $error;
    }

    return implode('; ', $errors);
}


/**
 * metodo generico para generar documentos xml
 */
    public function generarFacturaXml($data){

      $infoTrib = $data->infoTributaria;

      $xml = new \DOMDocument('1.0', 'UTF-8');
		  $xml->preserveWhiteSpace = false;

      $Factura = $xml->createElement('factura');
      $domAttribute = $xml->createAttribute('id');
      $domAttribute->value = 'comprobante';
      $Factura->appendChild($domAttribute);
      $domAttribute1 = $xml->createAttribute('version');
      $domAttribute1->value = '1.0.0';
      $Factura->appendChild($domAttribute1);
		  $Factura = $xml->appendChild($Factura);
      // INFORMACION TRIBUTARIA.
    	$infoTributaria = $xml->createElement('infoTributaria');
    	$infoTributaria = $Factura->appendChild($infoTributaria);
    	$cbc = $xml->createElement('ambiente',$infoTrib->ambiente);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('tipoEmision', $infoTrib->tipoEmision);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocial', $infoTrib->razonSocial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('nombreComercial', $infoTrib->nombreComercial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ruc', $infoTrib->ruc);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('claveAcceso', $infoTrib->claveAcceso);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('codDoc', $infoTrib->codDoc);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('estab', $infoTrib->estab);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ptoEmi', $infoTrib->ptoEmi);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('secuencial', $infoTrib->secuencial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('dirMatriz', $infoTrib->dirMatriz);
	    $cbc = $infoTributaria->appendChild($cbc);
      if($infoTrib->regimen=="1"){
        $cbc = $xml->createElement('regimenMicroempresas', "CONTRIBUYENTE RÉGIMEN MICROEMPRESAS");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib->regimen=="2"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib->regimen=="3"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
        $infoFac = $data->infoFactura;
      // INFORMACIOO DE FACTURA.
    	$infoFactura = $xml->createElement('infoFactura');
      $infoFactura = $Factura->appendChild($infoFactura);
      $date_emision=date_create($infoFac->fechaEmision);
      $fecha_format_emision= date_format($date_emision,"d/m/Y");
    	$cbc = $xml->createElement('fechaEmision',$fecha_format_emision);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('dirEstablecimiento', $infoFac->dirEstablecimiento);
      $cbc = $infoFactura->appendChild($cbc);



      if(isset($infoFac->contribuyenteEspecial)){

        if($infoFac->contribuyenteEspecial!=""){
          $cbc = $xml->createElement('contribuyenteEspecial', $infoFac->contribuyenteEspecial);
    	    $cbc = $infoFactura->appendChild($cbc);
        }

      }

    	$cbc = $xml->createElement('obligadoContabilidad', $infoFac->obligadoContabilidad);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('tipoIdentificacionComprador', $infoFac->tipoIdentificacionComprador);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocialComprador', $infoFac->razonSocialComprador);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('identificacionComprador', $infoFac->identificacionComprador);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('totalSinImpuestos', $infoFac->totalSinImpuestos);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('totalDescuento', $infoFac->totalDescuento);
    	$cbc = $infoFactura->appendChild($cbc);

      $totalConImp= $infoFac->totalImpuesto;

    	$totalConImpuestos = $xml->createElement('totalConImpuestos');
      $totalConImpuestos = $infoFactura->appendChild($totalConImpuestos);

      foreach ($totalConImp as $key => $value) {
        $totalImpuesto = $xml->createElement('totalImpuesto');
        $totalImpuesto = $totalConImpuestos->appendChild($totalImpuesto);
        $cbc = $xml->createElement('codigo', $value->codigo);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('codigoPorcentaje', $value->codigoPorcentaje);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('descuentoAdicional', '0');
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('baseImponible', $value->baseImponible);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('valor', $value->valor);
        $cbc = $totalImpuesto->appendChild($cbc);
      }


    	$cbc = $xml->createElement('propina', $infoFac->propina);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('importeTotal', $infoFac->importeTotal);
    	$cbc = $infoFactura->appendChild($cbc);
    	$cbc = $xml->createElement('moneda',  $infoFac->moneda);
    	$cbc = $infoFactura->appendChild($cbc);

        $pagosData = $infoFac->pagos;
        $pagos = $xml->createElement('pagos');
        $pagos = $infoFactura->appendChild($pagos);
        $pago = $xml->createElement('pago');
        $pago = $pagos->appendChild($pago);
        $cbc = $xml->createElement('formaPago', $pagosData->formaPago);
        $cbc = $pago->appendChild($cbc);
        $cbc = $xml->createElement('total', $pagosData->total);
    	$cbc = $pago->appendChild($cbc);


      //DETALLES DE LA FACTURA.
    	$detalles = $xml->createElement('detalles');
    	$detalles = $Factura->appendChild($detalles);

        $dataDetalle = $data->detalle;
      foreach ($dataDetalle as $key => $value) {

            $detalle = $xml->createElement('detalle');
            $detalle = $detalles->appendChild($detalle);
            $cbc = $xml->createElement('codigoPrincipal', $value->codigoPrincipal);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('codigoAuxiliar', $value->codigoAuxiliar);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('descripcion', $value->descripcion);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('cantidad',$value->cantidad);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('precioUnitario', $value->precioUnitario);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('descuento', $value->descuento);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('precioTotalSinImpuesto', $value->precioTotalSinImpuesto);
            $cbc = $detalle->appendChild($cbc);

            $imp = $value->impuesto;
           /*foreach ($variable as $key => $imp) {
            # code...
           }*/
                $impuestos = $xml->createElement('impuestos');
                $impuestos = $detalle->appendChild($impuestos);
                $impuesto = $xml->createElement('impuesto');
                $impuesto = $impuestos->appendChild($impuesto);
                $cbc = $xml->createElement('codigo', $imp->codigo);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('codigoPorcentaje', $imp->codigoPorcentaje);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('tarifa', $imp->tarifa);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('baseImponible', $imp->baseImponible);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('valor', $imp->valor);
                $cbc = $impuesto->appendChild($cbc);


      }

      $xml->formatOutput = true;
      $strings_xml = $xml->saveXML();
      return $strings_xml;
    }

    public function generarRetencionXml($data){
      $infoTrib = $data["infoTributaria"];

      $xml = new \DOMDocument('1.0', 'UTF-8');
		  $xml->preserveWhiteSpace = false;

      $COMPROBANTE_RETENCION = $xml->createElement('comprobanteRetencion');
      $domAttribute = $xml->createAttribute('id');
      $domAttribute->value = 'comprobante';
      $COMPROBANTE_RETENCION->appendChild($domAttribute);
      $domAttribute1 = $xml->createAttribute('version');
      $domAttribute1->value = '1.0.0';
      $COMPROBANTE_RETENCION->appendChild($domAttribute1);
		  $COMPROBANTE_RETENCION = $xml->appendChild($COMPROBANTE_RETENCION);
      // INFORMACION TRIBUTARIA.
    	$infoTributaria = $xml->createElement('infoTributaria');
    	$infoTributaria = $COMPROBANTE_RETENCION->appendChild($infoTributaria);
    	$cbc = $xml->createElement('ambiente',$infoTrib["ambiente"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('tipoEmision', $infoTrib["tipoEmision"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocial', $infoTrib["razonSocial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('nombreComercial', $infoTrib["nombreComercial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ruc', $infoTrib["ruc"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('claveAcceso', $infoTrib["claveAcceso"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('codDoc', $infoTrib["codDoc"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('estab', $infoTrib["estab"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ptoEmi', $infoTrib["ptoEmi"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('secuencial', $infoTrib["secuencial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('dirMatriz', $infoTrib["dirMatriz"]);
      $cbc = $infoTributaria->appendChild($cbc);
      if($infoTrib["regimen"]=="1"){
        $cbc = $xml->createElement('regimenMicroempresas', "CONTRIBUYENTE RÉGIMEN MICROEMPRESAS");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib["regimen"]=="2"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib["regimen"]=="3"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }


      $infoNot = $data["infoCompRetencion"];


      // INFORMACIÓN RETENCIÓN.
    	$infoComprobanteRetencion = $xml->createElement('infoCompRetencion');
      $infoComprobanteRetencion = $COMPROBANTE_RETENCION->appendChild($infoComprobanteRetencion);
      $date_emision=date_create($infoNot["fechaEmision"]);
      $fecha_format_emision= date_format($date_emision,"d/m/Y");
    	$cbc = $xml->createElement('fechaEmision',$fecha_format_emision);
      $cbc = $infoComprobanteRetencion->appendChild($cbc);

    	$cbc = $xml->createElement('dirEstablecimiento', $infoNot["dirEstablecimiento"]);
      $cbc = $infoComprobanteRetencion->appendChild($cbc);
      $cbc = $xml->createElement('obligadoContabilidad', $infoNot["obligadoContabilidad"]);
      $cbc = $infoComprobanteRetencion->appendChild($cbc);
      $cbc = $xml->createElement('tipoIdentificacionSujetoRetenido', $infoNot["tipoIdentificacionSujetoRetenido"]);
    	$cbc = $infoComprobanteRetencion->appendChild($cbc);

      $cbc = $xml->createElement('razonSocialSujetoRetenido', $infoNot["razonSocialSujetoRetenido"]);
      $cbc = $infoComprobanteRetencion->appendChild($cbc);
    	$cbc = $xml->createElement('identificacionSujetoRetenido', $infoNot["identificacionSujetoRetenido"]);
    	$cbc = $infoComprobanteRetencion->appendChild($cbc);
      $cbc = $xml->createElement('periodoFiscal', $infoNot["periodoFiscal"]);
      $cbc = $infoComprobanteRetencion->appendChild($cbc);




    	$impuestosRetencion = $xml->createElement('impuestos');
      $impuestosRetencion = $COMPROBANTE_RETENCION->appendChild($impuestosRetencion);

      $impuestos = $data["impuestos"];

      foreach ($impuestos as $key => $value) {

        $impuesto = $xml->createElement('impuesto');
        $impuesto = $impuestosRetencion->appendChild($impuesto);
        $cbc = $xml->createElement('codigo', $value["codigo"]);
        $cbc = $impuesto->appendChild($cbc);
        $cbc = $xml->createElement('codigoRetencion', $value["codigoRetencion"]);
        $cbc = $impuesto->appendChild($cbc);
        $cbc = $xml->createElement('baseImponible', $value["baseImponible"]);
        $cbc = $impuesto->appendChild($cbc);
        $cbc = $xml->createElement('porcentajeRetener', $value["porcentajeRetener"]);
        $cbc = $impuesto->appendChild($cbc);
        $cbc = $xml->createElement('valorRetenido', $value["valorRetenido"]);
        $cbc = $impuesto->appendChild($cbc);
        $cbc = $xml->createElement('codDocSustento', $value["codDocSustento"]);
        $cbc = $impuesto->appendChild($cbc);
        $cbc = $xml->createElement('numDocSustento', $value["numDocSustento"]);
        $cbc = $impuesto->appendChild($cbc);
        $date_emision_doc=date_create($value["fechaEmisionDocSustento"]);
        $fecha_format_emision= date_format($date_emision_doc,"d/m/Y");
        $cbc = $xml->createElement('fechaEmisionDocSustento', $fecha_format_emision);
        $cbc = $impuesto->appendChild($cbc);


      }


      $infoAdicionalRetencion =$data["infoAdicional"];

      $infoAdicional =  $xml->createElement('infoAdicional');
      $infoAdicional = $COMPROBANTE_RETENCION->appendChild($infoAdicional);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalRetencion["telefono"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Telefono';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalRetencion["email"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Email';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);


      $xml->formatOutput = true;
      $strings_xml = $xml->saveXML();
      return $strings_xml;
    }

    public function generarGuiaXml($data){
      $infoTrib = $data["infoTributaria"];

      $xml = new \DOMDocument('1.0', 'UTF-8');
		  $xml->preserveWhiteSpace = false;

      $GUIA = $xml->createElement('guiaRemision');
      $domAttribute = $xml->createAttribute('id');
      $domAttribute->value = 'comprobante';
      $GUIA->appendChild($domAttribute);
      $domAttribute1 = $xml->createAttribute('version');
      $domAttribute1->value = '1.0.0';
      $GUIA->appendChild($domAttribute1);
		  $GUIA = $xml->appendChild($GUIA);
      // INFORMACION TRIBUTARIA.
    	$infoTributaria = $xml->createElement('infoTributaria');
    	$infoTributaria = $GUIA->appendChild($infoTributaria);
    	$cbc = $xml->createElement('ambiente',$infoTrib["ambiente"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('tipoEmision', $infoTrib["tipoEmision"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocial', $infoTrib["razonSocial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('nombreComercial', $infoTrib["nombreComercial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ruc', $infoTrib["ruc"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('claveAcceso', $infoTrib["claveAcceso"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('codDoc', $infoTrib["codDoc"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('estab', $infoTrib["estab"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ptoEmi', $infoTrib["ptoEmi"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('secuencial', $infoTrib["secuencial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('dirMatriz', $infoTrib["dirMatriz"]);
      $cbc = $infoTributaria->appendChild($cbc);
      if($infoTrib["regimen"]=="1"){
        $cbc = $xml->createElement('regimenMicroempresas', "CONTRIBUYENTE RÉGIMEN MICROEMPRESAS");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib["regimen"]=="2"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib["regimen"]=="3"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }


      $infoNot = $data["infoGuiaRemision"];


      // INFORMACIÓN DE NOTA CREDITO.
    	$infoGuiaRemision = $xml->createElement('infoGuiaRemision');
      $infoGuiaRemision = $GUIA->appendChild($infoGuiaRemision);
      /*$date_emision=date_create($infoNot["fechaEmision"]);
      $fecha_format_emision= date_format($date_emision,"d/m/Y");
    	$cbc = $xml->createElement('fechaEmision',$fecha_format_emision);
    	$cbc = $infoGuiaRemision->appendChild($cbc);*/
    	$cbc = $xml->createElement('dirEstablecimiento', $infoNot["dirEstablecimiento"]);
      $cbc = $infoGuiaRemision->appendChild($cbc);
      $cbc = $xml->createElement('dirPartida', $infoNot["dirPartida"]);
      $cbc = $infoGuiaRemision->appendChild($cbc);
      $cbc = $xml->createElement('razonSocialTransportista', $infoNot["razonSocialTransportista"]);
    	$cbc = $infoGuiaRemision->appendChild($cbc);
      if(isset($infoNot->contribuyenteEspecial)){
        if($infoNot->contribuyenteEspecial!= "" && !is_null($infoNot["contribuyenteEspecia"])){
          $cbc = $xml->createElement('contribuyenteEspecial', $infoNot["contribuyenteEspecial"]);
          $cbc = $infoGuiaRemision->appendChild($cbc);
        }
      }
      $cbc = $xml->createElement('tipoIdentificacionTransportista', $infoNot["tipoIdentificacionTransportista"]);
      $cbc = $infoGuiaRemision->appendChild($cbc);
    	$cbc = $xml->createElement('rucTransportista', $infoNot["rucTransportista"]);
    	$cbc = $infoGuiaRemision->appendChild($cbc);
      $cbc = $xml->createElement('obligadoContabilidad', $infoNot["obligadoContabilidad"]);
      $cbc = $infoGuiaRemision->appendChild($cbc);

      $fechaIniTransporte=date_create($infoNot["fechaIniTransporte"]);
      $fecha_format_ini_transporte= date_format($fechaIniTransporte,"d/m/Y");
      $cbc = $xml->createElement('fechaIniTransporte', $fecha_format_ini_transporte);
      $cbc = $infoGuiaRemision->appendChild($cbc);

      $fechaFinTransporte=date_create($infoNot["fechaFinTransporte"]);
      $fecha_format_fin_transporte= date_format($fechaFinTransporte,"d/m/Y");
      $cbc = $xml->createElement('fechaFinTransporte', $fecha_format_fin_transporte);
      $cbc = $infoGuiaRemision->appendChild($cbc);

    	$cbc = $xml->createElement('placa', $infoNot["placa"]);
      $cbc = $infoGuiaRemision->appendChild($cbc);

    	$destinatarios = $xml->createElement('destinatarios');
      $destinatarios = $GUIA->appendChild($destinatarios);
      $destinatariosInfo = $data["destinatarios"];

      foreach ($destinatariosInfo as $key => $value) {

        $destinatario = $xml->createElement('destinatario');
        $destinatario = $destinatarios->appendChild($destinatario);
        $cbc = $xml->createElement('identificacionDestinatario', $value["identificacionDestinatario"]);
        $cbc = $destinatario->appendChild($cbc);
        $cbc = $xml->createElement('razonSocialDestinatario', $value["razonSocialDestinatario"]);
        $cbc = $destinatario->appendChild($cbc);
        $cbc = $xml->createElement('dirDestinatario', $value["dirDestinatario"]);
        $cbc = $destinatario->appendChild($cbc);
        $cbc = $xml->createElement('motivoTraslado', $value["motivoTraslado"]);
        $cbc = $destinatario->appendChild($cbc);

        $detalles = $value["detalles"];

        $detallesGuia = $xml->createElement('detalles');
        $detallesGuia = $destinatario->appendChild($detallesGuia);
        foreach ($detalles as $key => $value) {
          $detalleGuia = $xml->createElement('detalle');
          $detalleGuia = $detallesGuia->appendChild($detalleGuia);
          $cbc = $xml->createElement('codigoInterno', $value["codigoInterno"]);
          $cbc = $detalleGuia->appendChild($cbc);
          $cbc = $xml->createElement('descripcion', $value["descripcion"]);
          $cbc = $detalleGuia->appendChild($cbc);
          $cbc = $xml->createElement('cantidad', $value["cantidad"]);
          $cbc = $detalleGuia->appendChild($cbc);
        }

      }



      $infoAdicionalGuia =$data["infoAdicional"];

      $infoAdicional =  $xml->createElement('infoAdicional');
      $infoAdicional = $GUIA->appendChild($infoAdicional);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalGuia["telefono"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Telefono';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalGuia["email"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Email';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);


      $xml->formatOutput = true;
      $strings_xml = $xml->saveXML();
      return $strings_xml;
    }
    public function generarNotaDebitoXml($data){

      $infoTrib = $data["infoTributaria"];

      $xml = new \DOMDocument('1.0', 'UTF-8');
		  $xml->preserveWhiteSpace = false;

      $NotaCredito = $xml->createElement('notaDebito');
      $domAttribute = $xml->createAttribute('id');
      $domAttribute->value = 'comprobante';
      $NotaCredito->appendChild($domAttribute);
      $domAttribute1 = $xml->createAttribute('version');
      $domAttribute1->value = '1.0.0';
      $NotaCredito->appendChild($domAttribute1);
		  $NotaCredito = $xml->appendChild($NotaCredito);
      // INFORMACION TRIBUTARIA.
    	$infoTributaria = $xml->createElement('infoTributaria');
    	$infoTributaria = $NotaCredito->appendChild($infoTributaria);
    	$cbc = $xml->createElement('ambiente',$infoTrib["ambiente"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('tipoEmision', $infoTrib["tipoEmision"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocial', $infoTrib["razonSocial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('nombreComercial', $infoTrib["nombreComercial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ruc', $infoTrib["ruc"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('claveAcceso', $infoTrib["claveAcceso"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('codDoc', $infoTrib["codDoc"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('estab', $infoTrib["estab"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ptoEmi', $infoTrib["ptoEmi"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('secuencial', $infoTrib["secuencial"]);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('dirMatriz', $infoTrib["dirMatriz"]);
      $cbc = $infoTributaria->appendChild($cbc);
      if($infoTrib["regimen"]=="1"){
        $cbc = $xml->createElement('regimenMicroempresas', "CONTRIBUYENTE RÉGIMEN MICROEMPRESAS");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib["regimen"]=="2"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib["regimen"]=="3"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }


      $infoNot = $data["infoNotaDebito"];
      // INFORMACIÓN DE NOTA CREDITO.



    	$infoNotaDebito = $xml->createElement('infoNotaDebito');
      $infoNotaDebito = $NotaCredito->appendChild($infoNotaDebito);
      $date_emision=date_create($infoNot["fechaEmision"]);
      $fecha_format_emision= date_format($date_emision,"d/m/Y");
    	$cbc = $xml->createElement('fechaEmision',$fecha_format_emision);
    	$cbc = $infoNotaDebito->appendChild($cbc);
    	$cbc = $xml->createElement('dirEstablecimiento', $infoNot["dirEstablecimiento"]);
      $cbc = $infoNotaDebito->appendChild($cbc);
      $cbc = $xml->createElement('tipoIdentificacionComprador', $infoNot["tipoIdentificacionComprador"]);
      $cbc = $infoNotaDebito->appendChild($cbc);
      $cbc = $xml->createElement('razonSocialComprador', $infoNot["razonSocialComprador"]);
    	$cbc = $infoNotaDebito->appendChild($cbc);
      if(isset($infoNot->contribuyenteEspecial)){
        if($infoNot->contribuyenteEspecial!= "" && !is_null($infoNot["contribuyenteEspecia"])){
          $cbc = $xml->createElement('contribuyenteEspecial', $infoNot["contribuyenteEspecial"]);
          $cbc = $infoNotaDebito->appendChild($cbc);
        }
      }
      $cbc = $xml->createElement('identificacionComprador', $infoNot["identificacionComprador"]);
      $cbc = $infoNotaDebito->appendChild($cbc);

    	$cbc = $xml->createElement('obligadoContabilidad', $infoNot["obligadoContabilidad"]);
    	$cbc = $infoNotaDebito->appendChild($cbc);



      $cbc = $xml->createElement('codDocModificado', $infoNot["codDocModificado"]);
      $cbc = $infoNotaDebito->appendChild($cbc);
      $cbc = $xml->createElement('numDocModificado', $infoNot["numDocModificado"]);
      $cbc = $infoNotaDebito->appendChild($cbc);
      $fechaEmisionDocSustento=date_create($infoNot["fechaEmisionDocSustento"]);
      $fecha_format_sustento_emision= date_format($fechaEmisionDocSustento,"d/m/Y");
      $cbc = $xml->createElement('fechaEmisionDocSustento', $fecha_format_sustento_emision);
    	$cbc = $infoNotaDebito->appendChild($cbc);
    	$cbc = $xml->createElement('totalSinImpuestos', $infoNot["totalSinImpuestos"]);
      $cbc = $infoNotaDebito->appendChild($cbc);

    	$totalConImpuestos = $xml->createElement('impuestos');
      $totalConImpuestos = $infoNotaDebito->appendChild($totalConImpuestos);
      $impuestos = $infoNot["impuestos"];

      foreach ($impuestos as $key => $value) {
        $totalImpuesto = $xml->createElement('impuesto');
        $totalImpuesto = $totalConImpuestos->appendChild($totalImpuesto);
        $cbc = $xml->createElement('codigo', $value["codigo"]);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('codigoPorcentaje', $value["codigoPorcentaje"]);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('tarifa', $value["tarifa"]);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('baseImponible', $value["baseImponible"]);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('valor', $value["valor"]);
        $cbc = $totalImpuesto->appendChild($cbc);
      }

      $cbc = $xml->createElement('valorTotal', $infoNot["valorTotal"]);
    	$cbc = $infoNotaDebito->appendChild($cbc);







      $pagosData = $infoNot["pagos"];
      $pagos = $xml->createElement('pagos');
      $pagos = $infoNotaDebito->appendChild($pagos);
      foreach ($pagosData as $key => $value) {
        $pago = $xml->createElement('pago');
        $pago = $pagos->appendChild($pago);
        $cbc = $xml->createElement('formaPago', $value["formaPago"]);
        $cbc = $pago->appendChild($cbc);
        $cbc = $xml->createElement('total', $value["total"]);
        $cbc = $pago->appendChild($cbc);
        $cbc = $xml->createElement('plazo', $value["plazo"]);
        $cbc = $pago->appendChild($cbc);
        $cbc = $xml->createElement('unidadTiempo', $value["unidadTiempo"]);
        $cbc = $pago->appendChild($cbc);
      }



      //DETALLES DE nota crédito.
    	$detalles = $xml->createElement('motivos');
      $detalles = $NotaCredito->appendChild($detalles);

      $dataDetalle = $data["motivos"];

      foreach ($dataDetalle as $key => $value) {

            $detalle = $xml->createElement('motivo');
            $detalle = $detalles->appendChild($detalle);
            $cbc = $xml->createElement('razon', $value["razon"]);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('valor', $value["valor"]);
            $cbc = $detalle->appendChild($cbc);

      }

      $infoAdicionalNotaDebito =$data["infoAdicional"];

      $infoAdicional =  $xml->createElement('infoAdicional');
      $infoAdicional = $NotaCredito->appendChild($infoAdicional);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalNotaDebito["telefono"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Telefono';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalNotaDebito["email"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Email';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);


      $xml->formatOutput = true;
      $strings_xml = $xml->saveXML();
      return $strings_xml;
    }


    public function generarNotaCreditoXml($data){

      $infoTrib = $data->infoTributaria;

      $xml = new \DOMDocument('1.0', 'UTF-8');
		  $xml->preserveWhiteSpace = false;

      $NotaCredito = $xml->createElement('notaCredito');
      $domAttribute = $xml->createAttribute('id');
      $domAttribute->value = 'comprobante';
      $NotaCredito->appendChild($domAttribute);
      $domAttribute1 = $xml->createAttribute('version');
      $domAttribute1->value = '1.0.0';
      $NotaCredito->appendChild($domAttribute1);
		  $NotaCredito = $xml->appendChild($NotaCredito);
      // INFORMACION TRIBUTARIA.
    	$infoTributaria = $xml->createElement('infoTributaria');
    	$infoTributaria = $NotaCredito->appendChild($infoTributaria);
    	$cbc = $xml->createElement('ambiente',$infoTrib->ambiente);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('tipoEmision', $infoTrib->tipoEmision);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocial', $infoTrib->razonSocial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('nombreComercial', $infoTrib->nombreComercial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ruc', $infoTrib->ruc);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('claveAcceso', $infoTrib->claveAcceso);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('codDoc', $infoTrib->codDoc);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('estab', $infoTrib->estab);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ptoEmi', $infoTrib->ptoEmi);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('secuencial', $infoTrib->secuencial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('dirMatriz', $infoTrib->dirMatriz);
      $cbc = $infoTributaria->appendChild($cbc);
      if($infoTrib->regimen=="1"){
        $cbc = $xml->createElement('regimenMicroempresas', "CONTRIBUYENTE RÉGIMEN MICROEMPRESAS");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib->regimen=="2"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib->regimen=="3"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }


      $infoNot = $data->infoNotaCredito;
      // INFORMACIÓN DE NOTA CREDITO.



    	$infoNotaCredito = $xml->createElement('infoNotaCredito');
      $infoNotaCredito = $NotaCredito->appendChild($infoNotaCredito);
      $date_emision=date_create($infoNot->fechaEmision);
      $fecha_format_emision= date_format($date_emision,"d/m/Y");
    	$cbc = $xml->createElement('fechaEmision',$fecha_format_emision);
    	$cbc = $infoNotaCredito->appendChild($cbc);
    	$cbc = $xml->createElement('dirEstablecimiento', $infoNot->dirEstablecimiento);
      $cbc = $infoNotaCredito->appendChild($cbc);
      $cbc = $xml->createElement('tipoIdentificacionComprador', $infoNot->tipoIdentificacionComprador);
      $cbc = $infoNotaCredito->appendChild($cbc);
      $cbc = $xml->createElement('razonSocialComprador', $infoNot->razonSocialComprador);
    	$cbc = $infoNotaCredito->appendChild($cbc);
      if(isset($infoNot->contribuyenteEspecial)){
        if($infoNot->contribuyenteEspecial!= "" && !is_null($infoNot->contribuyenteEspecia)){
          $cbc = $xml->createElement('contribuyenteEspecial', $infoNot->contribuyenteEspecial);
          $cbc = $infoNotaCredito->appendChild($cbc);
        }
      }
      $cbc = $xml->createElement('identificacionComprador', $infoNot->identificacionComprador);
      $cbc = $infoNotaCredito->appendChild($cbc);

    	$cbc = $xml->createElement('obligadoContabilidad', $infoNot->obligadoContabilidad);
    	$cbc = $infoNotaCredito->appendChild($cbc);



      $cbc = $xml->createElement('codDocModificado', $infoNot->codDocModificado);
      $cbc = $infoNotaCredito->appendChild($cbc);
      $cbc = $xml->createElement('numDocModificado', $infoNot->numDocModificado);
      $cbc = $infoNotaCredito->appendChild($cbc);

      $fechaEmisionDocSustento=date_create($infoNot->fechaEmisionDocSustento);
      $fecha_format_sustento_emision= date_format($fechaEmisionDocSustento,"d/m/Y");

      $cbc = $xml->createElement('fechaEmisionDocSustento', $fecha_format_sustento_emision);
    	$cbc = $infoNotaCredito->appendChild($cbc);
    	$cbc = $xml->createElement('totalSinImpuestos', $infoNot->totalSinImpuestos);
      $cbc = $infoNotaCredito->appendChild($cbc);
      $cbc = $xml->createElement('valorModificacion', $infoNot->valorModificacion);
    	$cbc = $infoNotaCredito->appendChild($cbc);
     /*$cbc = $xml->createElement('totalDescuento', $infoNot->totalDescuento);
    	$cbc = $infoNotaCredito->appendChild($cbc);*/
      $cbc = $xml->createElement('moneda',  $infoNot->moneda);
      $cbc = $infoNotaCredito->appendChild($cbc);
      $totalConImp= $infoNot->totalConImpuestos;

    	$totalConImpuestos = $xml->createElement('totalConImpuestos');
      $totalConImpuestos = $infoNotaCredito->appendChild($totalConImpuestos);

      foreach ($totalConImp as $key => $value) {
        $totalImpuesto = $xml->createElement('totalImpuesto');
        $totalImpuesto = $totalConImpuestos->appendChild($totalImpuesto);
        $cbc = $xml->createElement('codigo', $value->codigo);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('codigoPorcentaje', $value->codigoPorcentaje);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('baseImponible', $value->baseImponible);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('valor', $value->valor);
        $cbc = $totalImpuesto->appendChild($cbc);
      }

      if(isset($infoNot->propina)){
        $cbc = $xml->createElement('propina', $infoLic->propina);
        $cbc = $infoNotaCredito->appendChild($cbc);
      }





      $cbc = $xml->createElement('motivo',  $infoNot->motivo);
    	$cbc = $infoNotaCredito->appendChild($cbc);

      /*$pagosData = $infoNot->pagos;
      $pagos = $xml->createElement('pagos');
      $pagos = $infoLiquidacionCompra->appendChild($pagos);
      $pago = $xml->createElement('pago');
      $pago = $pagos->appendChild($pago);
      $cbc = $xml->createElement('formaPago', $pagosData->formaPago);
      $cbc = $pago->appendChild($cbc);
      $cbc = $xml->createElement('total', $pagosData->total);
    	$cbc = $pago->appendChild($cbc);*/


      //DETALLES DE nota crédito.
    	$detalles = $xml->createElement('detalles');
      $detalles = $NotaCredito->appendChild($detalles);



      $dataDetalle = $data->detalle;

      foreach ($dataDetalle as $key => $value) {

            $detalle = $xml->createElement('detalle');
            $detalle = $detalles->appendChild($detalle);
            $cbc = $xml->createElement('codigoInterno', $value->codigoPrincipal);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('descripcion', $value->descripcion);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('cantidad',$value->cantidad);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('precioUnitario', $value->precioUnitario);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('descuento', $value->descuento);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('precioTotalSinImpuesto', $value->precioTotalSinImpuesto);
            $cbc = $detalle->appendChild($cbc);

            $imp = $value->impuesto;

                $impuestos = $xml->createElement('impuestos');
                $impuestos = $detalle->appendChild($impuestos);
                $impuesto = $xml->createElement('impuesto');
                $impuesto = $impuestos->appendChild($impuesto);
                $cbc = $xml->createElement('codigo', $imp->codigo);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('codigoPorcentaje', $imp->codigoPorcentaje);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('tarifa', $imp->tarifa);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('baseImponible', $imp->baseImponible);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('valor', $imp->valor);
                $cbc = $impuesto->appendChild($cbc);

      }
      $infoAdicionalNotaCredito =$data->infoAdicional;

      $infoAdicional =  $xml->createElement('infoAdicional');
      $infoAdicional = $NotaCredito->appendChild($infoAdicional);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalNotaCredito["telefono"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Telefono';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalNotaCredito["email"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Email';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);


      $xml->formatOutput = true;
      $strings_xml = $xml->saveXML();
      return $strings_xml;
    }

    public function generarLiquidacionCompraXml($data){
      $infoTrib = $data->infoTributaria;

      $xml = new \DOMDocument('1.0', 'UTF-8');
		  $xml->preserveWhiteSpace = false;

      $Liquidacion = $xml->createElement('liquidacionCompra');
      $domAttribute = $xml->createAttribute('id');
      $domAttribute->value = 'comprobante';
      $Liquidacion->appendChild($domAttribute);
      $domAttribute1 = $xml->createAttribute('version');
      $domAttribute1->value = '1.0.0';
      $Liquidacion->appendChild($domAttribute1);
		  $Liquidacion = $xml->appendChild($Liquidacion);
      // INFORMACION TRIBUTARIA.
    	$infoTributaria = $xml->createElement('infoTributaria');
    	$infoTributaria = $Liquidacion->appendChild($infoTributaria);
    	$cbc = $xml->createElement('ambiente',$infoTrib->ambiente);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('tipoEmision', $infoTrib->tipoEmision);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocial', $infoTrib->razonSocial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('nombreComercial', $infoTrib->nombreComercial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ruc', $infoTrib->ruc);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('claveAcceso', $infoTrib->claveAcceso);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('codDoc', $infoTrib->codDoc);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('estab', $infoTrib->estab);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('ptoEmi', $infoTrib->ptoEmi);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('secuencial', $infoTrib->secuencial);
    	$cbc = $infoTributaria->appendChild($cbc);
    	$cbc = $xml->createElement('dirMatriz', $infoTrib->dirMatriz);
      $cbc = $infoTributaria->appendChild($cbc);
      if($infoTrib->regimen=="1"){
        $cbc = $xml->createElement('regimenMicroempresas', "CONTRIBUYENTE RÉGIMEN MICROEMPRESAS");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib->regimen=="2"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }
      if($infoTrib->regimen=="3"){
        $cbc = $xml->createElement('contribuyenteRimpe', "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
        $cbc = $infoTributaria->appendChild($cbc);
      }


      $infoLic = $data->infoLiquidacionCompra;
      // INFORMACIÓN DE FACTURA.
    	$infoLiquidacionCompra = $xml->createElement('infoLiquidacionCompra');
      $infoLiquidacionCompra = $Liquidacion->appendChild($infoLiquidacionCompra);
      $date_emision=date_create($infoLic->fechaEmision);
      $fecha_format_emision= date_format($date_emision,"d/m/Y");
    	$cbc = $xml->createElement('fechaEmision',$fecha_format_emision);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('dirEstablecimiento', $infoLic->dirEstablecimiento);
      $cbc = $infoLiquidacionCompra->appendChild($cbc);

      if(isset($infoLic->contribuyenteEspecial)){
        if($infoLic->contribuyenteEspecial!= "" && !is_null($infoLic->contribuyenteEspecia)){
          $cbc = $xml->createElement('contribuyenteEspecial', $infoLic->contribuyenteEspecial);
          $cbc = $infoLiquidacionCompra->appendChild($cbc);
        }
      }


    	$cbc = $xml->createElement('obligadoContabilidad', $infoLic->obligadoContabilidad);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('tipoIdentificacionProveedor', $infoLic->tipoIdentificacionProveedor);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('razonSocialProveedor', $infoLic->razonSocialProveedor);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('identificacionProveedor', $infoLic->identificacionProveedor);
      $cbc = $infoLiquidacionCompra->appendChild($cbc);
      $cbc = $xml->createElement('direccionProveedor', $infoLic->direccionProveedor);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('totalSinImpuestos', $infoLic->totalSinImpuestos);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('totalDescuento', $infoLic->totalDescuento);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);

      $totalConImp= $infoLic->totalConImpuestos;

    	$totalConImpuestos = $xml->createElement('totalConImpuestos');
      $totalConImpuestos = $infoLiquidacionCompra->appendChild($totalConImpuestos);

      foreach ($totalConImp as $key => $value) {
        $totalImpuesto = $xml->createElement('totalImpuesto');
        $totalImpuesto = $totalConImpuestos->appendChild($totalImpuesto);
        $cbc = $xml->createElement('codigo', $value->codigo);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('codigoPorcentaje', $value->codigoPorcentaje);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('descuentoAdicional', '0');
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('baseImponible', $value->baseImponible);
        $cbc = $totalImpuesto->appendChild($cbc);
        $cbc = $xml->createElement('valor', $value->valor);
        $cbc = $totalImpuesto->appendChild($cbc);
      }

      if(isset($infoLic->propina)){
        $cbc = $xml->createElement('propina', $infoLic->propina);
        $cbc = $infoLiquidacionCompra->appendChild($cbc);
      }



    	$cbc = $xml->createElement('importeTotal', $infoLic->importeTotal);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);
    	$cbc = $xml->createElement('moneda',  $infoLic->moneda);
    	$cbc = $infoLiquidacionCompra->appendChild($cbc);

      $pagosData = $infoLic->pagos;
      $pagos = $xml->createElement('pagos');
      $pagos = $infoLiquidacionCompra->appendChild($pagos);
      $pago = $xml->createElement('pago');
      $pago = $pagos->appendChild($pago);
      $cbc = $xml->createElement('formaPago', $pagosData->formaPago);
      $cbc = $pago->appendChild($cbc);
      $cbc = $xml->createElement('total', $pagosData->total);
    	$cbc = $pago->appendChild($cbc);


      //DETALLES DE liquidación.
    	$detalles = $xml->createElement('detalles');
      $detalles = $Liquidacion->appendChild($detalles);



      $dataDetalle = $data->detalle;

      foreach ($dataDetalle as $key => $value) {

            $detalle = $xml->createElement('detalle');
            $detalle = $detalles->appendChild($detalle);
            $cbc = $xml->createElement('codigoPrincipal', $value->codigoPrincipal);
            $cbc = $detalle->appendChild($cbc);
          /*
            $cbc = $xml->createElement('codigoAuxiliar', $value->codigoAuxiliar);
            $cbc = $detalle->appendChild($cbc);
            */
            $cbc = $xml->createElement('descripcion', $value->descripcion);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('cantidad',$value->cantidad);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('precioUnitario', $value->precioUnitario);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('descuento', $value->descuento);
            $cbc = $detalle->appendChild($cbc);
            $cbc = $xml->createElement('precioTotalSinImpuesto', $value->precioTotalSinImpuesto);
            $cbc = $detalle->appendChild($cbc);

            $imp = $value->impuesto;

                $impuestos = $xml->createElement('impuestos');
                $impuestos = $detalle->appendChild($impuestos);
                $impuesto = $xml->createElement('impuesto');
                $impuesto = $impuestos->appendChild($impuesto);
                $cbc = $xml->createElement('codigo', $imp->codigo);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('codigoPorcentaje', $imp->codigoPorcentaje);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('tarifa', $imp->tarifa);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('baseImponible', $imp->baseImponible);
                $cbc = $impuesto->appendChild($cbc);
                $cbc = $xml->createElement('valor', $imp->valor);
                $cbc = $impuesto->appendChild($cbc);

      }
      $infoAdicionalLiquidacion =$data->infoAdicional;

      $infoAdicional =  $xml->createElement('infoAdicional');
      $infoAdicional = $Liquidacion->appendChild($infoAdicional);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalLiquidacion["telefono"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Telefono';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);

      $cbc = $xml->createElement('campoAdicional', $infoAdicionalLiquidacion["email"]);
      $domAttribute = $xml->createAttribute('nombre');
      $domAttribute->value = 'Email';
      $cbc->appendChild($domAttribute);
      $cbc = $infoAdicional->appendChild($cbc);


      $xml->formatOutput = true;
      $strings_xml = $xml->saveXML();
      return $strings_xml;
    }




    /**
     *
     */
    public function GenerarClaveDeAccesos($fechaEmision,$tipoComprobante,$ruc,$tipoAmbiente,$serie,$secuencial,$codigoNumerico,$tipoEmision){

      $date=date_create($fechaEmision);
      $fecha_format= date_format($date,"dmY");
      $clave_acceso=$fecha_format.$tipoComprobante.$ruc.$tipoAmbiente.$serie.$secuencial.$codigoNumerico.$tipoEmision;
      $digitoVerificador = $this->obtenerCodigoVerificador($clave_acceso);
      return $clave_acceso_final=$clave_acceso.$digitoVerificador;

    }
    /**
     *
     */
    private function obtenerCodigoVerificador( $num ){

        $digits = str_replace( array( '.', ',' ), array( ''.'' ), strrev($num ) );
        if ( ! ctype_digit( $digits ) )
        {
          return false;
        }
        $sum = 0;
        $factor = 2;
        for( $i=0;$i<strlen( $digits ); $i++ )
        {
          $sum += substr( $digits,$i,1 ) * $factor;
          if ( $factor == 7 )
          {
            $factor = 2;
          }else{
           $factor++;
         }
        }
        $dv = 11 - ($sum % 11);
        if ( $dv == 10 )
        {
          return 1;
        }
        if ( $dv == 11 )
        {
          return 0;
        }
        return $dv;
      }

}

