import React from 'react';
import { Copy } from 'lucide-react';

interface ProfileDataItemProps {
    icon: any;
    label: string;
    value: string;
    onCopy?: (text: string) => void;
}

export const ProfileDataItem: React.FC<ProfileDataItemProps> = ({ icon: Icon, label, value, onCopy }) => (
    <div className="flex items-start gap-4 group/item">
        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-all shadow-sm border border-slate-100">
            <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium">{label}</p>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm font-black text-slate-900 truncate tracking-tight font-premium uppercase">{value}</p>
                {onCopy && (
                    <button
                        onClick={() => onCopy(value)}
                        className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:text-primary transition-all bg-slate-50 rounded-lg border border-slate-200 shadow-sm"
                    >
                        <Copy size={12} strokeWidth={3} />
                    </button>
                )}
            </div>
        </div>
    </div>
);
