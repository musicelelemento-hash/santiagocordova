const xlsx = require('xlsx');
const fs = require('fs');

// Cargar el modelo que Zifact SÍ aceptó
const wbModel = xlsx.readFile('Adaptador Convert  ecuafact zifat/Modelo que acepto Zifact/Productos_Zifact (1).xls');

// Leer los productos de Ecuafact
const wbEcua = xlsx.readFile('Adaptador Convert  ecuafact zifat/0702933797001_Productos.xlsx');
const wsEcua = wbEcua.Sheets[wbEcua.SheetNames[0]];
const rawEcua = xlsx.utils.sheet_to_json(wsEcua, { header: 1 });

// Extraer la fila de productos de Ecuafact (fila 6)
// [ '1', '', 'Cacao', 50, 'BIEN', 0, 0 ]
const mappedRow = {
    'Nombre': 'Cacao',
    'Código Principal': '1',
    'Código Auxiliar': '',
    'Precio Unitario': 50.00, // Number
    'Código IVA': 5,          // Number (5%)
    'Código ICE': 0,          // Number
    'Código IRBPNR': 0,       // Number
    'Estado (A/I)': 'A'
};

const newWs = xlsx.utils.json_to_sheet([mappedRow], { raw: true });
wbModel.Sheets['Productos'] = newWs;

// Exportar en formato XLSX y XLS
xlsx.writeFile(wbModel, 'Adaptador Convert  ecuafact zifat/Productos_Zifact_Clonado.xlsx');
const buf = xlsx.write(wbModel, { bookType: 'biff8', type: 'buffer' });
fs.writeFileSync('Adaptador Convert  ecuafact zifat/Productos_Zifact_Clonado.xls', buf);

console.log('✅ Productos clonados generados exitosamente en .xlsx y .xls!');
