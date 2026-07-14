<?php

namespace LibreriasSri;

use InvalidArgumentException;

class FacturacionElectronicaLibrary
{
    private $facturacion;
    private $sri;
    private $validadores;

    private $generadores = [
        'factura' => ['generarFacturaXml', 'object'],
        'comprobanteRetencion' => ['generarRetencionXml', 'array'],
        'guiaRemision' => ['generarGuiaXml', 'array'],
        'notaDebito' => ['generarNotaDebitoXml', 'array'],
        'notaCredito' => ['generarNotaCreditoXml', 'object'],
        'liquidacionCompra' => ['generarLiquidacionCompraXml', 'object'],
    ];

    public function __construct(
        FacturacionElectronica $facturacion = null,
        FacturacionElectronicaService $sri = null,
        Validadores $validadores = null
    ) {
        $this->facturacion = $facturacion ?: new FacturacionElectronica();
        $this->sri = $sri ?: new FacturacionElectronicaService();
        $this->validadores = $validadores ?: new Validadores();
    }

    public function tiposSoportados()
    {
        return array_keys($this->generadores);
    }

    public function generarXml($tipoComprobante, $data)
    {
        $tipoComprobante = $this->normalizarTipoComprobante($tipoComprobante);
        [$metodo, $formato] = $this->generadores[$tipoComprobante];

        $payload = $formato === 'array'
            ? $this->toArray($data)
            : $this->toObject($data);

        $payload = $this->asegurarClaveAcceso($tipoComprobante, $payload, $formato);

        return $this->facturacion->$metodo($payload);
    }

    public function firmarXml($tipoComprobante, $xml, $certificadoP12, $claveCertificado)
    {
        $tipoComprobante = $this->normalizarTipoComprobante($tipoComprobante);
        $firma = new SignDOcumentToSRI($tipoComprobante, $certificadoP12, $claveCertificado, $xml);

        return $firma->xml;
    }

    public function generarYFirmarXml($tipoComprobante, $data, $certificadoP12, $claveCertificado)
    {
        $xml = $this->generarXml($tipoComprobante, $data);

        return $this->firmarXml($tipoComprobante, $xml, $certificadoP12, $claveCertificado);
    }

    public function enviarSri($xmlFirmado, $ambiente)
    {
        return $this->decodeSriResponse(
            $this->sri->enviarComprobanteSri($xmlFirmado, $ambiente)
        );
    }

    public function autorizarSri($claveAcceso, $ambiente)
    {
        return $this->decodeSriResponse(
            $this->sri->autorizarComprobanteSri($claveAcceso, $ambiente)
        );
    }

    public function generarClaveAcceso($fechaEmision, $tipoComprobante, $ruc, $ambiente, $serie, $secuencial, $codigoNumerico, $tipoEmision = '1')
    {
        return $this->facturacion->GenerarClaveDeAccesos(
            $fechaEmision,
            $tipoComprobante,
            $ruc,
            $ambiente,
            $serie,
            $secuencial,
            $codigoNumerico,
            $tipoEmision
        );
    }

    public function validarIdentificacion($tipo, $numero)
    {
        switch ($tipo) {
            case 'cedula':
                return $this->validadores->validarCedula($numero);
            case 'ruc_natural':
                return $this->validadores->validarRucPersonaNatural($numero);
            case 'ruc_privado':
                return $this->validadores->validarRucSociedadPrivada($numero);
            case 'ruc_publico':
                return $this->validadores->validarRucSociedadPublica($numero);
            default:
                throw new InvalidArgumentException("Tipo de identificacion no soportado: {$tipo}");
        }
    }

    private function normalizarTipoComprobante($tipoComprobante)
    {
        $aliases = [
            'retencion' => 'comprobanteRetencion',
            'guia' => 'guiaRemision',
            'nota_debito' => 'notaDebito',
            'nota_credito' => 'notaCredito',
            'liquidacion_compra' => 'liquidacionCompra',
        ];

        $tipoComprobante = $aliases[$tipoComprobante] ?? $tipoComprobante;

        if (!isset($this->generadores[$tipoComprobante])) {
            throw new InvalidArgumentException("Tipo de comprobante no soportado: {$tipoComprobante}");
        }

        return $tipoComprobante;
    }

    private function decodeSriResponse($response)
    {
        $decoded = json_decode($response, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $response;
    }

    private function asegurarClaveAcceso($tipoComprobante, $payload, $formato)
    {
        $infoTributaria = $this->getValue($payload, 'infoTributaria', $formato);

        if (!$infoTributaria || $this->getValue($infoTributaria, 'claveAcceso', $formato)) {
            return $payload;
        }

        $fechaEmision = $this->fechaEmisionDesdePayload($tipoComprobante, $payload, $formato);
        $ruc = $this->getValue($infoTributaria, 'ruc', $formato);
        $ambiente = $this->getValue($infoTributaria, 'ambiente', $formato);
        $estab = $this->getValue($infoTributaria, 'estab', $formato);
        $ptoEmi = $this->getValue($infoTributaria, 'ptoEmi', $formato);
        $secuencial = $this->getValue($infoTributaria, 'secuencial', $formato);
        $codigoNumerico = $this->getValue($infoTributaria, 'codigoNumerico', $formato)
            ?: substr(str_pad($secuencial, 8, '0', STR_PAD_LEFT), -8);
        $tipoEmision = $this->getValue($infoTributaria, 'tipoEmision', $formato) ?: '1';
        $codDoc = $this->getValue($infoTributaria, 'codDoc', $formato);

        if (!$fechaEmision || !$codDoc || !$ruc || !$ambiente || !$estab || !$ptoEmi || !$secuencial) {
            return $payload;
        }

        $claveAcceso = $this->facturacion->GenerarClaveDeAccesos(
            $fechaEmision,
            $codDoc,
            $ruc,
            $ambiente,
            $estab.$ptoEmi,
            $secuencial,
            $codigoNumerico,
            $tipoEmision
        );

        $this->setValue($infoTributaria, 'claveAcceso', $claveAcceso, $formato);
        $this->setValue($payload, 'infoTributaria', $infoTributaria, $formato);

        return $payload;
    }

    private function fechaEmisionDesdePayload($tipoComprobante, $payload, $formato)
    {
        $nodos = [
            'factura' => 'infoFactura',
            'comprobanteRetencion' => 'infoCompRetencion',
            'guiaRemision' => 'infoGuiaRemision',
            'notaDebito' => 'infoNotaDebito',
            'notaCredito' => 'infoNotaCredito',
            'liquidacionCompra' => 'infoLiquidacionCompra',
        ];

        $nodo = $this->getValue($payload, $nodos[$tipoComprobante], $formato);

        return $nodo ? $this->getValue($nodo, 'fechaEmision', $formato) : null;
    }

    private function getValue($data, $key, $formato)
    {
        if ($formato === 'array') {
            return is_array($data) && array_key_exists($key, $data) ? $data[$key] : null;
        }

        return is_object($data) && isset($data->$key) ? $data->$key : null;
    }

    private function setValue(&$data, $key, $value, $formato)
    {
        if ($formato === 'array') {
            $data[$key] = $value;
            return;
        }

        $data->$key = $value;
    }

    private function toObject($value)
    {
        if (is_object($value)) {
            return $value;
        }

        return json_decode(json_encode($value));
    }

    private function toArray($value)
    {
        if (is_array($value)) {
            return $value;
        }

        return json_decode(json_encode($value), true);
    }
}
