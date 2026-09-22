import { supabase } from '../src/supabase';

async function checkClients() {
    console.log("🔍 Buscando Andrade Malla y Ramirez Alvarado...");
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, ruc, regime, tax_profile, declaration_history, fee_structure, notes, sri_declaraciones(*)')
        .or('name.ilike.%ANDRADE MALLA%,name.ilike.%RAMIREZ ALVARADO%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    for (const c of (clients || [])) {
        console.log(`\n================================`);
        console.log(`👤 ${c.name} (${c.ruc})`);
        console.log(`Régimen: ${c.regime}`);
        console.log(`tax_profile:`, JSON.stringify(c.tax_profile, null, 2));
        console.log(`notes:`, c.notes);
        console.log(`fee_structure:`, c.fee_structure);
        console.log(`Declaraciones en sri_declaraciones:`, (c.sri_declaraciones || []).map((d: any) => ({ period: d.period, type: d.type, status: d.status, is_paid: d.is_paid, fee: d.fee })));
        console.log(`Declaraciones en declaration_history:`, (c.declaration_history || []).map((d: any) => ({ period: d.period, type: d.type, status: d.status, is_paid: d.is_paid, fee: d.fee })));
    }
}

checkClients().catch(console.error);
