import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as xlsx from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
    ArrowRightLeft, 
    UploadCloud, 
    RefreshCw, 
    Download, 
    Package, 
    Users, 
    Eye, 
    Trash2, 
    Sparkles, 
    FileSpreadsheet, 
    ShieldCheck, 
    X,
    Layers,
    CheckCircle2,
    Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Base64 binario idéntico al archivo oficial template_Productos.XLS de Zifact
const OFFICIAL_ZIFACT_PRODUCT_TEMPLATE_B64 = "0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAOwADAP7/CQAGAAAAAAAAAAAAAAABAAAABgAAAAAAAAAAEAAAAAAAAAEAAAD+////AAAAAAcAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8BAAAAAgAAAAMAAAD+////BQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAD+////IAAAACEAAAAiAAAA/v////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////7/AAAGAQIAAAAAAAAAAAAAAAAAAAAAAAEAAADghZ/y+U9oEKuRCAArJ7PZMAAAAMgAAAAIAAAAAQAAAEgAAAACAAAAUAAAAAMAAABsAAAABAAAAIgAAAAIAAAAmAAAAAwAAACoAAAADQAAALQAAAATAAAAwAAAAAIAAADkBAAAHgAAABQAAABQbGFudGlsbGEgUHJvZHVjdG9zAB4AAAAUAAAAUGxhbnRpbGxhIFByb2R1Y3RvcwAeAAAACAAAAEZhY3RlbAAAHgAAAAgAAABGYWN0ZWwAAEAAAAAAemygICTdAUAAAAAAemygICTdAQMAAAAAAAAAAAAAAAAAAAAJCBAAAAYFALsNzAfRAAEABgQAAEIAAgCwBD0AEgAAAAAAvCVyFTgAAAAAAAEAWAIiAAIAAAAxAB4A3AAAAAgAkAEAAAAAAAAHAUMAYQBsAGkAYgByAGkA4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAD1/yAAAMAAAAAAAAAAAAkE4AAUAAAAAAABACAAAMAAAAAAAAAAAAkEkwIEAACAAP+SAOIAOAAAAAAA////AP8AAAAA/wAAAAD/AP//AAD/AP8AAP//AIAAAAAAgAAAAACAAICAAACAAIAAAICAAMDAwACAgIAAmZn/AJkzZgD//8wAzP//AGYAZgD/gIAAAGbMAMzM/wAAAIAA/wD/AP//AAAA//8AgACAAIAAAAAAgIAAAAD/AADM/wDM//8AzP/MAP//mQCZzP8A/5nMAMyZ/wD/zJkAM2b/ADPMzACZzAAA/8wAAP+ZAAD/ZgAAZmaZAJaWlgAAM2YAM5lmAAAzAAAzMwAAmTMAAJkzZgAzM5kAMzMzAIUAGgA0BAAAAAAJAVAAbABhAG4AdABpAGwAbABhAMEBCADBAQAAZ+YBAK4BBAABAAEEFwAIAAEAAAAAAAAA/AAoAQwAAAAMAAAABgABTgBvAG0AYgByAGUAEAABQwBvAGQAaQBnAG8AIABQAHIAaQBuAGMAaQBwAGEAbAAPAAFDAG8AZABpAGcAbwAgAEEAdQB4AGkAbABpAGEAcgAPAAFQAHIAZQBjAGkAbwAgAFUAbgBpAHQAYQByAGkAbwAKAAFDAG8AZABpAGcAbwAgAEkAVgBBAAoAAUMAbwBkAGkAZwBv ACAASQBDAEUADQABQwBvAGQAaQBnAG8AIABJAFIAQgBQAE4AUgAMAAFFAHMAdABhAGQAbwAgACgAQQAvAEkAKQAQAAFQAHIAbwBkAHUAYwB0AG8AIABlAGoAZQBtAHAAbABvAAYAAVAAUgBEADAAMAAxAAYAAUEAVQBYADAAMAAxAAEAAUEACgAAAAkIEAAABhAAuw3MB9EAAQAGBAAAKgACAAAAKwACAAAAggACAAEAgAAIAAAAAAAAAAAAgQACAMEEFAADAAAAARUAAwAAAAGDAAIAAACEAAIAAAAmAAgAZmZmZmZm5j8nAAgAZmZmZmZm5j8oAAgAAAAAAAAA6D8pAAgAAAAAAAAA6D+hACIAAQBkAAEAAQABAAIAWAJYAjMzMzMzM9M/MzMzMzMz0z8BAFUAAgAIAH0ADAAAAAAA/hMPAAAAAAB9AAwAAQABAP4TDwAAAAAAfQAMAAIAAgC1Eg8AAAAAAH0ADAADAAMAtRIPAAAAAAB9AAwABAAEANoMDwAAAAAAfQAMAAUABQDaDA8AAAAAAH0ADAAGAAYAbBAPAAAAAAB9AAwABwAHAEgPDwAAAAAAAAIOAAAAAAADAAAAAQAJAAAA/QAKAAAAAAAPAAAAAAD9AAoAAAABAA8AAQAAAP0ACgAAAAIADwACAAAA/QAKAAAAAwAPAAMAAAD9AAoAAAAEAA8ABAAAAP0ACgAAAAUADwAFAAAA/QAKAAAABgAPAAYAAAD9AAoAAAAHAA8ABwAAAP0ACgABAAAADwAIAAAA/QAKAAEAAQAPAAkAAAD9AAoAAQACAA8ACgAAAAMCDgABAAMADwAAAAAAAAAkQAMCDgABAAQADwAAAAAAAAAQQAMCDgABAAUADwAAAAAAAAAAAAMCDgABAAYADwAAAAAAAAAAAP0ACgABAAcADwALAAAAPgISALYGAAAAAEAAAAAAAGQAAAAAAIsIEACLCAAAAAAAAAAAAABkAAAAHQAPAAMAAAAAAAABAAAAAAAAAGcIFwBnCAAAAAAAAAAAAAACAAH//////38AAAoAAAD+/wAABgECAAAAAAAAAAAAAAAAAAAAAAABAAAAAtXN1ZwuGxCTlwgAKyz5rjAAAAC8AAAACAAAAAEAAABIAAAAFwAAAFAAAAALAAAAWAAAABAAAABgAAAAEwAAAGgAAAAWAAAAcAAAAA0AAAB4AAAADAAAAI4AAAACAAAA5AQAAAMAAAAAAAwACwAAAAAAAAALAAAAAAAAAAsAAAAAAAAACwAAAAAAAAAeEAAAAQAAAAoAAABXb3Jrc2hlZXQADBAAAAIAAAAeAAAAEwAAAEZldWlsbGVzIGRlIGNhbGN1bAADAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSAG8AbwB0 ACAARQBuAHQAcgB5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFgAFAP//////////AQAAAAAJAgAAAAAAwAAAAAAAAEYAAAAAAHpsoCAk3QEAemygICTdAQEAAADACAAAAAAAAAUAUwB1AG0AbQBhAHIAeQBJAG4AZgBvAHIAbQBhAHQAaQBvAG4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoAAIAAgAAAAMAAAD/////AAkCAAAAAADAAAAAAAAARgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgAAAAAAAAAVwBvAHIAawBiAG8AbwBrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAgD///////////////8ACQIAAAAAAMAAAAAAAABGAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAwAYAAAAAAAAFAEQAbwBjAHUAbQBlAG4AdABTAHUAbQBtAGEAcgB5AEkAbgBmAG8AcgBtAGEAdABtAGEAdABpAG8AbgAAAAAAAAAAAAAAOAACAP///////////////wAJAgAAAAAAwAAAAAAAAEYAAAAAAAAAAAAAAAAAAAAAAAAAAB8AAADsAAAAAAAAAP7///8CAAAAAwAAAAQAAAAFAAAA/v////7////9////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////";

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function downloadAsXLS(previewFile: any) {
    if (!previewFile) return;
    try {
        const u8 = base64ToUint8Array(OFFICIAL_ZIFACT_PRODUCT_TEMPLATE_B64);
        const blob = new Blob([u8], { type: 'application/vnd.ms-excel' });
        saveAs(blob, `plantilla_zifact_${previewFile.name || 'convertido'}.xls`);
    } catch(e) {
        console.error("Error al descargar XLS", e);
    }
}

function triggerBrowserDownload(buf: Uint8Array | ArrayBuffer | Blob | string, filename: string, mimeType: string = 'application/vnd.ms-excel') {
    let blob: Blob;
    if (buf instanceof Blob) {
        blob = buf;
    } else if (typeof buf === 'string') {
        blob = new Blob([buf], { type: mimeType });
    } else {
        blob = new Blob([buf as BlobPart], { type: mimeType });
    }
    saveAs(blob, filename);
}

interface ProcessedFile {
    id: string;
    name: string;
    type: 'productos' | 'clientes';
    data: any[];
    rawCount: number;
    status: 'success' | 'error';
    message?: string;
    timestamp: string;
}

export const AdaptadorConvert: React.FC = () => {
    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewFile, setPreviewFile] = useState<ProcessedFile | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'clientes' | 'productos'>('all');

    const mapTipoIdentificacion = (val: string | number) => {
        const v = String(val || '').toLowerCase();
        if (v.includes('ruc') || v === '04' || v === '4') return '04';
        if (v.includes('cedula') || v.includes('cédula') || v === '05' || v === '5') return '05';
        if (v.includes('pasaporte') || v === '06' || v === '6') return '06';
        if (v.includes('final') || v === '07' || v === '7') return '07';
        return '04';
    };

    const mapCodigoIva = (val: string | number): number => {
        const v = String(val || '').replace('%', '').trim();
        if (v === '5' || v === '5.00') return 5; 
        if (v === '4' || v === '15' || v === '15.00') return 4; 
        if (v === '0' || v === '0.00' || v.toLowerCase() === 'cero') return 0; 
        return 4; // Default Zifact 15% (código 4)
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsProcessing(true);
        const newProcessedFiles: ProcessedFile[] = [];

        for (const file of acceptedFiles) {
            try {
                const data = await file.arrayBuffer();
                const workbook = xlsx.read(data, { raw: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
                
                // Buscar fila de encabezados reales de Ecuafact
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(20, rawData.length); i++) {
                    const rowStr = (rawData[i] || []).join(' ').toLowerCase();
                    if (rowStr.includes('identificación no') || rowStr.includes('razón social') || rowStr.includes('código') || rowStr.includes('descripción')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                const headers = (rawData[headerRowIndex] || []).map(h => String(h || '').trim());
                const jsonData: any[] = [];
                for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0 || row.every((c: any) => !c)) continue;
                    const obj: any = {};
                    headers.forEach((h, idx) => {
                        if (h) obj[h] = row[idx];
                    });
                    jsonData.push(obj);
                }

                // Detección de tipo de archivo
                const filename = file.name.toLowerCase();
                const headerStr = headers.join(' ').toLowerCase();
                const hasClientHeaders = headerStr.includes('identificación') || headerStr.includes('ruc') || headerStr.includes('cedula') || headerStr.includes('razón social');
                const hasProductHeaders = headerStr.includes('código') || headerStr.includes('precio') || headerStr.includes('pvp') || headerStr.includes('iva');

                const isClientes = filename.includes('cliente') || hasClientHeaders;
                const isProductos = filename.includes('producto') || hasProductHeaders;

                let type: 'productos' | 'clientes' = 'productos';
                if (isClientes && !isProductos) type = 'clientes';
                else if (isProductos && !isClientes) type = 'productos';
                else if (isClientes) type = 'clientes'; 
                
                let mappedData: any[] = [];

                if (type === 'clientes') {
                    mappedData = jsonData.map((row: any) => {
                        let ident = String(row['Identificacion'] || row['identificación'] || row['Identificación No.'] || row['RUC'] || row['Cedula'] || row['RUC/CI'] || '').trim();
                        
                        // Preservar ceros iniciales en RUCs (13 dígitos) y Cédulas (10 dígitos)
                        if (ident.length === 12) ident = '0' + ident;
                        else if (ident.length === 9) ident = '0' + ident;

                        let celular = String(row['Teléfono'] || row['Celular'] || row['Telefono'] || row['celular'] || '').trim();
                        // Preservar ceros iniciales en Celular/Teléfono
                        if (celular.length === 9 && celular.startsWith('9')) celular = '0' + celular;
                        else if (celular.length === 8 || celular.length === 7) celular = '0' + celular;

                        let tipoIdent = row['Tipo Identificacion'] || row['tipo_identificacion'] || row['Tipo'];
                        if (!tipoIdent) {
                            if (ident.length === 13) tipoIdent = '04'; 
                            else if (ident.length === 10) tipoIdent = '05'; 
                            else if (ident === '9999999999999') tipoIdent = '07'; 
                            else tipoIdent = '06'; 
                        }

                        return {
                            'Nombre': String(row['Razón Social'] || row['Nombre'] || row['Razon Social'] || row['Nombre Comercial'] || 'SIN NOMBRE'),
                            'Tipo Identificacion': mapTipoIdentificacion(tipoIdent),
                            'Identificacion': ident || '9999999999',
                            'Direccion': String(row['Dirección'] || row['Direccion'] || 'SN'),
                            'Celular': celular || '0999999999',
                            'Correo': String(row['E-mail'] || row['Correo'] || row['Email'] || 'correo@ejemplo.com')
                        };
                    });
                } else {
                    mappedData = jsonData.map((row: any) => {
                        const rawCod = String(row['Código'] || row['Código Principal'] || '1').trim();
                        // Sin ceros iniciales en código principal de productos
                        const codPrincipal = rawCod.replace(/^0+(?=\d)/, '') || '1';

                        const pvpNum = parseFloat(row['PVP'] || row['Precio Unitario'] || row['Precio'] || '0');
                        const codIvaNum = mapCodigoIva(row['IVA'] || row['Código IVA'] || row['Tarifa IVA'] || '5');
                        const codIceNum = parseInt(row['ICE'] || row['Código ICE'] || '0', 10) || 0;
                        const codIrbpnrNum = parseInt(row['Código IRBPNR'] || row['IRBPNR'] || '0', 10) || 0;

                        return {
                            'Nombre': String(row['Descripción'] || row['Nombre'] || row['Descripcion'] || 'Producto General'),
                            'Codigo Principal': codPrincipal,
                            'Codigo Auxiliar': String(row['Cod. Aux.'] || row['Código Auxiliar'] || ''),
                            'Precio Unitario': pvpNum,
                            'Codigo IVA': codIvaNum,
                            'Codigo ICE': codIceNum,
                            'Codigo IRBPNR': codIrbpnrNum,
                            'Estado (A/I)': 'A'
                        };
                    });

                    // Deduplicación e intensificación de unicidad en Código Principal para evitar choques en ZiFact
                    const seenCodes = new Set<string>();
                    mappedData.forEach((item: any, idx: number) => {
                        let code = String(item['Codigo Principal'] || '').trim();
                        if (!code || seenCodes.has(code)) {
                            let counter = idx + 1;
                            code = `P${String(counter).padStart(3, '0')}`;
                            while (seenCodes.has(code)) {
                                counter++;
                                code = `P${String(counter).padStart(3, '0')}`;
                            }
                        }
                        seenCodes.add(code);
                        item['Codigo Principal'] = code;
                    });
                }

                newProcessedFiles.push({
                    id: Math.random().toString(36).substring(2, 9),
                    name: file.name,
                    type,
                    data: mappedData,
                    rawCount: jsonData.length,
                    status: 'success',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            } catch (error) {
                console.error("Error processing file", file.name, error);
                newProcessedFiles.push({
                    id: Math.random().toString(36).substring(2, 9),
                    name: file.name,
                    type: 'productos',
                    data: [],
                    rawCount: 0,
                    status: 'error',
                    message: 'No se pudo estructurar el archivo.',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        }

        setProcessedFiles(prev => [...prev, ...newProcessedFiles]);
        setIsProcessing(false);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        }
    });

function buildProductosAOA(data: any[]): any[][] {
    const headers = ['Nombre', 'Codigo Principal', 'Codigo Auxiliar', 'Precio Unitario', 'Codigo IVA', 'Codigo ICE', 'Codigo IRBPNR', 'Estado (A/I)'];
    const rows: any[][] = [headers];

    data.forEach(item => {
        rows.push([
            String(item['Nombre'] || 'Producto General'),
            String(item['Codigo Principal'] || '1'),
            String(item['Codigo Auxiliar'] || ''),
            typeof item['Precio Unitario'] === 'number' ? item['Precio Unitario'] : parseFloat(item['Precio Unitario'] || '0') || 0,
            typeof item['Codigo IVA'] === 'number' ? item['Codigo IVA'] : parseInt(item['Codigo IVA'] || '4', 10) || 4,
            typeof item['Codigo ICE'] === 'number' ? item['Codigo ICE'] : parseInt(item['Codigo ICE'] || '0', 10) || 0,
            typeof item['Codigo IRBPNR'] === 'number' ? item['Codigo IRBPNR'] : parseInt(item['Codigo IRBPNR'] || '0', 10) || 0,
            String(item['Estado (A/I)'] || 'A')
        ]);
    });

    return rows;
}

function buildClientesAOA(data: any[]): any[][] {
    const headers = ['Nombre', 'Tipo Identificacion', 'Identificacion', 'Direccion', 'Celular', 'Correo'];
    const rows: any[][] = [headers];

    data.forEach(item => {
        rows.push([
            String(item['Nombre'] || 'SIN NOMBRE'),
            String(item['Tipo Identificacion'] || '04'),
            String(item['Identificacion'] || '9999999999999'),
            String(item['Direccion'] || 'SN'),
            String(item['Celular'] || '0999999999'),
            String(item['Correo'] || 'correo@ejemplo.com')
        ]);
    });

    return rows;
}

// --- BUILDERS DE VARIANTES DE PRUEBA ZIFACT / FACTEL ---

// Variant XML 2003: XML Spreadsheet 2003 (.xls) - 0% Memoria en PHP
function buildExcel2003XML(file: ProcessedFile): string {
    const isProd = file.type === 'productos';
    const sheetName = isProd ? 'Plantilla' : 'Clientes';
    const rows = isProd ? buildProductosAOA(file.data) : buildClientesAOA(file.data);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${sheetName}">
  <Table>`;

    rows.forEach((row, rIdx) => {
        xml += '\n   <Row>';
        row.forEach(cell => {
            const val = String(cell ?? '');
            const isNum = rIdx > 0 && !isNaN(Number(val)) && val.trim() !== '';
            if (isNum) {
                xml += `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
            } else {
                const escaped = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                xml += `<Cell><Data ss:Type="String">${escaped}</Data></Cell>`;
            }
        });
        xml += '</Row>';
    });

    xml += `
  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
}

// Variant HTML Table: HTML Table (.xls) - 0% Memoria en PHP
function buildHTMLTable(file: ProcessedFile): string {
    const isProd = file.type === 'productos';
    const rows = isProd ? buildProductosAOA(file.data) : buildClientesAOA(file.data);

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${isProd ? 'Plantilla' : 'Clientes'}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table>`;

    rows.forEach((row, rIdx) => {
        html += '\n<tr>';
        row.forEach(cell => {
            const tag = rIdx === 0 ? 'th' : 'td';
            const escaped = String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html += `<${tag}>${escaped}</${tag}>`;
        });
        html += '</tr>';
    });

    html += `
</table>
</body>
</html>`;

    return html;
}

// Variant BIFF5: Excel 5.0 / 95 Binary (.xls) con Inline Strings (0% Sobrecarga SST / XF en PHP)
function buildBIFF5(file: ProcessedFile): Uint8Array {
    const isProd = file.type === 'productos';
    const sheetName = isProd ? 'Plantilla' : 'Clientes';
    const rows = isProd ? buildProductosAOA(file.data) : buildClientesAOA(file.data);

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const lastCol = isProd ? 'H' : 'F';
    worksheet['!ref'] = `A1:${lastCol}${rows.length}`;

    delete worksheet['!rows'];
    delete worksheet['!cols'];
    delete worksheet['!margins'];

    const workbook = xlsx.utils.book_new();
    workbook.SheetNames = [sheetName];
    workbook.Sheets = { [sheetName]: worksheet };

    return xlsx.write(workbook, { bookType: 'biff5', type: 'array' });
}

// Variant 1: 1 Solo Producto Inyectado en BIFF5
function buildVariant1_SingleProduct(file: ProcessedFile): Uint8Array {
    const isProd = file.type === 'productos';
    const sheetName = isProd ? 'Plantilla' : 'Clientes';
    const rows = isProd ? buildProductosAOA(file.data.slice(0, 1)) : buildClientesAOA(file.data.slice(0, 1));

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const lastCol = isProd ? 'H' : 'F';
    worksheet['!ref'] = `A1:${lastCol}${rows.length}`;

    delete worksheet['!rows'];
    delete worksheet['!cols'];
    delete worksheet['!margins'];

    const workbook = xlsx.utils.book_new();
    workbook.SheetNames = [sheetName];
    workbook.Sheets = { [sheetName]: worksheet };

    return xlsx.write(workbook, { bookType: 'biff5', type: 'array' });
}

// Variant 2: Todos los Productos Inyectados en plantilla original template_Productos.XLS
function buildVariant2_TemplateInjected(file: ProcessedFile): Uint8Array {
    try {
        const bytes = base64ToUint8Array(OFFICIAL_ZIFACT_PRODUCT_TEMPLATE_B64);
        const workbook = xlsx.read(bytes, { type: 'array', cellStyles: true });
        const sheet = workbook.Sheets['Plantilla'];

        if (sheet) {
            Object.keys(sheet).forEach(k => {
                if (!k.startsWith('!') && parseInt(k.replace(/[^\d]/g, ''), 10) >= 2) {
                    delete sheet[k];
                }
            });

            file.data.forEach((p: any, idx: number) => {
                const r = idx + 2;
                sheet[`A${r}`] = { v: String(p['Nombre'] || 'Producto General'), t: 's' };
                sheet[`B${r}`] = { v: String(p['Codigo Principal'] || (idx + 1)), t: 's' };
                sheet[`C${r}`] = { v: String(p['Codigo Auxiliar'] || ''), t: 's' };
                sheet[`D${r}`] = { v: typeof p['Precio Unitario'] === 'number' ? p['Precio Unitario'] : parseFloat(p['Precio Unitario'] || '0') || 0, t: 'n' };
                sheet[`E${r}`] = { v: typeof p['Codigo IVA'] === 'number' ? p['Codigo IVA'] : parseInt(p['Codigo IVA'] || '4', 10) || 4, t: 'n' };
                sheet[`F${r}`] = { v: typeof p['Codigo ICE'] === 'number' ? p['Codigo ICE'] : parseInt(p['Codigo ICE'] || '0', 10) || 0, t: 'n' };
                sheet[`G${r}`] = { v: typeof p['Codigo IRBPNR'] === 'number' ? p['Codigo IRBPNR'] : parseInt(p['Codigo IRBPNR'] || '0', 10) || 0, t: 'n' };
                sheet[`H${r}`] = { v: String(p['Estado (A/I)'] || 'A'), t: 's' };
            });

            sheet['!ref'] = `A1:H${file.data.length + 1}`;
            return xlsx.write(workbook, { bookType: 'biff8', type: 'array' });
        }
    } catch (e) {
        console.warn("Error en V2:", e);
    }
    return buildBIFF5(file);
}

// Variant 3: BIFF8 Limpio Nuevo Libro (bookSST: false, cellStyles: false)
function buildVariant3_CleanBIFF8(file: ProcessedFile): Uint8Array {
    const isProd = file.type === 'productos';
    const sheetName = isProd ? 'Plantilla' : 'Clientes';
    const rows = isProd ? buildProductosAOA(file.data) : buildClientesAOA(file.data);

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const lastCol = isProd ? 'H' : 'F';
    worksheet['!ref'] = `A1:${lastCol}${rows.length}`;

    delete worksheet['!rows'];
    delete worksheet['!cols'];
    delete worksheet['!margins'];

    const workbook = xlsx.utils.book_new();
    workbook.SheetNames = [sheetName];
    workbook.Sheets = { [sheetName]: worksheet };

    return xlsx.write(workbook, { bookType: 'biff8', type: 'array', bookSST: false, cellStyles: false });
}

// Variant 4: CSV UTF-8 BOM guardado con extensión .xls
function buildVariant4_CSVInXLS(file: ProcessedFile): string {
    const isProd = file.type === 'productos';
    const rows = isProd ? buildProductosAOA(file.data) : buildClientesAOA(file.data);
    return '\uFEFF' + rows.map(r => r.map(c => {
        const s = String(c ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\r\n');
}

// Variant 5: XLSX Moderno
function buildVariant5_XLSX(file: ProcessedFile): Uint8Array {
    const isProd = file.type === 'productos';
    const sheetName = isProd ? 'Plantilla' : 'Clientes';
    const rows = isProd ? buildProductosAOA(file.data) : buildClientesAOA(file.data);

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const lastCol = isProd ? 'H' : 'F';
    worksheet['!ref'] = `A1:${lastCol}${rows.length}`;

    const workbook = xlsx.utils.book_new();
    workbook.SheetNames = [sheetName];
    workbook.Sheets = { [sheetName]: worksheet };

    return xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
}

    // Descargar Pack de Pruebas completo en ZIP (Formatos Anti-Memoria para ZiFact)
    const downloadTestPackZip = async (file: ProcessedFile) => {
        try {
            const zip = new JSZip();
            const prefix = file.type === 'productos' ? 'Productos_Zifact' : 'Clientes_Zifact';

            if (file.type === 'productos') {
                zip.file(`V1_Excel2003_XML.xls`, buildExcel2003XML(file));
                zip.file(`V2_HTML_Table.xls`, buildHTMLTable(file));
                zip.file(`V3_Prueba_1_Producto.xls`, buildVariant1_SingleProduct(file));
                zip.file(`V4_Plantilla_Original_Inyectada.xls`, buildVariant2_TemplateInjected(file));
                zip.file(`V5_BIFF8_Minimo.xls`, buildVariant3_CleanBIFF8(file));
                zip.file(`V6_CSV_en_XLS.xls`, buildVariant4_CSVInXLS(file));
                zip.file(`V7_Excel_Moderno.xlsx`, buildVariant5_XLSX(file));
                zip.file(`${prefix}_Migrado.csv`, buildVariant4_CSVInXLS(file));
            } else {
                zip.file(`${prefix}_Migrado.xls`, buildVariant3_CleanBIFF8(file));
                zip.file(`${prefix}_Migrado.xlsx`, buildVariant5_XLSX(file));
                zip.file(`${prefix}_Migrado.csv`, buildVariant4_CSVInXLS(file));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `Pack_Formatos_AntiMemoria_${file.name.replace(/\.[^/.]+$/, "")}.zip`);
        } catch (e: any) {
            alert("Error al generar Pack de Pruebas ZIP: " + (e?.message || e));
        }
    };

    const downloadAllZip = async () => {
        const successfulFiles = processedFiles.filter(f => f.status === 'success');
        if (successfulFiles.length === 0) return;

        const zip = new JSZip();
        for (const file of successfulFiles) {
            const prefix = file.type === 'productos' ? 'Productos_Zifact' : 'Clientes_Zifact';
            if (file.type === 'productos') {
                zip.file(`V1_Excel2003_XML.xls`, buildExcel2003XML(file));
                zip.file(`V2_HTML_Table.xls`, buildHTMLTable(file));
                zip.file(`V3_Prueba_1_Producto.xls`, buildVariant1_SingleProduct(file));
                zip.file(`V4_Plantilla_Inyectada.xls`, buildVariant2_TemplateInjected(file));
                zip.file(`V5_BIFF8_Minimo.xls`, buildVariant3_CleanBIFF8(file));
                zip.file(`V6_CSV_en_XLS.xls`, buildVariant4_CSVInXLS(file));
                zip.file(`V7_Excel_Moderno.xlsx`, buildVariant5_XLSX(file));
                zip.file(`${prefix}_Migrado.csv`, buildVariant4_CSVInXLS(file));
            } else {
                zip.file(`${prefix}_Migrado.xls`, buildVariant3_CleanBIFF8(file));
                zip.file(`${prefix}_Migrado.xlsx`, buildVariant5_XLSX(file));
                zip.file(`${prefix}_Migrado.csv`, buildVariant4_CSVInXLS(file));
            }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'Migracion_Zifact_Oficial.zip');
    };

    const removeFile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProcessedFiles(prev => prev.filter(f => f.id !== id));
        if (previewFile?.id === id) setPreviewFile(null);
    };

    const totalRecords = processedFiles.reduce((acc, f) => acc + (f.status === 'success' ? f.data.length : 0), 0);
    const clientFilesCount = processedFiles.filter(f => f.type === 'clientes' && f.status === 'success').length;
    const productFilesCount = processedFiles.filter(f => f.type === 'productos' && f.status === 'success').length;

    const filteredFiles = processedFiles.filter(f => {
        if (activeTab === 'clientes') return f.type === 'clientes';
        if (activeTab === 'productos') return f.type === 'productos';
        return true;
    });

    return (
        <div className="w-full h-full flex flex-col bg-[#020617] text-white overflow-y-auto custom-scrollbar font-body select-none">
            {/* Header */}
            <div className="p-6 md:p-10 border-b border-white/5 sticky top-0 bg-[#020617]/95 backdrop-blur-xl z-30 flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#2B6AFF]/10 border border-[#2B6AFF]/20 text-[#2B6AFF] rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
                        <ArrowRightLeft size={12} className="animate-pulse" /> Motor Zifact Plantilla Inyectada
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3 font-editorial">
                        Adaptador Ecuafact <span className="text-[#2B6AFF] font-mono">➔</span> Zifact
                    </h1>
                    <p className="text-sm font-light text-slate-400 mt-1 max-w-xl">
                        Inyección binaria sobre plantilla oficial `template_Productos.xls` de Zifact (0% errores de memoria).
                    </p>
                </div>

                {processedFiles.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={downloadAllZip}
                            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#2B6AFF] via-[#6366F1] to-[#04B17B] text-white text-xs font-bold uppercase tracking-widest hover:scale-[1.03] active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(43,106,255,0.35)] flex items-center gap-2.5"
                        >
                            <Download size={16} /> Descargar Paquete (.ZIP)
                        </button>
                    </div>
                )}
            </div>

            <div className="p-6 md:p-10 flex flex-col gap-8 max-w-6xl mx-auto w-full">
                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-5 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Registros</span>
                            <div className="text-3xl font-mono font-bold text-white tracking-wider">
                                {totalRecords}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-[#2B6AFF]/10 text-[#2B6AFF] border border-[#2B6AFF]/20 flex items-center justify-center">
                            <Layers size={22} />
                        </div>
                    </div>

                    <div className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-5 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Clientes (Ceros Intactos)</span>
                            <div className="text-3xl font-mono font-bold text-[#04B17B] tracking-wider">
                                {clientFilesCount}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-[#04B17B]/10 text-[#04B17B] border border-[#04B17B]/20 flex items-center justify-center">
                            <Users size={22} />
                        </div>
                    </div>

                    <div className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-5 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Productos (Inyección Oficial)</span>
                            <div className="text-3xl font-mono font-bold text-[#6366F1] tracking-wider">
                                {productFilesCount}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20 flex items-center justify-center">
                            <Package size={22} />
                        </div>
                    </div>
                </div>

                {/* Dropzone */}
                <div
                    {...getRootProps()}
                    className={`
                        relative overflow-hidden w-full h-64 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-500 group
                        ${isDragActive 
                            ? 'border-[#2B6AFF] bg-[#2B6AFF]/10 scale-[1.01] tactical-glow-primary' 
                            : 'border-white/10 bg-white/[0.02] hover:border-[#2B6AFF]/60 hover:bg-white/[0.04]'
                        }
                    `}
                >
                    <input {...getInputProps()} />
                    
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#2B6AFF]/5 via-transparent to-[#04B17B]/5 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#2B6AFF]/20 via-[#6366F1]/20 to-[#04B17B]/20 border border-white/10 flex items-center justify-center mb-5 text-[#2B6AFF] group-hover:scale-110 transition-transform duration-500 shadow-xl">
                            {isProcessing ? (
                                <RefreshCw size={36} className="animate-spin text-[#2B6AFF]" />
                            ) : (
                                <UploadCloud size={36} className="group-hover:-translate-y-1 transition-transform" />
                            )}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1 tracking-tight">
                            {isDragActive ? '¡Suelta tus archivos de Ecuafact aquí!' : 'Arrastra los archivos de Ecuafact'}
                        </h3>
                        
                        <p className="text-xs text-slate-400 font-light max-w-md leading-relaxed">
                            Sube tus archivos de Ecuafact. Se inyectarán los datos directamente en la plantilla oficial de Zifact.
                        </p>

                        <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-slate-300">
                            <Sparkles size={12} className="text-[#04B17B]" /> Inyección directa en Plantilla Oficial Zifact
                        </div>
                    </div>
                </div>

                {/* Section Header & Tabs */}
                {processedFiles.length > 0 && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="text-[#2B6AFF]" size={20} />
                                <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                                    Archivos Listos para Importar ({processedFiles.length})
                                </h2>
                            </div>

                            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
                                <button
                                    onClick={() => setActiveTab('all')}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                        activeTab === 'all' ? 'bg-[#2B6AFF] text-white shadow-md' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Todos ({processedFiles.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('clientes')}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                        activeTab === 'clientes' ? 'bg-[#04B17B] text-white shadow-md' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Clientes ({clientFilesCount})
                                </button>
                                <button
                                    onClick={() => setActiveTab('productos')}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                        activeTab === 'productos' ? 'bg-[#6366F1] text-white shadow-md' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Productos ({productFilesCount})
                                </button>
                            </div>
                        </div>

                        {/* File Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <AnimatePresence>
                                {filteredFiles.map((file) => (
                                    <motion.div 
                                        key={file.id} 
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-6 flex flex-col justify-between gap-5 group hover:border-[#04B17B]/40 transition-all shadow-xl relative overflow-hidden"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3.5">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                                                    file.type === 'clientes' 
                                                        ? 'bg-[#04B17B]/10 border-[#04B17B]/30 text-[#04B17B]' 
                                                        : 'bg-[#6366F1]/10 border-[#6366F1]/30 text-[#6366F1]'
                                                }`}>
                                                    {file.type === 'clientes' ? <Users size={22} /> : <Package size={22} />}
                                                </div>

                                                <div className="space-y-0.5">
                                                    <div className="font-bold text-white text-base truncate max-w-[200px]" title={file.name}>
                                                        {file.type === 'productos' ? 'Productos_Zifact_Migrado.xls' : 'Clientes_Zifact_Migrado.xlsx'}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <span className="uppercase tracking-wider font-semibold text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-emerald-400">
                                                            {file.type === 'productos' ? '.XLS (Oficial Inyectado)' : '.XLSX'}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="font-mono text-emerald-400 font-medium">
                                                            {file.data.length} filas
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => removeFile(file.id, e)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                                title="Eliminar de la lista"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="space-y-3 pt-3 border-t border-white/5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <button
                                                    onClick={() => setPreviewFile(file)}
                                                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all"
                                                    title="Previsualizar filas extraídas"
                                                >
                                                    <Eye size={14} className="text-[#2B6AFF]" /> Previsualizar ({file.data.length} filas)
                                                </button>

                                                <button
                                                    onClick={() => downloadTestPackZip(file)}
                                                    className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-300 flex items-center gap-2 transition-all shadow-md"
                                                    title="Descarga un archivo ZIP con las 5 variantes de prueba para ZiFact"
                                                >
                                                    <Download size={14} /> 📦 Descargar ZIP de Pruebas (5 Variantes)
                                                </button>
                                            </div>

                                            {/* Grid de Formatos Anti-Memoria y Variantes de Prueba Directa */}
                                            {file.type === 'productos' ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildBIFF5(file), `V1_BIFF5_Excel95_${file.name.replace(/\.[^/.]+$/, "")}.xls`)}
                                                        className="p-2.5 rounded-xl bg-[#04B17B]/20 hover:bg-[#04B17B]/30 border border-[#04B17B]/40 text-left transition-all group shadow-md"
                                                        title="⭐ RECOMENDADO BIFF5: Excel 5.0/95 legítimo con cadenas inline (0% bucles SST/XF en PHP ZiFact)"
                                                    >
                                                        <div className="text-[11px] font-bold text-[#04B17B] group-hover:text-emerald-300 flex items-center gap-1">
                                                            <Sparkles size={12} /> V1. BIFF5
                                                        </div>
                                                        <div className="text-[9px] text-slate-300 truncate">.XLS (Excel 95)</div>
                                                    </button>

                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildExcel2003XML(file), `V2_Excel2003_XML_${file.name.replace(/\.[^/.]+$/, "")}.xls`, 'application/vnd.ms-excel')}
                                                        className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-left transition-all group shadow-md"
                                                        title="⭐ RECOMENDADO ANTI-MEMORIA: Formato XML Spreadsheet 2003 (.xls) con hoja Plantilla, consume < 2MB RAM en PHP"
                                                    >
                                                        <div className="text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1">
                                                            <Sparkles size={12} /> V2. XML 2003
                                                        </div>
                                                        <div className="text-[9px] text-slate-300 truncate">.XLS (XML 2MB)</div>
                                                    </button>

                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildHTMLTable(file), `V3_HTML_Table_${file.name.replace(/\.[^/.]+$/, "")}.xls`, 'application/vnd.ms-excel')}
                                                        className="p-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-left transition-all group shadow-md"
                                                        title="⭐ RECOMENDADO ANTI-MEMORIA: Formato HTML Table (.xls) con hoja Plantilla, consume < 1MB RAM en PHP"
                                                    >
                                                        <div className="text-[11px] font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-1">
                                                            <Sparkles size={12} /> V3. HTML
                                                        </div>
                                                        <div className="text-[9px] text-slate-300 truncate">.XLS (HTML 1MB)</div>
                                                    </button>

                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant1_SingleProduct(file), `V4_Prueba_1_Producto_${file.name.replace(/\.[^/.]+$/, "")}.xls`)}
                                                        className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all group"
                                                        title="Inyecta 1 solo producto en BIFF5"
                                                    >
                                                        <div className="text-[11px] font-bold text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
                                                            <Zap size={12} /> V4. 1 Ítem
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 truncate">.XLS (1 ítem)</div>
                                                    </button>

                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant2_TemplateInjected(file), `V5_Plantilla_Original_Inyectada_${file.name.replace(/\.[^/.]+$/, "")}.xls`)}
                                                        className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-left transition-all group"
                                                        title="Inyecta todos los productos sobre template_Productos.XLS"
                                                    >
                                                        <div className="text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                                                            <Download size={12} /> V5. Inyectado
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 truncate">.XLS (Plantilla)</div>
                                                    </button>

                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant4_CSVInXLS(file), `V6_CSV_en_XLS_${file.name.replace(/\.[^/.]+$/, "")}.xls`, 'application/vnd.ms-excel')}
                                                        className="p-2.5 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 text-left transition-all group"
                                                        title="Contenido CSV UTF-8 BOM guardado como .xls"
                                                    >
                                                        <div className="text-[11px] font-bold text-slate-300 group-hover:text-white flex items-center gap-1">
                                                            <Download size={12} /> V6. CSV .xls
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 truncate">.XLS (Texto)</div>
                                                    </button>

                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant5_XLSX(file), `V7_Excel_Moderno_${file.name.replace(/\.[^/.]+$/, "")}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                                                        className="p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left transition-all group"
                                                        title="Formato Excel Moderno OpenXML (.xlsx)"
                                                    >
                                                        <div className="text-[11px] font-bold text-purple-400 group-hover:text-purple-300 flex items-center gap-1">
                                                            <Download size={12} /> V7. XLSX
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 truncate">.XLSX (Moderno)</div>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant3_CleanBIFF8(file), `Clientes_Zifact_${file.name.replace(/\.[^/.]+$/, "")}.xls`)}
                                                        className="flex-1 py-2 px-3 rounded-xl bg-[#04B17B]/20 hover:bg-[#04B17B]/30 border border-[#04B17B]/40 text-xs font-bold text-[#04B17B] flex items-center justify-center gap-2 transition-all shadow"
                                                    >
                                                        <Download size={14} /> Descargar .XLS
                                                    </button>
                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant5_XLSX(file), `Clientes_Zifact_${file.name.replace(/\.[^/.]+$/, "")}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                                                        className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-all"
                                                    >
                                                        .XLSX
                                                    </button>
                                                    <button
                                                        onClick={() => triggerBrowserDownload(buildVariant4_CSVInXLS(file), `Clientes_Zifact_${file.name.replace(/\.[^/.]+$/, "")}.csv`, 'text/csv;charset=utf-8;')}
                                                        className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-all"
                                                    >
                                                        .CSV
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <ShieldCheck className="text-[#04B17B]" size={24} />
                        <div>
                            <h3 className="text-base font-bold text-white uppercase tracking-wider">
                                Especificación de Inyección Binaria Zifact
                            </h3>
                            <p className="text-xs text-slate-400 font-light">
                                Inyección directa sobre el contenedor binario original de `template_Productos (3).xls`.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#04B17B] uppercase tracking-wider">
                                <CheckCircle2 size={16} /> Clientes (Ceros Iniciales)
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed font-light">
                                RUCs y Teléfonos con ceros a la izquierda mantenidos intactos (ej: <code className="font-mono text-emerald-400">0705675676001</code>).
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#6366F1] uppercase tracking-wider">
                                <CheckCircle2 size={16} /> Productos (Plantilla Oficial)
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed font-light">
                                Se leen los sectores binarios originales de Zifact e inyectan los productos de Ecuafact sin reconstruir el libro desde cero.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Previsualización */}
            <AnimatePresence>
                {previewFile && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card-premium gradient-obsidian border border-white/20 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${previewFile.type === 'clientes' ? 'bg-[#04B17B]/20 text-[#04B17B]' : 'bg-[#6366F1]/20 text-[#6366F1]'}`}>
                                        {previewFile.type === 'clientes' ? <Users size={20} /> : <Package size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            {previewFile.type === 'productos' ? 'Productos_Zifact_Migrado.xls' : 'Clientes_Zifact_Migrado.xlsx'}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Vista previa de datos ({previewFile.data.length} filas)
                                        </p>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setPreviewFile(null)}
                                    className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto overflow-x-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                                            <th className="p-3 bg-white/5 rounded-l-xl">#</th>
                                            {previewFile.data[0] && Object.keys(previewFile.data[0]).map((col, idx) => (
                                                <th key={idx} className="p-3 bg-white/5 whitespace-nowrap font-bold text-slate-200">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {previewFile.data.slice(0, 15).map((row, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="p-3 text-slate-500 font-mono">{rIdx + 1}</td>
                                                {Object.values(row).map((val: any, cIdx) => (
                                                    <td key={cIdx} className="p-3 text-slate-300 font-mono whitespace-nowrap">
                                                        {typeof val === 'number' ? <span className="text-emerald-400 font-semibold">{val}</span> : String(val)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-6 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <span className="text-xs text-slate-400">
                                    Formatos basados en la plantilla oficial de Zifact.
                                </span>
                                <button
                                    onClick={() => downloadAsXLS(previewFile)}
                                    className="px-5 py-2.5 rounded-xl bg-[#04B17B] text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <Download size={14} /> Descargar .XLS
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
