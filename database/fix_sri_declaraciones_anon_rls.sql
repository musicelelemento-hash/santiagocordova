-- fix_sri_declaraciones_anon_rls.sql
-- ---------------------------------------------------------------------
-- Habilita SELECT y UPDATE para el rol `anon` en `sri_declaraciones`.
-- 
-- Diagnóstico probado el 07-sep-2026:
-- En agosto 2026, harden_full_rls.sql configuró:
--   CREATE POLICY "sri_declaraciones_anon_insert" FOR INSERT TO anon WITH CHECK (true);
-- pero omitió SELECT y UPDATE para `anon`.
-- En PostgreSQL / PostgREST, un UPSERT (`on_conflict=...` con
-- `Prefer: resolution=merge-duplicates`) requiere permisos y políticas
-- de UPDATE sobre la tabla. Al no existir, Postgres lanza:
--   42501 "new row violates row-level security policy for table sri_declaraciones"
-- y PostgREST lo transforma en HTTP 401 Unauthorized, impidiendo que el bot
-- guarde la declaración relacional.
-- Además, al no tener SELECT, la consulta de clientes con sri_declaraciones(...)
-- devuelve siempre un arreglo vacío para la extensión.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "sri_declaraciones_anon_select" ON public.sri_declaraciones;
CREATE POLICY "sri_declaraciones_anon_select" ON public.sri_declaraciones
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "sri_declaraciones_anon_update" ON public.sri_declaraciones;
CREATE POLICY "sri_declaraciones_anon_update" ON public.sri_declaraciones
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Asegurar permisos GRANT a anon a nivel de tabla
GRANT SELECT, INSERT, UPDATE ON public.sri_declaraciones TO anon;
