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
        className={`flex flex-col items-center justify-center p-4 rounded-3xl ${color} hover:scale-105 active:scale-95 transition-all shadow-sm group/btn`}
    >
        <Icon size={20} className="mb-2 group-hover/btn:rotate-12 transition-transform" />
        <span className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</span>
    </button>
);
