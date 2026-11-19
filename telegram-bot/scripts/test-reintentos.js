// Prueba src/reintentos.ts sin red: `npm test`.
// Lo importante: un corte momentáneo de Supabase (522) se reintenta, pero una
// escritura que pudo haberse aplicado (524, corte a mitad) NO se repite —
// repetirla podría duplicar un cobro o un mensaje.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});
const { crearFetchConReintentos } = require(path.join(botDir, 'src', 'reintentos.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const html = (status) => new Response('<!DOCTYPE html><title>522</title>', { status, headers: { 'content-type': 'text/html' } });
const ok = () => new Response('[{"id":1}]', { status: 200, headers: { 'content-type': 'application/json' } });
const errRed = (code) => Object.assign(new TypeError('fetch failed'), { cause: { code } });

function falso(guion) {
    const f = async () => {
        f.llamadas++;
        const paso = guion[Math.min(f.llamadas - 1, guion.length - 1)];
        if (paso instanceof Error) throw paso;
        return paso();
    };
    f.llamadas = 0;
    return f;
}
const opciones = { dormir: async () => {}, avisar: () => {} };
const URL_ = 'https://x.supabase.co/rest/v1/bot_settings?id=eq.gmail_1';

(async () => {
    let base = falso([() => html(522), () => html(522), ok]);
    let r = await crearFetchConReintentos(base, opciones)(URL_, { method: 'GET' });
    ver('lectura: 522, 522 y luego responde', r.status === 200 && base.llamadas === 3, { s: r.status, n: base.llamadas });

    base = falso([() => html(522), ok]);
    r = await crearFetchConReintentos(base, opciones)(URL_, { method: 'POST', body: '{}' });
    ver('escritura: 522 (no llegó) se reintenta', r.status === 200 && base.llamadas === 2, { s: r.status, n: base.llamadas });

    base = falso([() => html(524), ok]);
    r = await crearFetchConReintentos(base, opciones)(URL_, { method: 'POST', body: '{}' });
    ver('escritura: 524 (pudo aplicarse) NO se repite', r.status === 524 && base.llamadas === 1, { s: r.status, n: base.llamadas });

    base = falso([errRed('ECONNRESET'), ok]);
    let lanzo = false;
    try { await crearFetchConReintentos(base, opciones)(URL_, { method: 'PATCH', body: '{}' }); } catch { lanzo = true; }
    ver('escritura: corte a mitad (ECONNRESET) NO se repite', lanzo && base.llamadas === 1, { lanzo, n: base.llamadas });

    base = falso([errRed('ECONNREFUSED'), ok]);
    r = await crearFetchConReintentos(base, opciones)(URL_, { method: 'POST', body: '{}' });
    ver('escritura: conexión rechazada (no se envió) se reintenta', r.status === 200 && base.llamadas === 2, { n: base.llamadas });

    base = falso([errRed('ECONNRESET'), ok]);
    r = await crearFetchConReintentos(base, opciones)(URL_);
    ver('lectura: corte de red se reintenta', r.status === 200 && base.llamadas === 2, { n: base.llamadas });

    base = falso([() => html(522)]);
    r = await crearFetchConReintentos(base, opciones)(URL_);
    const cuerpo = await r.text();
    ver('se rinde tras 3 intentos', base.llamadas === 3, { n: base.llamadas });
    ver('el error final es un JSON corto, no la página HTML', r.status === 522 && cuerpo.startsWith('{') && cuerpo.length < 200, cuerpo);

    base = falso([() => new Response('{"code":"PGRST116"}', { status: 406, headers: { 'content-type': 'application/json' } })]);
    r = await crearFetchConReintentos(base, opciones)(URL_);
    ver('un error normal (406) no se reintenta', r.status === 406 && base.llamadas === 1, { n: base.llamadas });

    console.log(mal ? `\n${mal} fallaron` : '\ntodo verde');
    process.exit(mal ? 1 : 0);
})();
