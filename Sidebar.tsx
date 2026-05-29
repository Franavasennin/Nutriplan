import React from 'react';

export type Step = 'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes';

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
  onNavigate: (step: Step) => void;
  onGoHome: () => void;
  onToggleTheme: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep, isDark, onNavigate, onGoHome,
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
          <p className="text-[10px] font-bold text-text-sub uppercase text-center">Base de Datos</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { onClick: onExportJSON, icon: 'download',   label: 'JSON'   },
              { onClick: onExportCSV,  icon: 'table_view', label: 'CSV'    },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm">{btn.icon}</span>
                <span className="text-[8px] font-bold">{btn.label}</span>
              </button>
            ))}
            <label className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-sm">upload</span>
              <span className="text-[8px] font-bold">Cargar</span>
              <input type="file" className="hidden" accept=".json" onChange={onImport} />
            </label>
          </div>
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
            EC
          </div>
          <div className="flex flex-col overflow-hidden">
            <p className="text-text-main dark:text-white text-xs font-black truncate">Ester Correa</p>
            <p className="text-text-sub dark:text-gray-400 text-[9px] font-bold uppercase truncate">Dietista-Nutricionista</p>
          </div>
        </div>
      </div>

    </div>
  </aside>
);
