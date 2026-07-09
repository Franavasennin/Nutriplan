import React, { useState, useEffect, useCallback } from 'react';
import { Recipe, RecipeFilters, MealType, DietType, ALLERGEN_LABELS } from '../types';
import { findRecipes } from '../services/geminiService';
import { RECIPES } from '../data/recipes';
import { getRecipeAllergens } from '../utils/allergenVerification';

interface RecipeSearchProps {
  /** External recipe catalogue (e.g. synced from DB). Falls back to static RECIPES. */
  recipes?: Recipe[];
}

// ─── Mapeo DietType enum → tag en la base de datos ───────────────────────────
const DIET_TAG_MAP: Record<string, string> = {
  [DietType.Balanced]:      'equilibrada',
  [DietType.LowCarb]:       'baja en carbohidratos',
  [DietType.Keto]:          'cetogénica',
  [DietType.Vegetarian]:    'vegetariana',
  [DietType.Vegan]:         'vegana',
  [DietType.Mediterranean]: 'mediterránea',
  [DietType.Paleo]:         'paleo',
  [DietType.Protein]:       'proteica',
  [DietType.Athlete]:       'atleta',
};

// ─── Filtrado local (instantáneo, sin API) ────────────────────────────────────
function filterLocally(filters: RecipeFilters, allRecipes: Recipe[]): Recipe[] {
  const query    = filters.query.trim().toLowerCase();
  const excluded = (filters.excludeIngredients ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  return allRecipes.filter(recipe => {
    // Texto libre
    if (query) {
      const inTitle       = recipe.title.toLowerCase().includes(query);
      const inDescription = recipe.description.toLowerCase().includes(query);
      const inTags        = recipe.tags.some(t => t.toLowerCase().includes(query));
      const inIngredients = recipe.ingredients.some(i => i.toLowerCase().includes(query));
      if (!inTitle && !inDescription && !inTags && !inIngredients) return false;
    }

    // Tipo de comida
    if (filters.mealType !== MealType.Any) {
      if (!recipe.tags.some(t => t.toLowerCase() === filters.mealType.toLowerCase())) return false;
    }

    // Tipo de dieta
    if (filters.dietType !== 'cualquiera') {
      const dietTag = DIET_TAG_MAP[filters.dietType as DietType] ?? filters.dietType;
      if (!recipe.tags.some(t => t.toLowerCase().includes(dietTag.toLowerCase()))) return false;
    }

    // Tiempo de preparación
    if (recipe.prepTime > filters.maxPrepTime) return false;

    // Calorías máximas
    if (filters.maxCalories && recipe.calories > filters.maxCalories) return false;

    // Alimentos excluidos
    if (excluded.length > 0) {
      const hasExcluded = excluded.some(exc =>
        recipe.ingredients.some(i => i.toLowerCase().includes(exc)) ||
        recipe.title.toLowerCase().includes(exc)
      );
      if (hasExcluded) return false;
    }

    return true;
  });
}

// ─── Etiqueta de tipo de comida → español ────────────────────────────────────
const MEAL_LABELS: Record<MealType, string> = {
  [MealType.Breakfast]: 'Desayuno',
  [MealType.Lunch]:     'Almuerzo',
  [MealType.Dinner]:    'Cena',
  [MealType.Snack]:     'Merienda',
  [MealType.Any]:       'Cualquiera',
};

const RecipeSearch: React.FC<RecipeSearchProps> = ({ recipes: externalRecipes }) => {
  // Bug preexistente corregido (iteración 003, descubierto verificando
  // MEJORA-013): useAppData siempre pasa dbRecipes=[] (no hay tabla de
  // recetas), y `[] ?? RECIPES` devuelve [] — el corpus estático de 68
  // recetas nunca llegaba a usarse y el buscador local mostraba "0 recetas".
  const catalogue = externalRecipes?.length ? externalRecipes : RECIPES;
  const [recipes,        setRecipes]        = useState<Recipe[]>([]);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [aiError,        setAiError]        = useState<string | null>(null);
  const [isAiResults,    setIsAiResults]    = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [filters, setFilters] = useState<RecipeFilters>({
    query:             '',
    mealType:          MealType.Any,
    maxPrepTime:       120,
    dietType:          'cualquiera',
    maxCalories:       undefined,
    excludeIngredients: '',
  });

  // Filtrado local instantáneo cada vez que cambian los filtros o el catálogo
  useEffect(() => {
    if (isAiResults) return;
    setRecipes(filterLocally(filters, catalogue));
  }, [filters, isAiResults, catalogue]);

  // Carga inicial: mostrar todas las recetas del catálogo activo
  useEffect(() => {
    setRecipes(catalogue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = useCallback((patch: Partial<RecipeFilters>) => {
    setIsAiResults(false);
    setAiError(null);
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  // Búsqueda con IA para recetas no cubiertas por la base de datos
  const handleAiSearch = async () => {
    setAiLoading(true);
    setAiError(null);
    setSelectedRecipe(null);
    try {
      const results = await findRecipes(filters);
      setRecipes(results);
      setIsAiResults(true);
    } catch {
      setAiError('No se pudieron generar recetas con IA. Verifica tu conexión y API key.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsAiResults(false);
      setAiError(null);
      setFilters(prev => ({ ...prev })); // trigger useEffect
    }
  };

  const resetToLocal = () => {
    setIsAiResults(false);
    setAiError(null);
    setRecipes(filterLocally(filters, catalogue));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sidebar de filtros ── */}
      <aside className="w-80 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-white dark:bg-[#15281d] overflow-y-auto hidden lg:flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-text-main dark:text-white">Filtros</h3>
          <p className="text-xs text-text-sub dark:text-gray-500 mt-1">Resultados instantáneos de base de datos</p>
        </div>
        <div className="p-6 space-y-6">
          {/* Tiempo */}
          <div>
            <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Tiempo de Preparación</h4>
            <select
              aria-label="Tiempo máximo de preparación"
              className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white"
              value={filters.maxPrepTime}
              onChange={e => handleFilterChange({ maxPrepTime: Number(e.target.value) })}
            >
              <option value={15}>15 min (Rápido)</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 hora</option>
              <option value={120}>Sin límite</option>
            </select>
          </div>

          {/* Tipo de comida */}
          <div>
            <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Tipo de Comida</h4>
            <div className="space-y-2">
              {[MealType.Any, MealType.Breakfast, MealType.Lunch, MealType.Dinner, MealType.Snack].map(type => (
                <label key={type} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="mealType"
                    checked={filters.mealType === type}
                    onChange={() => handleFilterChange({ mealType: type })}
                    className="form-radio text-primary focus:ring-primary bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 h-4 w-4"
                  />
                  <span className="text-sm font-medium text-text-main dark:text-gray-300 group-hover:text-primary transition-colors">
                    {MEAL_LABELS[type]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tipo de dieta */}
          <div>
            <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Tipo de Dieta</h4>
            <select
              aria-label="Tipo de dieta"
              className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white capitalize"
              value={filters.dietType}
              onChange={e => handleFilterChange({ dietType: e.target.value as DietType | 'cualquiera' })}
            >
              <option value="cualquiera">Cualquiera</option>
              {Object.entries(DIET_TAG_MAP).map(([val, label]) => (
                <option key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Calorías máx */}
          <div>
            <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Calorías Máx.</h4>
            <input
              type="number"
              placeholder="Ej: 500"
              className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white"
              value={filters.maxCalories || ''}
              onChange={e => handleFilterChange({ maxCalories: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          {/* Excluir alimentos */}
          <div>
            <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Excluir Alimentos</h4>
            <input
              type="text"
              placeholder="Ej: nueces, marisco..."
              className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white"
              value={filters.excludeIngredients ?? ''}
              onChange={e => handleFilterChange({ excludeIngredients: e.target.value })}
            />
          </div>

          {/* Botón IA */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-text-sub dark:text-gray-500 mb-3">¿No encuentras lo que buscas? Genera recetas personalizadas con IA.</p>
            <button
              type="button"
              onClick={handleAiSearch}
              disabled={aiLoading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              {aiLoading ? 'Generando...' : 'Generar con IA'}
            </button>
            {isAiResults && (
              <button type="button" onClick={resetToLocal} className="w-full mt-2 py-2 text-xs text-text-sub dark:text-gray-400 hover:text-primary transition-colors">
                ← Volver a base de datos
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-8 py-6 bg-white dark:bg-[#15281d]/50 shrink-0 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-bold text-[#111813] dark:text-white">Buscador de Recetas</h1>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isAiResults ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
              {isAiResults ? '✦ IA' : `${recipes.length} recetas`}
            </span>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              className="block w-full pl-10 pr-3 py-3 border-none rounded-xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
              placeholder="Buscar por nombre, ingrediente o etiqueta..."
              type="text"
              value={filters.query}
              onChange={e => handleFilterChange({ query: e.target.value })}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-6 bg-background-light dark:bg-background-dark">
          {aiError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {aiError}
            </div>
          )}

          {aiLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {!aiLoading && recipes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                <span className="material-symbols-outlined text-4xl text-gray-400">menu_book</span>
              </div>
              <h3 className="text-xl font-bold text-text-main dark:text-white">Sin resultados</h3>
              <p className="text-text-sub dark:text-gray-400 mt-2 max-w-xs">
                Ninguna receta coincide con los filtros actuales. Prueba con otros criterios o genera con IA.
              </p>
            </div>
          )}

          {!aiLoading && recipes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
              {recipes.map(recipe => (
                <div
                  key={recipe.id}
                  className="group bg-white dark:bg-[#1a2e22] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer"
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  {/* Imagen placeholder */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-t-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-green-300 dark:text-green-700">restaurant</span>
                    <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
                      <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">schedule</span> {recipe.prepTime} min
                      </span>
                      {recipe.tags[0] && (
                        <span className="bg-primary/80 backdrop-blur-md text-black text-xs font-semibold px-2.5 py-1 rounded-full capitalize">
                          {recipe.tags[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight mb-1 line-clamp-1">{recipe.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{recipe.description}</p>

                    {/* Macros */}
                    <div className="grid grid-cols-4 gap-1 py-3 border-y border-dashed border-gray-200 dark:border-gray-700 mb-4">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Kcal</p>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.calories}</p>
                      </div>
                      <div className="text-center border-l border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Prot</p>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.protein}g</p>
                      </div>
                      <div className="text-center border-l border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">HC</p>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.carbs}g</p>
                      </div>
                      <div className="text-center border-l border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Grasas</p>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.fats}g</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full bg-primary text-black font-bold py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2 mt-auto"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span> Ver Receta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal detalle de receta ── */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            className="bg-white dark:bg-[#1a2e22] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-text-main dark:text-white pr-4">{selectedRecipe.title}</h2>
                <button type="button" onClick={() => setSelectedRecipe(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors shrink-0">
                  <span className="material-symbols-outlined dark:text-white">close</span>
                </button>
              </div>
              <p className="text-sm text-text-sub dark:text-gray-400 mb-4">{selectedRecipe.description}</p>

              {/* Macros resumen */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl mb-6">
                {[
                  { label: 'Calorías', value: `${selectedRecipe.calories} kcal` },
                  { label: 'Proteínas', value: `${selectedRecipe.protein}g` },
                  { label: 'Carbos', value: `${selectedRecipe.carbs}g` },
                  { label: 'Grasas', value: `${selectedRecipe.fats}g` },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <p className="text-xs text-text-sub dark:text-gray-400">{m.label}</p>
                    <p className="font-bold text-base text-text-main dark:text-white">{m.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="material-symbols-outlined text-[16px] text-gray-400">schedule</span>
                <span className="text-sm text-text-sub dark:text-gray-400">{selectedRecipe.prepTime} min</span>
                {selectedRecipe.tags.map(tag => (
                  <span key={tag} className="text-xs bg-primary/10 text-green-700 dark:text-primary px-2 py-0.5 rounded-full capitalize">{tag}</span>
                ))}
              </div>

              {/* Alérgenos (MEJORA-013, iteración 003): derivados heurísticamente
                  de los ingredientes salvo que la receta los declare explícitamente. */}
              {(() => {
                const { allergens, derived } = getRecipeAllergens(selectedRecipe);
                if (allergens.length === 0) return null;
                return (
                  <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <span className="material-symbols-outlined text-[16px] text-red-500">warning</span>
                    <span className="text-xs font-semibold text-text-main dark:text-gray-300">Alérgenos:</span>
                    {allergens.map(a => (
                      <span key={a} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">
                        {ALLERGEN_LABELS[a]}
                      </span>
                    ))}
                    {derived && (
                      <span className="text-[10px] text-text-sub dark:text-gray-500 italic">
                        (detección automática por ingredientes — no sustituye el etiquetado profesional)
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-bold text-lg text-text-main dark:text-white mb-3">Ingredientes</h3>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="text-text-sub dark:text-gray-400 text-sm flex items-start gap-2">
                        <span className="text-primary mt-1 shrink-0">•</span> {ing}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-main dark:text-white mb-3">Preparación</h3>
                  <ol className="space-y-4">
                    {selectedRecipe.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="shrink-0 w-6 h-6 bg-primary/20 text-green-700 dark:text-primary rounded-full flex items-center justify-center font-bold text-xs">
                          {i + 1}
                        </span>
                        <p className="text-text-sub dark:text-gray-400 text-sm">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeSearch;
