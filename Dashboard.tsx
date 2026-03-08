import React from 'react';
import { SavedDiet } from '../types';

interface Props {
    stats: {
        totalClients: number;
        activePlans: number;
        customFoods: number;
    };
    recentDiets: SavedDiet[];
    onNewClient: () => void;
    onLoadDiet: (diet: SavedDiet) => void;
    installEvent: any;
    onInstall: () => void;
    onExportCSV: () => void;
}

const Dashboard: React.FC<Props> = ({ stats, recentDiets, onNewClient, onLoadDiet, installEvent, onInstall, onExportCSV }) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-8 pb-20">
                {/* Header */}
                <header className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex min-w-72 flex-col gap-2">
                        <h1 className="text-text-main dark:text-white text-4xl font-extrabold leading-tight tracking-[-0.033em]">Gestión de Clientes</h1>
                        <p className="text-text-sub dark:text-gray-400 text-base font-normal">Visualiza y administra el progreso de tus pacientes.</p>
                    </div>
                    <div className="flex gap-3">
                         {installEvent && (
                             <button onClick={onInstall} className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm" title="Instalar Aplicación en Escritorio">
                                <span className="material-symbols-outlined">download</span>
                            </button>
                         )}
                        <button onClick={onExportCSV} className="flex size-10 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm" title="Exportar Base de Datos Excel/CSV">
                            <span className="material-symbols-outlined">table_view</span>
                        </button>
                        <button onClick={onNewClient} className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-primary text-background-dark text-sm font-bold leading-normal tracking-[0.015em] hover:brightness-90 transition-all shadow-md shadow-primary/20">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            <span className="truncate">Nuevo Cliente</span>
                        </button>
                    </div>
                </header>
                
                {/* Stats Overview */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-text-sub dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Total Clientes</p>
                            <span className="material-symbols-outlined text-primary">groups</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-text-main dark:text-white text-3xl font-bold leading-tight">{stats.totalClients}</p>
                            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">Activos</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-text-sub dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Planes Generados</p>
                            <span className="material-symbols-outlined text-primary">fitness_center</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-text-main dark:text-white text-3xl font-bold leading-tight">{stats.activePlans}</p>
                            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">+ Recientes</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-text-sub dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Alimentos DB</p>
                            <span className="material-symbols-outlined text-orange-400">database</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-text-main dark:text-white text-3xl font-bold leading-tight">{stats.customFoods}</p>
                            <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-600/20">Personalizados</span>
                        </div>
                    </div>
                </section>

                 {/* Search and Filters */}
                <div className="flex flex-col lg:flex-row justify-between gap-4 items-center rounded-xl bg-surface-light dark:bg-surface-dark p-2 border border-border-light dark:border-border-dark shadow-sm">
                    <div className="w-full lg:w-1/2">
                        <label className="flex w-full items-center rounded-lg bg-background-light dark:bg-background-dark border border-transparent focus-within:border-primary px-3 h-12 transition-colors">
                            <span className="material-symbols-outlined text-text-sub dark:text-gray-400">search</span>
                            <input className="w-full border-none bg-transparent p-2 text-text-main dark:text-white placeholder:text-text-sub focus:ring-0 text-base outline-none" placeholder="Buscar cliente por nombre o objetivo..." type="text"/>
                        </label>
                    </div>
                    <div className="w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                        <div className="flex gap-2 min-w-max px-2">
                            <button className="flex h-9 items-center justify-center rounded-lg bg-text-main dark:bg-white px-4 text-white dark:text-background-dark text-sm font-bold shadow-md">Todos</button>
                            <button className="flex h-9 items-center justify-center rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-4 text-text-main dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium">Activos</button>
                            <button className="flex h-9 items-center justify-center rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-4 text-text-main dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium">Inactivos</button>
                        </div>
                    </div>
                </div>

                {/* Clients Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {recentDiets.map((diet) => (
                        <div key={diet.id} className="group flex flex-col justify-between gap-4 rounded-xl bg-surface-light dark:bg-surface-dark p-5 border border-border-light dark:border-border-dark hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3 items-center">
                                        <div className="size-12 rounded-full bg-cover bg-center ring-2 ring-transparent group-hover:ring-primary/30 transition-all flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 font-bold text-lg">
                                            {diet.patientData.name ? diet.patientData.name.charAt(0).toUpperCase() : 'P'}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="text-base font-bold text-text-main dark:text-white truncate">{diet.patientData.name || 'Paciente'}</h3>
                                            <p className="text-xs text-text-sub dark:text-gray-400">{diet.patientData.age} años • {diet.patientData.weight}kg</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">Activo</span>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold text-text-sub dark:text-gray-400 uppercase tracking-wider mb-1">Dieta</p>
                                        <div className="flex items-center gap-1.5 text-text-main dark:text-white font-medium text-sm capitalize">
                                            <span className="material-symbols-outlined text-base text-primary">restaurant</span>
                                            {diet.patientData.dietType.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-semibold text-text-sub dark:text-gray-400 uppercase tracking-wider">Calorías</span>
                                            <span className="text-primary font-bold">{diet.metrics.tee}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-background-light dark:bg-background-dark overflow-hidden">
                                            <div className="h-full rounded-full bg-primary" style={{width: '75%'}}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => onLoadDiet(diet)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-background-light dark:bg-background-dark py-2.5 text-sm font-bold text-text-main dark:text-white transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 group-hover:bg-primary group-hover:text-background-dark">
                                Ver Plan
                            </button>
                        </div>
                    ))}

                     {/* Add New Card */}
                     <button onClick={onNewClient} className="group flex flex-col items-center justify-center gap-4 rounded-xl bg-transparent p-5 border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all duration-300 min-h-[220px]">
                        <div className="size-16 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-primary text-3xl">add</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-text-main dark:text-white">Añadir Cliente</h3>
                            <p className="text-xs text-text-sub dark:text-gray-400 mt-1">Crear nuevo perfil y dieta</p>
                        </div>
                    </button>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;