import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  error:   'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info:    'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error:   'warning',
  info:    'info',
};

const DURATION = 4000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 shadow-xl pointer-events-auto transition-all ${STYLES[t.type]}`}
          >
            <span className="material-symbols-outlined text-lg shrink-0">{ICONS[t.type]}</span>
            <p className="text-sm font-bold flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
