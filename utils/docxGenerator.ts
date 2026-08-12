import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { safeFormat } from './sri';

export interface EcuafactData {
    nombres: string;
    cedula: string;
    fecha?: Date;
    direccion?: string;
    email?: string;
    telefono?: string;
}

export const generateEcuafactContract = async (data: EcuafactData) => {
    try {
        const response = await fetch('/template_ecuafact.docx');
        if (!response.ok) throw new Error('No se pudo cargar la plantilla DOCX');
        
        const arrayBuffer = await response.arrayBuffer();
        
        const zip = new PizZip(arrayBuffer);
        
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' }
        });
        
        const fechaActual = data.fecha || new Date();
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const fechaFormateada = `Guayaquil, ${fechaActual.getDate()} de ${meses[fechaActual.getMonth()]} del ${fechaActual.getFullYear()}`;
        
        const templateData = {
            FECHA: fechaFormateada,
            fecha: fechaFormateada,
            NOMBRES: data.nombres,
            nombres: data.nombres,
            NOMBRE: data.nombres,
            CEDULA: data.cedula,
            cedula: data.cedula,
            RUC: data.cedula,
            DIRECCION: data.direccion || '',
            EMAIL: data.email || '',
            TELEFONO: data.telefono || ''
        };
        
        doc.render(templateData);
        
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        
        const fileName = `Autorizacion_Ecuafact_${data.cedula}.docx`;
        saveAs(out, fileName);
        return true;
    } catch (error) {
        console.error('Error generando DOCX:', error);
        throw error;
    }
};
