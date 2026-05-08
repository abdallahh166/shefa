-- Durable auth operational telemetry for rollout monitoring and super-admin alerts.

ALTER TABLE public.client_error_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

CREATE INDEX IF NOT EXISTS client_error_logs_auth_metric_created_at_idx
ON public.client_error_logs (resource_type, created_at DESC)
WHERE action_type = 'auth_metric';

DROP FUNCTION IF EXISTS public.admin_operations_alert_summary(uuid);
CREATE OR REPLACE FUNCTION public.admin_operations_alert_summary(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  pending_jobs_count bigint,
  processing_jobs_count bigint,
  retrying_jobs_count bigint,
  dead_letter_jobs_count bigint,
  stale_processing_jobs_count bigint,
  recent_job_failures_count bigint,
  recent_edge_failures_count bigint,
  recent_client_errors_count bigint,
  recent_auth_login_success_count bigint,
  recent_auth_login_failure_count bigint,
  recent_auth_refresh_success_count bigint,
  recent_auth_refresh_failure_count bigint,
  recent_auth_recovery_success_count bigint,
  recent_auth_recovery_failure_count bigint,
  recent_auth_drift_count bigint,
  recent_stale_auth_rejects_count bigint,
  recent_auth_replay_rejects_count bigint,
  recent_auth_queue_overflows_count bigint,
  recent_unexpected_logouts_count bigint,
  recent_auth_kill_switch_count bigint,
  recent_auth_refresh_storms_count bigint,
  last_job_failure_at timestamptz,
  last_edge_failure_at timestamptz,
  last_client_error_at timestamptz,
  last_auth_signal_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.assert_super_admin_context(true, false);

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
    WHERE _tenant_id IS NULL OR tenant_id = _tenant_id
  ),
  job_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_job_failures_count,
      MAX(created_at) AS last_job_failure_at
    FROM public.system_logs
    WHERE level = 'error'
      AND service = 'job-worker'
      AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  ),
  edge_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_edge_failures_count,
      MAX(created_at) AS last_edge_failure_at
    FROM public.system_logs
    WHERE level = 'error'
      AND service <> 'job-worker'
      AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  ),
  client_failures AS (
    SELECT
      COUNT(*) FILTER (
        WHERE created_at >= now() - interval '15 minutes'
          AND action_type IS DISTINCT FROM 'auth_metric'
      )::bigint AS recent_client_errors_count,
      MAX(created_at) FILTER (WHERE action_type IS DISTINCT FROM 'auth_metric') AS last_client_error_at
    FROM public.client_error_logs
    WHERE _tenant_id IS NULL OR tenant_id = _tenant_id
  ),
  auth_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE resource_type = 'login_succeeded')::bigint AS recent_auth_login_success_count,
      COUNT(*) FILTER (WHERE resource_type = 'login_failed')::bigint AS recent_auth_login_failure_count,
      COUNT(*) FILTER (WHERE resource_type = 'refresh_succeeded')::bigint AS recent_auth_refresh_success_count,
      COUNT(*) FILTER (WHERE resource_type = 'refresh_failed')::bigint AS recent_auth_refresh_failure_count,
      COUNT(*) FILTER (WHERE resource_type = 'auth_recovery_succeeded')::bigint AS recent_auth_recovery_success_count,
      COUNT(*) FILTER (WHERE resource_type = 'auth_recovery_failed')::bigint AS recent_auth_recovery_failure_count,
      COUNT(*) FILTER (WHERE resource_type = 'session_drift_detected')::bigint AS recent_auth_drift_count,
      COUNT(*) FILTER (WHERE resource_type = 'stale_auth_context_rejected')::bigint AS recent_stale_auth_rejects_count,
      COUNT(*) FILTER (WHERE resource_type = 'auth_event_replay_rejected')::bigint AS recent_auth_replay_rejects_count,
      COUNT(*) FILTER (WHERE resource_type = 'auth_queue_overflow')::bigint AS recent_auth_queue_overflows_count,
      COUNT(*) FILTER (WHERE resource_type = 'unexpected_logout')::bigint AS recent_unexpected_logouts_count,
      COUNT(*) FILTER (WHERE resource_type = 'auth_kill_switch_activated')::bigint AS recent_auth_kill_switch_count,
      COUNT(*) FILTER (WHERE resource_type = 'auth_refresh_storm_detected')::bigint AS recent_auth_refresh_storms_count,
      MAX(created_at) AS last_auth_signal_at
    FROM public.client_error_logs
    WHERE action_type = 'auth_metric'
      AND created_at >= now() - interval '15 minutes'
      AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
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
    auth_metrics.recent_auth_login_success_count,
    auth_metrics.recent_auth_login_failure_count,
    auth_metrics.recent_auth_refresh_success_count,
    auth_metrics.recent_auth_refresh_failure_count,
    auth_metrics.recent_auth_recovery_success_count,
    auth_metrics.recent_auth_recovery_failure_count,
    auth_metrics.recent_auth_drift_count,
    auth_metrics.recent_stale_auth_rejects_count,
    auth_metrics.recent_auth_replay_rejects_count,
    auth_metrics.recent_auth_queue_overflows_count,
    auth_metrics.recent_unexpected_logouts_count,
    auth_metrics.recent_auth_kill_switch_count,
    auth_metrics.recent_auth_refresh_storms_count,
    job_failures.last_job_failure_at,
    edge_failures.last_edge_failure_at,
    client_failures.last_client_error_at,
    auth_metrics.last_auth_signal_at
  FROM job_counts, job_failures, edge_failures, client_failures, auth_metrics;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_auth_metric_trend(integer, integer, uuid);
CREATE OR REPLACE FUNCTION public.admin_auth_metric_trend(
  _bucket_minutes integer DEFAULT 15,
  _bucket_count integer DEFAULT 6,
  _tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  bucket_start timestamptz,
  metric_count bigint,
  failure_count bigint,
  affected_tenants_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  bucket_minutes integer := GREATEST(COALESCE(_bucket_minutes, 15), 5);
  bucket_count integer := GREATEST(COALESCE(_bucket_count, 6), 1);
  first_bucket timestamptz := date_trunc('minute', now()) - make_interval(mins => bucket_minutes * (bucket_count - 1));
BEGIN
  PERFORM public.assert_super_admin_context(true, false);

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      first_bucket,
      date_trunc('minute', now()),
      make_interval(mins => bucket_minutes)
    ) AS bucket_start
  )
  SELECT
    b.bucket_start,
    COUNT(c.id)::bigint AS metric_count,
    COUNT(c.id) FILTER (
      WHERE c.resource_type IN (
        'login_failed',
        'refresh_failed',
        'auth_recovery_failed',
        'session_drift_detected',
        'stale_auth_context_rejected',
        'auth_event_replay_rejected',
        'auth_queue_overflow',
        'unexpected_logout',
        'auth_kill_switch_activated',
        'auth_refresh_storm_detected'
      )
      OR c.metadata->>'result' = 'failure'
    )::bigint AS failure_count,
    COUNT(DISTINCT c.tenant_id)::bigint AS affected_tenants_count
  FROM buckets b
  LEFT JOIN public.client_error_logs c
    ON c.created_at >= b.bucket_start
   AND c.created_at < b.bucket_start + make_interval(mins => bucket_minutes)
   AND c.action_type = 'auth_metric'
   AND (_tenant_id IS NULL OR c.tenant_id = _tenant_id)
  GROUP BY b.bucket_start
  ORDER BY b.bucket_start ASC;
END;
$function$;
