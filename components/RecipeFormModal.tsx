import React, { useState } from 'react';
import { Recipe, Allergen, ALLERGEN_LABELS } from '../types';

interface Props {
  /** Si se pasa, edita esta receta; si no, crea una nueva. */
  recipe?: Recipe | null;
  onSave: (recipe: Recipe) => void;
  onClose: () => void;
}

type RecipeForm = {
  title: string; description: string; prepTime: string;
  calories: string; protein: string; carbs: string; fats: string;
  ingredients: string; instructions: string; tags: string;
  allergens: Set<Allergen>;
};

const emptyForm = (): RecipeForm => ({
  title: '', description: '', prepTime: '',
  calories: '', protein: '', carbs: '', fats: '',
  ingredients: '', instructions: '', tags: '',
  allergens: new Set(),
});

const formFromRecipe = (r: Recipe): RecipeForm => ({
  title:        r.title,
  description:  r.description,
  prepTime:     String(r.prepTime),
  calories:     String(r.calories),
  protein:      String(r.protein),
  carbs:        String(r.carbs),
  fats:         String(r.fats),
  ingredients:  r.ingredients.join('\n'),
  instructions: r.instructions.join('\n'),
  tags:         r.tags.join(', '),
  allergens:    new Set(r.allergens ?? []),
});

const FIELD_INPUT = "w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-2 outline-none dark:text-white focus:border-primary transition-colors text-sm";
const LABEL = "block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1";

const RecipeFormModal: React.FC<Props> = ({ recipe, onSave, onClose }) => {
  const isEdit = !!recipe;
  const [form, setForm] = useState<RecipeForm>(recipe ? formFromRecipe(recipe) : emptyForm());

  const setField = (key: keyof Omit<RecipeForm, 'allergens'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const toggleAllergen = (a: Allergen) => {
    setForm(prev => {
      const next = new Set(prev.allergens);
      next.has(a) ? next.delete(a) : next.add(a);
      return { ...prev, allergens: next };
    });
  };

  const linesOf = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
  const tagsOf = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean);

  const isValid =
    form.title.trim() && form.description.trim() && form.calories &&
    linesOf(form.ingredients).length > 0 && linesOf(form.instructions).length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const toNum = (v: string) => (isNaN(Number(v)) ? 0 : Number(v));
    const newRecipe: Recipe = {
      id:           recipe?.id ?? crypto.randomUUID(),
      title:        form.title.trim(),
      description:  form.description.trim(),
      prepTime:     toNum(form.prepTime) || 0,
      calories:     toNum(form.calories),
      protein:      toNum(form.protein),
      carbs:        toNum(form.carbs),
      fats:         toNum(form.fats),
      ingredients:  linesOf(form.ingredients),
      instructions: linesOf(form.instructions),
      tags:         tagsOf(form.tags),
      allergens:    form.allergens.size ? Array.from(form.allergens) : undefined,
    };
    onSave(newRecipe);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-black text-text-main dark:text-white">
              {isEdit ? 'Editar receta' : 'Nueva receta'}
            </h2>
            <button type="button" onClick={onClose} className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={LABEL}>Título *</label>
              <input type="text" className={FIELD_INPUT} value={form.title} onChange={setField('title')} placeholder="Ej: Avena con plátano y nueces" />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL}>Descripción *</label>
              <input type="text" className={FIELD_INPUT} value={form.description} onChange={setField('description')} placeholder="Breve descripción del plato" />
            </div>

            <div>
              <label className={LABEL}>Preparación (min)</label>
              <input type="number" min="0" className={FIELD_INPUT} value={form.prepTime} onChange={setField('prepTime')} placeholder="10" />
            </div>
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
              <input type="number" min="0" step="0.1" className={FIELD_INPUT} value={form.fats} onChange={setField('fats')} placeholder="0" />
            </div>
            <div>
              <label className={LABEL}>Etiquetas (separadas por coma)</label>
              <input type="text" className={FIELD_INPUT} value={form.tags} onChange={setField('tags')} placeholder="equilibrada, desayuno, rápido" />
            </div>

            <div className="md:col-span-2">
              <label className={LABEL}>Ingredientes * (uno por línea)</label>
              <textarea rows={5} className={FIELD_INPUT} value={form.ingredients} onChange={setField('ingredients')} placeholder={'60g copos de avena\n200ml leche semidesnatada'} />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL}>Preparación * (un paso por línea)</label>
              <textarea rows={5} className={FIELD_INPUT} value={form.instructions} onChange={setField('instructions')} placeholder={'Calentar la leche...\nAñadir la avena...'} />
            </div>

            <div className="md:col-span-2">
              <label className={LABEL}>Alérgenos (opcional)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.values(Allergen).map(a => (
                  <label key={a} className="flex items-center gap-2 text-xs text-text-main dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={form.allergens.has(a)} onChange={() => toggleAllergen(a)} className="size-4 accent-primary" />
                    {ALLERGEN_LABELS[a]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid}
              className="px-5 py-2 rounded-lg text-sm font-black bg-primary text-black hover:bg-primary-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isEdit ? 'Guardar cambios' : 'Añadir receta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeFormModal;
