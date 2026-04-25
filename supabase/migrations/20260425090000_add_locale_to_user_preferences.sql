ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_locale_check'
  ) THEN
    ALTER TABLE public.user_preferences
    ADD CONSTRAINT user_preferences_locale_check
    CHECK (locale IN ('en', 'ar'));
  END IF;
END
$$;
