const fs = require('fs');
const path = require('path');

const directoryPaths = [
    path.join(__dirname, 'screens'),
    path.join(__dirname, 'components')
];

function processFile(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Pattern 1: bg-white dark:bg-slate-XYZ border border-slate-XYZ dark:border-XYZ
    content = content.replace(/bg-white\s+dark:bg-(?:slate-\d+|surface[^\s]*|white\/\d+)\s+border\s+border-(?:slate-\d+|white\/\d+)\s+dark:border-(?:slate-\d+|white\/\d+)/g, 'glass-card-premium');
    
    // Pattern 1.1: bg-white dark:bg-slate-XYZ p-8 ... border border-slate
    content = content.replace(/bg-white\s+dark:bg-slate-\d+\s+p-\d+\s+sm:p-\d+\s+rounded-\[[^\]]+\]\s+border\s+border-slate-\d+\s+dark:border-slate-\d+/g, 'glass-card-premium p-8 sm:p-12');
    
    // Pattern 2: bg-slate-50 dark:bg-surface-low/XX border...
    content = content.replace(/bg-slate-50\s+dark:bg-(?:surface[^\s]*|slate-\d+)\s+border\s+border-(?:slate-\d+|white\/\d+)\s+dark:border-(?:slate-\d+|white\/\d+)/g, 'glass-card-premium');
    
    // Pattern 3: bg-surface-low dark:bg-surface-low
    content = content.replace(/bg-surface-low\s+dark:bg-surface-low/g, 'glass-card-premium');

    // Pattern 4: Remove redundant shadow-sm if glass-card-premium is applied
    content = content.replace(/glass-card-premium([^"]*)shadow-(?:sm|md|lg|2xl)/g, 'glass-card-premium$1');

    // Add button hovers
    content = content.replace(/bg-primary\s+hover:bg-[a-zA-Z0-9-]+/g, 'bg-primary hover:bg-gradient-azure');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function traverseDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDirectory(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

directoryPaths.forEach(traverseDirectory);
console.log('Refactor complete.');
