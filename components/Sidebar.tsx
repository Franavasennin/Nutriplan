import React from 'react';
import { CLINIC } from '../config/clinic';
import { downloadCSVTemplate } from '../services/exportService';

export type Step = 'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes' | 'couples';

interface NavItem {
  step: Step;
  icon: string;
  label: string;
}

const NAV_PRIMARY: NavItem[] = [
  { step: 'dashboard', icon: 'dashboard',   label: 'Dashboard'     },
  { step: 'form',      icon: 'person_add',  label: 'Nuevo Cliente' },
  { step: 'progress',  icon: 'monitoring',  label: 'Seguimiento'   },
];

const NAV_SECONDARY: NavItem[] = [
  { step: 'recipes', icon: 'menu_book', label: 'Recetas AI'        },
  { step: 'foods',   icon: 'database',  label: 'Base de Alimentos' },
  { step: 'history', icon: 'history',   label: 'Historial'         },
];

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left w-full ${
      isActive
        ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20'
        : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    <span className={`material-symbols-outlined ${isActive ? 'active-nav-icon' : ''}`}>
      {item.icon}
    </span>
    <span className="text-sm">{item.label}</span>
  </button>
);

export interface SidebarProps {
  currentStep: Step;
  isDark: boolean;
  dbOnline: boolean;
  onNavigate: (step: Step) => void;
  onGoHome: () => void;
  onToggleTheme: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep, isDark, dbOnline, onNavigate, onGoHome,
  onToggleTheme, onExportJSON, onExportCSV, onImport,
}) => (
  <aside className="hidden w-64 flex-col border-r border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark lg:flex z-50 transition-colors duration-200 no-print">
    <div className="flex h-full flex-col justify-between p-4">

      {/* Top: Logo + Nav */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 px-2 py-2 mb-4 cursor-pointer" onClick={onGoHome}>
          <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl font-bold">nutrition</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-text-main dark:text-white text-lg font-black leading-tight">NutriPlan</h1>
            <p className="text-text-sub dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">Software Clínico</p>
          </div>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto max-h-[50vh]">
          {NAV_PRIMARY.map(item => (
            <NavButton
              key={item.step}
              item={item}
              isActive={currentStep === item.step}
              onClick={() => onNavigate(item.step)}
            />
          ))}
          <div className="my-2 border-t border-border-light dark:border-border-dark opacity-50" />
          {NAV_SECONDARY.map(item => (
            <NavButton
              key={item.step}
              item={item}
              isActive={currentStep === item.step}
              onClick={() => onNavigate(item.step)}
            />
          ))}
        </div>
      </div>

      {/* Bottom: DB tools + theme + user */}
      <div className="flex flex-col gap-4">
        <div className="p-3 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-text-sub uppercase">Base de Datos</p>
            <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${dbOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dbOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
              {dbOnline ? 'PostgreSQL' : 'Local'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={onExportJSON}
              title="Backup completo (pacientes, alimentos y progreso). Úsalo para restaurar en otro ordenador."
              className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">backup</span>
              <span className="text-[8px] font-bold">Backup</span>
            </button>
            <button
              type="button"
              onClick={onExportCSV}
              title="Exporta un resumen en Excel. Solo para consulta."
              className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">table_view</span>
              <span className="text-[8px] font-bold">Excel</span>
            </button>
            <button
              type="button"
              onClick={downloadCSVTemplate}
              title="Descarga la plantilla CSV para importar clientes en masa."
              className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span className="text-[8px] font-bold">Plantilla</span>
            </button>
            <label
              title="Restaurar backup. Solo acepta archivos .json generados con NutriPlan."
              className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">upload</span>
              <span className="text-[8px] font-bold">Restaurar</span>
              <input type="file" className="hidden" accept=".json" onChange={onImport} />
            </label>
          </div>
          <p className="text-[8px] text-text-sub text-center leading-tight">Solo el Backup JSON restaura datos</p>
        </div>

        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-background-light dark:bg-background-dark text-text-sub text-xs font-bold border border-border-light dark:border-border-dark hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">{isDark ? 'light_mode' : 'dark_mode'}</span>
          {isDark ? 'Modo luz' : 'Modo oscuro'}
        </button>

        <div className="flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-primary bg-primary/10">
          <div className="bg-primary rounded-full size-8 flex items-center justify-center text-background-dark font-black text-sm shrink-0">
            {CLINIC.initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <p className="text-text-main dark:text-white text-xs font-black truncate">{CLINIC.name}</p>
            <p className="text-text-sub dark:text-gray-400 text-[9px] font-bold uppercase truncate">{CLINIC.role}</p>
          </div>
        </div>
      </div>

    </div>
  </aside>
);
