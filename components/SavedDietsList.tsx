import React, { useRef, useState, useMemo } from 'react';
import { SavedDiet, DIET_TYPE_LABELS, DietType } from '../types';
import { User, Calendar, Trash2, ChevronRight, FileText, Download, Upload, TableProperties, FileUp, Search, X } from 'lucide-react';
import { exportCSV, importCSV, downloadCSVTemplate } from '../services/exportService';

interface Props {
  diets: SavedDiet[];
  onLoad: (diet: SavedDiet) => void;
  onDelete: (id: string) => void;
  onImportCSV: (diets: SavedDiet[]) => void;
  onImportError: (msg: string) => void;
  onImportPDF: (file: File) => void;
}

const SavedDietsList: React.FC<Props> = ({ diets, onLoad, onDelete, onImportCSV, onImportError, onImportPDF }) => {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dietFilter, setDietFilter] = useState<string>('all');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    importCSV(file, onImportCSV, onImportError);
  };

  const handlePDFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    onImportPDF(file);
  };

  const filteredDiets = useMemo(() => {
    return diets
      .filter(diet => {
        const name = (diet.patientData.name || '').toLowerCase();
        const typeLabel = (DIET_TYPE_LABELS[diet.patientData.dietType] || diet.patientData.dietType).toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || typeLabel.includes(searchTerm.toLowerCase());
        const matchesFilter = dietFilter === 'all' || diet.patientData.dietType === dietFilter;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [diets, searchTerm, dietFilter]);

  const header = (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-black text-text-main dark:text-white flex items-center gap-2">
          <User className="text-primary" /> Historial de Planes
        </h2>
        <p className="text-sm text-text-sub dark:text-gray-400 mt-1">
          {diets.length} plan{diets.length === 1 ? '' : 'es'} registrado{diets.length === 1 ? '' : 's'} en total
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={downloadCSVTemplate}
          className="flex items-center gap-2 px-3 py-2 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-gray-100 dark:hover:bg-gray-800 text-text-sub dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
          title="Descargar plantilla CSV"
          aria-label="Descargar plantilla CSV"
        >
          <TableProperties size={16} />
          <span className="hidden sm:inline">Plantilla</span>
        </button>
        <button
          onClick={() => csvInputRef.current?.click()}
          className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
          title="Importar clientes desde CSV"
          aria-label="Importar clientes desde archivo CSV"
        >
          <Upload size={16} />
          <span>Importar CSV</span>
        </button>
        <button
          onClick={() => pdfInputRef.current?.click()}
          className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
          title="Importar dieta desde PDF"
          aria-label="Importar dieta desde documento PDF"
        >
          <FileUp size={16} />
          <span>Importar PDF</span>
        </button>
        {diets.length > 0 && (
          <button
            onClick={() => exportCSV(diets)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-background-dark hover:brightness-95 text-sm font-bold rounded-xl transition-colors shadow-sm shadow-primary/20 focus:ring-2 focus:ring-primary focus-visible:outline-none"
            title="Exportar lista de clientes a CSV"
            aria-label="Exportar lista de dietas a CSV"
          >
            <Download size={16} />
            <span>Exportar CSV</span>
          </button>
        )}
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePDFChange} />
      </div>
    </div>
  );

  if (diets.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="text-center py-16 px-6 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex flex-col items-center gap-3">
          <div className="bg-primary/10 text-primary p-4 rounded-full w-16 h-16 flex items-center justify-center mb-1">
            <FileText size={32} />
          </div>
          <h3 className="text-xl font-bold text-text-main dark:text-white">No hay planes en el historial</h3>
          <p className="text-sm text-text-sub dark:text-gray-400 max-w-sm">
            Genera un nuevo plan nutricional o importa pacientes existentes mediante un archivo CSV o PDF.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-surface-light dark:bg-surface-dark p-3.5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-sub dark:text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por paciente o tipo de dieta..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary"
            aria-label="Buscar planes guardados"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white p-1 rounded-full"
              aria-label="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-sub dark:text-gray-400 whitespace-nowrap">Filtrar:</span>
          <select
            value={dietFilter}
            onChange={e => setDietFilter(e.target.value)}
            className="py-2 px-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary"
            aria-label="Filtrar por tipo de dieta"
          >
            <option value="all">Todas las dietas</option>
            {Object.entries(DIET_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultados vacíos de búsqueda */}
      {filteredDiets.length === 0 && (
        <div className="text-center py-12 px-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-border-light dark:border-border-dark">
          <p className="text-text-main dark:text-white font-bold text-base mb-1">Sin resultados</p>
          <p className="text-text-sub dark:text-gray-400 text-sm">
            No se encontraron dietas que coincidan con los criterios de búsqueda.
          </p>
          <button
            onClick={() => { setSearchTerm(''); setDietFilter('all'); }}
            className="mt-3 px-4 py-1.5 text-xs font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Restablecer filtros
          </button>
        </div>
      )}

      {/* Grid de Dietas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDiets.map((diet) => {
          const typeLabel = DIET_TYPE_LABELS[diet.patientData.dietType] ?? diet.patientData.dietType;
          return (
            <div
              key={diet.id}
              className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-border-light dark:border-border-dark hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 text-primary font-black rounded-xl size-10 flex items-center justify-center text-base">
                      {diet.patientData.name ? diet.patientData.name.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main dark:text-white line-clamp-1 text-base">
                        {diet.patientData.name || 'Paciente sin nombre'}
                      </h3>
                      <span className="text-xs text-text-sub dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={12} />
                        {new Date(diet.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {diet.plan?.durationText ? ` · ${diet.plan.durationText}` : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(diet.id); }}
                    className="text-text-sub dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:ring-2 focus:ring-primary focus-visible:outline-none"
                    title="Eliminar del historial"
                    aria-label={`Eliminar dieta de ${diet.patientData.name || 'paciente'}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-2.5 py-3 border-y border-border-light dark:border-border-dark text-sm mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-sub dark:text-gray-400 font-semibold uppercase">Tipo de dieta:</span>
                    <span className="font-bold text-text-main dark:text-white text-xs px-2 py-0.5 rounded-md bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-sub dark:text-gray-400 font-semibold uppercase">Calorías / día:</span>
                    <span className="font-black text-primary-accessible dark:text-primary">
                      {diet.metrics.macros?.calories ? `${Math.round(diet.metrics.macros.calories)} kcal` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-sub dark:text-gray-400 font-semibold uppercase">IMC calculado:</span>
                    <span className="font-bold text-text-main dark:text-white">
                      {diet.metrics.imc}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onLoad(diet)}
                className="w-full py-2.5 bg-background-light dark:bg-background-dark text-text-main dark:text-white font-bold rounded-xl border border-border-light dark:border-border-dark group-hover:bg-primary group-hover:text-background-dark group-hover:border-primary transition-all flex items-center justify-center gap-1.5 text-sm shadow-sm cursor-pointer"
              >
                <span>Ver Plan Completo</span>
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavedDietsList;