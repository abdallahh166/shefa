# Auth Production Rollout and Operations

This runbook covers the deterministic auth bootstrap rollout and the operational signals that must stay healthy before expanding exposure.

## Rollout Sequence

1. Internal users only
   - Enable for platform operators and test accounts.
   - Verify login, logout, refresh, tenant switching, privileged step-up, and portal isolation.

2. Canary tenants
   - Select one or two active but low-volume tenants.
   - Keep support and engineering on the release window.

3. Low-risk clinics
   - Expand to clinics with simpler workflows and predictable business hours.
   - Watch for increased support contacts and unexpected logout reports.

4. Percentage rollout
   - Increase exposure in small increments.
   - Hold each increment until auth alerts stay healthy for at least one full business cycle.

5. Full rollout
   - Proceed only after no critical auth alerts, no elevated logout reports, and no refresh/recovery regressions.

## Required Signals

Monitor the super-admin Operations dashboard during every rollout stage.

Reliability:
- Login success rate
- Refresh success rate
- Recovery success rate
- Session restoration signals from `auth_bootstrap_completed`

Security anomalies:
- `stale_auth_context_rejected`
- `auth_event_replay_rejected`
- `session_drift_detected`
- `unexpected_logout`
- `auth_kill_switch_activated`

Runtime health:
- `refresh_failed`
- `auth_recovery_failed`
- `auth_queue_overflow`
- `auth_refresh_storm_detected`
- Auth metric trend failure buckets

## Alert Thresholds

Treat these as rollout blockers:

- Any `session_drift_detected`
- Any `auth_event_replay_rejected`
- Any `auth_queue_overflow`
- Any `auth_kill_switch_activated`
- Any `auth_refresh_storm_detected`
- Three or more `auth_recovery_failed` signals in 15 minutes
- Eight or more `refresh_failed` signals in 15 minutes
- Eight or more `unexpected_logout` signals in 15 minutes

Treat these as hold-and-investigate signals:

- Three or more `refresh_failed` signals in 15 minutes
- Any `auth_recovery_failed`
- Three or more `stale_auth_context_rejected` signals in 15 minutes
- Any visible rise in support reports about forced reauth, logout churn, or tenant-switch instability

## Rollback and Kill Switch

If auth degradation is user-visible or tenant-scoping confidence drops:

1. Pause rollout expansion.
2. Activate the auth kill switch if users may enter unsafe or inconsistent auth state.
3. Confirm protected routes enter safe mode and do not expose authenticated UI.
4. Roll back the application release if the regression is code-related.
5. Keep telemetry collection enabled while investigating unless it is part of the failure.

## Validation Checklist

Before each rollout stage:

- Auth bootstrap completes without transient authenticated UI from persisted state.
- Supabase session is authoritative after refresh, restore, and tenant switch.
- Boundary cleanup precedes principal adoption.
- Realtime subscriptions reconnect after reauth.
- PostgREST returns expected 401/403 behavior for expired or revoked JWTs.
- RLS still enforces tenant isolation after tenant switch and after refresh.

After each rollout stage:

- Review the Operations dashboard auth cards.
- Review auth metric trend buckets for failure concentration.
- Compare support contacts against baseline.
- Confirm no critical auth alert remains active.
