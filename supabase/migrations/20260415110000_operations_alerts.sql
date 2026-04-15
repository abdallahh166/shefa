-- Operations alert summary for super-admin production monitoring

DROP FUNCTION IF EXISTS public.admin_operations_alert_summary();

CREATE OR REPLACE FUNCTION public.admin_operations_alert_summary()
RETURNS TABLE (
  pending_jobs_count bigint,
  processing_jobs_count bigint,
  retrying_jobs_count bigint,
  dead_letter_jobs_count bigint,
  stale_processing_jobs_count bigint,
  recent_job_failures_count bigint,
  recent_edge_failures_count bigint,
  recent_client_errors_count bigint,
  last_job_failure_at timestamptz,
  last_edge_failure_at timestamptz,
  last_client_error_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admins can view operations alerts';
  END IF;

  RETURN QUERY
  WITH job_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_jobs_count,
      COUNT(*) FILTER (WHERE status = 'processing')::bigint AS processing_jobs_count,
      COUNT(*) FILTER (WHERE attempts > 0 AND status IN ('pending', 'processing'))::bigint AS retrying_jobs_count,
      COUNT(*) FILTER (WHERE status = 'dead_letter')::bigint AS dead_letter_jobs_count,
      COUNT(*) FILTER (
        WHERE status = 'processing'
          AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes')
      )::bigint AS stale_processing_jobs_count
    FROM public.jobs
  ),
  job_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_job_failures_count,
      MAX(created_at) AS last_job_failure_at
    FROM public.system_logs
    WHERE level = 'error'
      AND service = 'job-worker'
  ),
  edge_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_edge_failures_count,
      MAX(created_at) AS last_edge_failure_at
    FROM public.system_logs
    WHERE level = 'error'
      AND service <> 'job-worker'
  ),
  client_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_client_errors_count,
      MAX(created_at) AS last_client_error_at
    FROM public.client_error_logs
  )
  SELECT
    job_counts.pending_jobs_count,
    job_counts.processing_jobs_count,
    job_counts.retrying_jobs_count,
    job_counts.dead_letter_jobs_count,
    job_counts.stale_processing_jobs_count,
    job_failures.recent_job_failures_count,
    edge_failures.recent_edge_failures_count,
    client_failures.recent_client_errors_count,
    job_failures.last_job_failure_at,
    edge_failures.last_edge_failure_at,
    client_failures.last_client_error_at
  FROM job_counts, job_failures, edge_failures, client_failures;
END;
$function$;
