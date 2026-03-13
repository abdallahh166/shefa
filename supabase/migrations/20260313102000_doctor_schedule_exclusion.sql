-- Prevent overlapping doctor schedules per day
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.doctor_schedules
  ADD COLUMN IF NOT EXISTS schedule_range tsrange;

CREATE OR REPLACE FUNCTION public.set_doctor_schedule_range()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.schedule_range := tsrange(
    (date '2000-01-01' + NEW.start_time)::timestamp,
    (date '2000-01-01' + NEW.end_time)::timestamp,
    '[)'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_doctor_schedule_range ON public.doctor_schedules;
CREATE TRIGGER set_doctor_schedule_range
BEFORE INSERT OR UPDATE OF start_time, end_time
ON public.doctor_schedules
FOR EACH ROW
EXECUTE FUNCTION public.set_doctor_schedule_range();

UPDATE public.doctor_schedules
SET schedule_range = tsrange(
  (date '2000-01-01' + start_time)::timestamp,
  (date '2000-01-01' + end_time)::timestamp,
  '[)'
)
WHERE schedule_range IS NULL;

ALTER TABLE public.doctor_schedules
  ALTER COLUMN schedule_range SET NOT NULL;

ALTER TABLE public.doctor_schedules
  DROP CONSTRAINT IF EXISTS doctor_schedules_no_overlap;

ALTER TABLE public.doctor_schedules
  ADD CONSTRAINT doctor_schedules_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    doctor_id WITH =,
    day_of_week WITH =,
    schedule_range WITH &&
  )
  WHERE (is_active);
