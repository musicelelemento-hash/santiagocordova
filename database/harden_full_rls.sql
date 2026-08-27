-- harden_full_rls.sql
-- ---------------------------------------------------------------------
-- Endurecimiento RLS aplicado al proyecto afssvsxlxiwqgtcgvqxp
-- (SantiagoCordova.com). EJECUTADO vía Management API el 2026-08.
--
-- Estrategia:
--  * Las tablas de la app web pasan a SOLO `authenticated` (la web ya
--    inicia sesión con Supabase Auth; el bot usa service_role que omite RLS).
--  * `sri_declaraciones` mantiene un INSERT para `anon` SOLO porque la
--    extensión de Chrome sincroniza declaraciones con la llave anon.
--  * `clients` NO se toca en este lote (la extensión necesita leer
--    sri_password para el autollenado; decisión pendiente del dueño).
--  * Storage (buckets) pendiente de migración a URLs firmadas.
-- ---------------------------------------------------------------------

-- 1) emisor_settings (contiene p12_base64 + p12_password → CRÍTICO)
DROP POLICY IF EXISTS "Permitir acceso a emisor_settings" ON public.emisor_settings;
CREATE POLICY "emisor_settings_authenticated" ON public.emisor_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) files (901 filas de comprobantes)
DROP POLICY IF EXISTS "Public Access" ON public.files;
CREATE POLICY "files_authenticated" ON public.files
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) audit_logs
DROP POLICY IF EXISTS "Public access to audit logs" ON public.audit_logs;
CREATE POLICY "audit_logs_authenticated" ON public.audit_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) users
DROP POLICY IF EXISTS "Allow everything for now" ON public.users;
CREATE POLICY "users_authenticated" ON public.users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) tasks
DROP POLICY IF EXISTS "Allow all for anon" ON public.tasks;
CREATE POLICY "tasks_authenticated" ON public.tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6) sri_comprobantes (quitar acceso anon)
DROP POLICY IF EXISTS "Permitir lectura general" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir inserción general" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir actualización general" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir lectura general a autenticados" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir inserción a autenticados" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir actualización a autenticados" ON public.sri_comprobantes;
CREATE POLICY "sri_comprobantes_authenticated" ON public.sri_comprobantes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7) sri_declaraciones: anon SOLO INSERT (extensión), authenticated ALL
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sri_declaraciones;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.sri_declaraciones;
DROP POLICY IF EXISTS "Enable update for all users" ON public.sri_declaraciones;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.sri_declaraciones;
CREATE POLICY "sri_declaraciones_anon_insert" ON public.sri_declaraciones
    FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "sri_declaraciones_authenticated" ON public.sri_declaraciones
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Verificación post-aplicación:
--   SELECT tablename, policyname, cmd, roles FROM pg_policies
--   WHERE tablename IN ('emisor_settings','files','audit_logs','users',
--                       'tasks','sri_comprobantes','sri_declaraciones')
--   ORDER BY tablename, cmd;
-- ---------------------------------------------------------------------
