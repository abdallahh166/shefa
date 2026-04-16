ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS result_value text NULL,
  ADD COLUMN IF NOT EXISTS result_unit text NULL,
  ADD COLUMN IF NOT EXISTS reference_range text NULL,
  ADD COLUMN IF NOT EXISTS abnormal_flag text NULL
    CHECK (abnormal_flag IS NULL OR abnormal_flag IN ('normal', 'abnormal', 'high', 'low', 'critical')),
  ADD COLUMN IF NOT EXISTS result_notes text NULL,
  ADD COLUMN IF NOT EXISTS resulted_at timestamptz NULL;
