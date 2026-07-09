import React, { useState, useEffect } from 'react';

const messages = [
  "Analizando perfil antropométrico...",
  "Calculando IMC (OMS/FAO)...",
  "Consultando tablas nutricionales...",
  "Ajustando macros por patología...",
  "Diseñando menús diarios...",
  "Finalizando pautas clínicas...",
  "Organizando plan de 7 días..."
];

const LoadingOverlay: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    // Cambiamos mensajes más rápido (cada 1.8 segundos) para dar sensación de actividad constante
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-md">
      <div className="relative flex flex-col items-center max-w-sm w-full p-8 text-center">
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="size-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-primary animate-pulse">nutrition</span>
          </div>
        </div>

        <h2 className="text-xl font-black text-text-main dark:text-white mb-4 uppercase tracking-tight">Procesando Plan Clínico</h2>
        
        <div className="h-6 overflow-hidden w-full mb-6">
            <p className="text-primary-accessible dark:text-primary font-bold text-xs uppercase tracking-widest">
                {messages[msgIndex]}
            </p>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
          <div className="bg-primary h-full animate-[progress_10s_linear_infinite] rounded-full"></div>
        </div>
        
        <p className="mt-8 text-[10px] text-text-sub dark:text-gray-400 leading-relaxed italic opacity-70">
          Modo Alta Velocidad Activado
        </p>
      </div>

      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;