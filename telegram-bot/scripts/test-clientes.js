// Prueba src/clientes_botones.ts sin red: `npm test`.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';
require(path.join(botDir, 'node_modules', 'ts-node')).register({ project: path.join(botDir, 'tsconfig.json'), transpileOnly: true });
const C = require(path.join(botDir, 'src', 'clientes_botones.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const filas = [
    { id: uuid(1), name: 'ÁLVAREZ PEÑA ANA', ruc: '0701234541001', regime: 'Régimen General', tax_profile: { ivaFrequency: 'Mensual' } },
    { id: uuid(2), name: 'BRAVO LUIS', ruc: '0701234511001', regime: 'RIMPE Emprendedor', tax_profile: {} },
    { id: uuid(3), name: 'ACME S.A.S.', ruc: '0791234561001', regime: 'Régimen General', tax_profile: {} },
    { id: uuid(4), name: 'CASTRO MIA', ruc: '0701234591001', regime: 'RIMPE Negocio Popular', tax_profile: {} },
    { id: uuid(5), name: 'ZAMBRANO INACTIVO', ruc: '0701234541001', regime: 'Régimen General', is_active: false },
];
for (let i = 6; i <= 25; i++) filas.push({ id: uuid(i), name: `DIAZ CLIENTE ${String(i).padStart(2, '0')}`, ruc: '0701234541001', regime: 'Régimen General', tax_profile: { ivaFrequency: 'Mensual' } });
const items = filas.map(C.aItem);

ver('tipo: tax_profile manda; si no, el régimen', items[0].tipo === 'mensual' && items[1].tipo === 'semestral' && items[3].tipo === 'popular');
ver('sociedad por el 3.er dígito 9', items[2].sociedad && !items[0].sociedad);
ver('9.º dígito leído del RUC', items[0].digito === 4 && items[1].digito === 1);
ver('inactivo marcado', items[4].activo === false);

ver('todos = sólo activos, A–Z sin mirar tildes (Álvarez antes que Bravo)', C.filtrar(items, 't')[0].name.startsWith('ACME') && C.filtrar(items, 't')[1].name.startsWith('ÁLVAREZ') && !C.filtrar(items, 't').some(i => !i.activo));
ver('por letra: «Á» cuenta como A', C.filtrar(items, 'l:A').length === 2, C.filtrar(items, 'l:A').map(i => i.name));
ver('por dígito', C.filtrar(items, 'd:4').length === 21);
ver('por tipo y sociedades', C.filtrar(items, 'r:popular').length === 1 && C.filtrar(items, 'r:sociedad').length === 1);
ver('inactivos', C.filtrar(items, 'i').length === 1);

const p1 = C.pantallaLista(items, 'd:4', 0);
const json1 = JSON.stringify(p1.kb);
ver('lista de 8 en 8 con ▶ y página 1/3', (json1.match(/bc:v:/g) || []).length === 8 && json1.includes('1/3') && json1.includes('bc:l:d:4:1') && !json1.includes('◀'), json1);
const p3 = JSON.stringify(C.pantallaLista(items, 'd:4', 2).kb);
ver('última página: ◀ y sin ▶', p3.includes('3/3') && p3.includes('◀') && !p3.includes('▶'));
ver('página fuera de rango se ajusta', JSON.stringify(C.pantallaLista(items, 'd:4', 99).kb).includes('3/3'));
ver('título del dígito con su día', p1.texto.includes('9.º dígito 4 · vence el día 16'));
ver('lista vacía lo dice', C.pantallaLista(items, 'l:Q', 0).texto.includes('No hay clientes'));

// Todos los callbacks caben en el límite de Telegram (64 bytes).
const pantallas = [C.pantallaIndice(items), C.pantallaLetras(items), C.pantallaDigitos(items), C.pantallaTipos(items), C.pantallaLista(items, 'r:semestral', 0), p1];
const largos = pantallas.flatMap(p => p.kb.inline_keyboard.flat().map(b => Buffer.byteLength(b.callback_data || '', 'utf8')));
ver('todos los botones caben en 64 bytes', Math.max(...largos) <= 64, Math.max(...largos));
ver('dígitos: 10 botones con día y cantidad', JSON.stringify(C.pantallaDigitos(items).kb).includes('4 · día 16 (21)'));
ver('índice: muestra activos e inactivos', C.pantallaIndice(items).texto.includes('24 activos') && JSON.stringify(C.pantallaIndice(items).kb).includes('Inactivos (1)'));

console.log(mal ? `\n${mal} prueba(s) MAL` : '\nTodas las pruebas de clientes por botones OK');
process.exit(mal ? 1 : 0);
