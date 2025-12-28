import React, { useState } from 'react';
import { Recipe, RecipeFilters, MealType, DietType } from '../types';
import { findRecipes } from '../services/geminiService';

const RecipeSearch: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RecipeFilters>({
    query: '',
    mealType: MealType.Any,
    maxPrepTime: 60,
    dietType: 'cualquiera',
    maxCalories: undefined,
    excludeIngredients: ''
  });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSelectedRecipe(null);
    try {
      const results = await findRecipes(filters);
      setRecipes(results);
    } catch (err) {
      setError('No se pudieron encontrar recetas. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if(e.key === 'Enter') handleSearch();
  }

  return (
    <div className="flex h-full overflow-hidden">
        {/* Filter Sidebar */}
        <aside className="w-80 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-white dark:bg-[#15281d] overflow-y-auto hidden lg:flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-text-main dark:text-white">Filtros</h3>
        </div>
        <div className="p-6 space-y-6">
            <div>
                <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Tiempo de Preparación</h4>
                <select 
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white"
                    value={filters.maxPrepTime}
                    onChange={e => setFilters({...filters, maxPrepTime: Number(e.target.value)})}
                >
                    <option value={15}>15 min (Rápido)</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                    <option value={120}>Sin límite</option>
                </select>
            </div>

            <div>
                <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Tipo de Comida</h4>
                <div className="space-y-2">
                    {[MealType.Breakfast, MealType.Lunch, MealType.Dinner, MealType.Snack, MealType.Any].map(type => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                                type="radio" 
                                name="mealType"
                                checked={filters.mealType === type}
                                onChange={() => setFilters({...filters, mealType: type})}
                                className="form-radio text-primary focus:ring-primary bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-text-main dark:text-gray-300 group-hover:text-primary transition-colors capitalize">
                                {type === MealType.Any ? 'Cualquiera' : type}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Dieta</h4>
                <select 
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white capitalize"
                    value={filters.dietType}
                    onChange={e => setFilters({...filters, dietType: e.target.value as any})}
                >
                    <option value="cualquiera">Cualquiera</option>
                    {Object.values(DietType).map(d => (
                        <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </div>

            <div>
                <h4 className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-3">Calorías Máx.</h4>
                <input 
                    type="number" 
                    placeholder="Ej: 500"
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none dark:text-white"
                    value={filters.maxCalories || ''}
                    onChange={e => setFilters({...filters, maxCalories: Number(e.target.value)})}
                />
            </div>
            
            <button 
                onClick={handleSearch}
                className="w-full py-3 bg-primary text-black font-bold rounded-xl shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
                {loading ? 'Buscando...' : 'Aplicar Filtros'}
            </button>
        </div>
        </aside>

        <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-8 py-6 bg-white dark:bg-[#15281d]/50 shrink-0 border-b border-gray-100 dark:border-gray-800">
            <h1 className="text-2xl font-bold text-[#111813] dark:text-white mb-4">Buscador de Recetas</h1>
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input 
                        className="block w-full pl-10 pr-3 py-3 border-none rounded-xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm" 
                        placeholder="Buscar receta por ingrediente o nombre..." 
                        type="text"
                        value={filters.query}
                        onChange={e => setFilters({...filters, query: e.target.value})}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </div>
        </div>

            <div className="flex-1 overflow-y-auto p-8 pt-6 bg-background-light dark:bg-background-dark">
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 mb-6">
                    {error}
                    </div>
                )}

                {!loading && recipes.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                            <span className="material-symbols-outlined text-4xl text-gray-400">menu_book</span>
                        </div>
                        <h3 className="text-xl font-bold text-text-main dark:text-white">¿Qué cocinamos hoy?</h3>
                        <p className="text-text-sub dark:text-gray-400 mt-2">Usa el buscador y filtros para encontrar recetas.</p>
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                    {recipes.map(recipe => (
                        <div key={recipe.id} className="group bg-white dark:bg-[#1a2e22] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer" onClick={() => setSelectedRecipe(recipe)}>
                            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">restaurant</span>
                                <div className="absolute bottom-3 left-3 z-10 flex gap-2">
                                    <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span> {recipe.prepTime} min
                                    </span>
                                </div>
                            </div>
                            <div className="p-5 flex flex-col flex-1">
                                <div className="mb-3">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight mb-1 line-clamp-1">{recipe.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{recipe.description}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 py-3 border-y border-dashed border-gray-200 dark:border-gray-700 mb-4">
                                        <div className="text-center">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Kcal</p>
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.calories}</p>
                                    </div>
                                        <div className="text-center border-l border-gray-100 dark:border-gray-700">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Prot</p>
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.protein}g</p>
                                    </div>
                                    <div className="text-center border-l border-gray-100 dark:border-gray-700">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Grasas</p>
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{recipe.fats}g</p>
                                    </div>
                                </div>
                                <button className="w-full bg-primary text-black font-bold py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2 mt-auto">
                                    <span className="material-symbols-outlined text-[18px]">visibility</span> Ver Detalles
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Recipe Detail Modal */}
        {selectedRecipe && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-[#1a2e22] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="p-6 md:p-8">
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-2xl font-bold text-text-main dark:text-white">{selectedRecipe.title}</h2>
                            <button onClick={() => setSelectedRecipe(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <span className="material-symbols-outlined dark:text-white">close</span>
                            </button>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-lg text-text-main dark:text-white mb-3">Ingredientes</h3>
                                <ul className="space-y-2">
                                    {selectedRecipe.ingredients.map((ing, i) => (
                                        <li key={i} className="text-text-sub dark:text-gray-400 text-sm flex items-start gap-2">
                                            <span className="text-primary mt-1">•</span> {ing}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-text-main dark:text-white mb-3">Instrucciones</h3>
                                <ol className="space-y-4">
                                    {selectedRecipe.instructions.map((step, i) => (
                                        <li key={i} className="flex gap-4">
                                            <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-green-700 dark:text-primary rounded-full flex items-center justify-center font-bold text-xs">
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