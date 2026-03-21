const fs = require('fs');
const path = require('path');

const directory = './';
const ext = ['.ts', '.tsx'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git') && !file.includes('respaldo') && !file.includes('GestionesTributariasPRO-main') && !file.includes('santiagocordova-main')) {
                results = results.concat(walk(file));
            }
        } else { 
            if (ext.some(e => file.endsWith(e))) results.push(file);
        }
    });
    return results;
}

const files = walk(directory);
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // fix property accesses
    content = content.replace(/\.isPaid/g, '.is_paid');
    content = content.replace(/isPaid:/g, 'is_paid:');
    content = content.replace(/\bconst \{([\s\S]*?)isPaid([\s\S]*?)\} =/g, 'const {$1is_paid$2} =');

    content = content.replace(/\.proofFile/g, '.proof_file');
    content = content.replace(/proofFile:/g, 'proof_file:');
    content = content.replace(/\bconst \{([\s\S]*?)proofFile([\s\S]*?)\} =/g, 'const {$1proof_file$2} =');

    content = content.replace(/\.feeStructure/g, '.fee_structure');
    content = content.replace(/feeStructure/g, 'fee_structure'); // replace any remaining feeStructure

    content = content.replace(/declarationHistory/g, 'declarations');

    content = content.replace(/\bisVip\s*:\s*(true|false|db\.is_vip)/g, ''); // just remove assignments inside object literals
    content = content.replace(/\bis_vip\s*:\s*client\.isVip/g, 'is_vip: true'); // special case

    // Remove isVip completely from destructuring
    content = content.replace(/isVip\s*,/g, '');
    content = content.replace(/,\s*isVip\b/g, '');
    content = content.replace(/\{\s*isVip\s*\}/g, '{}');

    // Fix the !!undefined problem that I introduced
    content = content.replace(/!!undefined/g, 'false');

    // Fix remaining occurrences of isVip as a standalone word
    content = content.replace(/\bisVip\b/g, 'true');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
        console.log('Fixed', file);
    }
});

console.log(`Done. Changed ${changedCount} files.`);
