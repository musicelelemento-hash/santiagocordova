// Prueba las consultas livianas de database_ops.ts sin red: `npm test`.
// marcarComprobantes() reemplaza bajar el PDF entero por una marca: tiene que
// dar el mismo «¿hay comprobante?» que `!!d.proof_file` daba antes.
const path = require('path');
const botDir = path.resolve(__dirname, '..');
require(path.join(botDir, 'node_modules', 'ts-node')).register({
    project: path.join(botDir, 'tsconfig.json'),
    transpileOnly: true,
});

// Supabase falso: 1.150 declaraciones con comprobante (las de id par hasta 2.300):
// obliga a paginar de a 1.000.
const conProof = new Set();
for (let i = 1; i <= 2300; i++) if (i % 2 === 0) conProof.add(String(i));
const pedidos = [];
const supabaseFalso = {
    from(tabla) {
        const q = { tabla, filtros: [], rango: null };
        const b = {
            select() { return b; },
            not(col, op, val) { q.filtros.push(['not', col, op, val]); return b; },
            neq(col, val) { q.filtros.push(['neq', col, val]); return b; },
            range(a, z) {
                q.rango = [a, z];
                pedidos.push(q);
                const ids = [...conProof].sort((x, y) => x - y).slice(a, z + 1);
                return Promise.resolve({ data: ids.map((id) => ({ id })), error: null });
            },
        };
        return b;
    },
};
const rutaSupabase = require.resolve(path.join(botDir, 'src', 'supabase.ts'));
require.cache[rutaSupabase] = { id: rutaSupabase, filename: rutaSupabase, loaded: true, exports: { supabase: supabaseFalso } };

const ops = require(path.join(botDir, 'src', 'database_ops.ts'));

let mal = 0;
function ver(nombre, cond, detalle) {
    if (!cond) mal++;
    console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${cond ? '' : ' -> ' + JSON.stringify(detalle)}`);
}

(async () => {
    const clientes = [
        { ruc: 'A', sri_declaraciones: [{ id: 4 }, { id: 3 }, { id: 2298 }] },
        { ruc: 'B', sri_declaraciones: [{ id: 2299 }] },
        { ruc: 'C', sri_declaraciones: [] },
        { ruc: 'D' },
    ];
    await ops.marcarComprobantes(clientes);
    const marca = (c, i) => !!clientes[c].sri_declaraciones[i].proof_file;
    ver('id 4 tiene comprobante', marca(0, 0) === true);
    ver('id 3 no tiene', marca(0, 1) === false);
    ver('id 2298 (segunda página) tiene', marca(0, 2) === true);
    ver('id 2299 no tiene', marca(1, 0) === false);
    ver('pagina hasta traer todo (2 pedidos)', pedidos.length === 2 && pedidos[1].rango[0] === 1000, pedidos.map((p) => p.rango));
    ver('filtra en la base, no baja los PDF', pedidos.every((p) => p.filtros.some((f) => f[0] === 'not' && f[1] === 'proof_file' && f[2] === 'is')));
    ver('no usa neq sobre jsonb (rompería)', pedidos.every((p) => !p.filtros.some((f) => f[0] === 'neq')));
    ver('cliente sin declaraciones no rompe', Array.isArray(clientes[2].sri_declaraciones) && !('sri_declaraciones' in clientes[3]));

    ver('cortesía: honorarios en 0', ops.esClienteCortesia({ fee_structure: { monthly: 0, semestral: 0, annual: 0 } }) === true);
    ver('cortesía: custom_service_fee 0', ops.esClienteCortesia({ custom_service_fee: 0 }) === true);
    ver('cortesía: nota «familia»', ops.esClienteCortesia({ notes: 'Tío, es familia' }) === true);
    ver('cliente normal no es cortesía', ops.esClienteCortesia({ fee_structure: { monthly: 5 }, notes: 'paga puntual' }) === false);
    ver('SELECT liviano no pide archivos', !/declaration_history|vault|proof_file|ruc_certificate|signature_file|_proof\b/.test(ops.SELECT_CLIENTES_LIGERO), ops.SELECT_CLIENTES_LIGERO);

    console.log(mal ? `\n${mal} fallaron` : '\ntodo verde');
    process.exit(mal ? 1 : 0);
})();
