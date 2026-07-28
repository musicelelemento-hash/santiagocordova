import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formats a date into Spanish long date string (e.g., "28 de julio de 2026")
 */
export const getFormattedCurrentDateSpanish = (): string => {
    const now = new Date();
    const day = now.getDate();
    const month = format(now, 'MMMM', { locale: es });
    const year = now.getFullYear();
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${day} del ${year}`;
};

/**
 * Generates a modified .docx Blob for EcuaFact Authorization
 */
export const generateEcuafactDocx = async (
    clientName: string,
    clientRuc: string,
    customDateStr?: string
): Promise<Blob> => {
    const dateText = customDateStr || getFormattedCurrentDateSpanish();
    const uppercaseName = (clientName || 'CLIENTE').toUpperCase().trim();
    const cleanRuc = (clientRuc || '0000000000001').trim();

    // Fetch template file from public root
    let arrayBuffer: ArrayBuffer;
    try {
        const response = await fetch('/Autorizaci%C3%B3n_Especial_Firma_Electr%C3%B3nica%20Ecuafact.docx');
        if (!response.ok) throw new Error('Primary fetch failed');
        arrayBuffer = await response.arrayBuffer();
    } catch (e) {
        const fallbackResp = await fetch('./Autorización_Especial_Firma_Electrónica Ecuafact.docx');
        if (!fallbackResp.ok) {
            throw new Error('No se pudo cargar la plantilla .docx de la raíz.');
        }
        arrayBuffer = await fallbackResp.arrayBuffer();
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
        throw new Error('El archivo .docx no contiene word/document.xml');
    }

    let xml = await docXmlFile.async('text');

    // Replace template values
    xml = xml.replace(/SANCHEZ BARRERA HENRY IVAN/g, uppercaseName);
    xml = xml.replace(/0703340455/g, cleanRuc);
    xml = xml.replace(/Julio 24 del 2026/g, dateText);
    xml = xml.replace(/Julio \d+ del \d{4}/gi, dateText);

    zip.file('word/document.xml', xml);

    const outBuffer = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    return outBuffer;
};

/**
 * Downloads personalized EcuaFact authorization .docx directly to user's device
 */
export const downloadEcuafactDocx = async (clientName: string, clientRuc: string): Promise<void> => {
    const blob = await generateEcuafactDocx(clientName, clientRuc);
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    saveAs(blob, `Autorizacion_Ecuafact_${safeName}_${clientRuc}.docx`);
};

/**
 * Opens a print-friendly preview window of the EcuaFact Authorization Letter
 */
export const printEcuafactAuthorization = (clientName: string, clientRuc: string, city: string = 'Machala'): void => {
    const dateText = getFormattedCurrentDateSpanish();
    const uppercaseName = (clientName || 'CLIENTE').toUpperCase().trim();
    const cleanRuc = (clientRuc || '0000000000001').trim();

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>PODER ESPECIAL FIRMA ELECTRÓNICA ECUAFACT</title>
        <style>
            @page { size: A4; margin: 2.5cm 2cm; }
            body {
                font-family: 'Arial', sans-serif;
                color: #1e293b;
                line-height: 1.8;
                font-size: 14px;
                padding: 40px;
            }
            .header-title {
                text-align: center;
                font-size: 18px;
                font-weight: bold;
                letter-spacing: 1px;
                margin-bottom: 40px;
                text-transform: uppercase;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
            }
            .date-line {
                text-align: left;
                margin-bottom: 30px;
                font-weight: bold;
            }
            .recipient {
                margin-bottom: 30px;
                font-weight: bold;
            }
            .body-text {
                text-align: justify;
                margin-bottom: 40px;
                text-indent: 30px;
            }
            .signatures {
                margin-top: 100px;
                text-align: center;
            }
            .line {
                margin: 0 auto;
                width: 250px;
                border-top: 1px solid #000;
                margin-bottom: 10px;
            }
            .name { font-weight: bold; font-size: 13px; text-transform: uppercase; }
            .ci { font-size: 12px; color: #475569; }
            @media print {
                body { padding: 0; }
            }
        </style>
    </head>
    <body>
        <div class="header-title">PODER ESPECIAL FIRMA ELECTRÓNICA</div>
        
        <div class="date-line">${city}, ${dateText}</div>
        
        <div class="recipient">
            Señores:<br>
            UANATACA ECUADOR S.A.<br>
            Presente. -
        </div>
        
        <div class="body-text">
            Yo <strong>${uppercaseName}</strong> con número de CÉDULA/RUC <strong>${cleanRuc}</strong> estoy interesado (a) en contratar una firma electrónica para mi uso personal y he seleccionado a la compañía UANATACA ECUADOR S.A como entidad de certificación de firma electrónica acreditada.
        </div>
        
        <div class="body-text">
            Con los antecedentes expuestos, otorgo poder especial a ECUANEXUS, para que obtenga una firma electrónica a mi nombre en la compañía UANATACA ECUADOR S.A y realice el proceso completo, la misma que servirá para firmar documentos tributarios electrónicos, según la normativa establecida por el Servicio de Rentas Internas para el efecto.
        </div>
        
        <div class="body-text">
            Para constancia y ratificación de lo señalado, suscribe.
        </div>
        
        <div class="signatures">
            <div class="line"></div>
            <div class="name">${uppercaseName}</div>
            <div class="ci">C.I. / RUC ${cleanRuc}</div>
        </div>

        <script>
            window.onload = function() {
                window.print();
            };
        </script>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
        printWin.document.write(htmlContent);
        printWin.document.close();
    }
};
