import React, { useState } from 'react';
import { useNotifications, MealReminder } from '../hooks/useNotifications';

/**
 * NotificationSettings — panel for configuring per-meal push reminders.
 * Collapsed by default; click the header to expand.
 */
const NotificationSettings: React.FC = () => {
  const { permission, reminders, requestPermission, applyReminders } = useNotifications();
  const [draft, setDraft] = useState<MealReminder[]>(reminders);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const handleToggle = (id: string) => {
    setDraft(prev => prev.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setSaved(false);
  };

  const handleTime = (id: string, time: string) => {
    setDraft(prev => prev.map(r => (r.id === id ? { ...r, time } : r)));
    setSaved(false);
  };

  const handleSave = async () => {
    let granted = permission === 'granted';
    if (!granted) granted = await requestPermission();
    if (!granted) return;
    applyReminders(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-[#1a2e22] rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">

      {/* ── Clickable header (always visible) ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">notifications</span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-[#111813] dark:text-white leading-tight">Recordatorios de comidas</p>
          <p className="text-[11px] text-text-sub dark:text-gray-400">Avisos diarios para no saltarte ninguna comida.</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
          permission === 'granted'  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : permission === 'denied' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          :                           'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {permission === 'granted' ? 'Activo' : permission === 'denied' ? 'Bloqueado' : 'Sin permisos'}
        </span>
        <span
          className="material-symbols-outlined text-gray-400 text-[20px] flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      {/* ── Collapsible body ── */}
      {open && (
        <div className="px-5 pb-5 pt-3 border-t border-border-light dark:border-border-dark">

          {/* Blocked warning */}
          {permission === 'denied' && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
              Notificaciones bloqueadas en tu navegador. Actívalas desde{' '}
              <strong>Ajustes → Privacidad → Notificaciones</strong> y recarga.
            </div>
          )}

          {/* Request permission */}
          {permission === 'default' && (
            <button
              type="button"
              onClick={requestPermission}
              className="w-full mb-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">notifications_active</span>
              Activar notificaciones
            </button>
          )}

          {/* Reminder rows */}
          <div className="space-y-3">
            {draft.map(r => (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                r.enabled
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'
                  : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'
              }`}>
                {/* Toggle switch */}
                <button
                  type="button"
                  aria-label={`${r.enabled ? 'Desactivar' : 'Activar'} recordatorio de ${r.label}`}
                  onClick={() => handleToggle(r.id)}
                  disabled={permission === 'denied'}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40 ${
                    r.enabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    r.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>

                <span className={`flex-1 text-sm font-medium ${
                  r.enabled ? 'text-[#111813] dark:text-white' : 'text-text-sub dark:text-gray-400'
                }`}>
                  {r.label}
                </span>

                <input
                  type="time"
                  value={r.time}
                  disabled={!r.enabled || permission === 'denied'}
                  aria-label={`Hora del recordatorio de ${r.label}`}
                  onChange={e => handleTime(r.id, e.target.value)}
                  className="text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[#111813] dark:text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
          </div>

          {/* Save */}
          {permission !== 'denied' && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">{saved ? 'check_circle' : 'save'}</span>
                {saved ? '¡Guardado!' : 'Guardar recordatorios'}
              </button>
            </div>
          )}

          <p className="mt-3 text-xs text-text-sub dark:text-gray-500 text-center">
            Los recordatorios se disparan diariamente. La app debe estar abierta o instalada como PWA.
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
