<?php

namespace App\Http\Controllers;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use LibreriasSri\SignDOcumentToSRI;


class FirmaController extends Controller
{


/**
 * @OA\Get(
 * path="/api/v1/sign/xml",
 * summary="Sign new Cert",
 * description="Sign new Cert",
 * operationId="SignCert",
 * tags={"FirmaController"},
 * @OA\RequestBody(
 *    required=false,
 *    description="Pass user credentials"
 * ),
 * @OA\Response(
 *    response=200,
 *    description="Wrong credentials response",
 *    @OA\JsonContent(
 *      @OA\Property(property="status", type="boolean", example="true"),
 *       @OA\Property(property="data", type="string", example="{xml}")
 *        )
 *     )
 * )
 */

 public function ProcesarFirma(Request $request)
 {
     try {
            //dd("l");
         //return public_path();
           // return $request->json()->all();
         $data = $request->all();
         $this->validarPayloadFirma($data);

         $xml = $this->xmlFromData($data);
         $clave = $this->claveFromData($data);
         $firma = $this->firmaFromData($data);
         $tipoDocumento = $this->tipoDocumentoFromData($data);
         $claveAcceso = $this->claveAccesoFromData($data, $xml);

         if (empty($claveAcceso)) {
            throw new \InvalidArgumentException('El campo ClaveAcceso no fue enviado y no se pudo leer desde el XML.');
         }

         File::put(public_path('certificados/' . $claveAcceso . '.p12'), $firma);
         File::put(public_path('no_firmados/'. $claveAcceso .'.xml'), $xml);
          $respuesta = $this->firmarXml($clave, $claveAcceso, $tipoDocumento);
          $xmlFirmado="";
         if (trim($respuesta) == "FIRMADO") {
              $xmlFirmado = File::get(public_path('si_firmados/' . $claveAcceso . '.xml'));
         } else {
            //dd("k");
             $xmlFirmado = $respuesta;
         }
         File::delete(public_path('no_firmados/' . $claveAcceso . '.xml'));
         File::delete(public_path('si_firmados/' . $claveAcceso . '.xml'));
         File::delete(public_path('certificados/' . $claveAcceso . '.p12'));
         return response()->json([
             "status" => true,
             "data" => $xmlFirmado
         ])->setStatusCode(Response::HTTP_OK);
     } catch (\Throwable $th) {
         throw new HttpResponseException(response()->json([
             'status'   => false,
             'message'   => 'Validation errors ' . $th,
         ]));
     }
 }

    private function validarPayloadFirma($data)
    {
        if (!$this->hasAny($data, ['Xml', 'xml_base64', 'xml'])) {
            throw new \InvalidArgumentException('El campo Xml, xml_base64 o xml es requerido.');
        }

        if (!$this->hasAny($data, ['Clave', 'clave_base64', 'clave'])) {
            throw new \InvalidArgumentException('El campo Clave, clave_base64 o clave es requerido.');
        }

        if (!$this->hasAny($data, ['Firma', 'certificado_p12_base64'])) {
            throw new \InvalidArgumentException('El campo Firma o certificado_p12_base64 es requerido.');
        }
    }

    private function hasAny($data, $fields)
    {
        foreach ($fields as $field) {
            if (isset($data[$field]) && '' !== $data[$field] && !is_null($data[$field])) {
                return true;
            }
        }

        return false;
    }

    private function xmlFromData($data)
    {
        if (isset($data['Xml']) && !empty($data['Xml'])) {
            return $this->decodeBase64Field($data['Xml'], 'Xml');
        }

        if (isset($data['xml_base64']) && !empty($data['xml_base64'])) {
            return $this->decodeBase64Field($data['xml_base64'], 'xml_base64');
        }

        return $data['xml'];
    }

    private function claveFromData($data)
    {
        if (isset($data['Clave']) && !empty($data['Clave'])) {
            return $this->decodeBase64Field($data['Clave'], 'Clave');
        }

        if (isset($data['clave_base64']) && !empty($data['clave_base64'])) {
            return $this->decodeBase64Field($data['clave_base64'], 'clave_base64');
        }

        return $data['clave'];
    }

    private function firmaFromData($data)
    {
        if (isset($data['Firma']) && !empty($data['Firma'])) {
            return $this->decodeBase64Field($data['Firma'], 'Firma');
        }

        return $this->decodeBase64Field($data['certificado_p12_base64'], 'certificado_p12_base64');
    }

    private function claveAccesoFromData($data, $xml)
    {
        if (isset($data['ClaveAcceso']) && !empty($data['ClaveAcceso'])) {
            return $this->decodeBase64Field($data['ClaveAcceso'], 'ClaveAcceso');
        }

        if (isset($data['clave_acceso']) && !empty($data['clave_acceso'])) {
            return $data['clave_acceso'];
        }

        return $this->obtenerClaveAccesoDesdeXml($xml);
    }

    private function tipoDocumentoFromData($data)
    {
        if (isset($data['TipoDocumento']) && !empty($data['TipoDocumento'])) {
            return $data['TipoDocumento'];
        }

        if (isset($data['Tipo']) && !empty($data['Tipo'])) {
            return $data['Tipo'];
        }

        if (isset($data['tipo']) && !empty($data['tipo'])) {
            return $data['tipo'];
        }

        return 'factura';
    }

    private function decodeBase64Field($value, $field)
    {
        $decoded = base64_decode($value, true);

        if (false === $decoded) {
            throw new \InvalidArgumentException("El campo {$field} no es un base64 valido.");
        }

        return $decoded;
    }

    private function obtenerClaveAccesoDesdeXml($xml)
    {
        $document = new \DOMDocument();

        if (!$document->loadXML($xml)) {
            throw new \InvalidArgumentException('El XML enviado no es valido.');
        }

        $claveAcceso = $document->getElementsByTagName('claveAcceso')->item(0);

        if (is_null($claveAcceso)) {
            return null;
        }

        return trim($claveAcceso->nodeValue);
    }






    private function firmarXml($clavecertificado,$documento,$tipo_documento = 'factura')
    {
        try {

            // nombre firma
            //$certificado="nombre_certificado";
            $cert =  public_path("certificados/" . $documento . ".p12");
            $ruta_no_firmados = public_path("no_firmados/" . $documento . ".xml");
            date_default_timezone_set("America/Guayaquil");



            // clave de firma
            $clave = $clavecertificado;
            date_default_timezone_set("America/Guayaquil");

            // ruta certificado
           // $cert =  public_path("certificados/" . $certificado . ".p12");
            $almacen_cert = file_get_contents($cert);

            // ruta no firmados
            $ruta_no_firmados = public_path("no_firmados/" . $documento . ".xml");

            $acceso_no_firmados = file_get_contents($ruta_no_firmados);

            $factura_firmada =  new SignDOcumentToSRI($tipo_documento, $almacen_cert, $clave, $acceso_no_firmados);


            // ruta firmados
            File::put(public_path('si_firmados/' . $documento . '.xml'), $factura_firmada->xml);

            return  "FIRMADO";
        } catch (\Throwable $th) {
            return  "NO FIRMADO" . $th;
        }
    }
}
