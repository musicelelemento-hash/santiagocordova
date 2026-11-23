// Prueba src/resumen_semanal.ts y los botones del parte, sin red: `npm test`.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';
require(path.join(botDir, 'node_modules', 'ts-node')).register({ project: path.join(botDir, 'tsconfig.json'), transpileOnly: true });
const S = require(path.join(botDir, 'src', 'resumen_semanal.ts'));
const P = require(path.join(botDir, 'src', 'parte_diario.ts'));
const { clasificarCierre } = require(path.join(botDir, 'src', 'cierre.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const base = {
    desde: new Date(2026, 10, 16), hasta: new Date(2026, 10, 23),
    cobros: 12, declaraciones: 9, pendientesHechos: 4,
    clientesNuevos: [{ name: 'PEREZ LOPEZ FELIX' }, { name: 'ACME S.A.S.' }],
    prospectos: [
        { codigoCampana: 'IVA-M1', etapa: 'ganado' }, { codigoCampana: 'iva-m1', etapa: 'prospecto' },
        { codigoCampana: 'FIRMA2', etapa: 'prospecto' }, { etapa: 'prospecto' },
    ],
    mensualesActivos: 52,
};
const t = S.armarResumenSemanal(base);
console.log('\n----- resumen de muestra -----\n' + t.replace(/<\/?(b|code)>/g, '') + '\n------------------------------\n');
ver('encabezado con las fechas de la semana', t.includes('16 nov – 23 nov'));
ver('cobros, declaraciones y pendientes cerrados', t.includes('<b>12</b>') && t.includes('<b>9</b>') && t.includes('<b>4</b>'));
ver('clientes nuevos con nombre corto', t.includes('Clientes nuevos: 2') && t.includes('Perez Lopez'));
ver('las siglas con punto quedan igual (S.A.S.)', t.includes('Acme S.A.S.'), t);
ver('prospectos por código (sin importar mayúsculas), el más usado primero', t.indexOf('IVA-M1') < t.indexOf('FIRMA2') && t.includes('IVA-M1</code>: 2 prospectos, 1 cliente'), t);
ver('«Sin código» al final', t.indexOf('Sin código') > t.indexOf('FIRMA2'));
ver('avance a la meta', t.includes('<b>52</b> de 3.000') && t.includes('1,7 %'));
const vacio = S.armarResumenSemanal({ ...base, clientesNuevos: [], prospectos: [] });
ver('sin prospectos sugiere anotar el código', vacio.includes('anota en el CRM el código'));
ver('el código se escapa (HTML)', S.armarResumenSemanal({ ...base, prospectos: [{ codigoCampana: '<x>', etapa: 'prospecto' }] }).includes('&lt;X&gt;'));

// Botones del parte: uno por cosa que atender.
const hoy = new Date(2026, 10, 24);
const parte = P.armarParte(clasificarCierre([], hoy), hoy, [], []);
const soloWeb = JSON.stringify(P.botonesParte(parte));
ver('sin nada que atender: sólo el botón de la web', soloWeb.includes('Abrir Declaraciones') && !soloWeb.includes('Cobrar'));
parte.reporte = { clavesConProblema: [{ name: 'X', ruc: '0705832137001', reason: 'Clave rechazada por el SRI' }], porCobrar: 100 };
parte.misPendientes = [{ id: 't', title: 'x', due_date: null, status: 'Pendiente' }];
const kb = JSON.stringify(P.botonesParte(parte));
ver('con claves rotas, deuda y pendientes: sus tres botones', kb.includes('baku_nav:sri_keys') && kb.includes('baku_page_debt:1') && kb.includes('baku_tarea:lista'), kb);

console.log(mal ? `\n${mal} prueba(s) MAL` : '\nTodas las pruebas del resumen semanal OK');
process.exit(mal ? 1 : 0);
