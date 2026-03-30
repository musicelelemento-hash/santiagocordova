const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory && !f.includes('node_modules') && !f.includes('.git') && !f.includes('dist')) {
      walkDir(dirPath, callback);
    } else if (!isDirectory) {
      callback(path.join(dir, f));
    }
  });
}

const targetDir = path.join(__dirname, 'src') || path.join(__dirname, 'components') || __dirname;

walkDir(__dirname, function(filePath) {
  if (filePath.endsWith('.tsx') && !filePath.includes('node_modules') && !filePath.includes('.git')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Mejorar legibilidad
    content = content.replace(/text-\[7px\]/g, 'text-[9px]');
    content = content.replace(/text-\[8px\]/g, 'text-[10px]');
    content = content.replace(/text-\[9px\]/g, 'text-[11px]');
    content = content.replace(/text-\[10px\]/g, 'text-xs');

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Armonizado UI/Tipografía en:', filePath);
    }
  }
});
console.log('¡Armonización de diseño (Zenith Control UI) completada exitosamente en todo el proyecto!');
