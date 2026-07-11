import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus, APPOINTMENT_STATUS_LABELS } from '../types';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

interface Props {
  clients: string[];
  appointments: Appointment[];
  onSave: (appt: Appointment) => void;
  onUpdate: (appt: Appointment) => void;
  onDelete: (id: string) => void;
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Scheduled]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  [AppointmentStatus.Done]:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  [AppointmentStatus.Cancelled]: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  [AppointmentStatus.NoShow]:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const toDateInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toTimeInput = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const AgendaView: React.FC<Props> = ({ clients, appointments, onSave, onUpdate, onDelete }) => {
  const { confirm } = useConfirm();
  const { toast }   = useToast();

  const now = Date.now();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState(() => toDateInput(now));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [dayFilter, setDayFilter] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setClientName('');
    setDate(toDateInput(Date.now()));
    setTime('09:00');
    setDuration(30);
    setNotes('');
  };

  const sorted = useMemo(
    () => [...appointments].sort((a, b) => a.scheduledAt - b.scheduledAt),
    [appointments]
  );
  const upcoming = sorted.filter(a => a.status === AppointmentStatus.Scheduled && a.scheduledAt >= now - 60 * 60 * 1000);
  const past     = sorted.filter(a => a.status !== AppointmentStatus.Scheduled || a.scheduledAt < now - 60 * 60 * 1000);

  // ── Calendario mensual (mismo patrón visual que ProgressTracker) ───────────
  const entryByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = toDateInput(a.scheduledAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [appointments]);

  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const last  = new Date(calYear, calMonth + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Lu = 0
    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    for (let i = startDow; i > 0; i--) cells.push({ date: new Date(calYear, calMonth, 1 - i), isCurrentMonth: false });
    for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(calYear, calMonth, d), isCurrentMonth: true });
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) cells.push({ date: new Date(calYear, calMonth + 1, i), isCurrentMonth: false });
    return cells;
  }, [calYear, calMonth]);

  const navCal = (delta: number) => {
    const d = new Date(calYear, calMonth + delta);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const todayStr = toDateInput(now);

  const handleEdit = (appt: Appointment) => {
    setEditingId(appt.id);
    setClientName(appt.clientName);
    setDate(toDateInput(appt.scheduledAt));
    setTime(toTimeInput(appt.scheduledAt));
    setDuration(appt.durationMinutes);
    setNotes(appt.notes ?? '');
    document.getElementById('agenda-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !date || !time) return;
    const [hh, mm] = time.split(':').map(Number);
    const scheduledAt = new Date(date + 'T00:00:00').setHours(hh, mm, 0, 0);

    if (editingId) {
      const original = appointments.find(a => a.id === editingId);
      if (!original) return;
      onUpdate({ ...original, clientName, scheduledAt, durationMinutes: duration, notes: notes || undefined });
      toast('Cita actualizada.', 'success');
    } else {
      onSave({
        id: crypto.randomUUID(),
        clientName, scheduledAt, durationMinutes: duration,
        status: AppointmentStatus.Scheduled,
        notes: notes || undefined,
        createdAt: Date.now(),
      });
      toast('Cita programada.', 'success');
    }
    resetForm();
  };

  const handleStatusChange = (appt: Appointment, status: AppointmentStatus) => {
    onUpdate({ ...appt, status });
  };

  const handleDelete = async (appt: Appointment) => {
    const ok = await confirm({
      title: 'Eliminar cita',
      message: `¿Eliminar la cita de ${appt.clientName} del ${new Date(appt.scheduledAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    onDelete(appt.id);
    toast('Cita eliminada.', 'success');
  };

  const inputCls = "w-full h-11 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm";
  const labelCls = "block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1";

  const renderAppointmentRow = (appt: Appointment) => (
    <div key={appt.id}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-colors ${
        editingId === appt.id
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
          : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-text-main dark:text-white">{appt.clientName}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[appt.status]}`}>
            {APPOINTMENT_STATUS_LABELS[appt.status]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-sub dark:text-gray-400 mt-1">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">calendar_month</span>
            {new Date(appt.scheduledAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            {toTimeInput(appt.scheduledAt)} · {appt.durationMinutes} min
          </span>
        </div>
        {appt.notes && <p className="text-xs text-text-sub dark:text-gray-500 mt-1 truncate" title={appt.notes}>{appt.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {appt.status === AppointmentStatus.Scheduled && (
          <>
            <button type="button" onClick={() => handleStatusChange(appt, AppointmentStatus.Done)}
              title="Marcar como realizada"
              className="size-8 inline-flex items-center justify-center rounded-lg text-text-sub hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 transition-colors">
              <span className="material-symbols-outlined text-[18px]">check</span>
            </button>
            <button type="button" onClick={() => handleStatusChange(appt, AppointmentStatus.NoShow)}
              title="Marcar como no asistió"
              className="size-8 inline-flex items-center justify-center rounded-lg text-text-sub hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 transition-colors">
              <span className="material-symbols-outlined text-[18px]">event_busy</span>
            </button>
          </>
        )}
        <button type="button" onClick={() => handleEdit(appt)} title="Editar cita"
          className="size-8 inline-flex items-center justify-center rounded-lg text-text-sub hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 transition-colors">
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button type="button" onClick={() => handleDelete(appt)} title="Eliminar cita"
          className="size-8 inline-flex items-center justify-center rounded-lg text-text-sub hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors">
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    </div>
  );

  const filteredUpcoming = dayFilter ? upcoming.filter(a => toDateInput(a.scheduledAt) === dayFilter) : upcoming;

  return (
    <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-text-main dark:text-white text-3xl font-black leading-tight tracking-tight mb-2">Agenda</h1>
          <p className="text-text-sub dark:text-gray-400 text-base">Programa y consulta las próximas citas de tus pacientes.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div id="agenda-form" className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-text-main dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{editingId ? 'edit' : 'add_circle'}</span>
                {editingId ? 'Editar Cita' : 'Nueva Cita'}
              </h3>
              {editingId && (
                <button type="button" onClick={resetForm}
                  className="text-xs font-semibold text-text-sub hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 flex items-center gap-1 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">close</span> Cancelar
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Cliente</label>
                <input aria-label="Cliente" className={inputCls} list="agenda-clients"
                  value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Nombre del paciente" required />
                <datalist id="agenda-clients">
                  {clients.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input aria-label="Fecha" type="date" className={inputCls}
                    value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input aria-label="Hora" type="time" className={inputCls}
                    value={time} onChange={e => setTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className={labelCls}>Duración (min)</label>
                <select aria-label="Duración" className={inputCls} value={duration} onChange={e => setDuration(Number(e.target.value))}>
                  {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <textarea aria-label="Notas" className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 focus:ring-2 focus:ring-primary outline-none dark:text-white text-sm resize-none"
                  rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Motivo de la consulta, recordatorios..." />
              </div>
              <button type="submit"
                className={`w-full hover:brightness-95 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all ${editingId ? 'bg-amber-400 shadow-amber-400/20' : 'bg-primary shadow-primary/20'}`}>
                <span className="material-symbols-outlined text-[20px]">{editingId ? 'edit' : 'save'}</span>
                {editingId ? 'Actualizar Cita' : 'Programar Cita'}
              </button>
            </form>
          </div>

          {/* Calendario + lista */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
                  {new Date(calYear, calMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => navCal(-1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-text-sub dark:text-gray-400">chevron_left</span>
                  </button>
                  <button onClick={() => navCal(1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-text-sub dark:text-gray-400">chevron_right</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-text-sub dark:text-gray-500 uppercase py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map(({ date: cellDate, isCurrentMonth }, idx) => {
                  const key = toDateInput(cellDate.getTime());
                  const dayAppts = entryByDate.get(key) ?? [];
                  const isToday = key === todayStr;
                  const isSelected = key === dayFilter;
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setDayFilter(isSelected ? null : key)}
                      title={dayAppts.length ? `${dayAppts.length} cita(s)` : undefined}
                      className={[
                        'relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs transition-colors',
                        isCurrentMonth ? 'text-text-main dark:text-white' : 'text-gray-300 dark:text-gray-600',
                        isToday ? 'ring-2 ring-primary bg-primary/10' : '',
                        isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : '',
                        dayAppts.length ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : '',
                      ].join(' ')}
                    >
                      <span className={`font-semibold text-[11px] ${isToday ? 'text-primary-accessible dark:text-primary' : ''}`}>{cellDate.getDate()}</span>
                      {dayAppts.length > 0 && (
                        <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 absolute bottom-0.5">{dayAppts.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {dayFilter && (
                <button type="button" onClick={() => setDayFilter(null)}
                  className="mt-2 text-[11px] text-text-sub dark:text-gray-400 underline hover:text-primary">
                  Quitar filtro de día ({new Date(dayFilter + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })})
                </button>
              )}
            </div>

            <div>
              <h3 className="font-bold text-text-main dark:text-white mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                Próximas citas {dayFilter ? '' : `(${upcoming.length})`}
              </h3>
              {filteredUpcoming.length === 0 ? (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6 text-center text-sm text-text-sub dark:text-gray-500">
                  No hay citas próximas{dayFilter ? ' ese día' : ''}.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredUpcoming.map(renderAppointmentRow)}
                </div>
              )}
            </div>

            {past.length > 0 && !dayFilter && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-bold text-text-sub dark:text-gray-400 hover:text-primary transition-colors mb-2 list-none flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90">chevron_right</span>
                  Historial ({past.length})
                </summary>
                <div className="flex flex-col gap-2">
                  {[...past].reverse().map(renderAppointmentRow)}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgendaView;
