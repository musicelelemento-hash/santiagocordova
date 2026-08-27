# Seguridad — santiagocordova-main

Estado y guía de endurecimiento de seguridad. No contiene secretos.

## 1. Resumen ejecutivo

La app se conectaba a Supabase con la **llave pública `anon`** y casi todas las tablas
tenían políticas RLS abiertas (`TO public` / `TO anon` con `USING (true)`). La llave
`anon` no es secreta: viaja embebida en el bundle del navegador. El nivel de exposición
era **"base de datos pública"**. Con el endurecimiento aplicado (ver §3), ese nivel bajó
a "solo usuarios autenticados" en 7 de las tablas principales.

## 2. Auditoría en vivo (Management API, proyecto `afssvsxlxiwqgtcgvqxp`)

| Tabla / recurso | Filas | Antes | Después (aplicado) |
|---|---|---|---|
| `emisor_settings` (p12_base64 + p12_password) | 1 | ALL `anon, authenticated` | ✅ solo `authenticated` |
| `files` | 901 | Public Access (ALL) | ✅ solo `authenticated` |
| `sri_comprobantes` | 21 | ALL `anon, authenticated` | ✅ solo `authenticated` |
| `sri_declaraciones` | 669 | ALL `public` | ✅ `authenticated` ALL + `anon` INSERT (extensión) |
| `audit_logs` | 3217 | ALL `public` | ✅ solo `authenticated` |
| `users` | 1 | ALL `public` | ✅ solo `authenticated` |
| `tasks` | 0 | ALL `anon` | ✅ solo `authenticated` |
| `clients` | 157 | ALL `anon` | ⚠️ SIN CAMBIAR (ver §4.4) |
| bucket `sri_proofs` | — | `public = true` | ⚠️ PENDIENTE (ver §4.5) |
| `sri_padron_el_oro` | ? | RLS deshabilitado | sin cambios (dato público) |

Datos sensibles en `clients` (texto plano, aún legibles por anon — ver §4.4):
- **135 de 157** clientes con `sri_password`; **33** con `signature_password`;
  además `iess_password`, `signature_file`, `vault`.

Notas: `sri_vault` y `billing_plans` **no existen** en esta base; el archivo
`database/fix_sri_vault_rls.sql` ya no aplica.

## 3. Ya aplicado (2026-08)

**Base de datos (proyecto `afssvsxlxiwqgtcgvqxp`):**
- RLS endurecido en 7 tablas: `emisor_settings`, `files`, `sri_comprobantes`,
  `sri_declaraciones`, `audit_logs`, `users`, `tasks` → solo `authenticated`.
- `sri_declaraciones` conserva un INSERT para `anon` (la extensión de Chrome sincroniza
  declaraciones con la llave anon). Verificado vía `pg_policies`.
- SQL de referencia: `database/harden_full_rls.sql`.

**Código (repositorio):**
- `services/authService.ts` (nuevo): login real con Supabase Auth.
- `screens/LoginScreen.tsx`: el acceso de Administrador autentica contra Supabase
  (email + contraseña), reemplazando el flag falso `sc_pro_admin_session`.
- `App.tsx`: la sesión se restaura automáticamente; sin sesión → login.
- `services/fileService.ts` + `services/sri.ts`: las URLs públicas de Storage se firman
  antes de descargar/abrir (`signPublicStorageUrl` → `createSignedUrl`); consumidores
  actualizados (TaxComplianceMatrix, GlobalUploadModal).
- `telegram-bot/src/supabase.ts`: el bot ahora usa `SUPABASE_SERVICE_KEY` (era `anon`);
  el bot descarga comprobantes con URLs firmadas.
- `sri_vault`: el script `setup-vault.js` ya no imprime políticas `anon_*`.
- `import-vault.js` usa `SUPABASE_SERVICE_KEY` en lugar de la llave `anon`.
- Clave de Gemini fuera del bundle (`vite.config.ts` sin `define` de API keys).
- TypeScript `strict` activado, 0 errores.

## 4. Pendiente / resuelto (por orden de impacto)

1. **Crear el usuario administrador en Supabase Auth** (imprescindible: sin él nadie
   puede entrar). ✅ Creado: `admin@santiagocordova.com` (login verificado).
2. **Desplegar el build nuevo** (con login) en Vercel. La web desplegada sin el build
   nuevo no carga datos (ya está bloqueada). ⏳ Acción del dueño.
3. **`clients` — RESUELTO**: se eliminó la política "Allow all for anon" y los permisos
   de anon quedaron limitados por columnas (`GRANT SELECT (id, ruc, name, regime,
   tax_profile, declaration_history, updated_at)` + `UPDATE (declaration_history,
   updated_at)`). Verificado con la llave anon real: leer `sri_password` → 401; leer
   columnas de sync → 200. La extensión mantiene la lectura/upload de PDFs (flujo
   mensual/bucle); las claves SRI viven SOLO en la caché local de Chrome
   (`sc_clients_cache`), que se fusiona al sincronizar y se edita localmente.
4. **Bucket privado + URLs firmadas — RESUELTO**: el bucket `sri_proofs` se marcó
   **privado** y las políticas de `storage.objects` pasaron a `authenticated` (con un
   INSERT para `anon` reservado a la extensión). La app web firma URLs en el render
   (`signPublicStorageUrl`) y el bot usa URLs firmadas con `service_role`.
   Verificado: bucket `public=false`.
5. **Cifrar claves en reposo** (p. ej. pgsodium/Supabase Vault) con clave fuera del
   cliente. ⏳ Opcional a futuro.

## 5. Reglas permanentes
- Nunca commitear `.env*`, `serviceAccountKey.json`, `*.p12`, `*.pem`, `*.key`,
  `Contraseñas de Chrome.csv` ni `import_passwords.js` (cubiertos por `.gitignore`).
- Rotar cualquier secreto que alguna vez haya estado en un bundle o repo (incluidas las
  claves SRI expuestas y el token de Management API compartido en chat).
- El rol `anon` de Supabase NO debe poder leer tablas con contraseñas.
