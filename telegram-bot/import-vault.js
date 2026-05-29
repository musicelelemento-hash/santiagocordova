/**
 * import-vault.js
 * 
 * Lee el CSV de Chrome, filtra SOLO claves del SRI,
 * cruza con SRI_RUC_El_Oro.csv para obtener nombres,
 * y sube todo a Supabase en la tabla `sri_vault`.
 * 
 * Uso: node import-vault.js <ruta_al_chrome_csv>
 * Ejemplo: node import-vault.js "C:\Users\Santiago\...\Contraseñas de Chrome.csv"
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY en .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Rutas ---
const chromeCsvPath = process.argv[2] || path.join(__dirname, '..', 'Contraseñas de Chrome.csv');
const sriCsvPath = process.argv[3] || path.join(__dirname, '..', 'SRI_RUC_El_Oro.csv');

async function main() {
    console.log('🔍 Leyendo CSV de Chrome...');
    
    if (!fs.existsSync(chromeCsvPath)) {
        console.error(`❌ No se encontró el archivo: ${chromeCsvPath}`);
        process.exit(1);
    }

    const chromeContent = fs.readFileSync(chromeCsvPath, 'utf8');
    const chromeLines = chromeContent.split('\n').slice(1); // skip header

    // Filtrar solo filas del SRI (url contiene sri.gob.ec)
    const sriRows = [];
    for (const line of chromeLines) {
        if (!line.trim()) continue;
        // parse CSV respetando comillas
        const parts = parseCsvLine(line);
        if (!parts || parts.length < 4) continue;
        const [name, url, username, password] = parts;
        if (!url || !url.includes('sri.gob.ec')) continue;
        const ruc = username?.trim();
        const clave = password?.trim();
        if (!ruc || !clave || ruc.length < 10) continue;
        sriRows.push({ ruc, clave });
    }

    console.log(`✅ Encontradas ${sriRows.length} claves SRI en el CSV de Chrome`);

    // Cargar índice de nombres desde SRI_RUC_El_Oro.csv si existe
    const nameIndex = {};
    if (fs.existsSync(sriCsvPath)) {
        console.log('📖 Cargando índice de nombres desde SRI_RUC_El_Oro.csv...');
        const sriContent = fs.readFileSync(sriCsvPath, 'utf8');
        const sriLines = sriContent.split('\n').slice(1);
        for (const line of sriLines) {
            if (!line.trim()) continue;
            const parts = line.split('|');
            const ruc = parts[0]?.trim();
            const razon = parts[1]?.trim();
            if (ruc && razon) nameIndex[ruc] = razon;
        }
        console.log(`✅ Índice de nombres cargado: ${Object.keys(nameIndex).length} RUCs`);
    } else {
        console.warn('⚠️  SRI_RUC_El_Oro.csv no encontrado, los nombres quedarán vacíos');
    }

    // Construir registros para Supabase
    const records = sriRows.map(({ ruc, clave }) => ({
        ruc,
        nombre: nameIndex[ruc] || null,
        sri_password: clave,
        updated_at: new Date().toISOString()
    }));

    // Subir en lotes de 500
    const BATCH_SIZE = 500;
    let uploaded = 0;
    let errors = 0;

    console.log(`\n🚀 Subiendo ${records.length} registros a Supabase (tabla sri_vault)...`);

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('sri_vault')
            .upsert(batch, { onConflict: 'ruc' });

        if (error) {
            console.error(`❌ Error en lote ${i}-${i + BATCH_SIZE}:`, error.message);
            errors += batch.length;
        } else {
            uploaded += batch.length;
            process.stdout.write(`\r   ✅ ${uploaded}/${records.length} subidos...`);
        }
    }

    console.log(`\n\n🎉 Importación completa:`);
    console.log(`   ✅ ${uploaded} registros subidos exitosamente`);
    if (errors > 0) console.log(`   ❌ ${errors} errores`);
    console.log(`\nAhora el bot puede buscar claves por nombre en la bóveda. Baku.`);
}

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

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
