# Spec: Mejoras mi_app_dieta — 5 features

**Fecha:** 2026-05-28  
**Proyecto:** mi_app_dieta  
**Enfoque:** Cambios quirúrgicos independientes (Opción A)

---

## 1. Añadir / Quitar tomas extra al día

### Descripción
El nutricionista puede añadir una toma que no existe en el día actual, o eliminar una toma existente, sin regenerar el plan completo.

### Componente afectado
`components/DietPlanDisplay.tsx`

### Comportamiento

**Añadir toma:**
- Debajo de la última `MealSection` del día activo aparece un botón **"+ Añadir toma"**.
- Solo se muestra si hay tomas disponibles no presentes en ese día (diferencia entre `ALL_MEAL_CONFIGS` y las tomas que ya tiene el día).
- Al pulsarlo se abre un selector (dropdown o mini-panel) con las tomas disponibles: p.ej. si el día tiene desayuno, almuerzo y cena, ofrece "Media mañana" y "Merienda".
- Al seleccionar una toma, se hace una llamada a la IA para generar el contenido de esa toma, usando los macros residuales del día (macros objetivo menos la suma de las tomas ya existentes).
- La toma generada se inserta en `localPlan` → activa el flujo `hasChanges → Guardar cambios`.
- Mientras la IA genera, la toma muestra un skeleton/spinner en su lugar.

**Quitar toma:**
- Cada `MealSection` muestra un botón **"×"** (eliminar) en su cabecera, junto a los macros.
- Al pulsar se muestra un `ConfirmDialog` con el mensaje: "¿Eliminar [nombre de toma] del día [X]? No se puede deshacer."
- Si confirma, la toma se elimina de `localPlan.weeklyPlan[día].meals` → activa `hasChanges`.
- No se puede eliminar la última toma del día (mínimo 1 toma siempre presente).

### Tipos afectados
Ninguno — `DayPlan.meals` ya es un objeto con claves opcionales.

### Servicio afectado
`services/geminiService.ts` — se añade una función `generateSingleMeal(mealKey, residualMacros, patient)` que genera una toma nueva con los macros residuales como objetivo.

### Error handling
- Si la llamada a la IA falla, mostrar Toast de error. La toma no se añade.
- Si los macros residuales son negativos (el día ya excede el objetivo), la función usa como objetivo los macros por toma promedio del paciente.

---

## 2. Dietas para Parejas

### Descripción
Generar dos planes dietéticos para dos personas (pareja) en un solo flujo, cada uno con sus propios parámetros y macros, almacenados como una entidad vinculada.

### Tipos nuevos — `types.ts`

```typescript
export interface CouplesDiet {
  id: string;
  timestamp: number;
  personA: SavedDiet;
  personB: SavedDiet;
}
```

No se modifica `SavedDiet`. Cada persona tiene su propia `SavedDiet` completa.

### Base de datos — Supabase
Nueva tabla `couples_diets`:
```sql
id          text primary key
timestamp   bigint
person_a    jsonb   -- SavedDiet completa
person_b    jsonb   -- SavedDiet completa
```

### Hook — `useAppData.ts`
Se añaden:
- `couplesDiets: CouplesDiet[]` — estado
- `saveCouplesDiet(a: SavedDiet, b: SavedDiet): string` — crea el registro, devuelve el id
- `deleteCouplesDiet(id: string)` — elimina registro
- Carga inicial desde `couples_diets` en el `useEffect` de load.

### Formulario — `PatientForm.tsx`
- Toggle **"Generar para pareja"** al final del formulario.
- Al activarlo aparece una sección "Datos de la pareja" con: nombre, género, edad, peso, talla, actividad, tipo de dieta, objetivo calórico, alimentos excluidos, patologías, número de comidas.
- El botón de generar cambia a "Generar planes para pareja".
- Validación: todos los campos obligatorios de ambas personas deben estar rellenos.

### Generación — `App.tsx`
Al recibir el submit con modo pareja:
1. Calcular métricas para persona A y persona B por separado con `calculateAllMetrics`.
2. Lanzar en paralelo: `Promise.all([generateDietPlan(patientA, metricsA), generateDietPlan(patientB, metricsB)])`.
3. Construir dos `SavedDiet` independientes (cada una con su propio `id`).
4. Llamar a `saveCouplesDiet(savedDietA, savedDietB)` para guardar el registro vinculado.
5. Navegar a la vista de pareja pasando el `CouplesDiet`.

### Vista — nuevo componente `CouplesDietView.tsx`
- Recibe `couplesDiet: CouplesDiet`.
- Muestra dos **tabs** en la parte superior: "👤 [Nombre A]" y "👤 [Nombre B]".
- Al cambiar de tab renderiza el `DietPlanDisplay` de la persona seleccionada (reutiliza el componente existente completo).
- Header: "Plan de Pareja — [Nombre A] & [Nombre B]".
- Botón PDF genera ambos planes en una sola impresión (page break entre ellos).

### Listado — `SavedDietsList.tsx`
- Añadir una sección "Planes de Pareja" que lista los `CouplesDiet`.
- Cada ítem muestra los dos nombres y la fecha.

---

## 3. Ajuste de raciones a macros por toma (mejora de prompt)

### Descripción
Refuerzo del prompt de generación en `services/geminiService.ts` para que la IA calibre las raciones de cada toma a los macros objetivo individuales del paciente.

### Cambios en `buildDietSystemPrompt`
Añadir regla de verificación obligatoria:
> "VERIFICACIÓN FINAL OBLIGATORIA: Antes de cerrar el JSON, suma calories+protein+carbs+fats de todas las tomas del día 1. Si la suma difiere más del 5% del objetivo indicado en el prompt, ajusta las raciones antes de responder."

### Cambios en `buildUserPrompt`
La lógica de `proteinPerMeal`, `carbsPerMeal`, `fatsPerMeal`, `calPerMeal` ya existe. Ampliar con:

1. **Ejemplos numéricos personalizados** por macro, calculados con los valores reales del paciente:
   - HC: "Para [X]g HC por toma necesitas [Y]g arroz cocido, o [Z]g avena seca, o combina [A]g arroz + [B]g garbanzos."
   - Proteína: "Para [X]g P necesitas [Y]g pechuga de pollo (31g P/100g) — ese es el peso exacto, no uses 120g por defecto."
   - Grasas: "Para [X]g G necesitas [Y]ml AOVE, o [Z]g nueces, o [A]g salmón."

2. **Cap de proteína reforzado**: añadir nota explícita con el peso exacto de pechuga/atún que da el objetivo de proteína del paciente.

### Sin cambios de UI
Este punto es exclusivamente prompt engineering.

---

## 4. Guardar modificaciones de la lista de la compra

### Descripción
Las modificaciones manuales a la lista de la compra (añadir, eliminar, marcar/desmarcar) se persisten en `localStorage` y sobreviven al cerrar/reabrir el panel.

### Clave de localStorage
`shopping_list_<dietId>` — específica por dieta.

### Props nuevas en `DietPlanDisplay`
Añadir `dietId?: string` a las Props del componente para construir la clave de localStorage.

### Comportamiento

**Al abrir el panel:**
1. Buscar `localStorage.getItem('shopping_list_<dietId>')`.
2. Si existe: deserializar y usar como `editList` inicial.
3. Si no existe: generar desde el plan (comportamiento actual).

**Botón "Guardar lista":**
- Ubicación: dentro del header del panel, junto al contador "X pendientes".
- Icono `save` (Material Symbols). Label: "Guardar lista".
- Solo visible si `listHasChanges === true` (estado nuevo).
- Al pulsar: `localStorage.setItem(...)` + Toast "Lista guardada" + `setListHasChanges(false)`.

**Invalidación:**
- Al llamar `handleSaveAll` (guardar cambios del plan): `localStorage.removeItem('shopping_list_<dietId>')`.
- Al recibir un `plan` nuevo por props (useEffect existente): ídem.

**Degradación en modo incógnito:** si `localStorage` lanza excepción, capturar silenciosamente y no mostrar el botón "Guardar lista".

---

## 5. Mover y proteger el botón "Rehacer día"

### Descripción
El botón `replay` junto a los tabs de día se mueve al área de acciones del header y añade confirmación antes de ejecutar.

### Cambios en `DietPlanDisplay.tsx`

**Eliminar:**
- El `<button>` con icono `replay` dentro de la fila de tabs junto al tab activo.

**Añadir en el header de acciones** (fila de botones principales):
- Botón **"Rehacer día [activeDay]"** con icono `replay`.
- Solo visible si `onRegenerateDay` existe como prop.
- Estilo consistente con el botón "Rehacer plan" existente.
- Al pulsar: abrir `ConfirmDialog` (ya existe en `components/ConfirmDialog.tsx`) con:
  - `title`: `¿Rehacer el día ${activeDay}?`
  - `message`: `Se regenerará el menú completo del día ${activeDay}. El contenido actual se perderá.`
  - `confirmLabel`: `Rehacer`
  - `cancelLabel`: `Cancelar`
- Si confirma: `onRegenerateDay(activeDay)`.

**Estado nuevo:** `showRegenerateConfirm: boolean` para controlar la apertura del diálogo.

---

## Archivos afectados — resumen

| Archivo | Features |
|---|---|
| `types.ts` | 2 (añadir `CouplesDiet`) |
| `components/DietPlanDisplay.tsx` | 1, 4, 5 |
| `components/PatientForm.tsx` | 2 (toggle pareja) |
| `components/CouplesDietView.tsx` | 2 (nuevo componente) |
| `components/SavedDietsList.tsx` | 2 (sección parejas) |
| `hooks/useAppData.ts` | 2 (couplesDiets state + CRUD) |
| `services/geminiService.ts` | 1 (generateSingleMeal) y 3 (mejora prompt) |
| `App.tsx` | 2 (flujo generación pareja) |

---

## Consideraciones técnicas

- **CouplesDiet en Supabase offline:** si Supabase no está disponible, guardar en estado local y reintentar al reconectar (patrón ya existente en `useAppData`).
- **Generación paralela (Feature 2):** usar `Promise.all`. Si uno de los dos falla, Toast de error, no guardar ninguno.
- **Botón "+ Añadir toma" (Feature 1):** desactivado durante `isLoading` para evitar llamadas simultáneas.
- **Orden de implementación recomendado:** 5 → 4 → 3 → 1 → 2 (de menor a mayor complejidad).
