import React, { useState } from 'react';
import { 
    Award, Printer, Download, Search, CheckCircle2, ShieldCheck, 
    FileText, Calendar, UserCheck, X, Sparkles, AlertCircle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';

interface TaxCertificateGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TaxCertificateGeneratorModal: React.FC<TaxCertificateGeneratorModalProps> = ({ isOpen, onClose }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [selectedClientId, setSelectedClientId] = useState('');
    const [motivoEmision, setMotivoEmision] = useState('Trámites Bancarios / Crédito Comercial');
    const [validezDias, setValidezDias] = useState<number>(30);

    const activeClient = clients.find(c => c.id === selectedClientId);

    const handlePrintCertificate = () => {
        if (!activeClient) {
            toast.error("Selecciona un cliente del directorio.");
            return;
        }

        const codigoCertificado = `CERT-SRI-${Date.now().toString().slice(-6)}`;
        const fechaEmision = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
        const fechaVencimiento = new Date(Date.now() + validezDias * 86400000).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Certificado de Cumplimiento Contable - ${codigoCertificado}</title>
                <style>
                    body { font-family: 'Georgia', serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                    .header { text-align: center; border-b: 2px solid #00A896; padding-bottom: 20px; margin-bottom: 30px; }
                    .firm-name { font-size: 22px; font-weight: 900; color: #00A896; text-transform: uppercase; letter-spacing: 1px; }
                    .firm-sub { font-size: 11px; color: #64748b; font-family: sans-serif; }
                    .cert-title { text-align: center; font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 30px 0; color: #1e1b4b; letter-spacing: 2px; }
                    .content { font-size: 14px; text-align: justify; margin-bottom: 40px; }
                    .grid-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; margin: 25px 0; font-family: sans-serif; font-size: 13px; }
                    .signatures { display: flex; justify-content: space-around; margin-top: 80px; text-align: center; font-family: sans-serif; font-size: 12px; }
                    .sig-line { border-top: 1px solid #0f172a; width: 220px; margin: 0 auto 5px auto; }
                    .footer { text-align: center; margin-top: 50px; font-size: 10px; color: #64748b; border-t: 1px dashed #cbd5e1; padding-top: 15px; font-family: sans-serif; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="firm-name">SOLUCIONES CONTABLES & TRIBUTARIAS PRO</div>
                    <div class="firm-sub">Santiago Córdova — Contador Público & Asesoría Fiscal</div>
                    <div class="firm-sub">RUC: 0705787745001 • Pasaje, El Oro, Ecuador</div>
                </div>

                <div class="cert-title">CERTIFICADO DE PAZ Y SALVO CONTABLE</div>

                <div class="content">
                    El suscrito Contador Público de <strong>SOLUCIONES CONTABLES PRO</strong>, a petición de parte interesada, por medio de la presente:
                    <br/><br/>
                    <strong>CERTIFICA QUE:</strong>
                    <br/><br/>
                    El contribuyente <strong>${activeClient.name.toUpperCase()}</strong>, identificado con RUC/Cédula <strong>${activeClient.ruc}</strong>, mantiene sus obligaciones contables y tributarias al día en el Servicio de Rentas Internas (SRI), así como sus honorarios de asesoría profesional cancelados satisfactoriamente a la presente fecha.
                </div>

                <div class="grid-box">
                    <strong>Código Único de Certificación:</strong> ${codigoCertificado}<br/>
                    <strong>Fecha de Emisión:</strong> ${fechaEmision}<br/>
                    <strong>Válido Hasta:</strong> ${fechaVencimiento}<br/>
                    <strong>Motivo de Uso:</strong> ${motivoEmision}
                </div>

                <div class="signatures">
                    <div>
                        <div class="sig-line"></div>
                        <strong>Ing. Roberto Santiago Córdova R.</strong><br/>
                        Contador General<br/>
                        RUC: 0705787745001
                    </div>
                </div>

                <div class="footer">
                    Este documento cuenta con certificación algorítmica y validez de la firma autorizada.
                </div>

                <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
            </body>
            </html>
        `);
        printWindow.document.close();
        toast.success(`📜 Certificado para ${activeClient.name} generado exitosamente.`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-lg bg-[hsl(222,47%,5%)] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden text-white p-6 sm:p-8 space-y-6">
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-600 text-white font-bold shadow-lg shadow-[#00A896]/20">
                            <Award size={22} />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-[#00A896] tracking-[0.2em] block">
                                Documentación Oficial
                            </span>
                            <h2 className="text-lg font-black text-white tracking-tight">
                                Certificado de Paz y Salvo Tributario
                            </h2>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 uppercase block">Seleccionar Cliente</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-bold text-white outline-none focus:border-[#00A896]"
                        >
                            <option value="">-- Seleccionar cliente del directorio --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.ruc}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 uppercase block">Motivo de Emisión</label>
                        <input
                            type="text"
                            value={motivoEmision}
                            onChange={(e) => setMotivoEmision(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-bold text-white outline-none focus:border-[#00A896]"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 uppercase block">Días de Validez</label>
                        <input
                            type="number"
                            value={validezDias}
                            onChange={(e) => setValidezDias(parseInt(e.target.value) || 30)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono font-bold text-white outline-none focus:border-[#00A896]"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                    <button
                        onClick={handlePrintCertificate}
                        disabled={!selectedClientId}
                        className="px-6 py-2.5 rounded-xl bg-[#00A896] hover:bg-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        <Printer size={14} />
                        <span>Generar & Imprimir PDF</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
