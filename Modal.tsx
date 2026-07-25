
import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeOnOutsideClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  closeOnOutsideClick = true 
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 p-4" 
      onClick={() => closeOnOutsideClick && onClose()}
    >
      <div 
        className="relative w-full max-w-lg p-4 sm:p-6 mx-auto bg-slate-900 text-white rounded-3xl shadow-2xl border border-white/10 transform transition-all flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-white font-premium">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
