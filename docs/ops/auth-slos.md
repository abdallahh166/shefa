# Auth Runtime SLOs

These SLOs govern staging validation, canary promotion, and production rollback decisions.

| Signal | SLO | Rollout Action |
| --- | ---: | --- |
| Refresh success rate | `>= 99.5%` | Hold rollout below target. |
| Recovery timeout rate | `< 0.5%` | Hold rollout; investigate recovery queue, network latency, and Supabase Auth health. |
| Unauthorized storm rate | `0` | Block rollout or activate kill switch if user-visible. |
| Replay rejection rate | `0` outside controlled tests | Block rollout; inspect `authTraceId` timeline. |
| Stale auth context acceptance | `0` | Production-blocking. |
| Queue overflow | `0` | Block rollout; inspect burst behavior and recovery single-flight. |
| Session drift | `0` | Production-blocking. |
| Realtime stale-event leakage | `0` | Production-blocking. |
| Protected UI without session | `0` | Production-blocking. |

## Release Gate

Before promoting a release:

- Staging auth lifecycle suite is green.
- RLS adversarial suite is green.
- Realtime drift suite is green.
- Soak run completes without SLO violations.
- CSP report-only has no required production-path violations.
- Incident replay packs are attached for any failed staging-auth run.

## Dashboard Requirements

Dashboards must expose:

- `refresh_succeeded` / `refresh_failed`
- `auth_recovery_succeeded` / `auth_recovery_failed`
- `auth_queue_overflow`
- `auth_refresh_storm_detected`
- `stale_auth_context_rejected`
- `auth_event_replay_rejected`
- `session_drift_detected`
- `authorization_denied`
- `auth_runtime_invariant_failed`
- `auth_kill_switch_activated`

Group by:

- tenant
- user
- `authTraceId`
- endpoint
- release version
- browser family

## Burn-Rate Starting Point

Use a short-window and long-window pair for rollout alerting:

- 15 minutes: catch sharp auth storms during canary.
- 4 hours: catch slow soak regressions.

Initial thresholds should mirror `docs/ops/auth-production-rollout.md`; tighten them after the first clean staging soak establishes a baseline.
