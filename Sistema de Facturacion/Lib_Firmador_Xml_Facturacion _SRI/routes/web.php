<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return response()->json([
        'status' => true,
        'name' => 'Lib Firmador XML Facturacion SRI',
        'message' => 'Use POST /api/v1/sign/xml o las rutas /api/v1/facturacion/*',
    ]);
});
