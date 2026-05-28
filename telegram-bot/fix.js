const fs = require('fs');
let code = fs.readFileSync('src/database_ops.ts', 'utf8');

// Fix the select query
code = code.replace(/\.select\('.*?, declarations'\)/g, '.select(\'*\')');
code = code.replace(/\.select\('id, name, declarations'\)/g, '.select(\'id, name, declaration_history\')');

// Fix the table update/insert queries
code = code.replace(/supabase\.from\('declarations'\)\.update/g, '/* FIXME: Manual update needed */');

// Replace property accesses
code = code.replace(/c\.declarations/g, 'c.declaration_history');
code = code.replace(/client\.declarations/g, 'client.declaration_history');

fs.writeFileSync('src/database_ops.ts', code);
console.log('Done!');
