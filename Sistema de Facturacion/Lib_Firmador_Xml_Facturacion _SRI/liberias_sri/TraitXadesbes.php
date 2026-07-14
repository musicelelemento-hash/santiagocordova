<?php
namespace LibreriasSri;

trait TraitXadesbes
{
    /**
     * Version.
     *
     * @var string
     */
    public $version = '1.0';

    /**
     * Encoding.
     *
     * @var string
     */
    public $encoding = 'UTF-8';

    /**
     * Certs.
     *
     * @var array
     */
    protected $certs;

    /**
     * Attributes.
     *
     * @var array
     */
    protected $attributes;

    /**
     * Read certs.
     */
    protected function readCerts()
    {
       //dd(file_get_contents($this->pathCertificate));
       // dd($this->passwors);
        //print_r($this->pathCertificate);
        if (is_null($this->pathCertificate) || is_null($this->passwors)) {
            //dd("read");
            throw new \Exception('Class '.get_class($this).': requires the certificate path and password.');
        }
        if (!openssl_pkcs12_read($this->pathCertificate, $this->certs, $this->passwors)) {
            $openSslError = $this->getOpenSslErrors();

            if ($this->readLegacyPkcs12WithCli($openSslError)) {
                return;
            }

           //dd("read 2");
            throw new \Exception('Class '.get_class($this).': Failure signing data: '.$openSslError);
        }
    }

    /**
     * Read old PKCS#12 containers rejected by OpenSSL 3 legacy restrictions.
     */
    protected function readLegacyPkcs12WithCli($openSslError)
    {
        if (stripos($openSslError, 'unsupported') === false) {
            return false;
        }

        $openssl = $this->findOpenSslBinary();

        if (is_null($openssl)) {
            return false;
        }

        $tmpP12 = tempnam(sys_get_temp_dir(), 'sri_p12_');

        if (false === $tmpP12 || false === file_put_contents($tmpP12, $this->pathCertificate)) {
            return false;
        }

        try {
            $pem = $this->extractPkcs12Pem($openssl, $tmpP12, true);

            if (is_null($pem)) {
                $pem = $this->extractPkcs12Pem($openssl, $tmpP12, false);
            }

            if (is_null($pem)) {
                return false;
            }

            return $this->loadCertsFromPem($pem);
        } finally {
            @unlink($tmpP12);
        }
    }

    /**
     * Execute openssl pkcs12 and return PEM content.
     */
    protected function extractPkcs12Pem($openssl, $p12Path, $legacy)
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
            'PKCS12_PASSWORD' => $this->passwors,
        ]);

        if (!is_resource($process)) {
            return null;
        }

        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        if (0 !== $exitCode || empty($output)) {
            return null;
        }

        return $output;
    }

    /**
     * Parse PEM output from openssl pkcs12 into the same shape as openssl_pkcs12_read.
     */
    protected function loadCertsFromPem($pem)
    {
        if (!preg_match('/-----BEGIN (?:RSA |ENCRYPTED |EC |)PRIVATE KEY-----.*?-----END (?:RSA |ENCRYPTED |EC |)PRIVATE KEY-----/s', $pem, $privateKeyMatch)) {
            return false;
        }

        if (!preg_match_all('/-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----/s', $pem, $certificateMatches)) {
            return false;
        }

        $privateKey = openssl_pkey_get_private($privateKeyMatch[0]);

        if (false === $privateKey) {
            return false;
        }

        $this->certs = [
            'cert' => $certificateMatches[0][0],
            'pkey' => $privateKeyMatch[0],
        ];

        if (count($certificateMatches[0]) > 1) {
            $this->certs['extracerts'] = array_slice($certificateMatches[0], 1);
        }

        return true;
    }

    /**
     * Locate openssl on PATH or common Laragon locations.
     */
    protected function findOpenSslBinary()
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

    /**
     * Check that the binary can be executed.
     */
    protected function isOpenSslUsable($openssl)
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

    /**
     * Collect all OpenSSL errors for a useful exception message.
     */
    protected function getOpenSslErrors()
    {
        $errors = [];

        while ($error = openssl_error_string()) {
            $errors[] = $error;
        }

        return implode('; ', $errors);
    }

    /**
     * X509 export.
     */
    protected function x509Export()
    {
        if (!empty($this->certs)) {
            openssl_x509_export($this->certs['cert'], $stringCert);

            return str_replace([PHP_EOL, '-----BEGIN CERTIFICATE-----', '-----END CERTIFICATE-----'], '', $stringCert);
        }

        throw new \Exception('Class '.get_class($this).': Error openssl x509 export.');
    }

    /**
     * Identifiers references.
     */

    protected function identifiersReferences()
    {




        foreach ($this->ids as $key => $value) {
            $this->$key = "{$value}".$this->aleatorioReferences(6);
        }
    }

    /**
     * Remove child.
     *
     * @param string $tagName
     */
    protected function removeChild($tagName, $item = 0)
    {
        if (is_null($tag = $this->domDocument->documentElement->getElementsByTagName($tagName)->item($item))) {
            return;
        }

        $this->domDocument->documentElement->removeChild($tag);
    }

    /**
     * Get tag.
     *
     * @param string $tagName
     * @param int    $item
     *
     * @return mixed
     */
    protected function getTag($tagName, $item = 0, $attribute = NULL, $attribute_value = NULL)
    {
        $tag = $this->domDocument->documentElement->getElementsByTagName($tagName);

        if (is_null($tag->item(0))) {
            throw new \Exception('Class '.get_class($this).": The tag name {$tagName} does not exist.");
        }

        if($attribute)
            if($attribute_value){
                $tag->item($item)->setAttribute($attribute, $attribute_value);
                return;
            }
            else
                return $tag->item($item)->getAttribute($attribute);
        else
            return $tag->item($item);
    }

    protected function ValueXML($stringXML, $xpath)
    {
        if(substr($xpath, 0, 1) != '/')
            return NULL;
        $search = substr($xpath, 1, strpos(substr($xpath, 1), '/'));
        $posinicio = strpos($stringXML, "<".$search);
        if($posinicio == 0)
           return false;
        $posinicio = strpos($stringXML, ">", $posinicio) + 1;
        $posCierre = strpos($stringXML, "</".$search.">", $posinicio);
        if($posCierre == 0)
            return true;
        $valorXML = substr($stringXML, $posinicio, $posCierre - $posinicio);
        if(strcmp(substr($xpath, strpos($xpath, $search) + strlen($search)), '/') != 0)
            return $this->ValueXML($valorXML, substr($xpath, strpos($xpath, $search) + strlen($search)));
        else
            return $valorXML;
    }

    /**
     * Get query.
     *
     * @param string $query
     * @param bool   $validate
     * @param int    $item
     *
     * @return mixed
     */
    protected function getQuery($query, $validate = true, $item = 0)
    {
        $tag = $this->domXPath->query($query);

        if (($validate) && (null == $tag->item(0))) {
            throw new \Exception('Class '.get_class($this).": The query {$query} does not exist.");
        }
        if (is_null($item)) {
            return $tag;
        }

        return $tag->item($item);
    }

    /**
     * Join array.
     *
     * @param array  $array
     * @param bool   $formatNS
     * @param string $join
     *
     * @return string
     */
    protected function joinArray(array $array, $formatNS = true, $join = ' ')
    {
        return implode($join, array_map(function ($value, $key) use ($formatNS) {
            return ($formatNS) ? "{$key}=\"$value\"" : "{$key}=$value";
        }, $array, array_keys($array)));
    }

    /**
     * Set.
     *
     * @param any $name
     * @param any $value
     */
    public function __set($name, $value)
    {
        $this->attributes[$name] = $value;
    }

    /**
     * Get.
     *
     * @param any $name
     *
     * @return any
     */
    public function __get($name)
    {
        if (array_key_exists($name, $this->attributes)) {
            return $this->attributes[$name];
        }

        return;
    }

   public function aleatorioReferences($digits){

        return rand(pow(10, $digits-1), pow(10, $digits)-1);

        }
}
