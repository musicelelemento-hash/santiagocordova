// Prueba src/parte_diario.ts con clientes inventados y fechas fijas, sin red: `npm test`.
// Cuida que el parte ponga a cada cliente en el grupo correcto (vence hoy, mañana,
// esta semana, vencido), que respete el traslado por fin de semana y feriado, y que
// no mezcle «falta el comprobante» con «falta avisar por WhatsApp».
const path = require('path');
const botDir = path.resolve(__dirname, '..');

process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = 'prueba';

require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});

const { clasificarCierre } = require(path.join(botDir, 'src', 'cierre.ts'));
const P = require(path.join(botDir, 'src', 'parte_diario.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

const pdf = { url: 'https://r2.example/comprobante.pdf' };
// El 9.º dígito (posición 8) fija el día: 8→24, 9→26, 0→28, 7→22.
const C = (dig, name, extra = {}) => ({ ruc: `07000000${dig}0001`, name, regime: 'Régimen General', is_deleted: false, sri_declaraciones: [], ...extra });
const D = (period, extra = {}) => ({ type: 'IVA', period, status: 'Pendiente', is_paid: false, ...extra });

const clientes = [
    C('8', 'VENCE 24'),                                                     // nov-2026: martes 24
    C('9', 'VENCE 26'),                                                     // jueves 26
    C('0', 'VENCE 28'),                                                     // sábado 28 → lunes 30
    C('7', 'VENCE 22'),                                                     // domingo 22 → lunes 23
    C('1', 'SIN PDF', { sri_declaraciones: [D('2026-10', { status: 'Enviada' })] }),
    C('2', 'SIN AVISO', { sri_declaraciones: [D('2026-10', { status: 'Enviada', proof_file: pdf })] }),
    C('3', 'AVISADO', {
        sri_declaraciones: [D('2026-10', { status: 'Pagada', is_paid: true, proof_file: pdf })],
        declaration_history: [{ period: '2026-10', type: 'IVA', status: 'Pagada', isNotifiedWhatsApp: true }],
    }),
];

const firmas = [
    { name: 'FIRMA 3', ruc: '0700000030001', daysRemaining: 3 },
    { name: 'FIRMA 40', ruc: '0700000040001', daysRemaining: 40 },
    { name: 'FIRMA ?', ruc: '0700000050001', daysRemaining: null },
];

const nombres = (xs) => xs.map((x) => x.name).sort();

// Martes 24-nov-2026
{
    const hoy = new Date(2026, 10, 24);
    const p = P.armarParte(clasificarCierre(clientes, hoy), hoy, [], firmas);
    ver('martes 24: vence hoy el dígito 8', JSON.stringify(nombres(p.vencenHoy)) === JSON.stringify(['VENCE 24']), nombres(p.vencenHoy));
    ver('martes 24: mañana nadie', p.manana.length === 0, nombres(p.manana));
    ver('martes 24: semana = 26 y 28 (trasladado al lunes 30)', JSON.stringify(nombres(p.semana)) === JSON.stringify(['VENCE 26', 'VENCE 28']), p.semana);
    ver('martes 24: el 28 cae sábado y se traslada al 30', p.semana.find((i) => i.name === 'VENCE 28')?.fecha === '2026-11-30', p.semana);
    ver('martes 24: vencido el dígito 7 (domingo 22 → lunes 23)', JSON.stringify(nombres(p.vencidos)) === JSON.stringify(['VENCE 22']), p.vencidos);
    ver('declarado sin PDF va a «sin comprobante», no a «sin avisar»', JSON.stringify(nombres(p.sinComprobante)) === JSON.stringify(['SIN PDF']), nombres(p.sinComprobante));
    ver('declarado con PDF sin avisar va a «falta WhatsApp»', JSON.stringify(nombres(p.sinAvisar)) === JSON.stringify(['SIN AVISO']), nombres(p.sinAvisar));
    ver('el avisado por WhatsApp no aparece en ningún grupo', ![...p.sinAvisar, ...p.sinComprobante].some((f) => f.name === 'AVISADO'));
    ver('firmas: sólo la que vence en ≤15 días', JSON.stringify(p.firmas.map((f) => f.name)) === JSON.stringify(['FIRMA 3']), p.firmas);
    const t = P.textoParte(p, hoy);
    ver('el texto trae «Vencen HOY» y la nota de feriados', t.includes('Vencen HOY') && t.includes('FERIADOS_EC'), t);
    ver('recordatorio de la tarde se envía (algo vence hoy)', (P.textoTarde(p) || '').includes('VENCE 24'));
}

// Miércoles 25-nov-2026, con feriado inventado el jueves 26
{
    const hoy = new Date(2026, 10, 25);
    const sinFeriado = P.armarParte(clasificarCierre(clientes, hoy), hoy, [], []);
    ver('miércoles 25: mañana vence el dígito 9', JSON.stringify(nombres(sinFeriado.manana)) === JSON.stringify(['VENCE 26']), sinFeriado.manana);
    ver('miércoles 25: la tarde no molesta (nada vence hoy)', P.textoTarde(sinFeriado) === null);
    const conFeriado = P.armarParte(clasificarCierre(clientes, hoy), hoy, ['2026-11-26'], []);
    ver('con feriado el 26, el dígito 9 pasa al viernes 27', conFeriado.manana.length === 0 && conFeriado.semana.find((i) => i.name === 'VENCE 26')?.fecha === '2026-11-27', conFeriado.semana);
    ver('con feriados cargados no aparece la nota de FERIADOS_EC', !P.textoParte(conFeriado, hoy).includes('FERIADOS_EC'));
}

// Todo al día
{
    const hoy = new Date(2026, 10, 24);
    const p = P.armarParte(clasificarCierre([clientes[6]], hoy), hoy, [], []);
    ver('sin pendientes dice «Todo al día»', P.textoParte(p, hoy).includes('Todo al día'));
}

ver('FERIADOS_EC ignora valores mal escritos', JSON.stringify(P.feriadosConfigurados(' 2026-12-25, 25/12/2026 ,2027-01-01')) === JSON.stringify(['2026-12-25', '2027-01-01']));

{
    // Errores de la web: agrupa mensajes repetidos y sólo aparece si hay alguno.
    const hoy = new Date(2026, 10, 24);
    const r = P.resumirErroresWeb([{ message: 'A falla' }, { message: 'A falla' }, { message: 'B falla' }, { message: null }]);
    ver('errores web: cuenta todos y lista los distintos', r.total === 4 && JSON.stringify(r.mensajes) === JSON.stringify(['A falla', 'B falla']), r);
    const p = P.armarParte(clasificarCierre([clientes[6]], hoy), hoy, [], []);
    ver('sin errores web no aparece el bloque', !P.textoParte(p, hoy).includes('La web anotó'));
    p.erroresWeb = r;
    const t = P.textoParte(p, hoy);
    ver('con errores web aparece el bloque y ya no dice «Todo al día»', t.includes('La web anotó 4 errores') && !t.includes('Todo al día'), t);
    p.erroresWeb = { total: 1, mensajes: ['<script>'] };
    ver('el mensaje del error se escapa (HTML de Telegram)', P.textoParte(p, hoy).includes('&lt;script&gt;'));
}

console.log(mal ? `\n${mal} prueba(s) MAL` : '\nTodas las pruebas del parte diario OK');
process.exit(mal ? 1 : 0);
