import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastOptions {
  /** Botón de acción (p. ej. "Deshacer" — MEJORA-019, iteración 003). */
  action?: ToastAction;
  /** Duración en ms antes de auto-descartarse (por defecto 4000, 8000 si hay acción). */
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => '', dismissToast: () => {} });

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

  const toast = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions): string => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, action: options?.action }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), options?.duration ?? (options?.action ? 8000 : DURATION));
    return id;
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  React.useEffect(() => {
    const clear = () => setToasts([]);
    window.addEventListener('beforeprint', clear);
    return () => window.removeEventListener('beforeprint', clear);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismissToast: dismiss }}>
      {children}
      <div className="no-print fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 shadow-xl pointer-events-auto transition-all ${STYLES[t.type]}`}
          >
            <span className="material-symbols-outlined text-lg shrink-0">{ICONS[t.type]}</span>
            <p className="text-sm font-bold flex-1">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                className="text-sm font-black underline underline-offset-2 hover:opacity-70 transition-opacity shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
