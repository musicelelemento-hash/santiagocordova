<?php

namespace App\Http\Controllers;

use App\Services\FacturacionElectronicaLibrary;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class FacturacionElectronicaController extends Controller
{
    private $facturacion;

    public function __construct(FacturacionElectronicaLibrary $facturacion)
    {
        $this->facturacion = $facturacion;
    }

    public function tipos()
    {
        return response()->json([
            'status' => true,
            'data' => $this->facturacion->tiposSoportados(),
        ]);
    }

    public function generarXml(Request $request)
    {
        $request->validate([
            'tipo' => 'required|string',
            'data' => 'required|array',
        ]);

        $xml = $this->facturacion->generarXml(
            $request->input('tipo'),
            $request->input('data')
        );

        return response()->json([
            'status' => true,
            'data' => [
                'xml' => $xml,
                'xml_base64' => base64_encode($xml),
            ],
        ], Response::HTTP_OK);
    }

    public function firmarXml(Request $request)
    {
        $request->validate([
            'tipo' => 'required|string',
            'xml' => 'required_without:xml_base64|string',
            'xml_base64' => 'required_without:xml|string',
            'certificado_p12_base64' => 'nullable|string',
            'clave' => 'nullable|string',
            'clave_base64' => 'nullable|string',
        ]);

        $xmlFirmado = $this->facturacion->firmarXml(
            $request->input('tipo'),
            $this->xmlFromRequest($request),
            $this->certificadoFromRequest($request),
            $this->claveCertificadoFromRequest($request)
        );

        return response()->json([
            'status' => true,
            'data' => [
                'xml' => $xmlFirmado,
                'xml_base64' => base64_encode($xmlFirmado),
            ],
        ], Response::HTTP_OK);
    }

    public function generarYFirmarXml(Request $request)
    {
        $request->validate([
            'tipo' => 'required|string',
            'data' => 'required|array',
            'certificado_p12_base64' => 'nullable|string',
            'clave' => 'nullable|string',
            'clave_base64' => 'nullable|string',
        ]);

        $xmlFirmado = $this->facturacion->generarYFirmarXml(
            $request->input('tipo'),
            $request->input('data'),
            $this->certificadoFromRequest($request),
            $this->claveCertificadoFromRequest($request)
        );

        return response()->json([
            'status' => true,
            'data' => [
                'xml' => $xmlFirmado,
                'xml_base64' => base64_encode($xmlFirmado),
            ],
        ], Response::HTTP_OK);
    }

    public function enviarSri(Request $request)
    {
        $request->validate([
            'xml' => 'required_without:xml_base64|string',
            'xml_base64' => 'required_without:xml|string',
            'ambiente' => 'required|in:1,2',
        ]);

        return response()->json([
            'status' => true,
            'data' => $this->facturacion->enviarSri(
                $this->xmlFromRequest($request),
                $request->input('ambiente')
            ),
        ], Response::HTTP_OK);
    }

    public function autorizarSri(Request $request)
    {
        $request->validate([
            'clave_acceso' => 'required|string|size:49',
            'ambiente' => 'required|in:1,2',
        ]);

        return response()->json([
            'status' => true,
            'data' => $this->facturacion->autorizarSri(
                $request->input('clave_acceso'),
                $request->input('ambiente')
            ),
        ], Response::HTTP_OK);
    }

    public function generarClaveAcceso(Request $request)
    {
        $request->validate([
            'fecha_emision' => 'required|string',
            'tipo_comprobante' => 'required|string',
            'ruc' => 'required|string',
            'ambiente' => 'required|in:1,2',
            'serie' => 'required|string|size:6',
            'secuencial' => 'required|string',
            'codigo_numerico' => 'required|string',
            'tipo_emision' => 'nullable|string',
        ]);

        return response()->json([
            'status' => true,
            'data' => [
                'clave_acceso' => $this->facturacion->generarClaveAcceso(
                    $request->input('fecha_emision'),
                    $request->input('tipo_comprobante'),
                    $request->input('ruc'),
                    $request->input('ambiente'),
                    $request->input('serie'),
                    $request->input('secuencial'),
                    $request->input('codigo_numerico'),
                    $request->input('tipo_emision', '1')
                ),
            ],
        ], Response::HTTP_OK);
    }

    public function validarIdentificacion(Request $request)
    {
        $request->validate([
            'tipo' => 'required|in:cedula,ruc_natural,ruc_privado,ruc_publico',
            'numero' => 'required|string',
        ]);

        return response()->json([
            'status' => true,
            'data' => [
                'valido' => $this->facturacion->validarIdentificacion(
                    $request->input('tipo'),
                    $request->input('numero')
                ),
            ],
        ], Response::HTTP_OK);
    }

    private function xmlFromRequest(Request $request)
    {
        return $request->filled('xml_base64')
            ? base64_decode($request->input('xml_base64'))
            : $request->input('xml');
    }

    private function claveFromRequest(Request $request)
    {
        return $request->filled('clave_base64')
            ? base64_decode($request->input('clave_base64'))
            : $request->input('clave');
    }

    private function certificadoFromRequest(Request $request)
    {
        if ($request->filled('certificado_p12_base64')) {
            return base64_decode($request->input('certificado_p12_base64'));
        }

        $certificado = config('services.facturacion.certificado_p12');

        if (!$certificado) {
            throw ValidationException::withMessages([
                'certificado' => 'Configure FACTURACION_CERTIFICADO_P12 en .env o envie certificado_p12_base64.',
            ]);
        }

        $path = $this->resolverRutaCertificado($certificado);

        if (!is_file($path)) {
            throw ValidationException::withMessages([
                'certificado' => "No existe el certificado configurado: {$path}",
            ]);
        }

        return file_get_contents($path);
    }

    private function claveCertificadoFromRequest(Request $request)
    {
        $clave = $this->claveFromRequest($request);

        if ($clave) {
            return $clave;
        }

        $clave = config('services.facturacion.clave_certificado');

        if (!$clave) {
            throw ValidationException::withMessages([
                'clave' => 'Configure FACTURACION_CERTIFICADO_CLAVE en .env o envie clave/clave_base64.',
            ]);
        }

        return $clave;
    }

    private function resolverRutaCertificado($certificado)
    {
        if (preg_match('/^[A-Za-z]:[\\\\\\/]/', $certificado) || substr($certificado, 0, 1) === '/' || substr($certificado, 0, 2) === '\\\\') {
            return $certificado;
        }

        return public_path($certificado);
    }
}
