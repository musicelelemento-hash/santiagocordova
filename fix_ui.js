const fs = require('fs');
const path = require('path');
const file = path.join('c:', 'Users', 'Santiago', 'Documents', 'Visual Code Antigraviti', '01_Proyectos_Principales', 'SantiagoCordova.com', 'components', 'features', 'ClientDetailView.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Gestión de Cobro/g, 'FASE: LIQUIDACIÓN');
content = content.replace(/Registrar Pago/g, 'RECURSOS COMPROMETIDOS');

content = content.replace(/Contacto Email/g, 'ENLACE EMAIL');
content = content.replace(/Contacto Móvil/g, 'ENLACE MÓVIL');

content = content.replace(/<span className="text-\\[8px\\] font-medium text-slate-500 group-hover\\/btn:text-primary uppercase tracking-widest">SRI Web<\\/span>/g, '<span className="text-[9px] font-black text-slate-500 group-hover/btn:text-primary uppercase tracking-[0.2em]">PORTAL SRI</span>');

content = content.replace(/<span className="text-\\[8px\\] font-medium text-slate-500 group-hover\\/btn:text-emerald-400 uppercase tracking-widest">WhatsApp<\\/span>/g, '<span className="text-[9px] font-black text-slate-500 group-hover/btn:text-emerald-400 uppercase tracking-[0.2em]">WHATSAPP</span>');

content = content.replace(/Historial de Actividad<\/h3>/g, 'REGISTRO OPERATIVO</h3>');
content = content.replace(/Registro histórico de gestiones y validaciones<\/p>/g, 'TRAZABILIDAD DE ACCIONES Y VALIDACIONES</p>');

content = content.replace(/Perfil del Contribuyente<\/h3>/g, 'PERFIL DEL CONTRIBUYENTE</h3>');
content = content.replace(/Información de Contacto<\/h3>/g, 'INFORMACIÓN DE CONTACTO</h3>');
content = content.replace(/Protocolos Fiscales Avanzados<\/h3>/g, 'PROTOCOLOS FISCALES AVANZADOS</h3>');

// Update labels
content = content.replace(/text-\\[10px\\] font-medium text-slate-500 uppercase tracking-widest ml-1/g, 'text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1');

// Update tabs labels string
content = content.replace(/tab === 'profile' \? 'Estrategia' : tab === 'history' \? 'Operativas' : tab === 'vault' \? 'Bóveda' : 'Sistemas'/g, "tab === 'profile' ? 'ESTRATEGIA' : tab === 'history' ? 'OPERATIVAS' : tab === 'vault' ? 'DATA BÓVEDA' : 'SISTEMAS'");

// Update standard tab styles
content = content.replace(/px-6 sm:px-10 py-3 text-\\[10px\\] font-medium uppercase tracking-widest/g, 'px-6 sm:px-10 py-3 text-[10px] font-black uppercase tracking-[0.2em]');

fs.writeFileSync(file, content);
console.log('Done replacement!');
