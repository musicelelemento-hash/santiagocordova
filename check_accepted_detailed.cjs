const fs = require('fs');
const xlsx = require('xlsx');

const acceptedPath = 'Adaptador Convert  ecuafact zifat/Modelo que acepto Zifact/Productos_Zifact (1).xls';
const acceptedBuf = fs.readFileSync(acceptedPath);

console.log('=== ACCEPTED FILE FROM USER MODEL ===');
console.log('Path:', acceptedPath);
console.log('Size:', acceptedBuf.length, 'bytes');
console.log('Magic bytes (hex):', acceptedBuf.slice(0, 32).toString('hex'));

// Inspect internal BIFF8 record types if possible
const wb = xlsx.readFile(acceptedPath);
console.log('SheetNames:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
console.log('Ref:', ws['!ref']);
