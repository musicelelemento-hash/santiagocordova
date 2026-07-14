<?php

namespace App\Services;


use App\Traits\ConsumesExternalService;
use SoapClient;

/**
 * Service Lecturas
 */
class FacturacionElectronicaService
{

  use ConsumesExternalService;

/**
 * url base del servicio a consumir
 */
  public $baseUrl;
  private $cafile;
  private $soapTimeout;
  private $url_sri_valida_pruebas ="https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl";
  private $url_sri_autoriza_pruebas ="https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";

  private $url_sri_valida_produccion ="https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl";
  private $url_sri_autoriza_produccion ="https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";

/**
 * key autentication service
 */
  public $secret;

  public function __construct($cafile = null, $soapTimeout = null)
  {
      $this->baseUrl = $this->configValue('services.facturacion.base_url');
      $this->secret = $this->configValue('services.facturacion.secret');
      $this->cafile = $cafile ?: $this->configValue('services.facturacion.cafile');
      $this->soapTimeout = (int) ($soapTimeout ?: $this->configValue('services.facturacion.soap_timeout', 30));
  }



  /**
   *
   */

  public function enviarComprobanteSri($xml, $ambiente){

      $parametros = new \stdClass();
      $parametros->xml = $xml;
      $client="";
      if($ambiente=="1"){// pruebas
        $client = $this->soapClient($this->url_sri_valida_pruebas);
      }
      if($ambiente=="2"){
        $client = $this->soapClient($this->url_sri_valida_produccion);
      }

      $result = $client->validarComprobante($parametros);

     // dd($result);
      return json_encode($result);


   }
   /**
    *
   */
   public function autorizarComprobanteSri($claveAcceso, $ambiente){

      $cliente="";
      $parametros = array(); //parametros de la llamada
      $parametros['claveAccesoComprobante'] = $claveAcceso;
      if($ambiente=="1"){
        $client = $this->soapClient($this->url_sri_autoriza_pruebas);
      }
      if($ambiente=="2"){
        $client = $this->soapClient($this->url_sri_autoriza_produccion);
      }

      $result = $client->autorizacionComprobante($parametros);
     // dd($result);
      return json_encode($result);

  }

  private function soapClient($wsdl)
  {
      $options = [
          'exceptions' => true,
          'trace' => false,
          'cache_wsdl' => WSDL_CACHE_NONE,
          'connection_timeout' => $this->soapTimeout,
      ];

      $cafile = $this->sslCaFile();

      if ($cafile) {
          $options['stream_context'] = stream_context_create([
              'ssl' => [
                  'cafile' => $cafile,
                  'verify_peer' => true,
                  'verify_peer_name' => true,
              ],
              'http' => [
                  'timeout' => $this->soapTimeout * 2,
                  'user_agent' => 'PHP-SOAP/Laravel SRI',
              ],
          ]);
      }

      return new SoapClient($wsdl, $options);
  }

  private function sslCaFile()
  {
      $candidates = [
          $this->cafile,
          ini_get('openssl.cafile'),
          'C:\laragon\etc\ssl\cacert.pem',
          'C:\laragon\bin\git\mingw64\ssl\cert.pem',
          'C:\laragon\bin\git\usr\ssl\cert.pem',
      ];

      foreach ($candidates as $candidate) {
          if ($candidate && is_file($candidate)) {
              return $candidate;
          }
      }

      return null;
  }

  private function configValue($key, $default = null)
  {
      if (!function_exists('config')) {
          return $default;
      }

      try {
          return config($key, $default);
      } catch (\Throwable $exception) {
          return $default;
      }
  }
}
