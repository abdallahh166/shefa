ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_appointment_queue_appointment_id
  ON public.appointment_queue (appointment_id);
