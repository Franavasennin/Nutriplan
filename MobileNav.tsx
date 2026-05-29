import React from 'react';
import { Step } from './Sidebar';

interface MobileNavItem {
  step: Step;
  icon: string;
  requiresPlan?: boolean;
}

const MOBILE_NAV: MobileNavItem[] = [
  { step: 'dashboard', icon: 'dashboard'       },
  { step: 'form',      icon: 'person_add'      },
  { step: 'result',    icon: 'restaurant_menu', requiresPlan: true },
  { step: 'progress',  icon: 'monitoring'      },
];

interface MobileNavProps {
  currentStep: Step;
  onNavigate: (step: Step) => void;
  hasPlan: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentStep, onNavigate, hasPlan }) => (
  <div className="lg:hidden fixed bottom-0 left-0 w-full bg-surface-light dark:bg-surface-dark border-t-2 border-primary/20 p-2 flex justify-around items-center z-50 no-print">
    {MOBILE_NAV.map(({ step, icon, requiresPlan }) => {
      const disabled = requiresPlan && !hasPlan;
      const active   = currentStep === step;
      return (
        <button
          key={step}
          onClick={() => !disabled && onNavigate(step)}
          disabled={disabled}
          className={`p-2 rounded-xl flex flex-col items-center transition-colors disabled:opacity-30 ${
            active ? 'text-primary bg-primary/10' : 'text-text-sub'
          }`}
        >
          <span className="material-symbols-outlined">{icon}</span>
        </button>
      );
    })}
  </div>
);
