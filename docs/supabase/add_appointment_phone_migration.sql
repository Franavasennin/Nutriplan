-- ─────────────────────────────────────────────────────────────────────────────
-- Añade el teléfono de contacto a las citas -- hallazgo de revisión de código:
-- AgendaView.tsx ya tenía un campo de teléfono en el formulario (para el
-- recordatorio por WhatsApp), pero `appointments` nunca tuvo esa columna:
-- saveAppointment/updateAppointment guardaban el teléfono solo en memoria,
-- se perdía al recargar la página.
--
-- ✅ APLICADA el 2026-09-03.
-- ─────────────────────────────────────────────────────────────────────────────

alter table appointments add column if not exists phone text;

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'phone';

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- alter table appointments drop column if exists phone;
