// Prueba la elección del modelo Gemini (src/ai.ts) con la API de Google simulada,
// sin red: `npm test`. Cuida que un modelo retirado (404) no deje a Baku
// fallando en cada mensaje, que es lo que pasó con gemini-2.0-flash.
const path = require('path');
const botDir = path.resolve(__dirname, '..');

require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const gen = (n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] });
let respuesta;
let llamadas = 0;
global.fetch = async () => {
    llamadas++;
    if (respuesta instanceof Error) throw respuesta;
    return { ok: true, status: 200, json: async () => respuesta };
};

function cargar() {
    const ruta = require.resolve(path.join(botDir, 'src', 'ai.ts'));
    delete require.cache[ruta];
    return require(ruta);
}

(async () => {
    process.env.GEMINI_API_KEY = 'prueba';
    delete process.env.GEMINI_MODEL;

    // 1. Ofrece el preferido
    respuesta = { models: [gen('gemini-2.0-flash'), gen('gemini-2.5-flash'), gen('gemini-2.5-flash-lite'), gen('text-embedding-004')] };
    let ai = cargar();
    let m = await ai.modelosGemini();
    ver('elige gemini-2.5-flash si existe', m.principal === 'gemini-2.5-flash', m);
    ver('respaldo distinto del principal', m.respaldo === 'gemini-2.5-flash-lite', m);

    // 2. Sólo hay modelos más nuevos que la lista de preferencia
    respuesta = { models: [gen('gemini-3.0-flash-lite'), gen('gemini-3.1-flash'), gen('gemini-3.0-flash'), gen('gemini-3.1-pro')] };
    ai = cargar();
    m = await ai.modelosGemini();
    ver('sin preferidos, toma el flash más nuevo', m.principal === 'gemini-3.1-flash', m);
    ver('nunca elige un modelo pro', !/pro/.test(m.principal + m.respaldo), m);

    // 3. Guarda el resultado: no consulta en cada mensaje
    const antes = llamadas;
    await ai.modelosGemini();
    ver('no repite la consulta (caché)', llamadas === antes, { antes, llamadas });

    // 4. Un 404 en uso obliga a volver a consultar
    ai.avisarErrorGemini('[404 Not Found] models/gemini-3.1-flash is not found');
    respuesta = { models: [gen('gemini-3.2-flash')] };
    m = await ai.modelosGemini();
    ver('tras un 404 vuelve a consultar', m.principal === 'gemini-3.2-flash', m);

    // 5. La consulta falla: usa los por defecto, no rompe
    respuesta = new Error('red caída');
    ai = cargar();
    m = await ai.modelosGemini();
    ver('si falla la lista, usa el por defecto', m.principal === 'gemini-2.5-flash', m);

    // 6. GEMINI_MODEL forzado y disponible
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite';
    respuesta = { models: [gen('gemini-2.5-flash'), gen('gemini-2.5-flash-lite')] };
    ai = cargar();
    m = await ai.modelosGemini();
    ver('respeta GEMINI_MODEL si existe', m.principal === 'gemini-2.5-flash-lite', m);

    // 7. GEMINI_MODEL forzado pero retirado: no se queda con uno muerto
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    respuesta = { models: [gen('gemini-2.5-flash')] };
    ai = cargar();
    m = await ai.modelosGemini();
    ver('ignora un GEMINI_MODEL retirado', m.principal === 'gemini-2.5-flash', m);
    delete process.env.GEMINI_MODEL;

    // 8. Sin key: no consulta y devuelve el por defecto
    delete process.env.GEMINI_API_KEY;
    const sinKey = llamadas;
    ai = cargar();
    m = await ai.modelosGemini();
    ver('sin key no consulta la API', llamadas === sinKey && m.principal === 'gemini-2.5-flash', m);

    console.log(mal ? `\n${mal} fallaron` : '\ntodo verde');
    process.exit(mal ? 1 : 0);
})();
