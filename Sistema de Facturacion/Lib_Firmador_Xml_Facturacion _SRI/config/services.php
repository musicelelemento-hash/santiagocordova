<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'facturacion' => [
        'certificado_p12' => env('FACTURACION_CERTIFICADO_P12'),
        'clave_certificado' => env('FACTURACION_CERTIFICADO_CLAVE'),
        'ambiente' => env('FACTURACION_AMBIENTE', '1'),
        'cafile' => env('FACTURACION_CA_FILE'),
        'soap_timeout' => env('FACTURACION_SOAP_TIMEOUT', 30),
    ],

];
