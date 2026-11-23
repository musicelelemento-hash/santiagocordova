/**
 * Estado de Baku para la web (GET /estado): sin secretos.
 *
 * La pantalla del bot en la web mostraba un «en línea» decorativo. Esto le da
 * datos reales: desde cuándo está en línea, qué versión corre, si el correo
 * está configurado, qué modelo de IA usa y la agenda automática con la
 * próxima y la última ejecución de cada tarea.
 */

export const INICIO = new Date();

/** Tareas automáticas de cron.ts (hora de Ecuador, UTC-5 sin horario de verano). */
export const AGENDA = [
    { id: 'backup', nombre: 'Copia a Google Sheets', cron: '0 0 * * *', cuando: 'Todos los días 00:00' },
    { id: 'sociedades', nombre: 'Obligaciones de sociedades', cron: '30 8 * * *', cuando: 'Todos los días 08:30' },
    { id: 'buzon', nombre: 'Buzón SRI', cron: '0 9,14,18 * * 1-5', cuando: 'Lun–Vie 09:00, 14:00, 18:00' },
    { id: 'lunes', nombre: 'Lunes financiero (cobranza)', cron: '0 8 * * 1', cuando: 'Lunes 08:00' },
    { id: 'parte', nombre: 'Parte de la mañana (vencimientos, claves, estado y pendientes)', cron: '45 7 * * 1-5', cuando: 'Lun–Vie 07:45' },
    { id: 'parte_tarde', nombre: 'Recordatorio de vencimientos de hoy', cron: '0 17 * * 1-5', cuando: 'Lun–Vie 17:00 (sólo si algo vence hoy)' },
    { id: 'semana', nombre: 'Resumen de la semana', cron: '0 19 * * 0', cuando: 'Domingo 19:00' },
    { id: 'recordatorios', nombre: 'Recordatorios de pendientes', cron: '*/2 * * * *', cuando: 'Cada 2 minutos (sólo avisa si a algo le tocó la hora)' },
] as const;

export type IdTarea = typeof AGENDA[number]['id'];

const ultimas = new Map<string, string>();
/** Llamar al empezar cada tarea programada. */
export function registrarEjecucion(id: IdTarea): void {
    ultimas.set(id, new Date().toISOString());
}

const OFFSET_EC_MS = -5 * 60 * 60 * 1000;

function campo(valor: string, n: number): boolean {
    if (valor === '*') return true;
    const paso = valor.match(/^\*\/(\d+)$/);
    if (paso) return n % Number(paso[1]) === 0;
    return valor.split(',').some((parte) => {
        const [a, b] = parte.split('-').map(Number);
        return b === undefined ? n === a : n >= a && n <= b;
    });
}

/** Próxima ejecución (ISO, UTC) de un cron simple de 5 campos en hora de Ecuador. */
export function proximaEjecucion(expr: string, desde = new Date()): string | null {
    const [min, hora, dia, mes, dow] = expr.split(/\s+/);
    // Se recorre minuto a minuto en «hora de Ecuador» (como si fuera UTC) hasta 8 días.
    let t = new Date(Math.floor((desde.getTime() + OFFSET_EC_MS) / 60000) * 60000 + 60000);
    for (let i = 0; i < 8 * 24 * 60; i++, t = new Date(t.getTime() + 60000)) {
        if (campo(min, t.getUTCMinutes()) && campo(hora, t.getUTCHours()) && campo(dia, t.getUTCDate())
            && campo(mes, t.getUTCMonth() + 1) && campo(dow, t.getUTCDay())) {
            return new Date(t.getTime() - OFFSET_EC_MS).toISOString();
        }
    }
    return null;
}

export function agendaConFechas(ahora = new Date()) {
    return AGENDA.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        cuando: t.cuando,
        proxima: proximaEjecucion(t.cron, ahora),
        ultima: ultimas.get(t.id) || null, // desde el último arranque del bot
    }));
}

/** Orígenes de la web que pueden leer las rutas de estado (mismos que el proxy de RUC). */
const ORIGENES = [
    /^https:\/\/([a-z0-9-]+\.)*santiagocordova\.com$/,
    /^https:\/\/gestiones-tributarias-[a-z0-9-]*santiagos-projects-f4184cd4\.vercel\.app$/,
    /^https:\/\/gestiones-tributarias-pro\.vercel\.app$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
export const origenPermitido = (o?: string | null) => !!o && ORIGENES.some((re) => re.test(o));
