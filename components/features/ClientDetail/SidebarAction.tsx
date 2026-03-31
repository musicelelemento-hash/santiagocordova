import React from 'react';

interface SidebarActionProps {
    icon: any;
    label: string;
    color?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const SidebarAction: React.FC<SidebarActionProps> = ({
    icon: Icon,
    label,
    color = "bg-white border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30",
    onClick,
    disabled = false
}) => (
    <div className="relative group/action">
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-3.5 rounded-2xl transition-all active:scale-90 disabled:opacity-50 disabled:grayscale border shadow-sm ${color}`}
        >
            <Icon size={20} strokeWidth={2.5} />
        </button>
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 pointer-events-none group-hover/action:opacity-100 transition-all duration-300 translate-y-1 group-hover/action:translate-y-0 whitespace-nowrap shadow-xl z-50 font-premium">
            {label}
        </div>
    </div>
);
