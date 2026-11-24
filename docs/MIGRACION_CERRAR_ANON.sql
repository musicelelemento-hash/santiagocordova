-- ============================================================================
-- CERRAR LA LLAVE PÚBLICA (anon) A DATOS SENSIBLES — BORRADOR
-- Fecha: 24-nov-2026 · Estado: NO EJECUTADO
--
-- Requisitos antes de correr:
--   1. Extensión 01 v3.7.14+ con sesión del estudio probada (matriz,
--      declaración, comprobante, 02 y 04).
--   2. Web con portal_login (el RPC de abajo) y loadFromDB sólo con sesión.
--   3. Copia de las políticas actuales (ver PASO 0) para poder volver atrás.
--
-- Ejecutar COMPLETO dentro de una transacción. Si algo falla: ROLLBACK.
-- ============================================================================

begin;

-- PASO 0 · ANTES DE EJECUTAR: guardar las políticas originales
-- (correr aparte y pegar el resultado en un archivo privado; sirve para la
--  vuelta atrás exacta):
-- select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('clients','sri_declaraciones','annulments',
--                     'annulment_policies','sri_contacts')
-- order by tablename, policyname;

-- ----------------------------------------------------------------------------
-- PASO 1 · Portal del cliente: validar RUC/cédula + clave SRI sin abrir anon
-- ----------------------------------------------------------------------------
-- El portal hoy compara el RUC y la clave contra la lista de clientes que
-- cargaba con anon. Desde que anon no pueda leer clients, la validación pasa
-- a esta función SECURITY DEFINER (corre con permisos de su dueño).
-- Devuelve el cliente SIN contraseñas, firmas ni bóveda.

create or replace function public.portal_login(p_identificador text, p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    ident text;
    cli   public.clients;
begin
    ident := regexp_replace(coalesce(p_identificador, ''), '\D', '', 'g');

    select * into cli
    from public.clients c
    where (
            c.ruc = ident
            or (length(ident) = 10 and c.ruc like ident || '%')
          )
      and c.sri_password = p_clave
      and coalesce(c.is_deleted, false) = false
    order by c.ruc
    limit 1;

    if cli.id is null then
        return jsonb_build_object('ok', false, 'motivo', 'Credenciales inválidas');
    end if;

    if coalesce(cli.is_active, true) = false then
        return jsonb_build_object('ok', false, 'motivo', 'Cuenta pausada o inactiva');
    end if;

    return jsonb_build_object(
        'ok', true,
        'cliente', to_jsonb(cli)
            - 'sri_password' - 'iess_password' - 'signature_password'
            - 'signature_file' - 'vault' - 'ruc_certificate' - 'ruc_pdf'
    );
end;
$$;

revoke all on function public.portal_login(text, text) from public;
grant execute on function public.portal_login(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- PASO 2 · Quitar las políticas anónimas de las 5 tablas sensibles
-- ----------------------------------------------------------------------------
drop policy if exists clients_anon_sync_select       on public.clients;
drop policy if exists sri_declaraciones_anon_select  on public.sri_declaraciones;
drop policy if exists sri_declaraciones_anon_insert  on public.sri_declaraciones;
drop policy if exists sri_declaraciones_anon_update  on public.sri_declaraciones;
drop policy if exists annulments_anon_select         on public.annulments;
drop policy if exists annulments_anon_insert         on public.annulments;
drop policy if exists annulments_anon_update         on public.annulments;
drop policy if exists policies_all_anon              on public.annulment_policies;
drop policy if exists sri_contacts_anon_select       on public.sri_contacts;
drop policy if exists sri_contacts_anon_insert       on public.sri_contacts;
drop policy if exists sri_contacts_anon_update       on public.sri_contacts;

-- ----------------------------------------------------------------------------
-- PASO 3 · Revocar permisos de tabla al rol anon
-- ----------------------------------------------------------------------------
-- Nota: las políticas para `authenticated` (la web con sesión y las
-- extensiones con sc_sesion.js) NO se tocan.
revoke select, insert, update, delete on public.clients              from anon;
revoke select, insert, update, delete on public.sri_declaraciones    from anon;
revoke select, insert, update, delete on public.annulments           from anon;
revoke select, insert, update, delete on public.annulment_policies   from anon;
revoke select, insert, update, delete on public.sri_contacts         from anon;

-- ----------------------------------------------------------------------------
-- PASO 4 · Comprobaciones rápidas dentro de la misma transacción
-- ----------------------------------------------------------------------------
select 'clients anon policies restantes' as chequeo, count(*) as n
from pg_policies
where schemaname = 'public' and tablename = 'clients' and 'anon' = any(roles);

select 'portal_login existe' as chequeo,
       count(*) = 1 as ok
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'portal_login';

commit;

-- ============================================================================
-- VUELTA ATRÁS (sólo si algo salió mal y hay que abrir de nuevo)
-- Restaura políticas amplias equivalentes a las anteriores. Sirve para
-- desbloquear producción en minutos; para restaurar las EXACTAS usar el
-- resultado del PASO 0.
-- ============================================================================
-- begin;
-- drop function if exists public.portal_login(text, text);
-- create policy clients_anon_sync_select on public.clients
--   for select to anon using (true);
-- create policy sri_declaraciones_anon_select on public.sri_declaraciones
--   for select to anon using (true);
-- create policy sri_declaraciones_anon_insert on public.sri_declaraciones
--   for insert to anon with check (true);
-- create policy sri_declaraciones_anon_update on public.sri_declaraciones
--   for update to anon using (true) with check (true);
-- create policy annulments_anon_select on public.annulments
--   for select to anon using (true);
-- create policy annulments_anon_insert on public.annulments
--   for insert to anon with check (true);
-- create policy annulments_anon_update on public.annulments
--   for update to anon using (true) with check (true);
-- create policy policies_all_anon on public.annulment_policies
--   for all to anon using (true) with check (true);
-- create policy sri_contacts_anon_select on public.sri_contacts
--   for select to anon using (true);
-- create policy sri_contacts_anon_insert on public.sri_contacts
--   for insert to anon with check (true);
-- create policy sri_contacts_anon_update on public.sri_contacts
--   for update to anon using (true) with check (true);
-- grant select, insert, update, delete
--   on public.clients, public.sri_declaraciones, public.annulments,
--      public.annulment_policies, public.sri_contacts
--   to anon;
-- commit;

-- ============================================================================
-- VERIFICACIÓN DESPUÉS DE EJECUTAR (fuera de la transacción)
-- ============================================================================
-- 1) Con la llave pública, SIN sesión: debe dar 42501 o [] (nunca una clave)
--    curl -s "$SUPABASE_URL/rest/v1/clients?select=sri_password&limit=1" \
--      -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--
-- 2) Con sesión del estudio: debe responder datos
--    curl -s "$SUPABASE_URL/rest/v1/clients?select=name&limit=1" \
--      -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS_TOKEN"
--
-- 3) Portal con dato inventado: debe rechazar
--    curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/portal_login" \
--      -H "apikey: $ANON" -H "Content-Type: application/json" \
--      -d '{"p_identificador":"0000000000000","p_clave":"x"}'
--
-- 4) A mano: web admin, portal con cliente real, extensión 01/02/04.
