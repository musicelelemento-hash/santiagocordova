const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'components/features/ClientCard.tsx'),
  path.join(__dirname, 'components/features/VirtualClientTable.tsx')
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Replace text-[7px] with text-[9px]
    content = content.replace(/text-\[7px\]/g, 'text-[9px]');
    // Replace text-[8px] with text-[10px]
    content = content.replace(/text-\[8px\]/g, 'text-[10px]');
    // Replace text-[9px] with text-[11px] for slightly better scaling
    content = content.replace(/text-\[9px\]/g, 'text-[11px]');
    // Replace text-[10px] with text-xs (12px)
    content = content.replace(/text-\[10px\]/g, 'text-xs');

    fs.writeFileSync(file, content);
    console.log('Actualizado:', file);
  } else {
    console.log('Archivo no encontrado:', file);
  }
});
console.log('¡Fuentes ajustadas con éxito para mejorar la accesibilidad!');
