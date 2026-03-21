import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
      success: (msg: string) => void;
      error: (msg: string) => void;
      warning: (msg: string) => void;
      info: (msg: string) => void;
  }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const toastHelpers = {
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      warning: (msg: string) => addToast('warning', msg),
      info: (msg: string) => addToast('info', msg),
  };

  return (
    <ToastContext.Provider value={{ toast: toastHelpers }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md animate-slide-up-fade min-w-[300px]
              ${t.type === 'success' ? 'bg-white/95 border-green-500 text-slate-800 dark:bg-slate-800/95 dark:border-green-500 dark:text-white' : ''}
              ${t.type === 'error' ? 'bg-white/95 border-red-500 text-slate-800 dark:bg-slate-800/95 dark:border-red-500 dark:text-white' : ''}
              ${t.type === 'warning' ? 'bg-white/95 border-yellow-500 text-slate-800 dark:bg-slate-800/95 dark:border-yellow-500 dark:text-white' : ''}
              ${t.type === 'info' ? 'bg-white/95 border-blue-500 text-slate-800 dark:bg-slate-800/95 dark:border-blue-500 dark:text-white' : ''}
            `}
          >
            <div className={`p-1 rounded-full 
                ${t.type === 'success' ? 'bg-green-100 text-green-600' : ''}
                ${t.type === 'error' ? 'bg-red-100 text-red-600' : ''}
                ${t.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : ''}
                ${t.type === 'info' ? 'bg-blue-100 text-blue-600' : ''}
            `}>
                {t.type === 'success' && <CheckCircle size={20} />}
                {t.type === 'error' && <AlertOctagon size={20} />}
                {t.type === 'warning' && <AlertTriangle size={20} />}
                {t.type === 'info' && <Info size={20} />}
            </div>
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};