import React from 'react';

interface QuickActionBtnProps {
    icon: any;
    label: string;
    color: string;
    onClick: () => void;
}

export const QuickActionBtn: React.FC<QuickActionBtnProps> = ({ icon: Icon, label, color, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-6 rounded-3xl ${color} hover:scale-[1.03] active:scale-95 transition-all shadow-md group/btn border border-white/20`}
    >
        <div className="p-3 bg-white/20 rounded-2xl mb-3 group-hover/btn:rotate-12 transition-transform shadow-inner">
            <Icon size={24} strokeWidth={2.5} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] font-premium">{label}</span>
    </button>
);
