-- Ensure notifications RLS policies exist and enforce tenant + user ownership.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );
