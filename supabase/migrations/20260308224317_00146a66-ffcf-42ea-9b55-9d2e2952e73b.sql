
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow tenant creation during signup" ON public.tenants;
