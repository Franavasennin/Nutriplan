import React, { createContext, useContext, useMemo } from 'react';
import { CustomFood } from '../types';
import { buildVocabulary } from '../utils/foodVocabulary';

/**
 * Provee el vocabulario de alimentos (lista canónica + recetas + alimentos
 * personalizados) a los campos de autocompletado, sin prop-drilling. Mismo
 * patrón que ToastProvider/ConfirmProvider. Se monta dentro de AppContent
 * porque necesita `customFoods` (que vive en useAppData).
 */

const FoodVocabularyContext = createContext<string[]>([]);

export const useFoodVocabulary = (): string[] => useContext(FoodVocabularyContext);

export const FoodVocabularyProvider: React.FC<{
  customFoods: CustomFood[];
  children: React.ReactNode;
}> = ({ customFoods, children }) => {
  // El vocabulario solo se recalcula cuando cambian los alimentos
  // personalizados; la lista canónica y las recetas son estáticas.
  const vocabulary = useMemo(() => buildVocabulary(customFoods), [customFoods]);
  return (
    <FoodVocabularyContext.Provider value={vocabulary}>
      {children}
    </FoodVocabularyContext.Provider>
  );
};
