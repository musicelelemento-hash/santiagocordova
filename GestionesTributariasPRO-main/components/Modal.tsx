import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm animate-fade-in-down" onClick={onClose}>
      <div 
        className="relative w-full max-w-lg p-4 sm:p-6 mx-2 sm:mx-4 bg-white rounded-lg shadow-xl dark:bg-gray-900 transform transition-all flex flex-col border border-gold/20"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-2xl sm:text-3xl font-display text-gold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="mt-4 overflow-y-auto pr-2">
          {children}
        </div>
      </div>
    </div>
  );
};