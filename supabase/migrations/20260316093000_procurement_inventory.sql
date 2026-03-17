-- Procurement system and inventory movements

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text NULL,
  phone text NULL,
  email text NULL,
  address text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'received', 'cancelled')),
  order_date date NOT NULL DEFAULT current_date,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medication_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  lot_number text NOT NULL,
  expiry_date date NULL,
  quantity integer NOT NULL CHECK (quantity >= 0),
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  batch_id uuid NULL REFERENCES public.medication_batches(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'dispense', 'adjustment', 'transfer')),
  quantity integer NOT NULL CHECK (quantity <> 0),
  source_reference text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS: tenant scoped management
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Tenant users can manage suppliers" ON public.suppliers';
  EXECUTE 'CREATE POLICY "Tenant users can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';

  EXECUTE 'DROP POLICY IF EXISTS "Tenant users can manage purchase orders" ON public.purchase_orders';
  EXECUTE 'CREATE POLICY "Tenant users can manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';

  EXECUTE 'DROP POLICY IF EXISTS "Tenant users can manage purchase order items" ON public.purchase_order_items';
  EXECUTE 'CREATE POLICY "Tenant users can manage purchase order items" ON public.purchase_order_items FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';

  EXECUTE 'DROP POLICY IF EXISTS "Tenant users can manage stock receipts" ON public.stock_receipts';
  EXECUTE 'CREATE POLICY "Tenant users can manage stock receipts" ON public.stock_receipts FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';

  EXECUTE 'DROP POLICY IF EXISTS "Tenant users can manage medication batches" ON public.medication_batches';
  EXECUTE 'CREATE POLICY "Tenant users can manage medication batches" ON public.medication_batches FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';

  EXECUTE 'DROP POLICY IF EXISTS "Tenant users can manage inventory movements" ON public.inventory_movements';
  EXECUTE 'CREATE POLICY "Tenant users can manage inventory movements" ON public.inventory_movements FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';
END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_name ON public.suppliers (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_status ON public.purchase_orders (tenant_id, status, order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant ON public.purchase_order_items (tenant_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_tenant ON public.stock_receipts (tenant_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_medication_batches_tenant ON public.medication_batches (tenant_id, medication_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant ON public.inventory_movements (tenant_id, medication_id);
