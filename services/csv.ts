
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime, RentaCategory } from '../types';
import { getPeriod } from './sri';
import { getClientServiceFee } from './clientService';
import { v4 as uuidv4 } from 'uuid';


export const exportClientsToCSV = (clients: Client[], serviceFees: ServiceFeesConfig) => {
  const headers = ['ID', 'RUC', 'Nombre', 'Clave SRI', 'Régimen', 'Categoría Renta', 'Teléfono', 'Email', 'Estado Declaración Actual', 'Tarifa Servicio', 'Estado Cliente', 'Notas'];
  const rows = clients.map(client => {
    const currentPeriod = getPeriod(client, new Date());
    const currentDeclaration = client.declarations.find(d => d.period === currentPeriod);
    const status = currentDeclaration ? currentDeclaration.status : DeclarationStatus.Pendiente;
    const fee = getClientServiceFee(client, serviceFees);
    const clientStatus = client.isActive ?? true ? 'Activo' : 'Inactivo';
    
    return [
      client.id,
      client.ruc,
      `"${client.name.replace(/"/g, '""')}"`,
      client.sriPassword,
      client.regime,
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
                declarations: [],
                isActive: true,
                ...clientProps,
                name: clientProps.name,
                sriPassword: clientProps.sriPassword || '',
                regime: clientProps.regime || TaxRegime.General,
            };
            result.clientsToCreate.push(newClient);
        }
    }

    return result;
};

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

    const header = (lines[0].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [])
        .map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

    const urlIndex = header.indexOf('url');
    const usernameIndex = header.indexOf('username');
    const passwordIndex = header.indexOf('password');

    if (urlIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
        result.errors.push({ lineNumber: 1, message: "Formato de contraseñas de navegador no reconocido (faltan columnas url, username o password).", data: lines[0] });
        return result;
    }

    const processedRucs = new Map<string, { password: string, line: number }>();

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
                processedRucs.set(ruc, { password, line: i + 1 });
            }
        }
    }

    processedRucs.forEach((data, ruc) => {
        const existingClient = existingClients.find(c => c.ruc === ruc);

        if (existingClient) {
            if (existingClient.sriPassword !== data.password) {
                result.clientsToUpdate.push({ 
                    existingClient: existingClient, 
                    updates: { sriPassword: data.password } 
                });
            }
        } else {
            const newClient: Client = {
                id: uuidv4(),
                ruc: ruc,
                name: `Usuario Importado [${ruc.slice(-4)}]`, 
                sriPassword: data.password,
                regime: TaxRegime.General, 
                declarations: [],
                isActive: true,
                notes: 'Importado desde contraseñas del navegador. Verificar nombre y régimen.'
            };
            result.clientsToCreate.push(newClient);
        }
    });

    return result;
};

// New function to parse credentials for the key-value store (without creating clients)
const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
};

export const parseCredentialsCSV = (fileContent: string): Record<string, string> => {
    const lines = fileContent.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
    const credentials: Record<string, string> = {};

    if (lines.length < 2) return credentials;

    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());

    const urlIndex = header.findIndex(h => h.includes('url') || h.includes('sitio') || h.includes('website') || h.includes('link'));
    const usernameIndex = header.findIndex(h => h.includes('username') || h.includes('usuario') || h.includes('login') || h.includes('ruc') || h.includes('cedula') || h.includes('user'));
    const passwordIndex = header.findIndex(h => h.includes('password') || h.includes('contrase') || h.includes('clave') || h.includes('pass'));

    // Si no se encuentran por nombre de cabecera, usar las posiciones estándar de Chrome: name=0, url=1, username=2, password=3
    const effectiveUrlIdx = urlIndex > -1 ? urlIndex : 1;
    const effectiveUserIdx = usernameIndex > -1 ? usernameIndex : 2;
    const effectivePassIdx = passwordIndex > -1 ? passwordIndex : 3;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = parseCSVLine(line);

        const url = values[effectiveUrlIdx] || values[0] || '';
        const username = values[effectiveUserIdx] || '';
        const password = values[effectivePassIdx] || '';

        if (!password || password.toLowerCase() === 'password' || password.toLowerCase() === 'contraseña') continue;

        const cleanUser = username.trim();
        const rucMatch = cleanUser.match(/\b\d{10,13}\b/);
        const rucCandidate = rucMatch ? rucMatch[0] : (cleanUser.length >= 10 && cleanUser.length <= 13 && /^\d+$/.test(cleanUser) ? cleanUser : '');

        const isSriUrl = url.toLowerCase().includes('sri') || url.toLowerCase().includes('ecuafact') || url.toLowerCase().includes('factur');

        if (rucCandidate || isSriUrl) {
            const targetRuc = rucCandidate || (cleanUser.match(/\d+/)?.[0] || '');
            if (targetRuc.length === 13) {
                credentials[targetRuc] = password;
                credentials[targetRuc.slice(0, 10)] = password;
            } else if (targetRuc.length === 10) {
                credentials[targetRuc] = password;
                credentials[targetRuc + '001'] = password;
            }
        }
    }
    
    return credentials;
};
