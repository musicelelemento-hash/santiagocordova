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
            className={`group relative flex items-center justify-between w-full p-3 rounded-xl border transition-all duration-200 ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-teal/50 hover:shadow-sm'}`}
        >
            <div className="flex flex-col items-start truncate pr-2">
                {label && <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>}
                <span className={`font-mono text-sm font-medium truncate w-full text-left ${copied ? 'text-green-700' : 'text-slate-700 dark:text-slate-200'}`}>
                    {obscured ? '••••••••' : (text || 'N/A')}
                </span>
            </div>
            <div className={`p-2 flex-shrink-0 rounded-lg transition-colors ${copied ? 'bg-green-200 text-green-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-brand-teal group-hover:bg-brand-teal/10'}`}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
            </div>
        </button>
    );
};
