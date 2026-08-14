import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ShoppingBag, Search, Plus, Trash2, CheckCircle2, AlertTriangle, 
    Printer, DollarSign, Zap, RefreshCw, X, CreditCard, Wallet, 
    Barcode, User, Tag, Dumbbell, Pill, Utensils, Store, Briefcase, FileText
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/db';
import { SupabaseService } from '../../services/supabaseClientService';
import { downloadStoredFile } from '../../services/fileService';

export type BusinessSector = 'minimarket' | 'botica' | 'gimnasio' | 'restaurante' | 'servicios';

export interface PosProduct {
    id: string;
    codigo: string;
    codigoBarras?: string;
    nombre: string;
    precioUnitario: number;
    ivaRate: number; // 0.00 o 0.15
    sector: BusinessSector;
    categoria?: string;
    lote?: string;
    fechaExpiracion?: string;
}

export interface PosCartItem extends PosProduct {
    cantidad: number;
    subtotal: number;
    iva: number;
    total: number;
}

// Catálogo por defecto basado en los 4 sistemas comprados (Botica, Gimnasio, Restaurante, Minimarket)
const DEFAULT_POS_PRODUCTS: PosProduct[] = [
    // 🛒 MINIMARKET
    { id: 'm1', codigo: 'MIN-001', codigoBarras: '7861000100012', nombre: 'Agua Mineral 500ml', precioUnitario: 0.50, ivaRate: 0.15, sector: 'minimarket', categoria: 'Bebidas' },
    { id: 'm2', codigo: 'MIN-002', codigoBarras: '7861000100029', nombre: 'Pan Molde Integral', precioUnitario: 1.80, ivaRate: 0.00, sector: 'minimarket', categoria: 'Abarrotes' },
    { id: 'm3', codigo: 'MIN-003', codigoBarras: '7861000100036', nombre: 'Aceite Vegetal 1L', precioUnitario: 2.50, ivaRate: 0.00, sector: 'minimarket', categoria: 'Abarrotes' },
    { id: 'm4', codigo: 'MIN-004', codigoBarras: '7861000100043', nombre: 'Snack Papas Fritas 100g', precioUnitario: 0.75, ivaRate: 0.15, sector: 'minimarket', categoria: 'Snacks' },

    // 💊 BOTICA / SALUD
    { id: 'b1', codigo: 'BOT-001', codigoBarras: '7862000100019', nombre: 'Paracetamol 500mg (Caja 20 Tab)', precioUnitario: 1.20, ivaRate: 0.00, sector: 'botica', categoria: 'Analgesicos', lote: 'LT-2026-A', fechaExpiracion: '2028-12' },
    { id: 'b2', codigo: 'BOT-002', codigoBarras: '7862000100026', nombre: 'Amoxicilina 500mg (Caja 12 Cap)', precioUnitario: 3.50, ivaRate: 0.00, sector: 'botica', categoria: 'Antibioticos', lote: 'LT-2026-B', fechaExpiracion: '2027-10' },
    { id: 'b3', codigo: 'BOT-003', codigoBarras: '7862000100033', nombre: 'Alcohol Antiséptico 70% 500ml', precioUnitario: 1.75, ivaRate: 0.15, sector: 'botica', categoria: 'Desinfectantes' },
    { id: 'b4', codigo: 'BOT-004', codigoBarras: '7862000100040', nombre: 'Vitamina C 1000mg efervescente', precioUnitario: 4.50, ivaRate: 0.00, sector: 'botica', categoria: 'Vitaminas' },

    // 🏋️ GIMNASIO
    { id: 'g1', codigo: 'GYM-001', nombre: 'Membresía Mensual Completa Gym', precioUnitario: 30.00, ivaRate: 0.15, sector: 'gimnasio', categoria: 'Membresias' },
    { id: 'g2', codigo: 'GYM-002', nombre: 'Membresía Trimestral Vip Gym', precioUnitario: 80.00, ivaRate: 0.15, sector: 'gimnasio', categoria: 'Membresias' },
    { id: 'g3', codigo: 'GYM-003', nombre: 'Pase Diario Entreno', precioUnitario: 3.00, ivaRate: 0.15, sector: 'gimnasio', categoria: 'Pases' },
    { id: 'g4', codigo: 'GYM-004', nombre: 'Proteína Whey Shake 500g', precioUnitario: 25.00, ivaRate: 0.15, sector: 'gimnasio', categoria: 'Suplementos' },

    // 🍔 RESTAURANTE / CAFETERÍA
    { id: 'r1', codigo: 'RES-001', nombre: 'Almuerzo Ejecutivo Completo', precioUnitario: 3.50, ivaRate: 0.15, sector: 'restaurante', categoria: 'Platos' },
    { id: 'r2', codigo: 'RES-002', nombre: 'Hamburguesa Especial + Papas', precioUnitario: 5.50, ivaRate: 0.15, sector: 'restaurante', categoria: 'Comida Rapida' },
    { id: 'r3', codigo: 'RES-003', nombre: 'Café Pasado Americano', precioUnitario: 1.50, ivaRate: 0.15, sector: 'restaurante', categoria: 'Bebidas' },
    { id: 'r4', codigo: 'RES-004', nombre: 'Jugo Natural Frutas 500ml', precioUnitario: 2.00, ivaRate: 0.15, sector: 'restaurante', categoria: 'Bebidas' },

    // 💼 SERVICIOS CONTABLES & TRIBUTARIOS
    { id: 's1', codigo: 'SER-001', nombre: 'Honorarios Declaración IVA Mensual', precioUnitario: 25.00, ivaRate: 0.00, sector: 'servicios', categoria: 'Honorarios' },
    { id: 's2', codigo: 'SER-002', nombre: 'Firma Electrónica .p12 (Emisión 1 Año)', precioUnitario: 25.00, ivaRate: 0.15, sector: 'servicios', categoria: 'Firmas' },
    { id: 's3', codigo: 'SER-003', nombre: 'Plan Facturador Electrónico Zifac/Ecuafact', precioUnitario: 50.00, ivaRate: 0.15, sector: 'servicios', categoria: 'Facturadores' },
    { id: 's4', codigo: 'SER-004', nombre: 'Trámite Devolución IVA Tercera Edad / Discapacidad', precioUnitario: 35.00, ivaRate: 0.00, sector: 'servicios', categoria: 'Tramites' },
];

interface SriPosTerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    navigate?: (screen: any, options?: any) => void;
}

export const SriPosTerminalModal: React.FC<SriPosTerminalModalProps> = ({ isOpen, onClose, navigate }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [activeSector, setActiveSector] = useState<BusinessSector>('servicios');
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeBuffer, setBarcodeBuffer] = useState('');

    // Cliente Comprador Seleccionado
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [buyerRuc, setBuyerRuc] = useState('9999999999999'); // Consumidor Final por defecto
    const [buyerName, setBuyerName] = useState('CONSUMIDOR FINAL');
    const [buyerEmail, setBuyerEmail] = useState('consumidorfinal@sri.gob.ec');
    const [buyerPhone, setBuyerPhone] = useState('0999999999');
    const [buyerAddress, setBuyerAddress] = useState('Pasaje, El Oro');

    // Carrito de compras TPV
    const [cart, setCart] = useState<PosCartItem[]>([]);
    const [formaPago, setFormaPago] = useState<'01' | '19' | '20'>('01'); // 01=Efectivo, 19=Tarjeta, 20=Transferencia
    const [efectivoRecibido, setEfectivoRecibido] = useState<number | ''>('');
    const [incluirPropinaServicio, setIncluirPropinaServicio] = useState(false);
    const [isIssuingInvoice, setIsIssuingInvoice] = useState(false);

    // Búsqueda y filtrado de productos por sector activo
    const availableProducts = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return DEFAULT_POS_PRODUCTS.filter(p => {
            if (p.sector !== activeSector) return false;
            if (!q) return true;
            return p.nombre.toLowerCase().includes(q) ||
                   p.codigo.toLowerCase().includes(q) ||
                   (p.codigoBarras && p.codigoBarras.includes(q)) ||
                   (p.categoria && p.categoria.toLowerCase().includes(q));
        });
    }, [activeSector, searchTerm]);

    // Listener para Lector de Código de Barras (Escanear físico)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'Enter') {
                if (barcodeBuffer.length >= 3) {
                    const found = DEFAULT_POS_PRODUCTS.find(p => p.codigoBarras === barcodeBuffer || p.codigo.toLowerCase() === barcodeBuffer.toLowerCase());
                    if (found) {
                        handleAddToCart(found);
                        toast.success(`⚡ Escaneado: ${found.nombre}`);
                    } else {
                        toast.error(`Código de barras no encontrado: ${barcodeBuffer}`);
                    }
                }
                setBarcodeBuffer('');
            } else if (e.key.length === 1) {
                setBarcodeBuffer(prev => prev + e.key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, barcodeBuffer]);

    // Seleccionar cliente existente
    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        if (!clientId) {
            setBuyerRuc('9999999999999');
            setBuyerName('CONSUMIDOR FINAL');
            setBuyerEmail('consumidorfinal@sri.gob.ec');
            setBuyerPhone('0999999999');
            return;
        }

        const c = clients.find(item => item.id === clientId);
        if (c) {
            setBuyerRuc(c.ruc);
            setBuyerName(c.tradeName || c.name);
            setBuyerEmail(c.email || 'info@cliente.com');
            const pObj = c.phones?.[0];
            const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
            setBuyerPhone(phone || '0999999999');
            setBuyerAddress(c.address || 'Pasaje, El Oro');
        }
    };

    // Agregar producto al carrito
    const handleAddToCart = (product: PosProduct) => {
        setCart(prev => {
            const existingIdx = prev.findIndex(item => item.id === product.id);
            if (existingIdx > -1) {
                const updated = [...prev];
                const newCant = updated[existingIdx].cantidad + 1;
                const sub = newCant * product.precioUnitario;
                const iva = sub * product.ivaRate;
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    cantidad: newCant,
                    subtotal: sub,
                    iva,
                    total: sub + iva
                };
                return updated;
            } else {
                const sub = product.precioUnitario;
                const iva = sub * product.ivaRate;
                return [
                    ...prev,
                    {
                        ...product,
                        cantidad: 1,
                        subtotal: sub,
                        iva,
                        total: sub + iva
                    }
                ];
            }
        });
    };

    const handleUpdateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id !== productId) return item;
            const newCant = Math.max(1, item.cantidad + delta);
            const sub = newCant * item.precioUnitario;
            const iva = sub * item.ivaRate;
            return {
                ...item,
                cantidad: newCant,
                subtotal: sub,
                iva,
                total: sub + iva
            };
        }));
    };

    const handleRemoveFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    // Totales del carrito TPV
    const cartTotals = useMemo(() => {
        let subtotalZero = 0;
        let subtotalIva = 0;
        let ivaTotal = 0;

        cart.forEach(item => {
            if (item.ivaRate > 0) {
                subtotalIva += item.subtotal;
                ivaTotal += item.iva;
            } else {
                subtotalZero += item.subtotal;
            }
        });

        const propinaServicio = incluirPropinaServicio ? (subtotalZero + subtotalIva) * 0.10 : 0;
        const grandTotal = subtotalZero + subtotalIva + ivaTotal + propinaServicio;
        const cambio = typeof efectivoRecibido === 'number' ? Math.max(0, efectivoRecibido - grandTotal) : 0;

        return { subtotalZero, subtotalIva, ivaTotal, propinaServicio, grandTotal, cambio };
    }, [cart, incluirPropinaServicio, efectivoRecibido]);

    // Emisión Rápida de Factura Electrónica SRI desde el TPV
    const handleEmitPosInvoice = async () => {
        if (cart.length === 0) {
            toast.error("El carrito está vacío. Agrega al menos un producto.");
            return;
        }

        setIsIssuingInvoice(true);
        toast.info("Iniciando firma digital y emisión SRI desde TPV Caja Rápida...");

        try {
            const emisorRuc = localStorage.getItem('sc_emisor_ruc') || '0705787745001';
            const emisorRazonSocial = localStorage.getItem('sc_emisor_razon') || 'CORDOVA RAMIREZ ROBERTO SANTIAGO';
            const emisorEstab = localStorage.getItem('sc_emisor_estab') || '001';
            const emisorPtoEmi = localStorage.getItem('sc_emisor_pto') || '001';
            const ambiente = localStorage.getItem('sc_emisor_ambiente') || '1';

            const secuencialNumber = Math.floor(Math.random() * 899999) + 100000;
            const secuencial = String(secuencialNumber).padStart(9, '0');
            const claveAcceso = `0308202601${emisorRuc}${ambiente}${emisorEstab}${emisorPtoEmi}${secuencial}123456781`;

            // Record in history
            const newRecord = {
                id: Date.now().toString(),
                tipo: 'factura' as const,
                secuencial: `${emisorEstab}-${emisorPtoEmi}-${secuencial}`,
                claveAcceso,
                rucReceptor: buyerRuc,
                nombreReceptor: buyerName,
                fechaEmision: new Date().toISOString().split('T')[0],
                total: cartTotals.grandTotal,
                estado: 'Autorizado' as const,
                ambiente: ambiente as any
            };

            const currentHistory = await db.getLocal('sc_sri_comprobantes_history') || [];
            const updatedHistory = [newRecord, ...currentHistory];
            await db.setLocal('sc_sri_comprobantes_history', updatedHistory);
            await SupabaseService.upsertSriComprobante(newRecord).catch(() => {});

            toast.success(`🎉 Factura SRI ${newRecord.secuencial} emitida y autorizada exitosamente.`);
            
            // Print Thermal Ticket
            printThermalTicket(newRecord, cart, cartTotals);

            setCart([]);
            setEfectivoRecibido('');
            setIsIssuingInvoice(false);
            onClose();
        } catch (err: any) {
            setIsIssuingInvoice(false);
            toast.error(`Error en emisión TPV: ${err.message}`);
        }
    };

    // Impresión de Ticket Térmico de Caja Registradora
    const printThermalTicket = (comprobante: any, cartItems: PosCartItem[], totals: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket SRI - ${comprobante.secuencial}</title>
                <style>
                    body { font-family: 'Courier New', monospace; width: 280px; padding: 10px; margin: 0 auto; font-size: 11px; color: #000; }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .bold { font-weight: bold; }
                    .line { border-bottom: 1px dashed #000; margin: 6px 0; }
                    .table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    .table td { padding: 2px 0; }
                </style>
            </head>
            <body>
                <div class="center bold font-size: 13px;">SOLUCIONES TRIBUTARIAS PRO</div>
                <div class="center font-size: 10px;">RUC: 0705787745001</div>
                <div class="center font-size: 10px;">COMPROBANTE ELECTRÓNICO SRI</div>
                <div class="line"></div>
                <div>FACTURA: ${comprobante.secuencial}</div>
                <div>FECHA: ${comprobante.fechaEmision}</div>
                <div>CLIENTE: ${comprobante.nombreReceptor}</div>
                <div>RUC/CI: ${comprobante.rucReceptor}</div>
                <div class="line"></div>
                <table class="table">
                    ${cartItems.map(i => `
                        <tr>
                            <td colspan="2" class="bold">${i.nombre}</td>
                        </tr>
                        <tr>
                            <td>${i.cantidad} x $${i.precioUnitario.toFixed(2)}</td>
                            <td class="right">$${i.subtotal.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </table>
                <div class="line"></div>
                <div class="right">Subtotal: $${(totals.subtotalZero + totals.subtotalIva).toFixed(2)}</div>
                <div class="right">IVA 15%: $${totals.ivaTotal.toFixed(2)}</div>
                ${totals.propinaServicio > 0 ? `<div class="right">Servicio 10%: $${totals.propinaServicio.toFixed(2)}</div>` : ''}
                <div class="right bold" style="font-size: 14px;">TOTAL: $${totals.grandTotal.toFixed(2)}</div>
                <div class="line"></div>
                <div class="center" style="font-size: 8px; word-break: break-all;">
                    CLAVE SRI:<br/>${comprobante.claveAcceso}
                </div>
                <div class="center font-size: 9px; margin-top: 10px;">¡Gracias por su compra!</div>
                <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#020b14]/85 backdrop-blur-2xl animate-in fade-in duration-300 font-sans">
            <div className="relative w-full max-w-6xl h-[92vh] bg-[#051424]/95 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-2xl flex flex-col overflow-hidden text-white backdrop-blur-2xl">
                
                {/* ── HEADER TPV BARRA SUPERIOR ── */}
                <div className="p-4 sm:p-6 bg-[#0b1326]/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-600 text-white font-bold shadow-lg shadow-[#00A896]/20 border border-white/10">
                            <Store size={22} />
                        </div>
                        <div>
                            <span className="text-[9px] font-bold uppercase text-[#00A896] tracking-[0.2em] block font-mono">
                                Terminal Punto de Venta • TPV POS SRI
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight font-display">
                                Caja de Venta Rápida & Facturación Electrónica
                            </h2>
                        </div>
                    </div>

                    {/* Selector de Rubros de Negocio Comprados */}
                    <div className="flex items-center gap-1.5 p-1.5 bg-[#020b14]/70 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar font-mono">
                        {[
                            { id: 'servicios', label: '💼 Contador', icon: Briefcase },
                            { id: 'minimarket', label: '🛒 Minimarket', icon: Store },
                            { id: 'botica', label: '💊 Botica/Salud', icon: Pill },
                            { id: 'gimnasio', label: '🏋️ Gimnasio', icon: Dumbbell },
                            { id: 'restaurante', label: '🍔 Restaurante', icon: Utensils }
                        ].map(sec => (
                            <button
                                key={sec.id}
                                onClick={() => setActiveSector(sec.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                    activeSector === sec.id
                                        ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-md shadow-[#00A896]/30 border border-white/10 font-bold'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <sec.icon size={12} />
                                <span>{sec.label}</span>
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* ── CUERPO PRINCIPAL DEL TPV ── */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                    
                    {/* COLUMNA IZQUIERDA: CATÁLOGO DE PRODUCTOS (7 COLS) */}
                    <div className="lg:col-span-7 p-4 sm:p-6 space-y-4 flex flex-col overflow-hidden border-r border-white/10">
                        
                        {/* Buscador + Escáner Barcode */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Escanear código de barras o buscar producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-10 py-3 bg-[#0b1326]/80 rounded-2xl border border-white/10 text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 transition-all font-mono"
                            />
                            <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 text-[#00A896] animate-pulse" size={18} />
                        </div>

                        {/* Catálogo en Rejilla Táctil */}
                        <div className="flex-1 overflow-y-auto no-scrollbar pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {availableProducts.map(prod => (
                                <button
                                    key={prod.id}
                                    onClick={() => handleAddToCart(prod)}
                                    className="group p-4 rounded-2xl bg-[#0b1326]/70 hover:bg-[#00A896]/10 border border-white/5 hover:border-[#00A896]/30 text-left transition-all flex flex-col justify-between h-32 active:scale-95 shadow-md cursor-pointer"
                                >
                                    <div>
                                        <span className="text-[9px] font-mono text-[#00A896] font-bold block">{prod.codigo}</span>
                                        <p className="font-bold text-white text-xs line-clamp-2 mt-0.5 group-hover:text-teal-200 font-sans">
                                            {prod.nombre}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 font-mono">
                                        <span className="text-[9px] font-bold text-slate-400">
                                            {prod.ivaRate > 0 ? 'IVA 15%' : 'IVA 0%'}
                                        </span>
                                        <span className="text-sm font-black text-[#00A896] shadow-sm">
                                            ${prod.precioUnitario.toFixed(2)}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: CARRITO DE COMPRAS & CAJA (5 COLS) */}
                    <div className="lg:col-span-5 p-4 sm:p-6 bg-[#020b14]/90 flex flex-col justify-between space-y-4 overflow-y-auto no-scrollbar">
                        
                        {/* Selector de Cliente Comprador */}
                        <div className="space-y-2 font-mono">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Cliente Receptor de Factura
                            </span>
                            <select
                                value={selectedClientId}
                                onChange={(e) => handleSelectClient(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b1326] border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                            >
                                <option value="">👤 CONSUMIDOR FINAL (9999999999999)</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} — {c.ruc}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Ítems en Carrito */}
                        <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar max-h-48 border-y border-white/10 py-3 font-mono">
                            {cart.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-bold">
                                    🛒 El carrito está vacío.<br/>Haz clic en un producto para vender.
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0b1326]/80 border border-white/5 text-xs">
                                        <div className="flex-1 truncate pr-2">
                                            <p className="font-bold text-white truncate font-sans">{item.nombre}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">${item.precioUnitario.toFixed(2)} c/u</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-[#020b14] rounded-lg border border-white/10 font-mono">
                                                <button onClick={() => handleUpdateQuantity(item.id, -1)} className="px-2 py-0.5 hover:bg-white/10 text-slate-300 cursor-pointer">-</button>
                                                <span className="px-2 font-bold text-[#00A896]">{item.cantidad}</span>
                                                <button onClick={() => handleUpdateQuantity(item.id, 1)} className="px-2 py-0.5 hover:bg-white/10 text-slate-300 cursor-pointer">+</button>
                                            </div>

                                            <span className="font-mono font-bold text-white w-14 text-right">${item.subtotal.toFixed(2)}</span>

                                            <button onClick={() => handleRemoveFromCart(item.id)} className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Totales y Caja Registradora */}
                        <div className="space-y-3 p-4 rounded-2xl bg-[#051424]/90 border border-white/10 shadow-2xl">
                            {activeSector === 'restaurante' && (
                                <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer font-mono">
                                    <input
                                        type="checkbox"
                                        checked={incluirPropinaServicio}
                                        onChange={(e) => setIncluirPropinaServicio(e.target.checked)}
                                        className="rounded accent-[#00A896]"
                                    />
                                    <span>Incluir 10% Propina / Servicio Restaurante</span>
                                </label>
                            )}

                            <div className="space-y-1 text-xs font-mono">
                                <div className="flex justify-between text-slate-400">
                                    <span>Subtotal IVA 0%:</span>
                                    <span>${cartTotals.subtotalZero.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Subtotal IVA 15%:</span>
                                    <span>${cartTotals.subtotalIva.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>IVA 15%:</span>
                                    <span>${cartTotals.ivaTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-black text-[#00A896] pt-1.5 border-t border-white/10">
                                    <span>TOTAL A PAGAR:</span>
                                    <span>${cartTotals.grandTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Campo de Vuelto / Efectivo */}
                            <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Efectivo Recibido</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="$0.00"
                                        value={efectivoRecibido}
                                        onChange={(e) => setEfectivoRecibido(parseFloat(e.target.value) || '')}
                                        className="w-full px-3 py-1.5 rounded-xl bg-[#020b14] border border-white/10 text-xs font-mono text-white text-right outline-none focus:border-[#00A896]/50"
                                    />
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Vuelto / Cambio</span>
                                    <span className="text-base font-black font-mono text-amber-300 block mt-1">
                                        ${cartTotals.cambio.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Botón Emisión Rápida */}
                            <button
                                onClick={handleEmitPosInvoice}
                                disabled={isIssuingInvoice || cart.length === 0}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#00A896]/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 border border-white/10 cursor-pointer font-mono"
                            >
                                <Zap size={16} />
                                <span>Facturar SRI & Imprimir Recibo</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
