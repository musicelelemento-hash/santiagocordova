/**
 * setup-vault.js
 * Crea la tabla sri_vault en Supabase y la pobla con las claves del CSV de Chrome.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Faltan variables SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const chromeCsvPath = process.argv[2] || path.join(__dirname, '..', 'Contraseñas de Chrome.csv');
const sriCsvPath = path.join(__dirname, '..', 'SRI_RUC_El_Oro.csv');

/** Parsea una línea CSV respetando campos entre comillas */
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

async function main() {
    // 1. Cargar índice de nombres desde SRI_RUC_El_Oro.csv
    console.log('📖 Cargando índice de nombres...');
    const nameIndex = {};
    if (fs.existsSync(sriCsvPath)) {
        const sriLines = fs.readFileSync(sriCsvPath, 'utf8').split('\n').slice(1);
        for (const line of sriLines) {
            if (!line.trim()) continue;
            const parts = line.split('|');
            const ruc = parts[0]?.trim();
            const razon = parts[1]?.trim();
            if (ruc && razon) nameIndex[ruc] = razon;
        }
        console.log(`   ✅ ${Object.keys(nameIndex).length} nombres cargados`);
    } else {
        console.warn('   ⚠️  SRI_RUC_El_Oro.csv no encontrado, nombres quedarán vacíos');
    }

    // 2. Leer CSV de Chrome y filtrar solo SRI
    console.log('\n🔍 Leyendo CSV de Chrome...');
    const chromeLines = fs.readFileSync(chromeCsvPath, 'utf8').split('\n').slice(1);
    
    const records = [];
    const seen = new Set();
    
    for (const line of chromeLines) {
        if (!line.trim()) continue;
        const parts = parseCsvLine(line);
        if (!parts || parts.length < 4) continue;
        const [, url, username, password] = parts;
        if (!url || !url.includes('sri.gob.ec')) continue;
        const ruc = username?.trim().replace(/\r/g, '');
        const clave = password?.trim().replace(/\r/g, '');
        if (!ruc || !clave || ruc.length < 10 || seen.has(ruc)) continue;
        seen.add(ruc);
        records.push({
            ruc,
            nombre: nameIndex[ruc] || null,
            sri_password: clave,
            updated_at: new Date().toISOString()
        });
    }

    console.log(`   ✅ ${records.length} claves SRI únicas encontradas`);
    const conNombre = records.filter(r => r.nombre).length;
    console.log(`   📋 Con nombre: ${conNombre} | Sin nombre: ${records.length - conNombre}`);

    // 3. Subir en lotes
    const BATCH_SIZE = 300;
    let uploaded = 0;
    let errorCount = 0;

    console.log(`\n🚀 Subiendo a Supabase tabla 'sri_vault'...`);

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('sri_vault')
            .upsert(batch, { onConflict: 'ruc' });

        if (error) {
            if (error.message.includes("does not exist")) {
                console.error('\n❌ La tabla sri_vault no existe en Supabase.');
                console.error('   Crea la tabla manualmente con este SQL en el Dashboard de Supabase:');
                console.error(`
CREATE TABLE IF NOT EXISTS public.sri_vault (
  ruc TEXT PRIMARY KEY,
  nombre TEXT,
  sri_password TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sri_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON public.sri_vault FOR SELECT USING (true);
CREATE POLICY "anon_write" ON public.sri_vault FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON public.sri_vault FOR UPDATE USING (true);
                `);
                process.exit(1);
            }
            console.error(`\n❌ Error lote ${i}: ${error.message}`);
            errorCount += batch.length;
        } else {
            uploaded += batch.length;
            process.stdout.write(`\r   ✅ ${uploaded}/${records.length}...`);
        }
    }

    console.log(`\n\n🎉 ¡Importación completa!`);
    console.log(`   ✅ ${uploaded} claves SRI subidas`);
    if (errorCount > 0) console.log(`   ❌ ${errorCount} errores`);
    console.log(`\n   Ahora corre: node search-test.js "ayala" para probar. Baku.`);
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
