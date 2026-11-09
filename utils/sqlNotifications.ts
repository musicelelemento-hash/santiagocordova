/**
 * SQL de la tabla de notificaciones, embebido para que la pantalla pueda
 * ofrecer "Copiar SQL" cuando la tabla todavía no existe en Supabase.
 * Es el mismo contenido de `database/notifications.sql`.
 */
export const SQL_NOTIFICATIONS = `create table if not exists public.notifications (
    id              uuid primary key default gen_random_uuid(),
    ruc             text not null,
    cliente_nombre  text,
    canal           text not null check (canal in ('email', 'whatsapp', 'nota')),
    tipo            text not null default 'libre'
                    check (tipo in ('declaracion', 'recordatorio', 'pago', 'cobro', 'anulacion', 'bienvenida', 'libre')),
    destinatario    text not null default '',
    asunto          text not null default '',
    cuerpo          text not null default '',
    estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'programado', 'enviado', 'fallido', 'cancelado')),
    programada_para timestamptz,
    enviada_en      timestamptz,
    error           text,
    periodo         text,
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);

create index if not exists notifications_estado_idx on public.notifications (estado, programada_para);
create index if not exists notifications_ruc_idx on public.notifications (ruc, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_all_anon" on public.notifications
    for all to anon using (true) with check (true);`;
