import * as LucideIcons from 'lucide-react';

interface ProfileDataItemProps {
    icon: any;
    label: string;
    value: string;
    onCopy?: (text: string) => void;
}

export const ProfileDataItem: React.FC<ProfileDataItemProps> = ({ icon: Icon, label, value, onCopy }) => (
    <div className="flex items-center gap-4 group/item py-3 px-4 rounded-2xl hover:bg-surface-container-low/50 transition-all border border-transparent hover:border-outline-variant/10">
        <div className="w-12 h-12 bg-surface-container-high/50 rounded-xl flex items-center justify-center text-on-surface-variant group-hover/item:text-primary group-hover/item:bg-primary/5 transition-all shadow-sm border border-outline-variant/10 relative overflow-hidden">
            <Icon size={18} strokeWidth={2} className="relative z-10" />
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[9px] font-mono font-bold text-on-surface-variant/60 uppercase tracking-[0.2em]">{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-mono font-black text-on-surface truncate tracking-tight uppercase">{value}</p>
                {onCopy && (
                    <button
                        onClick={() => onCopy(value)}
                        className="opacity-0 group-hover/item:opacity-100 p-1.5 text-on-surface-variant hover:text-primary transition-all bg-surface-container-highest/50 rounded-lg border border-outline-variant/20 shadow-sm"
                    >
                        <LucideIcons.Copy size={10} strokeWidth={2.5} />
                    </button>
                )}
            </div>
        </div>
    </div>
);
