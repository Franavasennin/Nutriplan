import React, { useRef } from 'react';
import { SavedDiet } from '../types';
import { User, Calendar, Trash2, ChevronRight, FileText, Download, Upload, TableProperties, FileUp } from 'lucide-react';
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

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <User className="text-emerald-600" /> Historial de Pacientes
      </h2>
      <div className="flex items-center gap-2">
        <button
          onClick={downloadCSVTemplate}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-colors"
          title="Descargar plantilla CSV"
        >
          <TableProperties size={16} /> Plantilla
        </button>
        <button
          onClick={() => csvInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          title="Importar clientes desde CSV"
        >
          <Upload size={16} /> Importar CSV
        </button>
        <button
          onClick={() => pdfInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
          title="Importar dieta desde PDF"
        >
          <FileUp size={16} /> Importar PDF
        </button>
        {diets.length > 0 && (
          <button
            onClick={() => exportCSV(diets)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            title="Exportar lista de clientes a CSV"
          >
            <Download size={16} /> Exportar CSV
          </button>
        )}
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePDFChange} />
      </div>
    </div>
  );

  if (diets.length === 0) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        {header}
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="bg-gray-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FileText className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-800">No hay dietas guardadas</h3>
          <p className="text-gray-500 mt-1">Genera una nueva dieta o importa clientes desde un CSV.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {header}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {diets.sort((a, b) => b.timestamp - a.timestamp).map((diet) => (
          <div key={diet.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <User size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 line-clamp-1">{diet.patientData.name || 'Paciente sin nombre'}</h3>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(diet.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(diet.id); }}
                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tipo:</span>
                <span className="font-medium text-gray-700 capitalize">{diet.patientData.dietType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duración:</span>
                <span className="font-medium text-gray-700 capitalize">{diet.patientData.duration.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IMC:</span>
                <span className="font-medium text-gray-700">{diet.metrics.imc}</span>
              </div>
            </div>

            <button 
              onClick={() => onLoad(diet)}
              className="w-full py-2 bg-gray-50 text-emerald-600 font-medium rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-all flex items-center justify-center gap-1 text-sm"
            >
              Ver Dieta Completa <ChevronRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedDietsList;