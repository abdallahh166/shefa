-- Remove legacy overload to avoid ambiguous log_audit_event resolution
DROP FUNCTION IF EXISTS public.log_audit_event(uuid, uuid, text, text, uuid, jsonb);
