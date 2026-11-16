# Bucle remoto (runner) · el celular encola, la PC ejecuta

**Fecha:** 16-nov-2026 · Estado: **MVP funcionando** (cola + runner + panel).

---

## 1 · La idea en una línea

El celular **no** corre el bucle (Chrome Android no tiene extensiones). El celular
**encola** el trabajo en Supabase y una **PC** con Chrome + la extensión Nueva Luz,
con el dashboard abierto, **lo ejecuta** y reporta el avance.

```
📱 Web (celular)                    ☁️ Supabase                     🖥️ PC runner
Bucle → "Enviar al runner"  ──────►  bucle_remoto (pendiente) ──────►  extensión (cada 30 s)
   ▲                                   ▲                                │
   └──── progreso / estado ◄───────────┴──────── PATCH avance ◄─────────┘
```

---

## 2 · SQL: crear la tabla (una vez)

Ejecutar en el **SQL Editor** de Supabase:

```sql
-- Cola de trabajos del bucle remoto
create table if not exists public.bucle_remoto (
  id uuid primary key default gen_random_uuid(),
  runner_id text,                                  -- id del equipo que lo corre
  periodo text not null,                           -- 'YYYY-MM'
  clientes jsonb not null default '[]'::jsonb,     -- [{ruc,name}]
  modo text not null default 'declarar',           -- 'declarar' | 'solo_perfil'
  estado text not null default 'pendiente',        -- pendiente|corriendo|hecho|error|cancelado
  progreso jsonb,                                  -- {hecho,total,actual,mensaje}
  mensaje text,
  requested_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists bucle_remoto_estado_idx on public.bucle_remoto (estado, created_at desc);

alter table public.bucle_remoto enable row level security;

-- MVP: la web (usuario logueado) y la extensión (anon con JWT de la sesión) usan la cola.
-- Endurecer cuando haya multi-empresa: filtrar por empresa/runner.
drop policy if exists bucle_remoto_select on public.bucle_remoto;
create policy bucle_remoto_select on public.bucle_remoto for select using (true);

drop policy if exists bucle_remoto_insert on public.bucle_remoto;
create policy bucle_remoto_insert on public.bucle_remoto for insert with check (true);

drop policy if exists bucle_remoto_update on public.bucle_remoto;
create policy bucle_remoto_update on public.bucle_remoto for update using (true) with check (true);

-- Realtime (opcional, para ver el avance sin recargar)
alter publication supabase_realtime add table public.bucle_remoto;
```

> Si preferís no exponer la tabla: cambiá las políticas para que usen
> `auth.uid()` y un `runner_token` por equipo. El MVP deja la cola abierta para
> probar; el avance no contiene contraseñas.

---

## 3 · Activar el runner (PC)

1. En la PC: Chrome (o Quetta/Helium si es Android) con la extensión **Nueva Luz**.
2. Abrí el popup → menú ⋮ → **🖥️ Runner remoto: desactivado** → queda **ACTIVO**.
   - Se guarda `sc_runner = { enabled, id, nombre }` en la extensión.
3. Dejá **abierto el dashboard** en esa PC: la extensión toma las claves desde la
   caché sincronizada por la web (`sc_clients_cache`). Sin eso, el trabajo termina
   en `error` con el mensaje “Sin claves en el runner”.
4. La pestaña del SRI la abre el runner solo (`chrome.tabs.create`).
5. No cierres Chrome ni bloquees la PC mientras corre.

**Asignación:** cada trabajo puede llevar `runner_id`. Hoy el runner toma los
`pendiente` con `runner_id` igual al suyo (el runner consulta con su id). Si querés
“cualquier runner”, dejá `runner_id` nulo y cambiá el filtro en
`background.js` (`scRunnerPoll`).

---

## 4 · Enviar un trabajo (celular)

1. Web → **Bucle Mensual**.
2. Tarjeta **🖥️ Bucle remoto · runner**:
   - **Enviar al runner** → encola los clientes pendientes para declarar.
   - **Sólo entrar (mirar)** → modo `solo_perfil` (no declara).
   - **Estado** refresca la cola.
3. La tarjeta muestra: `pendiente → corriendo (x/y) → hecho`, con barra de avance
   y cancelación.

---

## 5 · Cómo reporta el avance la extensión

En `background.js` (service worker), cada 30 s (`chrome.alarms`):

1. Si hay trabajo en curso → lee `sc_loop` y hace `PATCH progreso {hecho,total,actual}`.
2. Cuando `sc_loop.estado === 'DETENIDO'` → `estado: hecho`, `finished_at`, `mensaje`.
3. Si no hay trabajo en curso → busca un `pendiente` asignado a su `runner_id`.
4. Arma **la misma cola** que “Ejecutar lote” del popup:
   `sc_loop`, `pending_sri_autofill`, `pendingAction: verifyProfile`, `workflowPeriod`,
   `auto_batch_*`, `sri_auto_mode`, `autoDeclaration` según el modo.
5. Abre la pestaña del SRI y sigue.

Permiso nuevo en el manifest: **`alarms`**.

---

## 6 · Prueba mínima (5 minutos)

1. SQL corrido, tabla visible en Supabase.
2. PC: extensión **ACTIVA** como runner + dashboard abierto con clientes sincronizados.
3. Celular: Bucle → **Enviar al runner** con 1 cliente de prueba.
4. En la cola debería pasar: `pendiente` (5 s) → `corriendo` → `hecho`.
5. En la PC: pestaña del SRI abierta, popup con `🖥️ Runner remoto: corriendo…`.
6. En Supabase: `select * from bucle_remoto order by created_at desc limit 3;`

---

## 7 · Límites y siguientes pasos

| Tema | Estado |
|---|---|
| Seguridad de la cola | MVP abierto; siguiente: token por runner + RLS por empresa |
| Reintentos | Si el runner se cae, el trabajo queda `corriendo`; siguiente: `heartbeat` y re-encolado tras 10 min |
| Varios runners | Siguiente: `claim` atómico (`update ... where estado='pendiente'`) |
| Notificación al celular | Siguiente: push/WhatsApp al `hecho` (ya existe el bot) |
| Claves | El runner necesita el dashboard abierto una vez; siguiente: cache cifrada por runner |

---

## 8 · Claim atómico + heartbeat (multi-runner)

### 8.1 · SQL extra (correr después del de la sección 2)

```sql
-- Señal de vida del runner
alter table public.bucle_remoto add column if not exists heartbeat_at timestamptz;

-- Claim ATÓMICO: un trabajo lo toma UN solo runner, aunque haya varios mirando.
-- `for update skip locked` evita que dos runners se lleven el mismo trabajo.
create or replace function public.claim_bucle_remoto(p_runner_id text)
returns setof public.bucle_remoto
language sql
security definer
as $$
  with elegido as (
    select id
      from public.bucle_remoto
     where estado = 'pendiente'
       and (runner_id is null or runner_id = p_runner_id)
     order by created_at asc
     limit 1
     for update skip locked
  )
  update public.bucle_remoto b
     set estado = 'corriendo',
         runner_id = p_runner_id,
         started_at = now(),
         heartbeat_at = now(),
         mensaje = null
    from elegido e
   where b.id = e.id
  returning b.*;
$$;

-- Re-encolar trabajos muertos: corriendo sin señal hace más de N minutos.
create or replace function public.reencolar_bucle_remoto(p_minutos int default 10)
returns int
language sql
security definer
as $$
  with viejos as (
    update public.bucle_remoto
       set estado = 'pendiente',
           runner_id = null,
           started_at = null,
           heartbeat_at = null,
           mensaje = 'Re-encolado: el runner no dio señal'
     where estado = 'corriendo'
       and coalesce(heartbeat_at, started_at, created_at) < now() - (p_minutos || ' minutes')::interval
    returning 1
  )
  select count(*)::int from viejos;
$$;

grant execute on function public.claim_bucle_remoto(text) to anon, authenticated;
grant execute on function public.reencolar_bucle_remoto(int) to anon, authenticated;
```

### 8.2 · Cómo queda el ciclo

1. **Varios runners**: cada uno llama `claim_bucle_remoto(su_id)`; el `skip locked`
   garantiza que no se dupliquen.
2. **Heartbeat**: mientras corre, el runner manda `heartbeat_at` y `progreso` cada 30 s.
3. **Runner caído**: la web ve “sin señal” pasado ~6 min y ofrece **Re-encolar**;
   también se puede programar el `reencolar_bucle_remoto(10)` en pg_cron:

```sql
-- Si tenés pg_cron habilitado (Database → Extensions)
select cron.schedule('reencolar-bucle-remoto', '*/10 * * * *',
                     $$select public.reencolar_bucle_remoto(10)$$);
```

4. **Fallback**: si la función `claim_bucle_remoto` no existe todavía, la extensión
   usa el camino viejo (select + patch). No rompe nada.
