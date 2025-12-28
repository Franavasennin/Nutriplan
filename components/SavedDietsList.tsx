import React from 'react';
import { SavedDiet } from '../types';
import { User, Calendar, Trash2, ChevronRight, FileText } from 'lucide-react';

interface Props {
  diets: SavedDiet[];
  onLoad: (diet: SavedDiet) => void;
  onDelete: (id: string) => void;
}

const SavedDietsList: React.FC<Props> = ({ diets, onLoad, onDelete }) => {
  if (diets.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="bg-gray-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <FileText className="text-gray-400" size={32} />
        </div>
        <h3 className="text-lg font-medium text-gray-800">No hay dietas guardadas</h3>
        <p className="text-gray-500 mt-1">Genera una nueva dieta y se guardará automáticamente aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <User className="text-emerald-600" /> Historial de Pacientes
      </h2>
      
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