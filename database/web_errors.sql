-- Errores de la web (22-nov-2026).
-- ESTADO: escrita, todavía NO aplicada en Supabase (falta la aprobación).
-- El panel anota acá los errores que antes sólo quedaban en la consola del
-- navegador. Baku los cuenta en el parte diario (lee con la service key).
-- Escribe sólo quien inició sesión; nadie (ni con sesión) puede leerlos desde
-- el navegador: no hace falta y el mensaje podría traer datos de un cliente.
create table if not exists public.web_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 2000),
  url text check (char_length(url) <= 300),
  origen text check (char_length(origen) <= 40),
  user_agent text check (char_length(user_agent) <= 300),
  user_id uuid default auth.uid()
);
alter table public.web_errors enable row level security;
revoke all on public.web_errors from anon, authenticated;
grant insert (message, stack, url, origen, user_agent) on public.web_errors to authenticated;
drop policy if exists web_errors_insert on public.web_errors;
create policy web_errors_insert on public.web_errors
  for insert to authenticated with check (true);
create index if not exists web_errors_created_at on public.web_errors (created_at desc);
