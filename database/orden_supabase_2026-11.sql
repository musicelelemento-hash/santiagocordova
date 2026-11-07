-- orden_supabase_2026-11.sql
-- ---------------------------------------------------------------------
-- Puesta en orden del proyecto Supabase principal (afssvsxlxiwqgtcgvqxp)
-- aplicada el 2026-11-06 desde la Management API.
--
-- Solo toca estructura, nunca datos:
--   1. Enciende RLS en sri_padron_el_oro (estaba expuesta sin RLS).
--   2. Fija search_path de get_next_sri_secuencial (lint de seguridad).
--   3. Elimina la política SELECT duplicada de clients para anon.
--   4. Elimina el índice duplicado idx_clients_ruc (clients_ruc_key ya
--      cubre la misma columna con un índice único).
--   5. Agrega índice de cobertura a tasks.client_id.
-- ---------------------------------------------------------------------

-- 1. RLS en la tabla del padrón (vacía, sin referencias en el código).
ALTER TABLE public.sri_padron_el_oro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sri_padron_el_oro_authenticated ON public.sri_padron_el_oro;
CREATE POLICY sri_padron_el_oro_authenticated
  ON public.sri_padron_el_oro
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. search_path explícito en la función de secuenciales SRI.
ALTER FUNCTION public.get_next_sri_secuencial(character varying)
  SET search_path = public, pg_temp;

-- 3. Política SELECT duplicada (ambas eran USING true).
DROP POLICY IF EXISTS clients_anon_read_policy ON public.clients;

-- 4. Índice duplicado sobre clients.ruc.
DROP INDEX IF EXISTS public.idx_clients_ruc;

-- 5. FK de tasks sin índice de cobertura.
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks (client_id);
