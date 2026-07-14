<?php

use App\Http\Controllers\FirmaController;
use App\Http\Controllers\FacturacionElectronicaController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::group(['middleware' => 'app'], function () {
    Route::post('/v1/sign/xml', [FirmaController::class,'ProcesarFirma']);

    Route::get('/v1/facturacion/tipos', [FacturacionElectronicaController::class, 'tipos']);
    Route::post('/v1/facturacion/clave-acceso', [FacturacionElectronicaController::class, 'generarClaveAcceso']);
    Route::post('/v1/facturacion/validar-identificacion', [FacturacionElectronicaController::class, 'validarIdentificacion']);
    Route::post('/v1/facturacion/xml', [FacturacionElectronicaController::class, 'generarXml']);
    Route::post('/v1/facturacion/firmar', [FacturacionElectronicaController::class, 'firmarXml']);
    Route::post('/v1/facturacion/generar-firmar', [FacturacionElectronicaController::class, 'generarYFirmarXml']);
    Route::post('/v1/facturacion/sri/enviar', [FacturacionElectronicaController::class, 'enviarSri']);
    Route::post('/v1/facturacion/sri/autorizar', [FacturacionElectronicaController::class, 'autorizarSri']);
});
