
import { Client, ClientCategory, DeclarationStatus, ServiceFeesConfig, TaxRegime, RentaCategory } from '../types';
import { getPeriod } from './sri';
import { getClientServiceFee } from './clientService';
import { v4 as uuidv4 } from 'uuid';


export const exportClientsToCSV = (clients: Client[], serviceFees: ServiceFeesConfig) => {
  const headers = ['ID', 'RUC', 'Nombre', 'Clave SRI', 'Régimen', 'Categoría IVA', 'Categoría Renta', 'Teléfono', 'Email', 'Estado Declaración Actual', 'Tarifa Servicio', 'Estado Cliente', 'Notas'];
  const rows = clients.map(client => {
    const currentPeriod = getPeriod(client, new Date());
    const currentDeclaration = client.declarationHistory.find(d => d.period === currentPeriod);
    const status = currentDeclaration ? currentDeclaration.status : DeclarationStatus.Pendiente;
    const fee = getClientServiceFee(client, serviceFees);
    const clientStatus = client.isActive ?? true ? 'Activo' : 'Inactivo';
    
    return [
      client.id,
      client.ruc,
      `"${client.name.replace(/"/g, '""')}"`,
      client.sriPassword,
      client.regime,
      client.category,
      client.rentaCategory || '',
      (client.phones || []).join('; '),
      client.email || '',
      status,
      fee.toFixed(2),
      clientStatus,
      `"${(client.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const date = new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `reporte_clientes_${date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export interface CSVParseResult {
    clientsToCreate: Client[];
    clientsToUpdate: {
        existingClient: Client;
        updates: Partial<Client>;
    }[];
    errors: {
        lineNumber: number;
        message: string;
        data: string;
    }[];
}

export const parseClientsFromCSV = (
    fileContent: string, 
    existingClients: Client[]
): CSVParseResult => {
    const lines = fileContent.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
    const result: CSVParseResult = {
        clientsToCreate: [],
        clientsToUpdate: [],
        errors: [],
    };

    if (lines.length < 2) {
        result.errors.push({ lineNumber: 1, message: "El archivo CSV está vacío o solo contiene la cabecera.", data: '' });
        return result;
    }

    const header = (lines[0].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
        .map(h => h.trim().toLowerCase().replace(/^"|"$/g, '').replace(/\s+/g, '').replace(/í/g, 'i').replace(/ó/g, 'o'));
    
    const rucIndex = header.indexOf('ruc');
    
    if (rucIndex === -1) {
        result.errors.push({ lineNumber: 1, message: "El archivo CSV debe contener una columna 'ruc'.", data: lines[0] });
        return result;
    }

    for (let i = 1; i < lines.length; i++) {
        const lineNumber = i + 1;
        const line = lines[i];
        // Regex to handle commas inside quotes
        const values = (line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
            .map(v => v.trim().replace(/^"|"$/g, ''));
        
        const clientData: { [key: string]: string } = {};
        header.forEach((h, index) => {
            clientData[h] = values[index] || '';
        });

        const ruc = clientData.ruc;
        if (!ruc) {
            result.errors.push({ lineNumber, message: `RUC vacío.`, data: line });
            continue;
        }
        if (!/^\d{13}$/.test(ruc)) {
            result.errors.push({ lineNumber, message: `RUC inválido: ${ruc}. Debe tener 13 dígitos.`, data: line });
            continue;
        }

        const clientStatus = clientData.estadocliente?.toLowerCase();
        
        const clientProps: Partial<Client> = {
            name: clientData.nombre || clientData.name,
            sriPassword: clientData.clavesri || clientData.sripassword || clientData.clave,
            regime: (clientData.regimen || clientData.regime) as TaxRegime,
            category: (clientData.categoriaiva || clientData.categoria || clientData.category) as ClientCategory,
            rentaCategory: (clientData.categoriarenta) as RentaCategory,
            phones: (clientData.telefono || clientData.phone || '').split(';').map(p => p.trim()).filter(Boolean),
            email: clientData.email,
            notes: clientData.notas || clientData.notes,
            customServiceFee: clientData.tarifaservicio ? parseFloat(clientData.tarifaservicio) : undefined,
            isActive: clientStatus ? (clientStatus === 'activo') : undefined,
        };

        Object.keys(clientProps).forEach(key => {
            const value = (clientProps as any)[key];
            if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
                delete (clientProps as any)[key];
            }
        });
        
        if (clientProps.regime && !Object.values(TaxRegime).includes(clientProps.regime)) delete clientProps.regime;
        if (clientProps.category && !Object.values(ClientCategory).includes(clientProps.category)) delete clientProps.category;
        if (clientProps.rentaCategory && !Object.values(RentaCategory).includes(clientProps.rentaCategory)) delete clientProps.rentaCategory;

        const existingClient = existingClients.find(c => c.ruc === ruc);

        if (existingClient) {
            result.clientsToUpdate.push({ existingClient: existingClient, updates: clientProps });
        } else {
            if (!clientProps.name) {
                 result.errors.push({ lineNumber, message: `Falta el nombre para el nuevo cliente con RUC ${ruc}.`, data: line });
                 continue;
            }
            const newClient: Client = {
                id: uuidv4(),
                ruc: ruc,
                declarationHistory: [],
                isActive: true,
                ...clientProps,
                name: clientProps.name,
                sriPassword: clientProps.sriPassword || '',
                regime: clientProps.regime || TaxRegime.General,
                category: clientProps.category || ClientCategory.SuscripcionMensual,
            };
            result.clientsToCreate.push(newClient);
        }
    }

    return result;
};

// New function specifically for Chrome/Browser Password Exports
export const parseBrowserPasswordsCSV = (
    fileContent: string,
    existingClients: Client[]
): CSVParseResult => {
    const lines = fileContent.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
    const result: CSVParseResult = {
        clientsToCreate: [],
        clientsToUpdate: [],
        errors: [],
    };

    if (lines.length < 2) {
        result.errors.push({ lineNumber: 1, message: "El archivo está vacío.", data: '' });
        return result;
    }

    // Browser exports usually have headers: name,url,username,password,note
    const header = (lines[0].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
        .map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

    const urlIndex = header.indexOf('url');
    const usernameIndex = header.indexOf('username');
    const passwordIndex = header.indexOf('password');

    if (urlIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        result.errors.push({ lineNumber: 1, message: "Formato de contraseñas de navegador no reconocido (faltan columnas url, username o password).", data: lines[0] });
        return result;
    }

    // Use a map to deduplicate RUCs within the file, keeping the last one found
    const processedRucs = new Map<string, { password: string, line: number }>();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = (line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
            .map(v => v.trim().replace(/^"|"$/g, ''));

        const url = values[urlIndex] || '';
        const username = values[usernameIndex] || '';
        const password = values[passwordIndex] || '';

        // Filter only SRI related URLs
        if (url.includes('sri.gob.ec') && username && password) {
            // Clean RUC (username might be the RUC)
            const ruc = username.trim();
            
            if (/^\d{13}$/.test(ruc)) {
                processedRucs.set(ruc, { password, line: i + 1 });
            }
        }
    }

    // Process unique RUCs
    processedRucs.forEach((data, ruc) => {
        const existingClient = existingClients.find(c => c.ruc === ruc);

        if (existingClient) {
            // Only update if password changed
            if (existingClient.sriPassword !== data.password) {
                result.clientsToUpdate.push({ 
                    existingClient: existingClient, 
                    updates: { sriPassword: data.password } 
                });
            }
        } else {
            // Create placeholder client
            const newClient: Client = {
                id: uuidv4(),
                ruc: ruc,
                name: `Usuario Importado [${ruc.slice(-4)}]`, // Placeholder name
                sriPassword: data.password,
                regime: TaxRegime.General, // Default
                category: ClientCategory.SuscripcionMensual, // Default
                declarationHistory: [],
                isActive: true,
                notes: 'Importado desde contraseñas del navegador. Verificar nombre y régimen.'
            };
            result.clientsToCreate.push(newClient);
        }
    });

    return result;
};

// Function to parse CSV into a Credentials Map
export const parseCredentialsCSV = (fileContent: string): Record<string, string> => {
    const lines = fileContent.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
    const credentials: Record<string, string> = {};

    if (lines.length < 2) return credentials;

    const header = (lines[0].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
        .map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

    const urlIndex = header.indexOf('url');
    const usernameIndex = header.indexOf('username');
    const passwordIndex = header.indexOf('password');

    if (urlIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        return credentials;
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = (line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
            .map(v => v.trim().replace(/^"|"$/g, ''));

        const url = values[urlIndex] || '';
        const username = values[usernameIndex] || '';
        const password = values[passwordIndex] || '';

        if (url.includes('sri.gob.ec') && username && password) {
            const ruc = username.trim();
            if (/^\d{13}$/.test(ruc)) {
                credentials[ruc] = password;
            }
        }
    }
    
    return credentials;
};
