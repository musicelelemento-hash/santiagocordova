-- harden_clients_rls.sql
-- ---------------------------------------------------------------------
-- ⚠️  NO EJECUTAR HASTA IMPLEMENTAR SUPABASE AUTH EN LA APP.
-- Hoy la app usa la llave `anon` sin sesión; si se restringen las políticas,
-- el frontend dejará de leer/escribir y la app se romperá.
--
-- Objetivo (una vez exista login): que SOLO usuarios autenticados accedan
-- a las tablas con datos sensibles (clients, billing_plans, sri_declaraciones...).
-- ---------------------------------------------------------------------

-- 1) clients (contiene sri_password)
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.clients;
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.billing_plans;
DROP POLICY IF EXISTS "Enable read for all" ON public.clients;

-- 2) Recrear políticas restringidas a `authenticated`
CREATE POLICY "clients_authenticated_all" ON public.clients
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "billing_plans_authenticated_all" ON public.billing_plans
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3) Verificación: qué roles tienen acceso a qué tablas
-- SELECT schemaname, tablename, policyname, roles
-- FROM pg_policies
-- WHERE tablename IN ('clients','billing_plans','sri_vault','sri_declaraciones');

-- Nota: el rol `service_role` (bot de Telegram) ignora RLS, así que sigue
-- funcionando sin cambios.
