// Compila la regla de cobro compartida (../services/annulmentBilling.ts) a
// telegram-bot/dist/services, para que el bot use EXACTAMENTE la misma lógica
// que la web sin duplicarla.
//
// Si el repo no está completo (por ejemplo un deploy que sólo sube la carpeta
// telegram-bot), el archivo no existe: avisamos y salimos con 0 para no romper
// el build. En ese caso la herramienta `consultar_cobros_pendientes` responde
// con un mensaje claro en vez de calcular mal.
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const fuente = path.resolve(raiz, '..', 'services', 'annulmentBilling.ts');
const tsc = path.resolve(raiz, 'node_modules', 'typescript', 'bin', 'tsc');

if (!existsSync(fuente)) {
    console.warn('[build:shared] No encontré ../services/annulmentBilling.ts.');
    console.warn('[build:shared] El bot seguirá compilando; la consulta de cobros pendientes quedará sin la regla compartida.');
    process.exit(0);
}

if (!existsSync(tsc)) {
    console.error('[build:shared] Falta typescript en telegram-bot/node_modules. Ejecutá npm install.');
    process.exit(1);
}

const resultado = spawnSync(process.execPath, [tsc, '-p', path.resolve(raiz, 'tsconfig.shared.json')], {
    cwd: raiz,
    stdio: 'inherit',
});

process.exit(typeof resultado.status === 'number' ? resultado.status : 1);
