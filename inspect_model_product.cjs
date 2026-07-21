const xlsx = require('xlsx');

const wbModel = xlsx.readFile('Adaptador Convert  ecuafact zifat/Modelo que acepto Zifact/Productos_Zifact (1).xls');
console.log('Model Sheet Names:', wbModel.SheetNames);
const wsModel = wbModel.Sheets['Productos'];
console.log('Model !ref:', wsModel['!ref']);
console.log('Model A1-H2 cells:');
for (let c of ['A1','B1','C1','D1','E1','F1','G1','H1','A2','B2','C2','D2','E2','F2','G2','H2']) {
    console.log(`  ${c}:`, wsModel[c]);
}
