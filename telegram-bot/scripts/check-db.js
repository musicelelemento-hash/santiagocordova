const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkCounts() {
    try {
        const snapshot = await db.collection('sc_pro_clients').get();
        const clients = snapshot.docs.map(doc => doc.data());
        const total = clients.length;
        
        const general = clients.filter(c => c.regime === 'Régimen General').length;
        const emprendedor = clients.filter(c => c.regime === 'Rimpe Emprendedor').length;
        const popular = clients.filter(c => c.regime === 'Rimpe Negocio Popular').length;
        
        const monthly = clients.filter(c => c.taxProfile?.ivaFrequency === 'Mensual').length;
        const semiannual = clients.filter(c => c.taxProfile?.ivaFrequency === 'Semestral').length;
        
        console.log("--- DB COUNTS ---");
        console.log({ total, general, emprendedor, popular, monthly, semiannual });
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkCounts();
