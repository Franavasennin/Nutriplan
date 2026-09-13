import React, { useState, useEffect } from 'react';
import { Step } from './Sidebar';

interface MobileNavItem {
  step: Step;
  icon: string;
  label: string;
  requiresPlan?: boolean;
}

const PRIMARY_MOBILE_NAV: MobileNavItem[] = [
  { step: 'dashboard', icon: 'dashboard',       label: 'Dashboard'     },
  { step: 'form',      icon: 'person_add',      label: 'Nuevo'         },
  { step: 'result',    icon: 'restaurant_menu', label: 'Plan', requiresPlan: true },
  { step: 'agenda',    icon: 'calendar_month',  label: 'Agenda'        },
  { step: 'progress',  icon: 'monitoring',      label: 'Seguimiento'   },
];

const SECONDARY_SECTIONS: { step: Step; icon: string; label: string; description: string }[] = [
  { step: 'recipes',  icon: 'menu_book', label: 'Recetas AI',        description: 'Buscador y sugerencias culinarias' },
  { step: 'foods',    icon: 'database',  label: 'Base de Alimentos', description: 'Composición nutricional personalizada' },
  { step: 'history',  icon: 'history',   label: 'Historial',         description: 'Planes y pacientes guardados' },
];

export interface MobileNavProps {
  currentStep: Step;
  onNavigate: (step: Step) => void;
  hasPlan: boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
  dbOnline?: boolean;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  onImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenClinicCriteria?: () => void;
  lastBackupLabel?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentStep,
  onNavigate,
  hasPlan,
  isDark,
  onToggleTheme,
  dbOnline,
  onExportJSON,
  onExportCSV,
  onImport,
  onOpenClinicCriteria,
  lastBackupLabel,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cerrar el drawer con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  // Evitar scroll en el fondo cuando el drawer está abierto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const handleSelectStep = (step: Step) => {
    onNavigate(step);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── Barra inferior fija en móvil ── */}
      <nav
        aria-label="Navegación móvil inferior"
        className="lg:hidden fixed bottom-0 left-0 w-full bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-border-light dark:border-border-dark px-1 py-1 flex justify-around items-center z-40 no-print shadow-lg"
      >
        {PRIMARY_MOBILE_NAV.map(({ step, icon, label, requiresPlan }) => {
          const disabled = requiresPlan && !hasPlan;
          const active   = currentStep === step;
          return (
            <button
              key={step}
              onClick={() => !disabled && handleSelectStep(step)}
              disabled={disabled}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={`min-h-[48px] min-w-[52px] px-1 py-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
              } ${
                active
                  ? 'text-primary dark:text-primary font-black bg-primary/10'
                  : 'text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white'
              }`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${active ? 'active-nav-icon' : ''}`}>
                {icon}
              </span>
              <span className="text-[10px] font-bold mt-0.5 leading-tight">{label}</span>
            </button>
          );
        })}

        {/* Botón de 'Más' para desplegar el drawer con el resto de secciones */}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-label="Menú y herramientas adicionales"
          className={`min-h-[48px] min-w-[52px] px-1 py-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            drawerOpen || ['recipes', 'foods', 'history'].includes(currentStep)
              ? 'text-primary dark:text-primary font-black bg-primary/10'
              : 'text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white'
          }`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">more_vert</span>
          <span className="text-[10px] font-bold mt-0.5 leading-tight">Más</span>
        </button>
      </nav>

      {/* ── Backdrop del Drawer ── */}
      {drawerOpen && (
        <div
          role="presentation"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-fade-in"
        />
      )}

      {/* ── Drawer lateral / modal inferior en móvil ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú ampliado de opciones"
        className={`lg:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] bg-surface-light dark:bg-surface-dark rounded-t-2xl z-50 overflow-y-auto border-t border-border-light dark:border-border-dark shadow-2xl transition-transform duration-300 transform ${
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-4 flex flex-col gap-4">
          {/* Header del drawer */}
          <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/20 rounded-lg size-8 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-lg">nutrition</span>
              </div>
              <span className="font-black text-base text-text-main dark:text-white">NutriPlan Pro</span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
              className="p-1.5 rounded-lg text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Secciones adicionales */}
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider px-2">
              Secciones
            </p>
            {SECONDARY_SECTIONS.map(({ step, icon, label, description }) => {
              const active = currentStep === step;
              return (
                <button
                  key={step}
                  onClick={() => handleSelectStep(step)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                    active
                      ? 'bg-primary text-background-dark font-black shadow-md shadow-primary/20'
                      : 'text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl text-primary">{icon}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{label}</span>
                    <span className={`text-xs ${active ? 'text-background-dark/80' : 'text-text-sub dark:text-gray-400'}`}>
                      {description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Herramientas y Base de datos */}
          <div className="border-t border-border-light dark:border-border-dark pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-bold text-text-sub dark:text-gray-400 uppercase tracking-wider">
                Herramientas y Base de Datos
              </p>
              {dbOnline !== undefined && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  dbOnline
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {dbOnline ? 'PostgreSQL Conectado' : 'Modo Local'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {onExportJSON && (
                <button
                  type="button"
                  onClick={() => { onExportJSON(); setDrawerOpen(false); }}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border-light dark:border-border-dark text-xs font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">backup</span>
                  Backup JSON
                </button>
              )}
              {onExportCSV && (
                <button
                  type="button"
                  onClick={() => { onExportCSV(); setDrawerOpen(false); }}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border-light dark:border-border-dark text-xs font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-[18px] text-blue-500">download</span>
                  Exportar CSV
                </button>
              )}
              {onOpenClinicCriteria && (
                <button
                  type="button"
                  onClick={() => { onOpenClinicCriteria(); setDrawerOpen(false); }}
                  className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border-light dark:border-border-dark text-xs font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-[18px] text-purple-500">psychology</span>
                  Criterio Clínico IA
                </button>
              )}
            </div>

            {lastBackupLabel && (
              <p className="text-[10px] text-text-sub dark:text-gray-400 px-2 text-center mt-1">
                {lastBackupLabel}
              </p>
            )}

            {/* Selector de tema claro/oscuro */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="mt-2 flex items-center justify-between px-4 py-3 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs font-bold text-text-main dark:text-white"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    {isDark ? 'light_mode' : 'nights_stay'}
                  </span>
                  Tema visual
                </span>
                <span className="text-text-sub dark:text-gray-400 uppercase font-extrabold">
                  {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
