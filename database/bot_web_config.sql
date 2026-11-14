-- ============================================================================
-- bot_web_config — ajustes de Baku que se editan desde la web.
-- ============================================================================
-- Clave/valor. La web escribe con la sesión iniciada (rol authenticated); el
-- bot lee con la service key, que salta RLS.
--
-- NO es bot_settings: ahí viven los tokens OAuth de Gmail y esa tabla no se le
-- abre al navegador.
--
--   id = 'custom_buttons'  →  data = [{ id, label, action, category, isActive }]
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================================

create table if not exists public.bot_web_config (
    id          text primary key,
    data        jsonb not null default '[]'::jsonb,
    updated_at  timestamptz not null default now()
);

alter table public.bot_web_config enable row level security;

grant select, insert, update, delete on public.bot_web_config to authenticated;
grant all on public.bot_web_config to service_role;

drop policy if exists "bot_web_config_authenticated" on public.bot_web_config;
create policy "bot_web_config_authenticated" on public.bot_web_config
    for all to authenticated using (true) with check (true);
