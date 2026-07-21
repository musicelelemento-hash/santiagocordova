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
    const bytes = base64ToUint8Array(b64);
    const workbook = xlsx.read(bytes, { type: 'array' });
    
    // Probar con array vacío
    const newWsEmpty = xlsx.utils.json_to_sheet([], { raw: true });
    console.log('Empty sheet !ref:', newWsEmpty['!ref']);
    workbook.Sheets['Plantilla'] = newWsEmpty;
    const out = xlsx.write(workbook, { bookType: 'biff8', type: 'buffer' });
    console.log('Written empty sheet:', out.length);
} catch (e) {
    console.error('FAILED EDGE CASE:', e);
}
