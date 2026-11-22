// Prueba src/reporte_diario.ts y el aviso de sociedades, sin red: `npm test`.
// Datos parecidos al reporte real del 22-nov-2026 que Santiago pidió acortar.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';
require(path.join(botDir, 'node_modules', 'ts-node')).register({ project: path.join(botDir, 'tsconfig.json'), transpileOnly: true });
const R = require(path.join(botDir, 'src', 'reporte_diario.ts'));
const E = require(path.join(botDir, 'src', 'empresas_recordatorios.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const hoy = new Date(2026, 10, 22); // domingo
const base = {
    hoy, periodoIva: '2026-10', semestre: '2026-S1', proximoSemestral: 'enero',
    mensualAlDia: 51,
    mensualPendientes: [{ name: 'CEDENO LUNA JOSELYN BRIGITTE', ruc: '2026081221161', dueDay: 12 }, { name: 'LABANDA ARMIJOS MANUEL ERMUNDO', ruc: '0701234561001', dueDay: 10 }],
    semestralAlDia: 62, semestralPendientes: 10, clavesVerificadas: 46,
    clavesConProblema: [
        { name: 'VERA PALADINES MARIUXI EDITH', ruc: '0918013715001', reason: 'Sin clave guardada' },
        { name: 'ARMIJOS NIEVES BRYAN JHOSEPH', ruc: '0705832137001', reason: 'Clave rechazada por el SRI' },
        { name: 'VIMARBO COMPANY S.A.S.', ruc: '0791844669001', reason: 'Cuenta SRI bloqueada' },
        { name: 'CEDENO LUNA JOSELYN BRIGITTE', ruc: '2026081221161', reason: 'Sin clave guardada' },
    ],
    proximos5: Array.from({ length: 17 }, (_, i) => ({ name: `CLIENTE ${i}`, dueDay: 22 + (i % 3) * 2, alDia: true })),
    porCobrar: 1186, deudores: [{ name: 'PINEDA NARVAEZ HENRY JOSELITO', debt: 65 }, { name: 'ENCALADA BAUTISTA JOEL', debt: 60 }, { name: 'ENCALADA OJEDA IRMA', debt: 40 }, { name: 'CHAVEZ CORDOVA GUIDO', debt: 30 }],
    pendientesTareas: 0,
    fichasRucDanado: [{ name: 'CEDENO LUNA JOSELYN BRIGITTE', ruc: '2026081221161' }, { name: 'CORDOVA RAMIREZ ROBERTO SANTIAGO', ruc: '2026040122204' }],
};

const t = R.armarReporteDiario(base);
console.log('\n----- reporte de muestra -----\n' + t.replace(/<\/?b>/g, '') + '\n------------------------------\n');
ver('es corto (menos de 1.400 caracteres; el viejo pasaba de 3.000)', t.length < 1400, t.length);
ver('lo urgente va arriba', t.indexOf('Para atender') < t.indexOf('Estado'));
ver('IVA vencido dice «venció el 12»', t.includes('Cedeno Luna (venció el 12)'));
ver('claves que no entran: 2, una bloqueada', t.includes('Claves del SRI que no entran: <b>2</b> (1 bloqueada)'));
ver('avisa fichas con RUC dañado', t.includes('Fichas con RUC dañado: <b>2</b>'));
ver('«sin clave» no cuenta las fichas dañadas', t.includes('<b>1</b> sin clave'));
ver('no lista a los que están al día', !t.includes('CLIENTE 0') && t.includes('todos están al día'));
ver('por cobrar en una línea con los 3 mayores', t.includes('$1.186') && t.includes('Pineda Narvaez $65') && !t.includes('Chavez'));
ver('sin listas de 10 nombres', (t.match(/\n• /g) || []).length <= 6, (t.match(/\n• /g) || []).length);

const vacio = R.armarReporteDiario({ ...base, mensualPendientes: [], clavesConProblema: [], fichasRucDanado: [], proximos5: [] });
ver('sin pendientes dice «Nada urgente hoy»', vacio.includes('Nada urgente hoy'));

const faltan = R.armarReporteDiario({ ...base, proximos5: [{ name: 'PEREZ LOPEZ FELIX', dueDay: 24, alDia: false }, { name: 'X Y', dueDay: 22, alDia: true }] });
ver('próximos 5 días: lista sólo los que faltan', faltan.includes('faltan 1') && faltan.includes('Perez Lopez') && !faltan.includes('X Y'));

ver('nombres se escapan (HTML)', R.armarReporteDiario({ ...base, deudores: [{ name: 'A&B <x>', debt: 5 }] }).includes('A&amp;b'));
ver('RUC válido: 13 con 001 o cédula de 10', R.rucValido('0705787745001') && R.rucValido('0705787745') && !R.rucValido('2026081221161') && !R.rucValido('123'));

// Sociedades
const vimarbo = [{ name: 'VIMARBO COMPANY S.A.S.', ruc: '0791844669001', hitos: [
    { nombre: '1021 Renta Sociedades', fecha: new Date(2026, 3, 20), dias: -216 },
    { nombre: 'SCVS Nómina de socios', fecha: new Date(2026, 1, 28), dias: -267 },
    { nombre: 'SCVS Estados financieros', fecha: new Date(2026, 3, 30), dias: -206 },
] }];
ver('sociedades: sólo vencidas → no avisa un domingo', E.armarAvisoSociedades(vimarbo, new Date(2026, 10, 22)) === null);
const lunes = E.armarAvisoSociedades(vimarbo, new Date(2026, 10, 23));
ver('sociedades: los lunes sí, en UNA línea por empresa', !!lunes && (lunes.match(/VIMARBO/g) || []).length === 1 && lunes.includes('3 vencidas'), lunes);
const pronto = E.armarAvisoSociedades([{ name: 'ACME S.A.S.', ruc: '0790000000001', hitos: [{ nombre: 'REBEFICS', fecha: new Date(2027, 1, 10), dias: 3 }] }], new Date(2026, 10, 22));
ver('sociedades: algo vence en ≤7 días → avisa cualquier día', !!pronto && pronto.includes('en 3 d'));

console.log(mal ? `\n${mal} prueba(s) MAL` : '\nTodas las pruebas del reporte diario OK');
process.exit(mal ? 1 : 0);
