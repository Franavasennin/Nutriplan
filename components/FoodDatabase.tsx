import React, { useState } from 'react';
import { CustomFood } from '../types';
import { useConfirm } from './ConfirmDialog';
import { FoodAutocompleteInput } from './FoodAutocomplete';

interface Props {
  foods: CustomFood[];
  onAdd: (food: CustomFood) => void;
  onDelete: (id: string) => void;
  onEdit: (food: CustomFood) => void;
}

type FoodForm = {
  name: string; brand: string; portionSize: string;
  calories: string; protein: string; carbs: string; fats: string;
};

const EMPTY_FORM: FoodForm = {
  name: '', brand: '', portionSize: '100g',
  calories: '', protein: '', carbs: '', fats: ''
};

const FIELD_INPUT = "w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white focus:border-primary transition-colors text-sm";
const LABEL = "block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1";

const FoodDatabase: React.FC<Props> = ({ foods, onAdd, onDelete, onEdit }) => {
  const { confirm } = useConfirm();
  const [form,       setForm]       = useState<FoodForm>(EMPTY_FORM);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const setField = (key: keyof FoodForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (food: CustomFood) => {
    setForm({
      name:        food.name,
      brand:       food.brand ?? '',
      portionSize: food.portionSize,
      calories:    String(food.calories),
      protein:     String(food.protein),
      carbs:       String(food.carbs),
      fats:        String(food.fats),
    });
    setEditingId(food.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = () => {
    const cal = Number(form.calories);
    if (!form.name.trim() || !form.calories || isNaN(cal) || cal < 0) return;

    const food: CustomFood = {
      id:          editingId ?? crypto.randomUUID(),
      name:        form.name.trim(),
      brand:       form.brand.trim() || undefined,
      portionSize: form.portionSize.trim() || '100g',
      calories:    cal,
      protein:     isNaN(Number(form.protein)) ? 0 : Number(form.protein  || 0),
      carbs:       isNaN(Number(form.carbs))   ? 0 : Number(form.carbs    || 0),
      fats:        isNaN(Number(form.fats))    ? 0 : Number(form.fats     || 0),
    };

    editingId ? onEdit(food) : onAdd(food);
    handleCancel();
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title:        'Eliminar alimento',
      message:      `¿Eliminar "${name}" de la base de datos?`,
      confirmLabel: 'Eliminar',
      danger:       true,
    });
    if (ok) onDelete(id);
  };

  const filtered = foods.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.brand ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background-light dark:bg-background-dark">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-text-main dark:text-white">Base de Datos</h2>
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
              <input
                type="text" placeholder="Buscar..."
                className="pl-9 pr-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm outline-none focus:border-primary dark:text-white w-56"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={showForm ? handleCancel : openAdd}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2 rounded-lg font-bold shadow-lg shadow-primary/20 text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">{showForm ? 'close' : 'add'}</span>
              {showForm ? 'Cancelar' : 'Añadir'}
            </button>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="mb-6 bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
            <h3 className="text-sm font-black text-text-main dark:text-white mb-4">
              {editingId ? 'Editar alimento' : 'Nuevo alimento'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fila 1 */}
              <div className="md:col-span-2">
                <label className={LABEL}>Nombre *</label>
                <FoodAutocompleteInput type="text" className={FIELD_INPUT} value={form.name} onChange={v => setForm(prev => ({ ...prev, name: v }))} placeholder="Ej: Pan integral Hacendado" />
              </div>
              <div>
                <label className={LABEL}>Marca</label>
                <input type="text" className={FIELD_INPUT} value={form.brand} onChange={setField('brand')} placeholder="Ej: Mercadona" />
              </div>
              <div>
                <label className={LABEL}>Porción</label>
                <input type="text" className={FIELD_INPUT} value={form.portionSize} onChange={setField('portionSize')} placeholder="100g" />
              </div>

              {/* Fila 2: macros — los 4 campos */}
              <div>
                <label className={LABEL}>Calorías *</label>
                <input type="number" min="0" className={FIELD_INPUT} value={form.calories} onChange={setField('calories')} placeholder="0" />
              </div>
              <div>
                <label className={LABEL}>Proteínas (g)</label>
                <input type="number" min="0" step="0.1" className={FIELD_INPUT} value={form.protein} onChange={setField('protein')} placeholder="0" />
              </div>
              <div>
                <label className={LABEL}>Carbohidratos (g)</label>
                <input type="number" min="0" step="0.1" className={FIELD_INPUT} value={form.carbs} onChange={setField('carbs')} placeholder="0" />
              </div>
              <div>
                <label className={LABEL}>Grasas (g)</label>
                {/* Este campo faltaba en la versión anterior */}
                <input type="number" min="0" step="0.1" className={FIELD_INPUT} value={form.fats} onChange={setField('fats')} placeholder="0" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={handleCancel}
                className="px-5 py-2 rounded-lg text-sm font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.calories}
                className="px-5 py-2 rounded-lg text-sm font-black bg-primary text-black hover:bg-primary-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingId ? 'Guardar cambios' : 'Añadir alimento'}
              </button>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#15261b] border-b border-border-light dark:border-border-dark text-xs uppercase text-text-sub font-semibold tracking-wider">
                <th className="p-4">Alimento</th>
                <th className="p-4 text-right">Kcal</th>
                <th className="p-4 text-right hidden sm:table-cell">P / C / G</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-sub dark:text-gray-500">
                    {searchTerm ? `Sin resultados para "${searchTerm}"` : 'No hay alimentos. Añade uno nuevo.'}
                  </td>
                </tr>
              ) : (
                filtered.map(food => (
                  <tr key={food.id} className="hover:bg-gray-50 dark:hover:bg-[#15261b] transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-text-main dark:text-white">{food.name}</div>
                      <div className="text-xs text-text-sub dark:text-gray-400">
                        {food.brand ? `${food.brand} • ` : ''}{food.portionSize}
                      </div>
                    </td>
                    <td className="p-4 text-right font-medium text-text-main dark:text-white">{food.calories}</td>
                    <td className="p-4 text-right hidden sm:table-cell text-xs">
                      <span className="text-blue-500 font-bold">{food.protein}g</span>
                      {' / '}
                      <span className="text-yellow-500 font-bold">{food.carbs}g</span>
                      {' / '}
                      <span className="text-red-500 font-bold">{food.fats}g</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(food)}
                          className="text-gray-400 hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-lg"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(food.id, food.name)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
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
