-- ============================================================================
-- Bóveda de contactos SRI — claves que NO son clientes.
-- ============================================================================
-- Las claves importadas del CSV de Chrome (las de las empresas del papá y las
-- de consulta) NO son clientes: no se declaran, no se notifican, no entran al
-- lote. Viven acá y sólo se usan para:
--   1. autocompletar la clave al crear un cliente nuevo con ese RUC;
--   2. responder "dame la clave del RUC …" del bot.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- ============================================================================

create table if not exists public.sri_contacts (
    ruc          text primary key,
    name         text not null default '',
    sri_password text not null,
    origen       text not null default 'csv-chrome',
    created_at   timestamptz not null default now()
);

alter table public.sri_contacts enable row level security;

drop policy if exists "sri_contacts_select_anon" on public.sri_contacts;
drop policy if exists "sri_contacts_insert_anon" on public.sri_contacts;
drop policy if exists "sri_contacts_update_anon" on public.sri_contacts;

create policy "sri_contacts_select_anon" on public.sri_contacts for select to anon using (true);
create policy "sri_contacts_insert_anon" on public.sri_contacts for insert to anon with check (true);
create policy "sri_contacts_update_anon" on public.sri_contacts for update to anon using (true) with check (true);

-- ── 1) Migrar los placeholders que ya existen en clients ───────────────────
insert into public.sri_contacts (ruc, name, sri_password, origen)
select c.ruc, c.name, c.sri_password, 'migrado-desde-clients'
from public.clients c
where c.name like 'SRI · %'
  and c.created_at is null
  and c.sri_password is not null
on conflict (ruc) do nothing;

-- ── 2) Verificar antes de borrar ───────────────────────────────────────────
-- Debe dar el mismo número en ambas filas.
select
    (select count(*) from public.sri_contacts) as en_boveda,
    (select count(*) from public.clients where name like 'SRI · %' and created_at is null) as en_clients;

-- ── 3) Sacarlos de clients (DESPUÉS de que los números coincidan) ──────────
-- OJO: si no se corrió el paso 1, esto pierde las claves. Verificar antes.
-- delete from public.clients where name like 'SRI · %' and created_at is null;

-- ============================================================================
-- Candado: `clients` no acepta nombres placeholder "SRI · RUC".
-- Aunque un import o un script lo intente, la base lo rechaza. Reversible:
--   drop trigger if exists trg_bloquear_placeholder on public.clients;
-- ============================================================================
create or replace function public.bloquear_placeholder_cliente()
returns trigger as $$
begin
    if new.name ~* '^SRI[[:space:]]*[-·–]?[[:space:]]*[0-9]{13}$' then
        raise exception 'Nombre placeholder SRI · RUC no permitido en clients: %', new.name
            using hint = 'La clave va en sri_contacts, no en clients.';
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bloquear_placeholder on public.clients;
create trigger trg_bloquear_placeholder
    before insert or update of name on public.clients
    for each row execute function public.bloquear_placeholder_cliente();
