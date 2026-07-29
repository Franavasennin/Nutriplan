import React, { useState } from 'react';

interface Props {
  criteria: string;
  onSave: (criteria: string) => void;
  onClose: () => void;
}

const FIELD_INPUT = "w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none dark:text-white focus:border-primary transition-colors text-sm";

/**
 * Criterio GLOBAL de la nutricionista ("Hacer la IA experta en nutrición",
 * Fase 3) -- a diferencia de las "Pautas" de DietPlanDisplay.tsx (que aplican
 * a UNA dieta concreta), esto se envía en TODAS las generaciones futuras.
 * Prioridad siempre por debajo de exclusiones/alérgenos del paciente y de la
 * pauta puntual de cada dieta.
 */
const ClinicCriteriaModal: React.FC<Props> = ({ criteria, onSave, onClose }) => {
  const [value, setValue] = useState(criteria);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">psychology</span>
              <h2 className="text-xl font-black text-text-main dark:text-white">Criterio de la IA</h2>
            </div>
            <button type="button" onClick={onClose} className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          <p className="text-xs text-text-sub dark:text-gray-400 mb-4">
            Este texto se envía en <strong>todas</strong> las dietas que se generen a partir de ahora (nuevas, "Rehacer día", "Rehacer plan") —
            no hace falta repetirlo paciente a paciente. Ejemplos: "prioriza siempre AOVE sobre otros aceites",
            "evita ultraprocesados en desayunos", "usa medidas caseras de Mercadona cuando sea posible".
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-4">
            Las alergias/exclusiones del paciente y la pauta puntual de cada dieta siguen teniendo prioridad sobre este criterio.
          </p>
          <textarea
            rows={6}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Ej: prioriza siempre aceite de oliva virgen extra sobre otros aceites."
            className={FIELD_INPUT}
          />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { onSave(value); onClose(); }}
              className="px-5 py-2 rounded-lg text-sm font-black bg-primary text-background-dark hover:brightness-90 transition-all"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicCriteriaModal;
