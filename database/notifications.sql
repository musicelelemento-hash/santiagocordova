-- ============================================================================
-- Notificaciones — correo, WhatsApp y notas, con envío y programación.
-- ============================================================================
-- Un registro = un mensaje a un cliente. `estado` cuenta la vida del envío:
--   pendiente  · en cola, listo para salir
--   programado · con `programada_para` en el futuro
--   enviado    · salió (con fecha y detalle del servicio)
--   fallido    · el servicio dijo que no (con el motivo)
--   cancelado  · lo canceló el usuario
-- ============================================================================

create table if not exists public.notifications (
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

-- Sólo con sesión iniciada (la pantalla de Notificaciones de la web). El bot
-- usa la service key y no pasa por RLS. NO abrir a `anon`: la llave anónima
-- viaja en el bundle de la web, y el despachador del bot manda por el Gmail
-- del estudio todo lo que esté `pendiente` en esta tabla — con `anon` cualquiera
-- podría encolar un correo con el destinatario y el texto que quisiera.
create policy "notifications_authenticated" on public.notifications
    for all to authenticated using (true) with check (true);
