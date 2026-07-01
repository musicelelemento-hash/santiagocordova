
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  disableBackdropClick?: boolean; // New prop to prevent accidental closing
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

  const modalSize = size ? sizeClasses[size] : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm animate-fade-in-down" onClick={handleBackdropClick}>
      <div 
        className={`relative w-full ${modalSize} p-4 sm:p-6 mx-2 sm:mx-4 bg-white rounded-lg shadow-xl dark:bg-gray-900 transform transition-all flex flex-col border border-gold/20`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {title ? (
          <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h3 className="text-2xl sm:text-3xl font-display text-gold">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <X size={24} />
            </button>
          </div>
        ) : (
          <button onClick={onClose} className="absolute top-4 right-4 z-[60] p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        )}
        <div className="mt-4 overflow-y-auto pr-2 w-full flex-grow flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};
