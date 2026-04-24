CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NULL,
  doctor_limit_label text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  annual_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (annual_price >= 0),
  currency text NOT NULL DEFAULT 'EGP',
  default_billing_cycle text NOT NULL DEFAULT 'monthly',
  is_popular boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  is_enterprise_contact boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT pricing_plans_plan_code_check CHECK (plan_code IN ('free', 'starter', 'pro', 'enterprise')),
  CONSTRAINT pricing_plans_features_json_array CHECK (jsonb_typeof(features) = 'array'),
  CONSTRAINT pricing_plans_default_billing_cycle_check CHECK (default_billing_cycle IN ('monthly', 'annual'))
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_public_order
  ON public.pricing_plans (display_order, plan_code)
  WHERE deleted_at IS NULL AND is_public = true;

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active pricing plans" ON public.pricing_plans;
CREATE POLICY "Public can view active pricing plans"
ON public.pricing_plans
FOR SELECT
TO anon, authenticated
USING (
  deleted_at IS NULL
  AND is_public = true
);

DROP POLICY IF EXISTS "Super admins can manage pricing plans" ON public.pricing_plans;
CREATE POLICY "Super admins can manage pricing plans"
ON public.pricing_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP TRIGGER IF EXISTS update_pricing_plans_updated_at ON public.pricing_plans;
CREATE TRIGGER update_pricing_plans_updated_at
BEFORE UPDATE ON public.pricing_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_plans (
  plan_code,
  name,
  description,
  doctor_limit_label,
  features,
  monthly_price,
  annual_price,
  currency,
  default_billing_cycle,
  is_popular,
  is_public,
  is_enterprise_contact,
  display_order
)
VALUES
  (
    'free',
    'مجاني',
    'ابدأ بإدارة عيادتك الأساسية بدون تكلفة.',
    'طبيب واحد',
    '["إدارة المواعيد الأساسية","طبيب واحد فقط","إدارة المرضى","لوحة تحكم بسيطة"]'::jsonb,
    0,
    0,
    'EGP',
    'monthly',
    false,
    true,
    false,
    1
  ),
  (
    'starter',
    'المبتدئ',
    'للعيادات الصغيرة التي تحتاج الفواتير والتقارير الأساسية.',
    'حتى 3 أطباء',
    '["جميع مميزات المجاني","حتى 3 أطباء","الفواتير والمحاسبة","التقارير والإحصائيات","دعم فني عبر البريد"]'::jsonb,
    299,
    2490,
    'EGP',
    'monthly',
    false,
    true,
    false,
    2
  ),
  (
    'pro',
    'الاحترافي',
    'للعيادات النامية التي تحتاج التشغيل السريري الكامل.',
    'أطباء غير محدودين',
    '["جميع مميزات المبتدئ","أطباء غير محدودين","تذكيرات SMS","تحليلات متقدمة","المختبر والصيدلية","دعم فني أولوية"]'::jsonb,
    799,
    6650,
    'EGP',
    'monthly',
    true,
    true,
    false,
    3
  ),
  (
    'enterprise',
    'المؤسسات',
    'للشبكات الطبية الكبيرة مع احتياجات التأمين والتكامل المؤسسي.',
    'غير محدود',
    '["جميع مميزات الاحترافي","التأمين الصحي","تكامل API","مدير حساب مخصص","تدريب الفريق","SLA مخصص"]'::jsonb,
    0,
    0,
    'EGP',
    'monthly',
    false,
    true,
    true,
    4
  )
ON CONFLICT (plan_code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  doctor_limit_label = EXCLUDED.doctor_limit_label,
  features = EXCLUDED.features,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  currency = EXCLUDED.currency,
  default_billing_cycle = EXCLUDED.default_billing_cycle,
  is_popular = EXCLUDED.is_popular,
  is_public = EXCLUDED.is_public,
  is_enterprise_contact = EXCLUDED.is_enterprise_contact,
  display_order = EXCLUDED.display_order,
  deleted_at = NULL;

CREATE OR REPLACE FUNCTION public.sync_subscription_pricing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_price numeric(10,2);
  v_annual_price numeric(10,2);
  v_currency text;
  v_default_billing_cycle text;
  v_resolved_billing_cycle text;
BEGIN
  SELECT
    monthly_price,
    annual_price,
    currency,
    default_billing_cycle
  INTO
    v_monthly_price,
    v_annual_price,
    v_currency,
    v_default_billing_cycle
  FROM public.pricing_plans
  WHERE plan_code = NEW.plan
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown pricing plan: %', NEW.plan USING ERRCODE = '23503';
  END IF;

  v_resolved_billing_cycle := lower(coalesce(nullif(NEW.billing_cycle, ''), v_default_billing_cycle, 'monthly'));

  IF v_resolved_billing_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Unsupported billing cycle: %', v_resolved_billing_cycle USING ERRCODE = '23514';
  END IF;

  NEW.billing_cycle := v_resolved_billing_cycle;
  NEW.currency := v_currency;
  NEW.amount := CASE
    WHEN v_resolved_billing_cycle = 'annual' THEN v_annual_price
    ELSE v_monthly_price
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_subscription_pricing_fields ON public.subscriptions;
CREATE TRIGGER sync_subscription_pricing_fields
BEFORE INSERT OR UPDATE OF plan, billing_cycle
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_subscription_pricing_fields();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'subscriptions'
      AND constraint_name = 'subscriptions_plan_fkey'
  ) THEN
    ALTER TABLE public.subscriptions
      DROP CONSTRAINT subscriptions_plan_fkey;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_fkey
  FOREIGN KEY (plan)
  REFERENCES public.pricing_plans (plan_code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

UPDATE public.subscriptions
SET billing_cycle = coalesce(nullif(billing_cycle, ''), 'monthly');
