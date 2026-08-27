-- fix_sri_vault_rls.sql
-- ---------------------------------------------------------------------
-- Elimina las políticas `anon_*` que dejaban las claves SRI en texto plano
-- accesibles con la llave PÚBLICA (anon) de Supabase.
--
-- Problema original:
--   CREATE POLICY "anon_read"   ... USING (true);
--   CREATE POLICY "anon_write"  ... WITH CHECK (true);
--   CREATE POLICY "anon_update" ... USING (true);
--   => Cualquiera con la llave `anon` (embebida en el bundle del cliente web)
--      podía leer/todas las claves SRI de todos los contribuyentes.
--
-- Cómo ejecutar: Supabase Dashboard > SQL Editor > pegar y Run.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "anon_read"   ON public.sri_vault;
DROP POLICY IF EXISTS "anon_write"  ON public.sri_vault;
DROP POLICY IF EXISTS "anon_update" ON public.sri_vault;

-- RLS queda habilitado. A partir de ahora solo el rol `service_role`
-- (usado por el bot de Telegram y los scripts de importación) puede
-- leer/escribir `sri_vault`. La llave `anon` no tiene acceso.
