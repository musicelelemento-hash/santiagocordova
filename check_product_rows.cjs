const xlsx = require('xlsx');

const wb = xlsx.readFile('Adaptador Convert  ecuafact zifat/0702933797001_Productos.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
console.log('0702933797001_Productos.xlsx Total rows:', data.length);
console.log('Ref range (!ref):', ws['!ref']);
console.log('Sample rows:', data.slice(0, 10));
