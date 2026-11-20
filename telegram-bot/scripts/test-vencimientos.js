// Prueba src/vencimientos.ts (herramienta calcular_vencimiento de Baku): `npm test`.
// Las fechas esperadas coinciden con el calculador de la skill sri-ecuador
// (contrastadas el 20-nov-2026 en 200 combinaciones de dígito × período × régimen).
const path = require('path');
const botDir = path.resolve(__dirname, '..');
require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});
const { calcularVencimiento } = require(path.join(botDir, 'src', 'vencimientos.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}
const v = (...a) => calcularVencimiento(...a);
const lanza = (fn) => { try { fn(); return false; } catch { return true; } };

let r = v('0702345671001', '2026-10', 'Régimen General');
ver('IVA oct-2026, dígito 7: domingo 22 → lunes 23', r.fecha === '2026-11-23' && r.nominal === '2026-11-22' && /lunes 23 de noviembre/.test(r.texto), r);

r = v('0702345600001', '2027-01', 'Régimen General');
ver('dígito 0, 28-feb-2027 domingo → adelanta al viernes 26', r.fecha === '2027-02-26' && /adelantado/.test(r.traslado), r);

r = v('0702345640001', '2026-10', 'Régimen General');
ver('día hábil no se mueve', r.fecha === r.nominal && r.traslado === null, r);

r = v('0702345671001', '2026-10', 'Régimen General', { feriados: ['2026-11-23'] });
ver('feriado el lunes → martes 24', r.fecha === '2026-11-24', r);

r = v('0702345678001', '2025', 'RIMPE Emprendedor');
ver('renta 2025 Emprendedor persona natural → mayo 2026', r.fecha.startsWith('2026-05'), r);

r = v('0702345678001', '2025', 'RIMPE Negocio Popular');
ver('renta 2025 Negocio Popular → mayo 2026', r.fecha.startsWith('2026-05'), r);

r = v('0702345678001', '2025', 'Régimen General');
ver('renta 2025 General persona natural → marzo 2026', r.fecha.startsWith('2026-03'), r);

r = v('0791234567001', '2025', 'Régimen General');
ver('renta de sociedad (3.er dígito 9) → abril', r.fecha.startsWith('2026-04'), r);

r = v('0702345678001', '2026-S2', 'RIMPE Emprendedor');
ver('IVA semestral S2-2026 → enero 2027', r.fecha.startsWith('2027-01'), r);
r = v('0702345678001', '2026-1S', 'RIMPE Emprendedor');
ver('acepta el formato 2026-1S', r.fecha.startsWith('2026-07'), r);

ver('Negocio Popular no declara IVA', lanza(() => v('0702345678001', '2026-10', 'RIMPE Negocio Popular')));
ver('regimen con mayúsculas distintas también', lanza(() => v('0702345678001', '2026-10', 'Rimpe negocio popular')));
ver('período inválido avisa', lanza(() => v('0702345678001', 'octubre')));

console.log(mal ? `\n${mal} fallaron` : '\ntodo verde');
process.exit(mal ? 1 : 0);
