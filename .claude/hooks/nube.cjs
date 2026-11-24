// SessionStart: en la nube (claude.ai/code) instala dependencias de la web y de Baku.
// En local no hace nada: CLAUDE_CODE_REMOTE solo existe en la nube.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

const raiz = path.resolve(__dirname, '..', '..');
const lineas = [];
for (const d of ['.', 'telegram-bot']) {
  const dir = path.join(raiz, d);
  if (!fs.existsSync(path.join(dir, 'package.json'))) continue;
  if (fs.existsSync(path.join(dir, 'node_modules'))) { lineas.push(`ok: ${d} (ya instalado)`); continue; }
  let r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8', timeout: 8 * 60 * 1000 });
  if (r.status !== 0) r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8', timeout: 8 * 60 * 1000 });
  lineas.push(r.status === 0 ? `ok: ${d}` : `FALLO npm en ${d}: ${(r.stderr || '').slice(-300)}`);
}
if (!fs.existsSync(path.join(raiz, '.env.local'))) {
  lineas.push('AVISO: no hay .env.local (normal en la nube). Nombres en docs/VARIABLES_ENTORNO.md; se cargan como variables del entorno.');
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: 'Sesion en la nube, preparacion automatica:\n' + lineas.join('\n') +
      '\nLa extension Nueva Luz vive en otro repo (musicelelemento-hash/santiagocordova.com).',
  },
}));
