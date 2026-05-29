import React, { useState } from 'react';
import { CustomFood } from '../types';

interface Props {
  foods: CustomFood[];
  onAdd: (food: CustomFood) => void;
  onDelete: (id: string) => void;
}

const FoodDatabase: React.FC<Props> = ({ foods, onAdd, onDelete }) => {
  const [newFood, setNewFood] = useState<Partial<CustomFood>>({
    name: '',
    brand: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    portionSize: '100g'
  });
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFood.name && newFood.calories !== undefined) {
      onAdd({
        id: crypto.randomUUID(),
        name: newFood.name,
        brand: newFood.brand || '',
        calories: Number(newFood.calories),
        protein: Number(newFood.protein || 0),
        carbs: Number(newFood.carbs || 0),
        fats: Number(newFood.fats || 0),
        portionSize: newFood.portionSize || '100g'
      });
      setNewFood({ name: '', brand: '', calories: 0, protein: 0, carbs: 0, fats: 0, portionSize: '100g' });
      setShowForm(false);
    }
  };

  const filteredFoods = foods.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background-light dark:bg-background-dark">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-text-main dark:text-white">Base de Datos</h2>
                <div className="flex gap-3">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            className="pl-9 pr-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm outline-none focus:border-primary dark:text-white w-64"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2 rounded-lg font-bold shadow-lg shadow-primary/20 text-sm">
                        <span className="material-symbols-outlined text-[18px]">{showForm ? 'close' : 'add'}</span> {showForm ? 'Cancelar' : 'Añadir'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="mb-6 bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark animate-fade-in-up">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Nombre</label>
                            <input type="text" required className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white" value={newFood.name} onChange={e => setNewFood({...newFood, name: e.target.value})} placeholder="Ej: Pan casero" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Marca</label>
                            <input type="text" className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white" value={newFood.brand} onChange={e => setNewFood({...newFood, brand: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Porción</label>
                            <input type="text" className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white" value={newFood.portionSize} onChange={e => setNewFood({...newFood, portionSize: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Calorías</label>
                            <input type="number" required className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white" value={newFood.calories} onChange={e => setNewFood({...newFood, calories: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Proteína (g)</label>
                            <input type="number" step="0.1" className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white" value={newFood.protein} onChange={e => setNewFood({...newFood, protein: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Carbos (g)</label>
                            <input type="number" step="0.1" className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white" value={newFood.carbs} onChange={e => setNewFood({...newFood, carbs: Number(e.target.value)})} />
                        </div>
                        <button type="submit" className="bg-primary hover:bg-primary-hover text-black font-bold p-2 rounded-lg h-10 w-full flex items-center justify-center">
                            Guardar
                        </button>
                    </form>
                </div>
            )}
            
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-[#15261b] border-b border-border-light dark:border-border-dark text-xs uppercase text-text-sub dark:text-text-sub font-semibold tracking-wider">
                            <th className="p-4">Alimento</th>
                            <th className="p-4 text-right">Kcal</th>
                            <th className="p-4 text-right hidden sm:table-cell">Macros (P/C/G)</th>
                            <th className="p-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                        {filteredFoods.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-sub dark:text-gray-500">No hay alimentos. Añade uno nuevo.</td></tr>
                        ) : (
                            filteredFoods.map(food => (
                                <tr key={food.id} className="hover:bg-gray-50 dark:hover:bg-[#15261b] transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-text-main dark:text-white">{food.name}</div>
                                        <div className="text-xs text-text-sub dark:text-gray-400">{food.brand ? `${food.brand} • ` : ''}{food.portionSize}</div>
                                    </td>
                                    <td className="p-4 text-right font-medium text-text-main dark:text-white">{food.calories}</td>
                                    <td className="p-4 text-right hidden sm:table-cell text-xs text-text-sub dark:text-gray-400">
                                        <span className="text-blue-500 font-bold">{food.protein}</span> / <span className="text-yellow-500 font-bold">{food.carbs}</span> / <span className="text-red-500 font-bold">{food.fats}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => onDelete(food.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default FoodDatabase;