import React, { useState } from 'react';
import { ClientProgress, ProgressEntry } from '../types';

interface Props {
  clients: string[];
  progressData: ClientProgress[];
  onSaveEntry: (clientName: string, entry: ProgressEntry) => void;
}

const ProgressTracker: React.FC<Props> = ({ clients, progressData, onSaveEntry }) => {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [newEntry, setNewEntry] = useState<Partial<ProgressEntry>>({
    weight: 0,
    waist: 0,
    hip: 0,
    notes: ''
  });

  const clientData = progressData.find(c => c.clientName === selectedClient);
  const sortedEntries = clientData ? [...clientData.entries].sort((a, b) => a.date - b.date) : [];
  const latestEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;
  const previousEntry = sortedEntries.length > 1 ? sortedEntries[sortedEntries.length - 2] : null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClient && newEntry.weight) {
      onSaveEntry(selectedClient, {
        id: crypto.randomUUID(),
        date: Date.now(),
        weight: Number(newEntry.weight),
        waist: Number(newEntry.waist) || undefined,
        hip: Number(newEntry.hip) || undefined,
        notes: newEntry.notes
      });
      setNewEntry({ weight: 0, waist: 0, hip: 0, notes: '' });
    }
  };

  const getWeightChange = () => {
      if (!latestEntry || !previousEntry) return { val: 0, percent: 0 };
      const diff = latestEntry.weight - previousEntry.weight;
      const percent = (diff / previousEntry.weight) * 100;
      return { val: diff.toFixed(1), percent: percent.toFixed(1) };
  };
  const change = getWeightChange();

  return (
    <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-4 md:p-8">
        <div className="container mx-auto max-w-5xl">
            {/* Page Heading */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-text-main dark:text-white text-3xl font-black leading-tight tracking-tight mb-2">Progreso y Métricas</h1>
                    <p className="text-text-sub dark:text-gray-400 text-base">Visualiza la evolución del cliente y compara con sus objetivos.</p>
                </div>
                <div className="w-full md:w-64">
                    <select 
                        className="w-full h-12 px-4 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                    >
                        <option value="">-- Seleccionar Cliente --</option>
                        {clients.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            
            {selectedClient ? (
                <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="flex flex-col p-5 bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-text-sub dark:text-gray-400 text-sm font-medium">Peso Actual</span>
                            <span className="material-symbols-outlined text-gray-300 text-xl">monitor_weight</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-text-main dark:text-white tracking-tight">{latestEntry?.weight || '-'}</span>
                            <span className="text-sm text-text-sub">kg</span>
                        </div>
                        {change.val !== 0 && (
                            <div className="flex items-center gap-1 mt-3">
                                <span className={`material-symbols-outlined text-sm ${Number(change.val) < 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {Number(change.val) < 0 ? 'trending_down' : 'trending_up'}
                                </span>
                                <span className={`text-sm font-bold ${Number(change.val) < 0 ? 'text-green-500' : 'text-red-500'}`}>{change.percent}%</span>
                                <span className="text-text-sub text-xs ml-1">vs anterior</span>
                            </div>
                        )}
                    </div>
                        <div className="flex flex-col p-5 bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-text-sub dark:text-gray-400 text-sm font-medium">Cintura</span>
                            <span className="material-symbols-outlined text-gray-300 text-xl">straighten</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-text-main dark:text-white tracking-tight">{latestEntry?.waist || '-'}</span>
                            <span className="text-sm text-text-sub">cm</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Entry Form */}
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm h-fit">
                        <h3 className="font-bold text-lg mb-4 text-text-main dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">edit_calendar</span> Nuevo Registro
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Peso (kg)</label>
                                <input 
                                    type="number" step="0.1" required
                                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none focus:border-primary dark:text-white"
                                    value={newEntry.weight || ''}
                                    onChange={e => setNewEntry({...newEntry, weight: Number(e.target.value)})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Cintura</label>
                                    <input 
                                        type="number" step="0.1"
                                        className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none focus:border-primary dark:text-white"
                                        value={newEntry.waist || ''}
                                        onChange={e => setNewEntry({...newEntry, waist: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Cadera</label>
                                    <input 
                                        type="number" step="0.1"
                                        className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none focus:border-primary dark:text-white"
                                        value={newEntry.hip || ''}
                                        onChange={e => setNewEntry({...newEntry, hip: Number(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1">Notas</label>
                                <textarea 
                                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none focus:border-primary dark:text-white"
                                    rows={2}
                                    value={newEntry.notes}
                                    onChange={e => setNewEntry({...newEntry, notes: e.target.value})}
                                ></textarea>
                            </div>
                            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-[20px]">save</span> Guardar
                            </button>
                        </form>
                    </div>

                    {/* History Table */}
                    <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-[#1A2C20]">
                            <h3 className="font-bold text-text-main dark:text-white">Historial de Registros</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-background-light dark:bg-background-dark text-text-sub dark:text-gray-400 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4 text-center">Peso</th>
                                        <th className="p-4 text-center">Cintura</th>
                                        <th className="p-4 text-center">Cadera</th>
                                        <th className="p-4">Notas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                    {sortedEntries.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">Sin registros aún</td></tr>
                                    ) : (
                                        [...sortedEntries].reverse().map(entry => (
                                            <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-text-main dark:text-gray-300 font-medium">{new Date(entry.date).toLocaleDateString()}</td>
                                                <td className="p-4 text-center text-text-main dark:text-white font-bold">{entry.weight} kg</td>
                                                <td className="p-4 text-center text-text-sub dark:text-gray-400">{entry.waist ? `${entry.waist}` : '-'}</td>
                                                <td className="p-4 text-center text-text-sub dark:text-gray-400">{entry.hip ? `${entry.hip}` : '-'}</td>
                                                <td className="p-4 text-text-sub dark:text-gray-500 truncate max-w-xs">{entry.notes}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark border-dashed">
                    <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">search</span>
                    <p className="text-text-sub dark:text-gray-400 text-lg">Selecciona un cliente arriba para ver su progreso</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default ProgressTracker;