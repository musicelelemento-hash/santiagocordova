import { generateDailyOperationalReport } from '../src/database_ops';

async function runTest() {
    console.log("🚀 Probando generateDailyOperationalReport()...\n");
    const startTime = Date.now();
    const reportHtml = await generateDailyOperationalReport();
    const duration = Date.now() - startTime;
    console.log(`⏱️ Generado en ${duration} ms.\n`);
    console.log("================ REPORTE GENERADO ================\n");
    console.log(reportHtml);
    console.log("\n===================================================");
}

runTest().catch(console.error);
