import React, { createContext, useContext, useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: async () => false });

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => setDialog({ ...options, resolve }));
  }, []);

  const handle = (result: boolean) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => handle(false)}
        >
          <div
            className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-border-light dark:border-border-dark"
            onClick={e => e.stopPropagation()}
          >
            <div className={`size-10 rounded-full flex items-center justify-center mb-4 ${dialog.danger ? 'bg-red-100 text-red-600' : 'bg-primary/20 text-primary'}`}>
              <span className="material-symbols-outlined">{dialog.danger ? 'delete_forever' : 'help'}</span>
            </div>
            <p className="font-black text-base text-text-main dark:text-white mb-1">{dialog.title}</p>
            <p className="text-sm text-text-sub dark:text-gray-400 mb-6">{dialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {dialog.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => handle(true)}
                className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${
                  dialog.danger
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-primary hover:bg-primary-hover text-background-dark'
                }`}
              >
                {dialog.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
