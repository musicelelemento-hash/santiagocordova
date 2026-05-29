require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.collection('sc_pro_backup').doc('sriCredentials').get().then(doc => {
  const rawData = doc.data();
  console.log('Doc exists:', doc.exists);
  console.log('Top-level keys:', Object.keys(rawData || {}).join(', '));
  // Check if data is nested under .data or flat at root
  const nested = rawData?.data;
  const flat = rawData;
  console.log('Nested .data keys count:', nested ? Object.keys(nested).length : 'N/A');
  console.log('Flat keys count:', flat ? Object.keys(flat).length : 'N/A');
  console.log('Check nested has 0702065319001:', !!(nested && nested['0702065319001']));
  console.log('Check flat has 0702065319001:', !!(flat && flat['0702065319001']));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
