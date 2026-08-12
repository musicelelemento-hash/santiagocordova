import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function generateAutorizacionEcuafact(
    nombre: string,
    cedula: string,
    fecha: string
): Promise<void> {
    try {
        // Fetch the template from the public directory
        const response = await fetch('/Template_Autorizacion_Ecuafact.docx');
        if (!response.ok) {
            throw new Error(`Failed to load template: ${response.statusText}`);
        }
        const templateArrayBuffer = await response.arrayBuffer();

        // Load the DOCX zip structure
        const JSZipInstance = new (JSZip as any)();
        const zip = await JSZipInstance.loadAsync(templateArrayBuffer);
        
        // Read the document.xml file
        const docXmlPath = 'word/document.xml';
        let content = await zip.file(docXmlPath)?.async('string');
        
        if (!content) {
            throw new Error("Invalid DOCX format: missing word/document.xml");
        }

        // Replace the tags with the provided data
        content = content.replace(/\{NOMBRE\}/g, nombre.toUpperCase());
        content = content.replace(/\{CEDULA\}/g, cedula);
        content = content.replace(/\{FECHA\}/g, fecha);

        // Save the modified document.xml back into the zip
        zip.file(docXmlPath, content);

        // Generate the new DOCX file as a Blob
        const newDocxBlob = await zip.generateAsync({ type: 'blob' });

        // Trigger file download
        const fileName = `Autorizacion_Ecuafact_${nombre.replace(/\s+/g, '_')}.docx`;
        saveAs(newDocxBlob, fileName);
    } catch (error) {
        console.error("Error generating DOCX:", error);
        throw error;
    }
}
