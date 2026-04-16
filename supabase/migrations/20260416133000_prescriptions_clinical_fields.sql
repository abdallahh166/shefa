ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_status_check;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_status_check
  CHECK (status IN ('active', 'completed', 'discontinued'));

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS route text NULL,
  ADD COLUMN IF NOT EXISTS frequency text NULL,
  ADD COLUMN IF NOT EXISTS quantity integer NULL CHECK (quantity IS NULL OR quantity > 0),
  ADD COLUMN IF NOT EXISTS refills integer NULL CHECK (refills IS NULL OR refills >= 0),
  ADD COLUMN IF NOT EXISTS instructions text NULL,
  ADD COLUMN IF NOT EXISTS end_date date NULL,
  ADD COLUMN IF NOT EXISTS discontinued_reason text NULL;
