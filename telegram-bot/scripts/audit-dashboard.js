const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { format, subMonths, isPast, getYear, getMonth } = require('date-fns');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Mocking required logic from sri.ts and constants
// Redundant declaration removed

const SRI_DUE_DATES = {
    1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 
    6: 20, 7: 22, 8: 24, 9: 26, 0: 28
};

function getNinthDigit(ruc) {
    if (!ruc || ruc.length < 9) return -1;
    return parseInt(ruc[8], 10);
}

function getDueDate(client, referenceDate) {
    const ninthDigit = getNinthDigit(client.ruc);
    if (ninthDigit === -1 || !(ninthDigit in SRI_DUE_DATES)) return null;
    const day = SRI_DUE_DATES[ninthDigit];
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
}

function getAnnualIncomeTaxDueDate(client, declarationYear) {
    const ninthDigit = getNinthDigit(client.ruc);
    if (ninthDigit === -1) return null;
    const day = SRI_DUE_DATES[ninthDigit];
    let month = 2; // March (0-indexed: 2)
    if (client.regime === TaxRegime.RimpeNegocioPopular) month = 4; // May
    return new Date(declarationYear + 1, month, day);
}

function getPeriod(client, date) {
    const currentYear = getYear(date);
    const prevYearStr = (currentYear - 1).toString();
    const month = getMonth(date);
    if (client.regime === TaxRegime.RimpeNegocioPopular) return prevYearStr;
    const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
    if (ivaFreq === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor) {
        return month < 6 ? `${currentYear - 1}-S2` : `${currentYear}-S1`;
    }
    const declarationMonth = subMonths(date, 1);
    return format(declarationMonth, 'yyyy-MM');
}

function getDueDateForPeriod(client, period) {
    if (!period) return null;
    if (period.includes('-S')) {
        const [year, semester] = period.split('-S');
        const referenceDate = semester === '1' ? new Date(parseInt(year), 6, 1) : new Date(parseInt(year) + 1, 0, 1);
        return getDueDate(client, referenceDate);
    } else if (period.length === 4) {
        return getAnnualIncomeTaxDueDate(client, parseInt(period, 10));
    } else if (period.includes('-')) {
        const [year, month] = period.split('-');
        const referenceDate = new Date(parseInt(year), parseInt(month), 1);
        return getDueDate(client, referenceDate);
    }
    return null;
}

const DeclarationStatus = {
    Pendiente: 'Pendiente',
    Enviada: 'Enviada',
    Pagada: 'Pagada',
    Cancelada: 'Cancelada',
    Vencida: 'Vencida',
};

const TaxRegime = {
    General: 'Régimen General',
    RimpeNegocioPopular: 'RIMPE Negocio Popular',
    RimpeEmprendedor: 'RIMPE Emprendedor',
};

async function audit() {
    try {
        const snapshot = await db.collection('sc_pro_clients').get();
        const allClients = snapshot.docs.map(doc => doc.data());
        const clients = allClients.filter(c => !c.isDeleted);
        const today = new Date();
        
        // Buggy stats (currently in code)
        let buggyStats = { vencidos: 0, ordenes: 0, cobros: 0, elite: 0 };
        // Fixed stats (logical status)
        let fixedStats = { vencidos: 0, ordenes: 0, cobros: 0, elite: 0 };
        
        let cases = { statusEnviadaNoProof: 0, statusPagadaNoProof: 0 };

        clients.forEach(client => {
            const period = getPeriod(client, today);
            const decl = (client.declarationHistory || []).find(d => d.period === period);
            const dueDate = getDueDateForPeriod(client, period);

            const hasProof = !!decl?.proofFile;
            const isIvaDeclaredStatus = decl?.status === DeclarationStatus.Enviada || decl?.status === DeclarationStatus.Pagada || hasProof;
            const isIvaPaidStatus = decl?.isPaid || decl?.status === DeclarationStatus.Pagada;

            const currentYear = today.getFullYear();
            const rentaPeriod = (currentYear - 1).toString();
            const needsRenta = client.taxProfile?.requiresAnnualRenta ?? true;
            const rentaDecl = (client.declarationHistory || []).find(d => d.period === rentaPeriod);
            
            const hasRentaProof = !!rentaDecl?.proofFile || !!client.annualRentaProof;
            const isRentaDeclaredStatus = rentaDecl?.status === DeclarationStatus.Enviada || rentaDecl?.status === DeclarationStatus.Pagada || !!client.annualRentaStatus || hasRentaProof;
            const isRentaPaidStatus = rentaDecl?.isPaid || rentaDecl?.status === DeclarationStatus.Pagada || !!client.annualRentaPaid;

            const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && client.taxProfile?.ivaFrequency !== 'Ninguno';

            // Current Buggy Logic (requires proofFile)
            const bIvaDecl = hasProof;
            const bIvaPaid = !!decl?.isPaid;
            const bRentaDecl = hasRentaProof;
            const bRentaPaid = !!rentaDecl?.isPaid || !!client.annualRentaPaid;

            const bFullDecl = bIvaDecl && (bRentaDecl || !needsRenta);
            const bFullPaid = bIvaPaid && (bRentaPaid || !needsRenta);
            
            if (dueDate && isPast(dueDate) && !bIvaDecl) buggyStats.vencidos++;
            else if (!bFullDecl && bFullPaid) buggyStats.ordenes++;
            else if (bFullDecl && !bFullPaid) buggyStats.cobros++;
            else if (bFullDecl && bFullPaid) buggyStats.elite++;

            // Proposed Logic (uses status flags)
            const fFullDecl = (isIvaDeclaredStatus || !needsIva) && (isRentaDeclaredStatus || !needsRenta);
            const fFullPaid = (isIvaPaidStatus || !needsIva) && (isRentaPaidStatus || !needsRenta);

            if (dueDate && isPast(dueDate) && !isIvaDeclaredStatus) fixedStats.vencidos++;
            else if (!fFullDecl && fFullPaid) fixedStats.ordenes++;
            else if (fFullDecl && !fFullPaid) fixedStats.cobros++;
            else if (fFullDecl && fFullPaid) fixedStats.elite++;

            if (decl?.status === DeclarationStatus.Enviada && !hasProof) cases.statusEnviadaNoProof++;
            if (decl?.status === DeclarationStatus.Pagada && !hasProof) cases.statusPagadaNoProof++;
        });

        console.log("--- STATUS vs PROOF AUDIT ---");
        console.log("Buggy Stats (Current):", buggyStats);
        console.log("Fixed Stats (Status-based):", fixedStats);
        console.log("Discrepancy Cases (Status set but no PDF):", cases);
        console.log("Current %:", Math.round((buggyStats.elite / clients.length) * 100));
        console.log("Fixed %:", Math.round((fixedStats.elite / clients.length) * 100));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

audit();
