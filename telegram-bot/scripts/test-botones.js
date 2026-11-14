// Prueba src/botones_web.ts contra grammY real, sin red ni credenciales: `npm test`.
// Cuida que un botón de la web dispare de verdad su comando o su texto, que uno
// muerto avise en vez de fallar callado, y que la lista de comandos de la web
// (screens/TelegramBotScreen.tsx) no se separe de la del bot (src/comandos.ts).
const path = require('path');
const botDir = path.resolve(__dirname, '..');

// Antes de cargar nada: que el cliente de Supabase no apunte a ningún lado real.
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';

require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});

const { Bot, InlineKeyboard } = require(path.join(botDir, 'node_modules', 'grammy'));
const sb = require(path.join(botDir, 'src', 'supabase.ts'));
const m = require(path.join(botDir, 'src', 'botones_web.ts'));
const { COMANDOS_MENU } = require(path.join(botDir, 'src', 'comandos.ts'));

let filas = [];
let fallaSupabase = null;
sb.supabase.from = () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => (fallaSupabase ? { data: null, error: fallaSupabase } : { data: { data: filas }, error: null }) }) }),
});

const bot = new Bot('123456:PRUEBA', {
    botInfo: { id: 1, is_bot: true, first_name: 'T', username: 'prueba_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false },
});
let llamados = [];
bot.command('cobranza', ctx => { llamados.push(`cmd:cobranza:${ctx.match}`); });
bot.command('facturar', ctx => { llamados.push(`cmd:facturar:${ctx.match}`); });
bot.on('message:text', ctx => { llamados.push(`texto:${ctx.message.text}`); });

function ctxFalso() {
    const respuestas = [];
    return {
        respuestas,
        update: { update_id: 5 },
        callbackQuery: { message: { message_id: 77 } },
        chat: { id: 111, type: 'private', first_name: 'S' },
        from: { id: 111, is_bot: false, first_name: 'S' },
        reply: async (t) => { respuestas.push(t); },
    };
}

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

(async () => {
    const b = (id, label, action, isActive = true) => ({ id, label, action, category: 'Gestión', isActive });

    // 1. Filtro de lo que guardó la web
    const sucio = [
        b('btn_1', 'A', '/cobranza'), b('btn_2', 'B', '/menu', false), b('btn:malo', 'C', '/menu'),
        b('btn_4', '   ', '/menu'), b('btn_5', 'E', '   '), null, 'texto', { id: 'btn_6' },
        b('btn_7', 'G', 'pedido'), b('btn_8', 'H', '/menu'), b('btn_9', 'I', '/menu'),
        b('btn_10', 'J', '/menu'), b('btn_11', 'K', '/menu'), b('btn_12', 'L', '/menu'),
    ];
    const limpios = m.botonesDesdeFila(sucio);
    ver('descarta inactivos y mal formados', limpios.every(x => !['btn_2', 'btn:malo', 'btn_4', 'btn_5', 'btn_6'].includes(x.id)), limpios);
    ver('tope de 6 en el menú', limpios.length === 6, limpios.length);
    ver('algo que no es lista -> vacío', m.botonesDesdeFila({ a: 1 }).length === 0 && m.botonesDesdeFila(null).length === 0);

    // 2. Teclado: dos por fila, después de lo que ya había
    const kb = m.agregarBotonesWeb(new InlineKeyboard().text('X', 'x').text('Y', 'y'), limpios.slice(0, 3));
    const filasKb = kb.inline_keyboard.filter(f => f.length);
    ver('dos por fila bajo el menú', filasKb.length === 3 && filasKb[0].length === 2 && filasKb[1].length === 2 && filasKb[2].length === 1, filasKb.map(f => f.length));
    ver('callback_data corto y con prefijo', filasKb[1][0].callback_data === 'baku_btn:btn_1', filasKb[1][0].callback_data);

    // 3. comandoDe
    ver('comandoDe', m.comandoDe('/Cobranza 3') === 'cobranza' && m.comandoDe('/menu@baku_bot') === 'menu' && m.comandoDe('deudores') === null);

    // 4. Ejecutar: comando conocido
    filas = [b('btn_1', 'Deudores', '/cobranza'), b('btn_2', 'Facturar', '/facturar 123'), b('btn_3', 'Pedido', 'deudores de más de $50 <ya>'),
             b('btn_4', 'Muerto', '/probar_claves'), b('btn_5', 'Apagado', '/cobranza', false)];
    let c = ctxFalso(); llamados = [];
    await m.ejecutarBotonWeb(bot, c, 'btn_1');
    ver('/cobranza dispara el comando', llamados.join('|') === 'cmd:cobranza:' && c.respuestas.length === 0, { llamados, r: c.respuestas });

    c = ctxFalso(); llamados = [];
    await m.ejecutarBotonWeb(bot, c, 'btn_2');
    ver('/facturar 123 pasa el argumento', llamados.join('|') === 'cmd:facturar:123', llamados);

    // 5. Ejecutar: pedido en palabras
    c = ctxFalso(); llamados = [];
    await m.ejecutarBotonWeb(bot, c, 'btn_3');
    ver('texto libre llega como mensaje', llamados.join('|') === 'texto:deudores de más de $50 <ya>', llamados);
    ver('texto libre se anuncia y escapa HTML', c.respuestas.length === 1 && c.respuestas[0].includes('&lt;ya&gt;') && !c.respuestas[0].includes('<ya>'), c.respuestas);

    // 6. Comando que Baku no tiene
    c = ctxFalso(); llamados = [];
    await m.ejecutarBotonWeb(bot, c, 'btn_4');
    ver('comando inexistente avisa y no ejecuta', llamados.length === 0 && c.respuestas.length === 1 && c.respuestas[0].includes('/probar_claves'), { llamados, r: c.respuestas });

    // 7. Botón apagado o borrado
    c = ctxFalso(); llamados = [];
    await m.ejecutarBotonWeb(bot, c, 'btn_5');
    ver('botón apagado no ejecuta', llamados.length === 0 && c.respuestas.length === 1, { llamados, r: c.respuestas });
    c = ctxFalso(); llamados = [];
    await m.ejecutarBotonWeb(bot, c, 'no_existe');
    ver('id desconocido no ejecuta', llamados.length === 0 && c.respuestas.length === 1, { llamados, r: c.respuestas });

    // 8. Supabase caído o tabla sin crear: el menú sale igual, sin botones
    fallaSupabase = { code: 'PGRST205', message: 'Could not find the table' };
    ver('sin tabla -> lista vacía, sin romper', (await m.botonesActivos()).length === 0);
    fallaSupabase = null;

    // 9. Las dos listas de comandos (bot y web) dicen lo mismo
    const web = require('fs').readFileSync(path.join(botDir, '..', 'screens', 'TelegramBotScreen.tsx'), 'utf8');
    const bloque = web.match(/export const BAKU_COMMANDS = \[([\s\S]*?)\];/)[1];
    const deLaWeb = [...bloque.matchAll(/'\/([a-z_]+)'/g)].map(x => x[1]).sort();
    const delBot = COMANDOS_MENU.map(x => x.command).sort();
    ver('lista de comandos igual en web y bot', JSON.stringify(deLaWeb) === JSON.stringify(delBot), { deLaWeb, delBot });

    // 10. Los defaults de la web apuntan todos a comandos reales
    const defaults = [...web.match(/DEFAULT_CUSTOM_BUTTONS: CustomBotButton\[\] = \[([\s\S]*?)\];/)[1].matchAll(/action: '([^']+)'/g)].map(x => x[1]);
    ver('ningún botón por defecto está muerto', defaults.length > 0 && defaults.every(a => a.startsWith('/') && delBot.includes(a.slice(1))), defaults);

    console.log(mal ? `${mal} fallaron` : 'todo verde');
    process.exit(mal ? 1 : 0);
})().catch(e => { console.error('REVENTÓ:', e); process.exit(2); });
