// Prueba src/estado.ts (agenda de /estado): `npm test`.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
require(path.join(botDir, 'node_modules', 'ts-node')).register({ project: path.join(botDir, 'tsconfig.json'), transpileOnly: true });
const e = require(path.join(botDir, 'src', 'estado.ts'));
let mal = 0;
const ver = (n, c, d) => { if (!c) mal++; console.log(`${c ? 'OK  ' : 'MAL '} ${n}${c ? '' : ' -> ' + JSON.stringify(d)}`); };
// Hora de Ecuador = UTC-5. 2026-11-20 es viernes.
const viernes0200 = new Date('2026-11-20T07:00:00Z'); // 02:00 EC
let r = e.proximaEjecucion('30 3 * * *', viernes0200);
ver('03:30 diario desde las 02:00 → hoy 03:30 EC (08:30Z)', r === '2026-11-20T08:30:00.000Z', r);
r = e.proximaEjecucion('0 0 * * *', viernes0200);
ver('00:00 diario → mañana 00:00 EC (05:00Z)', r === '2026-11-21T05:00:00.000Z', r);
r = e.proximaEjecucion('0 9,14,18 * * 1-5', new Date('2026-11-20T20:00:00Z')); // viernes 15:00 EC
ver('Buzón: viernes 15:00 → viernes 18:00', r === '2026-11-20T23:00:00.000Z', r);
r = e.proximaEjecucion('0 9,14,18 * * 1-5', new Date('2026-11-20T23:30:00Z')); // viernes 18:30 EC
ver('Buzón: viernes 18:30 → lunes 09:00 (salta el fin de semana)', r === '2026-11-23T14:00:00.000Z', r);
r = e.proximaEjecucion('0 8 * * 1', viernes0200);
ver('Lunes 08:00 → lunes 23-nov', r === '2026-11-23T13:00:00.000Z', r);
const ag = e.agendaConFechas(viernes0200);
ver('la agenda trae las 8 tareas con próxima fecha', ag.length === 8 && ag.every((t) => t.proxima), ag);
e.registrarEjecucion('backup');
ver('registra la última ejecución', !!e.agendaConFechas().find((t) => t.id === 'backup').ultima);
ver('CORS: acepta santiagocordova.com', e.origenPermitido('https://santiagocordova.com'));
ver('CORS: rechaza otro sitio', !e.origenPermitido('https://santiagocordova.com.evil.com') && !e.origenPermitido(undefined));
console.log(mal ? `\n${mal} fallaron` : '\ntodo verde');
process.exit(mal ? 1 : 0);
