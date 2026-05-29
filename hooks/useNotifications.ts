/**
 * useNotifications — PWA push / local notification reminders.
 *
 * Provides:
 *   - requestPermission()  — ask the user for Notification API permission
 *   - scheduleReminder()   — send a postMessage to the SW to fire a notification after delayMs
 *   - reminders            — persisted per-meal reminder settings (localStorage)
 *   - setReminder()        — save / update a reminder
 *   - removeReminder()     — reset a reminder to disabled
 *   - applyReminders()     — persist + re-schedule all enabled reminders at once
 *   - permission           — current Notification.permission value
 */

import { useState, useEffect, useCallback } from 'react';

export interface MealReminder {
  id: string;       // e.g. "breakfast", "lunch"
  label: string;    // human label shown in UI
  time: string;     // HH:MM — local time to fire the reminder
  enabled: boolean;
}

const STORAGE_KEY = 'nutriplan_reminders';

const DEFAULT_REMINDERS: MealReminder[] = [
  { id: 'breakfast',      label: 'Desayuno',    time: '08:00', enabled: false },
  { id: 'morningSnack',   label: 'Media mañana', time: '11:00', enabled: false },
  { id: 'lunch',          label: 'Comida',       time: '14:00', enabled: false },
  { id: 'afternoonSnack', label: 'Merienda',     time: '17:00', enabled: false },
  { id: 'dinner',         label: 'Cena',         time: '21:00', enabled: false },
];

function loadFromStorage(): MealReminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const saved: MealReminder[] = JSON.parse(raw);
    // Merge saved values into defaults so new meals appear automatically
    return DEFAULT_REMINDERS.map(def => {
      const match = saved.find(s => s.id === def.id);
      return match ? { ...def, ...match } : def;
    });
  } catch {
    return DEFAULT_REMINDERS;
  }
}

function saveToStorage(reminders: MealReminder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch { /* storage full — ignore */ }
}

/** Returns milliseconds until the next occurrence of HH:MM (today or tomorrow). */
function msUntil(timeStr: string): number {
  const [hh, mm] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

/** Resolve the active SW registration, or null if unavailable. */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration('/')) ?? null;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [reminders, setReminders] = useState<MealReminder[]>(loadFromStorage);

  // Persist on every change
  useEffect(() => {
    saveToStorage(reminders);
  }, [reminders]);

  // ── Request permission ──────────────────────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') { setPermission('granted'); return true; }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  // ── Fire a single reminder via SW (or fallback to plain Notification) ───────
  const scheduleReminder = useCallback(
    async (title: string, body: string, delayMs: number) => {
      if (permission !== 'granted') return;
      const reg = await getSwRegistration();
      if (reg?.active) {
        reg.active.postMessage({ type: 'SCHEDULE_REMINDER', title, body, delayMs });
      } else {
        // Fallback: plain Notification API
        const fire = () => new Notification(title, { body, icon: '/icon-192.png' });
        delayMs > 0 ? setTimeout(fire, delayMs) : fire();
      }
    },
    [permission]
  );

  // ── Schedule all enabled reminders ─────────────────────────────────────────
  const scheduleAll = useCallback(
    (list: MealReminder[]) => {
      list
        .filter(r => r.enabled)
        .forEach(r =>
          scheduleReminder(`🍽️ ${r.label}`, `Hora de tu ${r.label.toLowerCase()}.`, msUntil(r.time))
        );
    },
    [scheduleReminder]
  );

  // Re-schedule on mount if permission already granted
  useEffect(() => {
    if (permission === 'granted') scheduleAll(reminders);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CRUD helpers ────────────────────────────────────────────────────────────
  const setReminder = useCallback((updated: MealReminder) => {
    setReminders(prev => prev.map(r => (r.id === updated.id ? updated : r)));
  }, []);

  const removeReminder = useCallback((id: string) => {
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, enabled: false } : r)));
  }, []);

  /** Persist a new list and immediately re-schedule all enabled reminders. */
  const applyReminders = useCallback(
    (list: MealReminder[]) => {
      setReminders(list);
      if (permission === 'granted') scheduleAll(list);
    },
    [permission, scheduleAll]
  );

  return {
    permission,
    reminders,
    requestPermission,
    scheduleReminder,
    setReminder,
    removeReminder,
    applyReminders,
  };
}
