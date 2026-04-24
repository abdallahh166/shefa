CREATE OR REPLACE FUNCTION public.sync_subscriptions_from_pricing_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET
    amount = CASE
      WHEN billing_cycle = 'annual' THEN NEW.annual_price
      ELSE NEW.monthly_price
    END,
    currency = NEW.currency,
    updated_at = timezone('utc', now())
  WHERE plan = NEW.plan_code;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_subscriptions_from_pricing_plan_on_update ON public.pricing_plans;
CREATE TRIGGER sync_subscriptions_from_pricing_plan_on_update
AFTER UPDATE OF monthly_price, annual_price, currency
ON public.pricing_plans
FOR EACH ROW
WHEN (OLD.monthly_price IS DISTINCT FROM NEW.monthly_price
  OR OLD.annual_price IS DISTINCT FROM NEW.annual_price
  OR OLD.currency IS DISTINCT FROM NEW.currency)
EXECUTE FUNCTION public.sync_subscriptions_from_pricing_plan();
