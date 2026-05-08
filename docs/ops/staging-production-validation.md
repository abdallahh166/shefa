# Staging Production Validation

This runbook is the production gate after local auth orchestration, telemetry, and DB authorization hardening are green. It must run against a real staging Supabase project, not mocked auth or local-only pgTAP.

## Entry Criteria

- `npm run test:db` passes locally.
- Auth chaos and Supabase auth fetch tests pass.
- Staging has production-like auth settings, RLS, Realtime, storage buckets, feature flags, subscriptions, and representative tenants.
- Test accounts exist for clinic admin, accountant, doctor, patient portal user, suspended tenant user, expired subscription tenant, and super admin.
- Telemetry ingestion is enabled for `auth_metric` client logs.

## 1. Supabase Auth Lifecycle

Validate real JWT and refresh-token behavior with browser automation or a staging harness.

Required scenarios:
- Refresh token rotation during active UI use.
- Revoked refresh token while a tab is open.
- Expired access token during create/update mutations.
- Simultaneous 401 bursts from multiple service calls.
- Supabase Realtime websocket reconnect after browser sleep or network loss.
- Offline to reconnect with queued protected requests.
- Tenant switch while requests and subscriptions are active.
- Session revoked from another browser/device.
- Auth kill switch activation while multiple tabs are active.

Success criteria:
- No stale principal data appears after refresh, tenant switch, logout, or revocation.
- 401 recovery enters a single recovery path and replays each request at most once.
- 403 responses do not trigger refresh loops.
- Terminal failures become deterministic `reauth_required`.
- Active tabs do not create duplicate cleanup storms.
- Auth metrics include traceable recovery, failure, kill-switch, and replay-rejection signals.

## 2. RLS Adversarial Runtime

Run against staging through the same public Supabase client paths the browser uses.

Required probes:
- Tenant ID parameter tampering on RPCs.
- SECURITY DEFINER escalation attempts against search, billing, reports, analytics, and admin RPCs.
- Stale JWT after tenant switch.
- Cached query reuse after principal change.
- Portal user calling main-app RPCs.
- Main-app user reading portal-only projections.
- Soft-deleted or suspended tenant access.
- Expired subscription bypass attempts.
- Report aggregation leakage across tenants.
- Storage bucket cross-tenant reads.
- Signed URL reuse outside the tenant that created it.

Success criteria:
- Forbidden paths fail with 401/403 or SQLSTATE `42501`.
- No response body, aggregation count, storage metadata, or signed URL reveals another tenant.
- Runtime behavior matches DB assertions in `supabase/tests`.

## 3. Long-Running Soak

Run for 12 to 24 hours before canary.

Automation loop:
- Login, refresh, protected reads, protected mutations, logout, and relogin.
- Random network drops and throttled responses.
- Browser tab open/close churn.
- Multi-tab auth event propagation.
- Tenant switching where authorized.
- Realtime subscribe, disconnect, reconnect.
- Browser sleep/wake simulation where supported by the runner.

Track:
- Memory growth.
- Auth event volume.
- Recovery queue depth and overflow.
- Orphaned requests.
- Duplicate cleanup executions.
- Refresh retry distribution.
- Leader failover stability.
- Realtime reconnect success.

Success criteria:
- No unbounded memory growth.
- No auth refresh storms.
- No queue overflows.
- No repeated cleanup for the same auth transition.
- No stale principal leakage after churn.

## 4. CSP Report-Only Rollout

Deploy `Content-Security-Policy-Report-Only` in staging before enforcement.

Validation:
- Inventory all external hosts used by Supabase Auth, PostgREST, Realtime websocket, storage, Sentry, fonts, maps, payments, email previews, and CDNs.
- Confirm Realtime websocket compatibility.
- Confirm hCaptcha and other auth-screen third parties.
- Remove unsafe allowances incrementally.
- Keep report-only until expected violations are clean for a full staging soak.

Promotion gate:
- Report-only violation stream contains no required production path.
- Enforcement has a rollback toggle.

## 5. HTTP Auth Boundary

The browser must use one HTTP auth boundary for Supabase calls.

Required invariant:
- 401 is the only path that triggers refresh/recovery and a single replay.
- 403 is a non-refreshing authorization denial path.
- Auth token and logout endpoints are excluded from recovery recursion.
- Kill switch forces `reauth_required`.
- Every auth-boundary event carries an `authTraceId`.

Current implementation:
- `src/services/supabase/supabaseAuthFetch.ts`
- `src/services/auth/auth.service.ts`

## 6. Observability Gate

SLO definitions live in [Auth Runtime SLOs](./auth-slos.md).

Dashboards must show:
- Refresh success rate.
- Recovery latency and timeout rate.
- Recovery queue overflow frequency.
- Drift detection frequency.
- Replay rejection counts.
- Unauthorized storm signals.
- Leader failover signals.
- Stale-auth-context rejections.
- Unexpected logout spikes.
- Auth kill-switch activation.

Initial rollout blockers:
- Refresh success rate below 99.5%.
- Recovery timeout rate above 0.5%.
- Any queue overflow.
- Any session drift.
- Any replay rejection outside a controlled test.
- Unauthorized storm signal.
- Any stale principal leakage report.

## 7. Incident Drill

Simulate before canary:
- Supabase Auth outage.
- Realtime outage.
- Auth endpoint latency.
- Corrupted persisted auth state.
- Partial migration mismatch.
- Stale browser tabs after deploy.

Required proof:
- Kill switch works.
- Safe mode hides authenticated UI.
- Rollback path is documented and tested.
- Telemetry remains visible.
- Tenant isolation remains intact during the incident.

## Production Gate

Move to controlled canary only when:
- Supabase auth lifecycle validation passes.
- RLS adversarial runtime suite passes.
- 12 to 24 hour soak passes.
- CSP report-only is clean.
- Observability dashboards and thresholds are operational.
- Incident drill passes.
- Rollback and kill switch are verified.
