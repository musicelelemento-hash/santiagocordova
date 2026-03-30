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
    color = "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-teal",
    onClick,
    disabled = false
}) => (
    <div className="relative group/action">
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-3 rounded-2xl transition-all active:scale-90 disabled:opacity-50 disabled:grayscale ${color} shadow-sm`}
        >
            <Icon size={20} />
        </button>
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-widest rounded-lg opacity-0 pointer-events-none group-hover/action:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-50">
            {label}
        </div>
    </div>
);
