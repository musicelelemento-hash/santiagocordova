// Prueba src/pendientes.ts sin red: `npm test`. Fecha fija: domingo 22-nov-2026, 10:00 de Ecuador.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';
require(path.join(botDir, 'node_modules', 'ts-node')).register({ project: path.join(botDir, 'tsconfig.json'), transpileOnly: true });
const P = require(path.join(botDir, 'src', 'pendientes.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}
const ahora = new Date('2026-11-22T15:00:00Z'); // 10:00 en Ecuador, domingo
const ec = (iso) => { const p = P.partesEc(new Date(iso)); return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')} ${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`; };
const caso = (frase, titulo, cuando, conHora) => {
    const r = P.interpretarPendiente(frase, ahora);
    ver(`«${frase}»`, r.titulo === titulo && ec(r.venceIso) === cuando && r.conHora === conHora, { titulo: r.titulo, cuando: ec(r.venceIso), conHora: r.conHora });
};

caso('recuérdame mañana a las 10 llamar al SRI', 'Llamar al SRI', '2026-11-23 10:00', true);
caso('anota revisar la firma de Pérez', 'Revisar la firma de Pérez', '2026-11-22 23:59', false);
caso('Recuérdame llamar a 3 clientes a las 10', 'Llamar a 3 clientes', '2026-11-23 10:00', true);
caso('recuérdame a las 3 cobrar a María', 'Cobrar a María', '2026-11-22 15:00', true);
caso('recuérdame a las 9:30 am pagar el IESS', 'Pagar el IESS', '2026-11-23 09:30', true);
caso('anótame el viernes mandar comprobantes', 'Mandar comprobantes', '2026-11-27 23:59', false);
caso('recuérdame el lunes a las 8:15 declarar IVA de Gómez', 'Declarar IVA de Gómez', '2026-11-23 08:15', true);
caso('recuérdame en 20 minutos sacar el certificado', 'Sacar el certificado', '2026-11-22 10:20', true);
caso('apunta pasado mañana renovar la firma', 'Renovar la firma', '2026-11-24 23:59', false);
caso('recuérdame el 25/11 enviar el ATS', 'Enviar el ATS', '2026-11-25 23:59', false);
caso('anota el 5 pagar el arriendo', 'Pagar el arriendo', '2026-12-05 23:59', false);
caso('recuérdame esta tarde llamar a Juan', 'Llamar a Juan', '2026-11-22 15:00', true);
caso('recuérdame mañana de la mañana ir al banco', 'Ir al banco', '2026-11-23 09:00', true);
caso('Baku, recuérdame hoy a las 6 pm cerrar caja', 'Cerrar caja', '2026-11-22 18:00', true);

ver('«anota» solo no es un pedido', !P.esPedidoDeAnotar('anota'));
ver('«anota la factura» sí es pedido', P.esPedidoDeAnotar('anota la factura'));
ver('«anota el pago de Pérez» va al cobro, no a pendientes', !P.esPedidoDeAnotar('anota el pago de Pérez'));
ver('«apunta que Gómez pagó» va al cobro', !P.esPedidoDeAnotar('apunta que Gómez pagó'));
ver('«anota la declaración de Ruiz» va a declaraciones', !P.esPedidoDeAnotar('anota la declaración de Ruiz'));
ver('«recuérdame pagar el IESS» sí es recordatorio', P.esPedidoDeAnotar('recuérdame pagar el IESS'));
ver('una pregunta normal no es pedido', !P.esPedidoDeAnotar('¿cuánto me deben?'));
ver('«recuérdame» con tilde y sin tilde', P.esPedidoDeAnotar('recuerdame llamar') && P.esPedidoDeAnotar('Recuérdame llamar'));

// Sin hora = 23:59; con hora no.
ver('sin hora se reconoce', !P.tieneHora('2026-11-23T04:59:00.000Z'));
ver('con hora se reconoce', P.tieneHora('2026-11-23T15:00:00.000Z'));

// Avisos: sólo los con hora, dentro de la ventana, abiertos.
const filas = [
    { id: 'a', title: 'A', due_date: '2026-11-22T15:01:00.000Z', status: 'Pendiente' },
    { id: 'b', title: 'B', due_date: '2026-11-23T04:59:00.000Z', status: 'Pendiente' }, // sin hora
    { id: 'c', title: 'C', due_date: '2026-11-22T15:01:30.000Z', status: 'Completada' },
    { id: 'd', title: 'D', due_date: '2026-11-22T14:00:00.000Z', status: 'Pendiente' }, // antes de la ventana
];
const toca = P.tocaAvisar(filas, ahora, new Date(ahora.getTime() + 120000)).map((f) => f.id);
ver('avisa sólo al que tiene hora y le tocó', JSON.stringify(toca) === '["a"]', toca);

// Parte del día: hoy y vencidos, no los de mañana.
const hoy = P.pendientesDeHoy([
    { id: '1', title: 'vencido', due_date: '2026-11-20T15:00:00.000Z', status: 'Pendiente' },
    { id: '2', title: 'hoy sin hora', due_date: '2026-11-23T04:59:00.000Z', status: 'Pendiente' },
    { id: '3', title: 'mañana', due_date: '2026-11-23T15:00:00.000Z', status: 'Pendiente' },
], ahora).map((f) => f.id);
ver('pendientes de hoy: vencidos + hoy', JSON.stringify(hoy) === '["1","2"]', hoy);

ver('texto «mañana 10:00»', P.textoCuando('2026-11-23T15:00:00.000Z', ahora) === 'mañana 10:00', P.textoCuando('2026-11-23T15:00:00.000Z', ahora));
ver('texto «hoy» sin hora', P.textoCuando('2026-11-23T04:59:00.000Z', ahora) === 'hoy');
ver('texto vencido', P.textoCuando('2026-11-20T15:00:00.000Z', ahora).startsWith('vencido'));
ver('posponer 1 h', P.nuevaFecha('1h', null, ahora) === '2026-11-22T16:00:00.000Z');
ver('posponer a mañana con hora = 09:00', ec(P.nuevaFecha('manana', '2026-11-22T15:00:00.000Z', ahora)) === '2026-11-23 09:00');
ver('posponer a mañana sin hora sigue sin hora', ec(P.nuevaFecha('manana', '2026-11-23T04:59:00.000Z', ahora)) === '2026-11-23 23:59');
ver('el título se escapa (HTML)', P.textoRecordatorio({ id: 'x', title: '<b>', due_date: null, status: 'Pendiente' }).includes('&lt;b&gt;'));
ver('callback cabe en 64 bytes', `baku_tarea:manana:${'0'.repeat(36)}`.length <= 64);

console.log(mal ? `\n${mal} prueba(s) MAL` : '\nTodas las pruebas de pendientes OK');
process.exit(mal ? 1 : 0);
