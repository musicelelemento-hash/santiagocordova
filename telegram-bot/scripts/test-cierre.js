// Prueba src/cierre.ts con clientes inventados y fecha fija, sin red: `npm test`.
// Cuida que cobrar y declarar no se confundan: un período 'Pagada' sin comprobante
// NO cuenta como declarado, y nadie que deba declarar se cae de la lista.
const path = require('path');
const botDir = path.resolve(__dirname, '..');

process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';

require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});

const m = require(path.join(botDir, 'src', 'cierre.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const pdf = { url: 'https://r2.example/comprobante.pdf' };
const C = (ruc, name, extra = {}) => ({ ruc, name, regime: 'Régimen General', is_deleted: false, sri_declaraciones: [], ...extra });
const D = (period, extra = {}) => ({ type: 'IVA', period, status: 'Pendiente', is_paid: false, ...extra });

// El noveno dígito del RUC (posición 8) fija el día de vencimiento: 1→10, 4→16, 0→28…
const clientes = [
    C('0700000010001', 'A OK', { sri_declaraciones: [D('2026-10', { status: 'Pagada', is_paid: true, proof_file: pdf })] }),
    C('0700000020001', 'B COBRAR', { fee_structure: { monthly: 8 }, sri_declaraciones: [D('2026-10', { status: 'Enviada', proof_file: pdf })] }),
    C('0700000010002', 'C PAGADA SIN COMPROBANTE', { sri_declaraciones: [D('2026-10', { status: 'Pagada', is_paid: true })] }),
    C('0700000010003', 'D PEND VENCIDO'),
    C('0700000000004', 'E PEND'),
    C('0700000030001', 'F <ENVIADA> & CO', { sri_declaraciones: [D('2026-10', { status: 'Enviada' })] }),
    C('0700000040001', 'G FRENO', { sri_declaraciones: [D('2026-10', { status: 'por_pagar' })] }),
    C('0700000050001', 'I SEM OK', { regime: 'Rimpe Emprendedor', sri_declaraciones: [D('2026-S1', { status: 'Pagada', is_paid: true, proof_file: pdf })] }),
    C('0700000000005', 'J SEM PEND', { regime: 'Rimpe Emprendedor' }),
    C('0700000060001', 'K NUEVO', { tax_profile: { clientStartPeriod: '2026-11' } }),
    C('0700000070001', 'L OTRO MES', { sri_declaraciones: [D('2026-09', { status: 'Pagada', is_paid: true, proof_file: pdf })] }),
    C('0700000080001', 'M FRAGMENTO', { sri_declaraciones: [D('2026-10', { status: 'Pagada', is_paid: true, proof_file: { content: 'abc'.repeat(10) } })] }),
    C('0700000090001', 'N HISTORIAL', { declaration_history: [{ period: '2026-10', status: 'Realizada', pdfUrl: 'https://x/y.pdf', is_paid: true }] }),
    C('0700000010009', 'O RENTA', { sri_declaraciones: [{ type: 'RENTA', period: '2026-10', status: 'Pagada', is_paid: true, proof_file: pdf }] }),
    C('0700000020009', 'P EMBEBIDO', { sri_declaraciones: [D('2026-10', { status: 'Enviada', proof_file: { content: 'JVBERi0' + 'A'.repeat(300) } })] }),
    // Los que NO deben aparecer:
    C('0700000010010', 'X POPULAR', { regime: 'Rimpe Negocio Popular' }),
    C('0700000010011', 'X SOLO PLAN', { tax_profile: { clientType: 'solo_plan' } }),
    C('0700000010012', 'X SOLO FIRMA', { tax_profile: { isSignatureOnly: true } }),
    C('0700000010013', 'X SIN DECLARACIONES', { tax_profile: { requiresDeclarations: false } }),
    C('0700000010014', 'X INACTIVO', { is_active: false }),
    C('0700000010015', 'X BORRADO', { is_deleted: true }),
    null,
];

(async () => {
    const hoy = new Date(2026, 10, 13); // 13 de noviembre de 2026
    const cierre = m.clasificarCierre(clientes, hoy);
    const de = (nombre) => cierre.filas.find(f => f.name === nombre);
    const q = (nombre) => (de(nombre) || {}).cuadrante;

    ver('período mensual = mes anterior', cierre.mensual === '2026-10' && cierre.semestral === '2026-S1', cierre);
    ver('entran 14, 1 no aplica, ningún excluido', cierre.filas.length === 14 && cierre.noAplica === 1 && !cierre.filas.some(f => f.name.startsWith('X ')),
        { n: cierre.filas.length, noAplica: cierre.noAplica });

    ver('comprobante + cobrado = al día', q('A OK') === 'ok');
    ver('declarado sin cobrar, con su honorario', q('B COBRAR') === 'cobrar' && de('B COBRAR').honorario === 8);
    ver("'Pagada' sin comprobante NO es declarado", q('C PAGADA SIN COMPROBANTE') === 'verificar' && de('C PAGADA SIN COMPROBANTE').vencido === true, de('C PAGADA SIN COMPROBANTE'));
    ver('sin fila = pendiente, y vencido si pasó su día', q('D PEND VENCIDO') === 'pendiente' && de('D PEND VENCIDO').vencido === true && de('D PEND VENCIDO').dueDay === 10);
    ver('pendiente que todavía no vence', q('E PEND') === 'pendiente' && de('E PEND').vencido === false && de('E PEND').dueDay === 28);
    ver('enviada sin comprobante: se cobra, y se avisa', q('F <ENVIADA> & CO') === 'cobrar' && de('F <ENVIADA> & CO').sinComprobante === true && de('F <ENVIADA> & CO').honorario === 5);
    ver('la extensión frenó: pendiente con el motivo', q('G FRENO') === 'pendiente' && de('G FRENO').aviso === 'saldo a pagar', de('G FRENO'));
    ver('semestral al día contra su semestre', q('I SEM OK') === 'ok' && de('I SEM OK').periodo === '2026-S1');
    ver('semestral sin declarar en noviembre ya venció', q('J SEM PEND') === 'pendiente' && de('J SEM PEND').vencido === true && de('J SEM PEND').honorario === 10);
    ver('declarar otro mes no cubre éste', q('L OTRO MES') === 'pendiente');
    ver('un fragmento no es un comprobante', q('M FRAGMENTO') === 'verificar');
    ver('el historial del cliente también cuenta', q('N HISTORIAL') === 'ok');
    ver('una RENTA no tapa al IVA', q('O RENTA') === 'pendiente');
    ver('PDF embebido cuenta como comprobante', q('P EMBEBIDO') === 'cobrar' && de('P EMBEBIDO').sinComprobante === false);

    const orden = (c) => m.filasDe(cierre, c).map(f => f.name[0]).join('');
    ver('pendientes: vencidos primero, por día', orden('pendiente') === 'DOJGLE', orden('pendiente'));
    ver('por cobrar: el mayor honorario primero', orden('cobrar') === 'BFP', orden('cobrar'));

    const resumen = m.textoResumen(cierre);
    ver('resumen con los cuatro números', /Al día[^\n]*<b>3<\/b>/.test(resumen) && /sin cobrar: <b>3<\/b> · <b>\$18\.00<\/b>/.test(resumen)
        && /sin comprobante: <b>2<\/b>/.test(resumen) && /ni cobrar: <b>6<\/b> · 🔴 3 vencidos/.test(resumen), resumen);
    ver('resumen avisa las declaradas sin comprobante', resumen.includes('🧾 1 de las declaradas sin cobrar'), resumen);

    const lc = m.textoLista(cierre, 'cobrar', 1).texto;
    ver('lista escapa HTML de los nombres', lc.includes('F &lt;ENVIADA&gt; &amp; CO') && !lc.includes('<ENVIADA>'), lc);
    ver('lista de cobro: monto y falta de comprobante', lc.includes('$18.00') && lc.includes('🧾 sin comprobante') && lc.includes('<code>0700000020001</code>'), lc);
    const lp = m.textoLista(cierre, 'pendiente', 1).texto;
    ver('lista de pendientes: vencimiento y motivo', lp.includes('vence 10 🔴') && lp.includes('🛑 saldo a pagar') && lp.includes('vence 28'), lp);
    ver('lista a verificar explica qué hacer', m.textoLista(cierre, 'verificar', 1).texto.includes('no hay comprobante que pruebe la declaración'));

    const muchos = Array.from({ length: 20 }, (_, i) => C(`07000000${i % 10}0${String(100 + i)}`, `Z${i}`));
    const cm = m.clasificarCierre(muchos, hoy);
    const pag = m.textoLista(cm, 'pendiente', 99);
    ver('paginado: 20 en 3 páginas, y no se pasa de la última', pag.paginas === 3 && pag.pagina === 3 && pag.items.length === 4, { p: pag.pagina, de: pag.paginas, n: pag.items.length });

    ver('enero: se cierra diciembre y el 2do semestre', JSON.stringify(m.periodosActivos(new Date(2027, 0, 5))) === JSON.stringify({ mensual: '2026-12', semestral: '2026-S2' }));
    const julio = m.clasificarCierre([C('0700000000005', 'J SEM PEND', { regime: 'Rimpe Emprendedor' })], new Date(2026, 6, 10));
    ver('julio: el semestral todavía está en plazo', julio.semestral === '2026-S1' && julio.filas[0].vencido === false, julio);

    ver('un botón ajeno no es del cierre', (await m.manejarCallbackCierre({}, 'baku_otro:x')) === false);

    console.log(mal ? `${mal} fallaron` : 'todo verde');
    process.exit(mal ? 1 : 0);
})().catch(e => { console.error('REVENTÓ:', e); process.exit(2); });
