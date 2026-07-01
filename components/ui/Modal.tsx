
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  disableBackdropClick?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full mx-4'
};

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, disableBackdropClick = false, size }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disableBackdropClick) {
          onClose();
      }
  };

  const modalSize = size ? sizeClasses[size] : 'max-w-2xl';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full ${modalSize} flex flex-col rounded-[2rem] overflow-hidden shadow-2xl`}
        style={{
          maxHeight: '92vh',
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
          animation: 'modalSlideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent glow line at top */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, transparent, #6366f1, #8b5cf6, transparent)',
            opacity: 0.8
          }}
        />

        {/* Header */}
        {title ? (
          <div
            className="flex items-center justify-between px-8 py-5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 4, height: 28, borderRadius: 4,
                  background: 'linear-gradient(180deg, #6366f1, #8b5cf6)'
                }}
              />
              <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-white/10 active:scale-90"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[60] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-grow px-8 py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent' }}>
          {children}
        </div>

        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.94) translateY(16px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};
