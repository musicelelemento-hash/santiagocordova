import { createClient } from '@supabase/supabase-js';
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
// El bot es un BACKEND: debe usar la llave service_role (omite RLS).
// Con la llave anon ya no funciona: las tablas quedaron restringidas a
// 'authenticated' y service_role tras el endurecimiento de seguridad.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing Supabase credentials in .env (agregar SUPABASE_SERVICE_KEY)");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
