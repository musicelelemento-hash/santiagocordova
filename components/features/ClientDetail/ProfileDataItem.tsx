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
        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover/item:text-brand-teal group-hover/item:bg-brand-teal/10 transition-all shadow-sm">
            <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate tracking-tight">{value}</p>
                {onCopy && (
                    <button
                        onClick={() => onCopy(value)}
                        className="opacity-0 group-hover/item:opacity-100 p-1 hover:text-brand-teal transition-all"
                    >
                        <Copy size={12} />
                    </button>
                )}
            </div>
        </div>
    </div>
);
