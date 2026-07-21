const xlsx = require('xlsx');
const fs = require('fs');

const b64 = fs.readFileSync('Adaptador Convert  ecuafact zifat/plantilla que solicita Zifact/template_Productos (3).xls').toString('base64');

function base64ToUint8Array(base64) {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

try {
    const fileData = [
        {
            'Nombre': 'Cacao',
            'Codigo Principal': '1',
            'Codigo Auxiliar': '',
            'Precio Unitario': 50,
            'Codigo IVA': 5,
            'Codigo ICE': 0,
            'Codigo IRBPNR': 0,
            'Estado (A/I)': 'A'
        }
    ];

    const bytes = base64ToUint8Array(b64);
    const workbook = xlsx.read(bytes, { type: 'array' });
    
    console.log('Original Workbook SheetNames:', workbook.SheetNames);
    console.log('Original Sheet Plantilla keys:', Object.keys(workbook.Sheets['Plantilla']));

    const newWs = xlsx.utils.json_to_sheet(fileData, { raw: true });
    workbook.Sheets['Plantilla'] = newWs;

    console.log('Writing BIFF8...');
    const out = xlsx.write(workbook, { bookType: 'biff8', type: 'buffer' });
    console.log('SUCCESS! Bytes:', out.length);
} catch (e) {
    console.error('FAILED WITH ERROR:', e);
}
