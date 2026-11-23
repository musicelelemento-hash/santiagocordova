# Encargo para la sesión local · cerrar la tabla de clientes

> Escrito el 23-nov-2026 desde la sesión en la nube, que no puede ver la
> extensión Nueva Luz. Esta tarea la hace la sesión **local**, que tiene la
> extensión y el resto de la carpeta. Lee también `.agents/AGENTS.md` y
> `SECURITY.md` §4.4.

## El problema (verificado en la base el 23-nov-2026)

La llave pública de Supabase (`anon`) viaja dentro de la web y de la extensión:
cualquiera puede sacarla. Con ella hoy se puede:

| Tabla | Qué permite la llave pública | Políticas que lo abren |
|---|---|---|
| `clients` | **leer todo**: `sri_password`, `iess_password`, `signature_file`, `signature_password`, `vault`, correos, teléfonos | `clients_anon_sync_select` (y `clients_anon_sync_update`, hoy frenada porque la tabla sólo da `SELECT` a anon) |
| `sri_declaraciones` | leer, crear y modificar | `sri_declaraciones_anon_select/insert/update` |
| `annulments` | leer, crear y modificar | `annulments_select/insert/update_anon` |
| `annulment_policies` | todo | `policies_all_anon` |
| `sri_contacts` | leer, crear y modificar | `sri_contacts_select/insert/update_anon` |

Las demás tablas ya sólo responden con sesión (`authenticated`) o con la llave
de servicio (Baku).

**Por qué no se cerró todavía:** la extensión Nueva Luz usa esa llave pública
sin iniciar sesión. Si se quitan esas políticas sin cambiar la extensión, la
extensión deja de sincronizar.

## Lo que ya está listo
- El **panel web** inicia sesión de verdad con Supabase Auth
  (`services/authService.ts`); sus pantallas funcionan como `authenticated`.
- **Baku** usa la llave de servicio (Render): no le afecta.
- `database/harden_clients_rls.sql` tiene políticas restringidas de ejemplo
  (revisar antes de usar: menciona tablas que ya no existen, como `billing_plans`).

## Plan (en este orden, sin saltarse pasos)

1. **Mapear la extensión**: buscar cada lugar que crea un cliente de Supabase o
   llama a `/rest/v1/` con el encabezado `apikey`, y qué tablas toca
   (lectura/escritura). Ojo: una llave guardada en *Ajustes* de la extensión
   pisa a la del código.
2. **Login en la extensión**: que inicie sesión con el usuario del estudio
   (`supabase.auth.signInWithPassword`), guarde la sesión en
   `chrome.storage.local`, la renueve sola (refresh token) y use ese cliente
   autenticado en todas las consultas. Si la sesión vence, que lo diga en la
   extensión («Inicia sesión») en vez de fallar callada. **No guardar la
   contraseña en texto plano.**
3. **Probar la extensión de punta a punta con sesión**: sincronizar clientes,
   marcar una declaración, subir un comprobante, anulaciones y contactos SRI.
4. **Revisar quién más usa la llave pública sin sesión** antes de cerrar:
   la página pública (`screens/LandingLujoPage.tsx`), el portal del cliente
   (`/portal`), el autocompletado de RUC y `sri_contacts`. Lo que de verdad
   necesite ser público se deja con una política mínima y explicada.
5. **Cerrar en la base** (en una migración aparte, con su vuelta atrás escrita):
   quitar las políticas `*_anon` de `clients`, `sri_declaraciones`,
   `annulments`, `annulment_policies` y `sri_contacts`, y revocar los permisos
   de `anon` en esas tablas. Mantener (o crear) las de `authenticated`.
6. **Verificar desde afuera**: con la llave pública y sin sesión,
   `GET /rest/v1/clients?select=sri_password&limit=1` tiene que devolver
   vacío o «permission denied». Con sesión, la web y la extensión siguen andando.
7. Actualizar `SECURITY.md` §4.4 y `.agents/AGENTS.md` (quitar el pendiente 🔴).

## Reglas
- Hacerlo en ese orden: primero la extensión con sesión, después cerrar la base.
  Nunca al revés.
- Probar las claves del SRI de a una y a mano; nada se envía solo a clientes.
- No subir al repositorio datos de clientes ni contraseñas.
- Si algo del plan no cuadra con lo que encuentres en la extensión, avisarle a
  Santiago antes de cambiar el rumbo.
