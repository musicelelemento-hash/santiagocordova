<?php
namespace LibreriasSri;


class SignDOcumentToSRI extends Sign
{
    /**
     * XMLDSIG.
     *
     * @var string
     */
    const XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';
    const XMLDSIGETSI ='http://uri.etsi.org/01903/v1.3.2#';

    

    /**
     * C14N.
     *
     * @var string
     */
    const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

    /**
     * ENVELOPED_SIGNATURE.
     *
     * @var string
     */
    const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

    /**
     * SIGNED_PROPERTIES.
     *
     * @var string
     */
    const SIGNED_PROPERTIES = 'http://uri.etsi.org/01903#SignedProperties';

    /**
     * ALGO_SHA1.
     *
     * @var array
     */
    const ALGO_SHA1 = [
        'rsa' => 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        'algorithm' => 'http://www.w3.org/2000/09/xmldsig#sha1',
        'sign' => OPENSSL_ALGO_SHA1,
        'hash' => 'sha1',
    ];

    /**
     * ALGO_SHA256.
     *
     * @var array
     */
    const ALGO_SHA256 = [
        'rsa' => 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
        'algorithm' => 'http://www.w3.org/2001/04/xmlenc#sha256',
        'sign' => OPENSSL_ALGO_SHA256,
        'hash' => 'sha256',
    ];

    /**
     * ALGO_SHA512.
     *
     * @var array
     */
    const ALGO_SHA512 = [
        'rsa' => 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
        'algorithm' => 'http://www.w3.org/2001/04/xmlenc#sha512',
        'sign' => OPENSSL_ALGO_SHA512,
        'hash' => 'sha512',
    ];

    /**
     * IDS.
     *
     * @var array
     */
    protected $ids = [
        'CertificateID' => 'Certificate',
        'SignedPropertiesID' => 'SignedPropertiesID',
        'SignedProperties' => 'SignedProperties',
        'SignatureValueID' => 'SignatureValue',
        'SignatureID' => 'Signature',
        'KeyInfoID' => 'xmldsig',
        'ObjectID' => 'Object',
        'Reference_ID' => 'Reference-ID-',
        'SignedInfoID'=>'SignedInfo'
    ];

    /**
     * NS.
     *
     * @var array
     */
    public $ns = [
              'xmlns:etsi'=>'http://uri.etsi.org/01903/v1.3.2#',
              'xmlns:ds' => self::XMLDSIG
    ];


    /**
     * Result signature.
     *
     * @var mixed
     */
    public $resultSignature;

    /**
     * Group of totals.
     *
     * @var string
     */
    public $groupOfTotals = 'LegalMonetaryTotal';

    /**
     * Extra certs.
     *
     * @var array
     */
    private $extracerts = [];

    /**
     * Ruta donde se guardara el documento antes de firmar
     *
     * @var string
     */

    public $GuardarEn = false;

    public function __construct($tipoDoc,$pathCertificate = null, $passwors = null, $xmlString = null, $algorithm = self::ALGO_SHA1, $appresponsexml = null)
    {
        $this->algorithm = $algorithm;
        $this->tipoDoc= $tipoDoc;
        if (!$this->istDocumentoS($this->tipoDoc)){
            die("no se valida el tipo de document");
        }
        parent::__construct($pathCertificate, $passwors, $xmlString);

        return $this;
    }

    /**
     * Load XML.
     */
    protected function loadXML()
    {
        if ($this->xmlString instanceof \DOMDocument) {
            $this->xmlString = $this->xmlString->saveXML();
        }


      $this->domDocument = new \DOMDocument($this->version, $this->encoding);
        $this->domDocument->loadXML($this->xmlString);
        $this->GuardarEn = preg_replace("/[\r\n|\n|\r]+/", "", $this->GuardarEn);
        
        if ($this->GuardarEn){
            file_put_contents($this->GuardarEn, $this->xmlString);
        
        }

        // DOMX path
        $this->domXPath = new \DOMXPath($this->domDocument);
        // Software security code
        $this->softwareSecurityCode();

        // Digest value xml clean
        $this->digestValueXML();

          if($this->extensionContentSing = $this->domDocument->getElementsByTagName($this->tipoDoc)->item(0)){

          }else 
                  die('No se encuentra el tipo de Documento especificado');
      
       $this->signature = $this->domDocument->createElement('ds:Signature');
       $this->signature->setAttribute('xmlns:ds', self::XMLDSIG);
       $this->signature->setAttribute('xmlns:etsi', self::XMLDSIGETSI);
        
        $this->signature->setAttribute('Id', $this->SignatureID);
        $this->extensionContentSing->appendChild($this->signature);

        $this->signedInfo = $this->domDocument->createElement('ds:SignedInfo');
        $this->signedInfo -> setAttribute('Id','Signature-'.$this->SignedInfoID);
        $this->signature->appendChild($this->signedInfo);

        // Signature value not value
        $this->signatureValue = $this->domDocument->createElement('ds:SignatureValue', 'ERROR!');
        $this->signatureValue->setAttribute('Id', $this->SignatureValueID);
        $this->signature->appendChild($this->signatureValue);


         $this->keyInfo = $this->domDocument->createElement('ds:KeyInfo');
        $this->keyInfo->setAttribute('Id', $this->CertificateID);
        $this->signature->appendChild($this->keyInfo);

        $this->X509Data = $this->domDocument->createElement('ds:X509Data');
        $this->keyInfo->appendChild($this->X509Data);

        $this->KeyValue = $this->domDocument->createElement('ds:KeyValue');
        $this->keyInfo->appendChild($this->KeyValue);

        $publicKey = openssl_pkey_get_public($this->certs['cert']);
        $data = openssl_pkey_get_details($publicKey);
        $modulusHex =bin2hex($data['rsa']['n']);
        $modulusEncoded = base64_encode(hex2bin($modulusHex));
        $exponentEncoded = base64_encode($data['rsa']['e']);
       $this->RSAKeyValue = $this->domDocument->createElement('ds:RSAKeyValue');
        $this->KeyValue->appendChild($this->RSAKeyValue);
        $this->Modulus = $this->domDocument->createElement('ds:Modulus',$modulusEncoded);
        $this->RSAKeyValue->appendChild($this->Modulus);
        $this->Exponent = $this->domDocument->createElement('ds:Exponent',$exponentEncoded);
        $this->RSAKeyValue->appendChild($this->Exponent);

        $this->X509Certificate = $this->domDocument->createElement('ds:X509Certificate', $this->x509Export());
        $this->X509Data->appendChild($this->X509Certificate);

        $this->object = $this->domDocument->createElement('ds:Object');
        $this->object->setAttribute('Id', $this->SignatureID.'-'.$this->ObjectID);
        $this->signature->appendChild($this->object);

        $this->qualifyingProperties = $this->domDocument->createElement('etsi:QualifyingProperties');
        $this->qualifyingProperties->setAttribute('Target', "#{$this->SignatureID}");
        $this->object->appendChild($this->qualifyingProperties);

        $this->signedProperties = $this->domDocument->createElement('etsi:SignedProperties');
        $this->signedProperties->setAttribute('Id',$this->SignatureID.'-'.$this->SignedProperties);
        $this->qualifyingProperties->appendChild($this->signedProperties);

        $this->signedSignatureProperties = $this->domDocument->createElement('etsi:SignedSignatureProperties');
        $this->signedProperties->appendChild($this->signedSignatureProperties);
        
        $this->signingTime = $this->domDocument->createElement('etsi:SigningTime', (new \DateTime())->format('Y-m-d\TH:i:s.vT:00'));
        $this->signedSignatureProperties->appendChild($this->signingTime);

        $this->signingCertificate = $this->domDocument->createElement('etsi:SigningCertificate');
        $this->signedSignatureProperties->appendChild($this->signingCertificate);

        $this->SignedDataObjectProperties = $this->domDocument->createElement('etsi:SignedDataObjectProperties');
        $this->signedSignatureProperties->appendChild($this->SignedDataObjectProperties);

        $this->DataObjectFormat = $this->domDocument->createElement('etsi:DataObjectFormat');
        $this->DataObjectFormat->setAttribute('ObjectReference',"#".$this->Reference_ID);
        $this->SignedDataObjectProperties->appendChild($this->DataObjectFormat );

        $this->Description = $this->domDocument->createElement('etsi:Description','contenido comprobante');
        $this->DataObjectFormat->appendChild($this->Description );

        $this->MimeType = $this->domDocument->createElement('MimeType','text/xml');
        $this->DataObjectFormat->appendChild($this->MimeType );
           // Cert
        $this->cert = $this->domDocument->createElement('etsi:Cert');
        $this->signingCertificate->appendChild($this->cert);

        $this->certDigest = $this->domDocument->createElement('etsi:CertDigest');
        $this->cert->appendChild($this->certDigest);

        $this->digestMethodCert = $this->domDocument->createElement('ds:DigestMethod');
        $this->digestMethodCert->setAttribute('Algorithm', $this->algorithm['algorithm']);
        $this->certDigest->appendChild($this->digestMethodCert);

        $this->DigestValueCert = base64_encode(openssl_x509_fingerprint($this->certs['cert'], $this->algorithm['hash'], true));

        $this->digestValueCert = $this->domDocument->createElement('ds:DigestValue', $this->DigestValueCert);
        $this->certDigest->appendChild($this->digestValueCert);

        $this->issuerSerialCert = $this->domDocument->createElement('etsi:IssuerSerial');
        $this->cert->appendChild($this->issuerSerialCert);

        /*$this->X509IssuerNameCert = $this->domDocument->createElement('ds:X509IssuerName', $this->joinArray(array_reverse(openssl_x509_parse($this->certs['cert'])['issuer']), false, ','));*/
         //
         $isuernombre=$this->joinArray(array_reverse(openssl_x509_parse($this->certs['cert'])['issuer']), false, ',');
        //YA ACEPTADO POR SRI PHP
         if(strpos($isuernombre, "UANATACA") != false) {
             $isuernombre='2.5.4.97=#0c0f56415445532d413636373231343939,CN=UANATACA CA2 2016,OU=TSP-UANATACA,O=UANATACA S.A.,L=Barcelona (see current address at www.uanataca.com/address),C=ES';
          }
        $this->X509IssuerNameCert = $this->domDocument->createElement('ds:X509IssuerName', $isuernombre);
        $this->issuerSerialCert->appendChild($this->X509IssuerNameCert);
        $this->X509SerialNumberCert = $this->domDocument->createElement('ds:X509SerialNumber', openssl_x509_parse($this->certs['cert'])['serialNumber']);
        $this->issuerSerialCert->appendChild($this->X509SerialNumberCert);


        // Signed info nodes
        $this->canonicalizationMethod = $this->domDocument->createElement('ds:CanonicalizationMethod');
        $this->canonicalizationMethod->setAttribute('Algorithm', self::C14N);
        $this->signedInfo->appendChild($this->canonicalizationMethod);

        $this->signatureMethod = $this->domDocument->createElement('ds:SignatureMethod');
        $this->signatureMethod->setAttribute('Algorithm', $this->algorithm['rsa']);
        $this->signedInfo->appendChild($this->signatureMethod);

        $this->referenceXML = $this->domDocument->createElement('ds:Reference');
        $this->referenceXML->setAttribute('Id', $this->SignedPropertiesID);
        $this->referenceXML->setAttribute('Type', self::SIGNED_PROPERTIES);
        $this->referenceXML->setAttribute('URI', '#'.$this->SignatureID.'-'.$this->SignedProperties);
        
        
        $this->signedInfo->appendChild($this->referenceXML);

     
        $this->digestMethodXML = $this->domDocument->createElement('ds:DigestMethod');
        $this->digestMethodXML->setAttribute('Algorithm', $this->algorithm['algorithm']);
        $this->referenceXML->appendChild($this->digestMethodXML);

        $this->domDocumentSignedPropertiesC14N = new \DOMDocument($this->version, $this->encoding);
        $this->domDocumentSignedPropertiesC14N->loadXML(str_replace('<etsi:SignedProperties ', "<etsi:SignedProperties {$this->joinArray($this->ns)} ", $this->domDocument->saveXML($this->signedProperties)));
        $this->DigestValueSignedProperties = base64_encode(hash($this->algorithm['hash'], $this->domDocumentSignedPropertiesC14N->C14N(), true));



        $this->digestValueXML = $this->domDocument->createElement('ds:DigestValue', $this->DigestValueSignedProperties);

        $this->referenceXML->appendChild($this->digestValueXML);
        $this->domDocumentReferenceKeyInfoC14N = new \DOMDocument($this->version, $this->encoding);
        $this->domDocumentReferenceKeyInfoC14N->loadXML(str_replace('<ds:KeyInfo ', "<ds:KeyInfo {$this->joinArray($this->ns)} ", $this->domDocument->saveXML($this->keyInfo)));

        $this->DigestValueKeyInfo = base64_encode(hash($this->algorithm['hash'], $this->domDocumentReferenceKeyInfoC14N->C14N(), true));
          
        $this->referenceSignedProperties = $this->domDocument->createElement('ds:Reference');
        
        $this->referenceSignedProperties->setAttribute('URI', '#'.$this->CertificateID);
        $this->signedInfo->appendChild($this->referenceSignedProperties);

        $this->digestMethodSignedProperties = $this->domDocument->createElement('ds:DigestMethod');
        $this->digestMethodSignedProperties->setAttribute('Algorithm', $this->algorithm['algorithm']);
        $this->referenceSignedProperties->appendChild($this->digestMethodSignedProperties);
        $this->digestValueSignedProperties = $this->domDocument->createElement('ds:DigestValue',$this->DigestValueKeyInfo );
        $this->referenceSignedProperties->appendChild($this->digestValueSignedProperties);
        $this->referenceKeyInfo = $this->domDocument->createElement('ds:Reference');
        $this->referenceKeyInfo->setAttribute('Id',$this->Reference_ID);
        $this->referenceKeyInfo->setAttribute('URI', "#comprobante");


        $this->transformsXML = $this->domDocument->createElement('ds:Transforms');
        $this->referenceKeyInfo->appendChild($this->transformsXML);

        $this->transformXML = $this->domDocument->createElement('ds:Transform');
        $this->transformXML->setAttribute('Algorithm', self::ENVELOPED_SIGNATURE);
        $this->transformsXML->appendChild($this->transformXML);
       
        $this->signedInfo->appendChild($this->referenceKeyInfo);

        $this->digestMethodKeyInfo = $this->domDocument->createElement('ds:DigestMethod');
        $this->digestMethodKeyInfo->setAttribute('Algorithm', $this->algorithm['algorithm']);
        $this->referenceKeyInfo->appendChild($this->digestMethodKeyInfo);
        $this->digestValueKeyInfo = $this->domDocument->createElement('ds:DigestValue', $this->DigestValueXML);
        $this->referenceKeyInfo->appendChild($this->digestValueKeyInfo);

        // Signature set value
        $this->domDocumentSignatureValueC14N = new \DOMDocument($this->version, $this->encoding);
        $this->domDocumentSignatureValueC14N->loadXML(str_replace('<ds:SignedInfo', "<ds:SignedInfo {$this->joinArray($this->ns)} ", $this->domDocument->saveXML($this->signedInfo)));

        if (!openssl_sign($this->domDocumentSignatureValueC14N->C14N(), $this->resultSignature, $this->certs['pkey'], $this->algorithm['sign'])) {
            throw new \Exception('Class '.get_class($this).': Failure signing SignedInfo: '.$this->getOpenSslErrors());
        }

        $this->signatureValue->nodeValue = base64_encode($this->resultSignature);

     
         
       
    }

    /**
     * Digest value XML.
     */
    private function digestValueXML()
    {
       
                $this->DigestValueXML = base64_encode(hash($this->algorithm['hash'], $this->domDocument->C14N(), true));
    }

    /**
     * Software security code.
     */
    private function softwareSecurityCode()
    {
        if (is_null($this->softwareID) || is_null($this->pin)) {
            return;
        }
        if($this->valueXML($this->domXPath->document->saveXML(), "/NominaIndividual/ProveedorXML/") || $this->valueXML($this->domXPath->document->saveXML(), "/NominaIndividualDeAjuste/ProveedorXML/")){
            $this->getTag('ProveedorXML', 0, 'SoftwareSC', hash('sha384', "{$this->softwareID}{$this->pin}{$this->getTag('NumeroSecuenciaXML', 0, 'Numero')}"));
        }
        else
            $this->getTag('SoftwareSecurityCode', 0)->nodeValue = hash('sha384', "{$this->softwareID}{$this->pin}{$this->getTag('ID', 0)->nodeValue}");
    }


public    function istDocumentoS($doc){

        switch ($doc) {
        case 'factura':
            return true;
            break;
        case 'comprobanteRetencion':
            return true;
            break;
        case 'notaCredito':
             return true;
            break;
        case 'notaCredito':
             return true;
            break;
        case 'notaDebito':
             return true;
            break;
        case 'guiaRemision':
             return true;
            break;  
    
        default:
            return false;
          }
    }
   

}
