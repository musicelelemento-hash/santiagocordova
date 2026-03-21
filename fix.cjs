const fs = require('fs');
const path = require('path');

const directory = './';
const ext = ['.ts', '.tsx'];

const replacements = [
    { target: /\.feeStructure/g, replace: '.fee_structure' },
    { target: /\.declarationHistory/g, replace: '.declarations' },
    { target: /\bdeclarationHistory:/g, replace: 'declarations:' },
    { target: /feeStructure:/g, replace: 'fee_structure:' },
    { target: /\.isVip/g, replace: '' }, // we will manually fix `isVip` or replace with true depending on context
    // Actually, `.isVip` usually used in ternary `client.isVip ? A : B`. Replacing with `true` might break `client.isVip` -> `clienttrue`.
    // Let's replace `client.isVip` with `true` or just handle it.
];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git')) {
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

    content = content.replace(/\bclient\.feeStructure\b/g, 'client.fee_structure');
    content = content.replace(/\bc\.feeStructure\b/g, 'c.fee_structure');
    content = content.replace(/\bclient\.declarationHistory\b/g, 'client.declarations');
    content = content.replace(/\bc\.declarationHistory\b/g, 'c.declarations');
    
    // feeStructure in destructuring
    content = content.replace(/feeStructure\s*:/g, 'fee_structure:');
    content = content.replace(/declarationHistory\s*:/g, 'declarations:');

    // legacy properties we might just delete from types or map to true
    content = content.replace(/\bclient\.isVip\b/g, 'true');
    content = content.replace(/\bc\.isVip\b/g, 'true');
    content = content.replace(/\bisVip:\s*client\.isVip\b/g, 'isVip: true');
    content = content.replace(/\bis_vip:\s*client\.isVip\b/g, 'is_vip: true');

    // annualRentaStatus etc since they are removed
    content = content.replace(/\bclient\.annualRentaStatus\b/g, 'undefined');
    content = content.replace(/\bclient\.annualRentaPaid\b/g, 'undefined');
    content = content.replace(/\bclient\.annualRentaProof\b/g, 'undefined');

    content = content.replace(/\bclient\.anexoGastosStatus\b/g, 'undefined');
    content = content.replace(/\bclient\.anexoGastosPaid\b/g, 'undefined');
    content = content.replace(/\bclient\.anexoGastosProof\b/g, 'undefined');

    content = content.replace(/\bclient\.devolucionIvaStatus\b/g, 'undefined');
    content = content.replace(/\bclient\.devolucionIvaPaid\b/g, 'undefined');
    content = content.replace(/\bclient\.devolucionIvaProof\b/g, 'undefined');

    content = content.replace(/\bclient\.iceAnexoStatus\b/g, 'undefined');
    content = content.replace(/\bclient\.iceAnexoPaid\b/g, 'undefined');
    content = content.replace(/\bclient\.iceAnexoProof\b/g, 'undefined');

    content = content.replace(/\bclient\.iceDeclarationStatus\b/g, 'undefined');
    content = content.replace(/\bclient\.iceDeclarationPaid\b/g, 'undefined');
    content = content.replace(/\bclient\.iceDeclarationProof\b/g, 'undefined');

    content = content.replace(/\bclient\.anexoPvpStatus\b/g, 'undefined');
    content = content.replace(/\bclient\.anexoPvpPaid\b/g, 'undefined');
    content = content.replace(/\bclient\.anexoPvpProof\b/g, 'undefined');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
        console.log('Fixed', file);
    }
});

console.log(`Done. Changed ${changedCount} files.`);
