import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
    text: string;
    label?: string;
    obscured?: boolean;
    onCopy?: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, label, obscured, onCopy }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        if (onCopy) onCopy();
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className={`group relative flex items-center justify-between w-full p-4 rounded-xl border transition-all duration-500 shadow-sm ${copied ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-100 hover:border-primary/30 hover:shadow-md'}`}
        >
            <div className="flex flex-col items-start truncate pr-2">
                {label && <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 font-premium">{label}</span>}
                <span className={`font-mono text-xs font-black truncate w-full text-left uppercase tracking-widest ${copied ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {obscured ? '••••••••' : (text || 'N/A')}
                </span>
            </div>
            <div className={`p-2.5 flex-shrink-0 rounded-xl transition-all duration-300 ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-50 border border-slate-100 text-slate-400 group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/20'}`}>
                {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.5} />}
            </div>
        </button>
    );
};
