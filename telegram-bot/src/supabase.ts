import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
require('dotenv').config();

// Intento de fallback automático si falta en telegram-bot/.env pero existe en la app web
let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    try {
        const localEnvPath = path.resolve(__dirname, '../../.env.local');
        if (fs.existsSync(localEnvPath)) {
            const content = fs.readFileSync(localEnvPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('VITE_SUPABASE_URL=') && !supabaseUrl) {
                    supabaseUrl = trimmed.split('=')[1].replace(/['"]/g, '').trim();
                }
                if ((trimmed.startsWith('VITE_SUPABASE_ANON_KEY=') || trimmed.startsWith('SUPABASE_SERVICE_KEY=')) && !supabaseKey) {
                    supabaseKey = trimmed.split('=')[1].replace(/['"]/g, '').trim();
                }
            }
        }
    } catch (e) {
        // Silencioso en entornos donde no existe el archivo local
    }
}

if (!supabaseUrl || !supabaseKey) {
    console.error("⚠️ ADVERTENCIA: Credenciales de Supabase no encontradas en .env ni .env.local.");
    // Fallback defensivo para que el módulo cargue sin tumbar todo el proceso
    supabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
    supabaseKey = supabaseKey || 'placeholder-key';
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

