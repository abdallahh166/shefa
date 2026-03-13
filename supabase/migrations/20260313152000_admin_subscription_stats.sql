-- Aggregate subscription stats for super_admin overview
CREATE OR REPLACE FUNCTION public.admin_subscription_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_active_count integer;
  v_total_revenue numeric;
  v_plan_counts jsonb;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'super_admin');
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) FILTER (WHERE status = 'active')
  INTO v_active_count
  FROM public.subscriptions;

  SELECT COALESCE(sum(amount), 0)
  INTO v_total_revenue
  FROM public.subscriptions
  WHERE status = 'active';

  SELECT jsonb_object_agg(plan, count)
  INTO v_plan_counts
  FROM (
    SELECT plan, count(*)::int AS count
    FROM public.subscriptions
    GROUP BY plan
  ) AS plan_stats;

  v_plan_counts := COALESCE(v_plan_counts, '{}'::jsonb)
    || jsonb_build_object('free', 0, 'starter', 0, 'pro', 0, 'enterprise', 0);

  RETURN jsonb_build_object(
    'active_count', COALESCE(v_active_count, 0),
    'total_revenue', COALESCE(v_total_revenue, 0),
    'plan_counts', v_plan_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_subscription_stats() TO authenticated;
