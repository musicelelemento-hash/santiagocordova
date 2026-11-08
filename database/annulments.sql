-- ============================================================================
-- Anulaciones de comprobantes — registro para cobrar
-- ============================================================================
-- Cada comprobante anulado al SRI se cobra una sola vez. La clave de acceso
-- (49 dígitos) es la identidad: el UNIQUE de `clave` impide cobrar dos veces
-- el mismo comprobante aunque se reintente.
--
-- Estados: pendiente -> facturado -> pagado. `no_cobrable` (el SRI rechazó) y
-- `exonerado` (decisión comercial) quedan registrados pero no se cobran.
--
-- Ejecutar en Supabase → SQL Editor. No borra nada ni toca tablas existentes.
-- ============================================================================

create table if not exists public.annulments (
    id              uuid primary key default gen_random_uuid(),
    client_id       uuid references public.clients(id) on delete set null,
    client_ruc      text not null,
    consecutivo     text not null,
    clave           text not null unique,
    tipo            text,
    factura         text,
    receptor        text,
    periodo         text not null,                 -- YYYY-MM
    lote            text,
    fecha           timestamptz not null default now(),
    precio          numeric(10, 2) not null default 2,
    estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'facturado', 'pagado', 'no_cobrable', 'exonerado')),
    resultado       text,
    detalle         text,
    factura_ref     text,                          -- secuencial de la factura que la cobró
    intentos        integer not null default 1,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists annulments_cliente_periodo_idx
    on public.annulments (client_ruc, periodo);

create index if not exists annulments_estado_idx
    on public.annulments (estado);

-- Política de precio por cliente (RESERVADA).
-- Hoy la fuente de verdad es `clients.tax_profile.facturadorConfig.annulmentPolicy`,
-- que es lo que escribe el editor de la Bóveda y leen la web y el bot. Esta
-- tabla queda creada para el día que se quiera consultar la política sin leer
-- el JSON del cliente; nadie la lee todavía.
create table if not exists public.annulment_policies (
    client_ruc      text primary key,
    modo            text not null default 'heredado'
                    check (modo in ('heredado', 'gratis', 'fijo', 'cupo')),
    precio          numeric(10, 2),
    cupo_por_periodo integer not null default 0,
    updated_at      timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mismo criterio que el resto del proyecto: no dejar la tabla abierta.
-- Si la app usa la clave `anon` sin sesión (como hoy), hay que habilitar las
-- políticas equivalentes a las de `clients`/`sri_declaraciones`; si usa auth,
-- alcanza con `auth.role() = 'authenticated'`.
--
-- Dejo la tabla cerrada por defecto: se abre cuando se decida el modelo de
-- acceso, igual que se hizo con el hardening de `clients`.
alter table public.annulments enable row level security;
alter table public.annulment_policies enable row level security;

-- Mismo modelo que `sri_declaraciones`: la extensión escribe con la clave
-- `anon` (pública) desde el navegador, así que hace falta permitirlo. Es el
-- mismo nivel de exposición que ya tienen las declaraciones.
create policy "annulments_select_anon" on public.annulments for select to anon using (true);
create policy "annulments_insert_anon" on public.annulments for insert to anon with check (true);
create policy "annulments_update_anon" on public.annulments for update to anon using (true);
create policy "policies_all_anon" on public.annulment_policies for all to anon using (true) with check (true);
