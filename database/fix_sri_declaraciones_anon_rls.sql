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

-- ---------------------------------------------------------------------
-- AGREGADO 07-sep-2026 (Claude) — la OTRA mitad del mismo 401.
--
-- El bloque de arriba cubre `sri_declaraciones`. Pero el 401 también salía
-- de `clients`, y por un motivo distinto: un permiso de COLUMNA.
--
-- Probado contra el proyecto real, con la llave anon del código:
--
--   200  GET /rest/v1/clients?select=id            ok
--   200  GET /rest/v1/clients?select=tax_profile   ok
--   401  GET /rest/v1/clients?select=is_deleted    42501 permission denied
--   401  GET /rest/v1/clients?is_deleted=eq.false  42501 permission denied
--
-- La extensión filtraba TODAS sus consultas por `is_deleted=eq.false`, así
-- que cada una devolvía 401. Ya se quitó ese filtro del código, y por eso
-- hoy funciona sin correr esto.
--
-- Este GRANT devuelve el filtro. Es OPCIONAL y es una decisión tuya: le da
-- al rol público permiso de lectura sobre esa columna. Sin él, la lista del
-- cockpit puede incluir algún contribuyente dado de baja en la web.
-- ---------------------------------------------------------------------

GRANT SELECT (is_deleted) ON public.clients TO anon;

-- ---------------------------------------------------------------------
-- Y una columna que NO EXISTE en ninguna de las dos tablas:
--
--   400  GET /rest/v1/sri_declaraciones?select=notification_count
--        {"code":"42703","message":"column ... does not exist"}
--
-- `services/supabaseClientService.ts` la manda en el upsert de cada
-- declaración. PostgREST rechaza el payload ENTERO cuando trae una columna
-- desconocida, así que esto puede estar tirando abajo el guardado completo
-- desde la sala de envío — que nunca se verificó en pantalla con datos
-- reales.
--
-- La columna hace falta de verdad: es la etapa del mensaje (1 = envío del
-- comprobante, 2 = recordatorio, 3+ = seguimiento). Sin ella, todos vuelven
-- a recibir el mensaje de bienvenida aunque lleven tres avisos.
--
-- Es aditivo y no rompe nada.
-- ---------------------------------------------------------------------

ALTER TABLE public.sri_declaraciones
    ADD COLUMN IF NOT EXISTS notification_count integer NOT NULL DEFAULT 0;
