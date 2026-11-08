-- ============================================================================
-- Buzón de sugerencias — lo que el contador pide/padece, con nivel y color.
-- ============================================================================
-- Niveles (de menos a más urgente):
--   idea        · gris    · “esto estaría bueno”
--   sugerencia  · azul    · “mejor si…”
--   mejora      · celeste · “esto ya funciona, mejorarlo”
--   aplicar     · ámbar   · “aplicalo”
--   solucionar  · rojo    · “esto está roto, ahora”
--   revisar     · violeta · “revisá esto otro”
--
-- El agente lee sólo los 'pendiente' y en formato de una línea por entrada
-- (tools/buzon.mjs), así no gasta contexto.
-- ============================================================================

create table if not exists public.suggestions (
    id          uuid primary key default gen_random_uuid(),
    level       text not null check (level in ('idea', 'sugerencia', 'mejora', 'aplicar', 'solucionar', 'revisar')),
    area        text not null default 'general',
    texto       text not null,
    source      text not null default 'web',
    status      text not null default 'pendiente' check (status in ('pendiente', 'aplicada', 'descartada')),
    created_at  timestamptz not null default now()
);

create index if not exists suggestions_pendientes_idx
    on public.suggestions (status, created_at desc);

alter table public.suggestions enable row level security;

-- La web y las extensiones escriben con la clave anon, como el resto del sistema.
create policy "suggestions_insert_anon" on public.suggestions for insert to anon with check (true);
create policy "suggestions_select_anon" on public.suggestions for select to anon using (true);
create policy "suggestions_update_anon" on public.suggestions for update to anon using (true);
