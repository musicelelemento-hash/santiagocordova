<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AuthenticateApp
{
    /**
     * Verifica que la petición tenga un token válido en el header Authorization.
     * El token debe estar en la variable de entorno ACCEPTED_SECRETS
     * (separado por comas si hay más de uno).
     *
     * Ejemplo de header: Authorization: mi-token-secreto
     */
    public function handle(Request $request, Closure $next)
    {
        $secretsEnv = env('ACCEPTED_SECRETS', '');

        // Si no hay secrets configurados en producción, bloquear todo
        if (empty($secretsEnv)) {
            return response()->json([
                'status'  => false,
                'message' => 'API no configurada: falta ACCEPTED_SECRETS en el servidor.',
            ], 500);
        }

        $validSecrets = array_map('trim', explode(',', $secretsEnv));
        $tokenRecibido = $request->header('Authorization', '');

        if (in_array($tokenRecibido, $validSecrets, true)) {
            return $next($request);
        }

        return response()->json([
            'status'  => false,
            'message' => 'No autorizado. Envía el token en el header Authorization.',
        ], 401);
    }
}

