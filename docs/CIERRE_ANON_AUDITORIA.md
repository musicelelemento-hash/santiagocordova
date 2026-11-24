# Cerrar la llave `anon` — auditoría previa (paso 4)

> Complemento de `docs/ENCARGO_SESION_LOCAL.md`. Fecha: 24-nov-2026.
> Estado: **NO se cerró la base todavía**. La extensión ya tiene sesión (01 v3.7.14),
> pero falta que Santiago pruebe el login y que resolvamos los usos de `anon`
> de la web antes de la migración.

## Lo que ya está hecho (pasos 1 y 2)

| Paso | Estado |
| :--- | :--- |
| 1 · Mapa de usos de `anon` en las extensiones | ✅ `extenciones web/docs/MAPA_SUPABASE_EXTENSIONES.md` |
| 2 · Sesión del estudio en las 3 extensiones | ✅ `sc_sesion.js` + `scBearer()` en 01, 02 y 04; login en Ajustes/popup; banco `tests/sesion.html` (32 comprobaciones) |

- 01 Nueva Luz **v3.7.14** · 976 comprobaciones en verde · CI en verde (`3cf7b72`).
- La contraseña del estudio **no se guarda**: sólo access + refresh token en `chrome.storage.local`; el refresh es automático y, si vence sin renovar, el popup y Ajustes dicen «Inicia sesión».

## Paso 3 · Prueba con sesión (pendiente de Santiago)

1. `chrome://extensions` → 01 Nueva Luz → Recargar (ver `build 3.7.14`).
2. Popup → **⚙ Ajustes** → **👤 Sesión del estudio** → correo y contraseña del usuario de Supabase (el mismo del panel web).
3. Probar, con sesión iniciada:
   - [ ] sincronizar clientes (la matriz del popup carga),
   - [ ] marcar una declaración (PATCH a `clients`),
   - [ ] subir un comprobante (Storage `clients-vault`),
   - [ ] en 02 Cambio de Claves: leer clientes y guardar una clave,
   - [ ] en 04 Anulador: subir una anulación.
4. Si alguna dice «Inicia sesión» o 401/403, **no cerrar la base**: avisar con el log.

## Paso 4 · Quién más usa `anon` sin sesión (hallazgos)

| Consumidor | Qué hace hoy con `anon` | ¿Se rompe al cerrar? | Arreglo necesario |
| :--- | :--- | :--- | :--- |
| **Web · panel admin** | `App.tsx` llama `loadFromDB()` al montar; `SupabaseService.fetchClients` lee `clients` + `sri_declaraciones` + `annulments` | **Admin no** (tiene sesión de Supabase Auth). **Visitante anónimo** sí recibe 401/403 al cargar | No cargar datos si no hay sesión (`loadFromDB` sólo con sesión), y mostrar «Inicia sesión» |
| **Web · portal del cliente `/portal`** | `LoginScreen` valida RUC/cédula + clave contra el arreglo `clients` cargado por `loadFromDB` (incluye `sri_password`) | **Sí, se rompe** | Reemplazar por RPC `portal_login(identificador, clave)` `SECURITY DEFINER` que valide y devuelva el cliente **sin** `sri_password`/`iess_password`/`vault`/firmas. Mientras no exista, **no cerrar** |
| **Web · autocompletado de RUC** | Usa datos ya cargados en el store (admin) y `ruc_pdf`/bóveda | No (admin con sesión) | Nada |
| **Web · `/api/gemini`** | Usa `anon` sólo para validar el bearer con `/auth/v1/user` | No | Nada |
| **Bot Telegram (Baku)** | Llave de **servicio** | No | Nada |
| **Extensión 02 Cambio de Claves** | `GET clients?select=*` con anon (traía contraseñas) | **Sí** | Ya migrada a sesión (`scBearBridge`) |
| **Extensión 04 Anulador** | `annulments` con anon | **Sí** | Ya migrada a sesión |
| **Extensión 01 Nueva Luz** | `clients`, `sri_declaraciones`, Storage, `suggestions` | **Sí** | Ya migrada a sesión (`scBearer`) |
| **Extensión 01 · runner remoto** | `bucle_remoto` con token prestado de la web | No (usa sesión de la web) | Nada (se puede mantener) |

**Conclusión del paso 4:** para cerrar hay que resolver primero **el portal del cliente**. Sin eso, un cliente no podría entrar a ver sus declaraciones.

## Paso 5 · Migración (preparada, NO ejecutada)

Archivo: `docs/MIGRACION_CERRAR_ANON.sql` — incluye:
1. `portal_login()` (SECURITY DEFINER, `search_path` fijo) para el portal.
2. `DROP POLICY` de las políticas `*_anon` de las 5 tablas.
3. `REVOKE` de permisos de tabla a `anon`.
4. Bloque de **vuelta atrás** completo al final.

Antes de ejecutarla:
1. terminar el paso 3 (prueba real de la extensión),
2. implementar el portal con `portal_login`,
3. correr la verificación del paso 6.

## Paso 6 · Verificación (después de ejecutar)

```bash
# 1) Con la llave pública, SIN sesión: debe dar vacío o permission denied
curl -s "$SUPABASE_URL/rest/v1/clients?select=sri_password&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# esperado: {"code":"42501",...} o [] (nunca una clave)

# 2) Con sesión (token de un usuario del estudio): debe responder datos
curl -s "$SUPABASE_URL/rest/v1/clients?select=name&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS_TOKEN"

# 3) Portal con el RPC (dato inventado): debe rechazar
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/portal_login" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"p_identificador":"0000000000000","p_clave":"x"}'
```

Además, a mano: web (login admin), extensión (matriz + declarar una), portal con un cliente real, extensión 02 y 04.

## Orden recomendado (lo que pediría autorización para hacer)

1. Implementar el `portal_login` (RPC) + cambiar `LoginScreen` y `loadFromDB` de la web.
2. Que Santiago pruebe portal y extensión.
3. Ejecutar `docs/MIGRACION_CERRAR_ANON.sql` en Supabase (con su vuelta atrás lista).
4. Correr las verificaciones del paso 6 y avisar.
