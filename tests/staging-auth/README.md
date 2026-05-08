# Staging Auth Validation Harness

This suite proves the guarantees in `docs/ops/staging-production-validation.md` against a real staging Supabase project.

Run:

```bash
STAGING_AUTH_VALIDATE=1 npm run test:staging-auth
```

Long soak:

```bash
STAGING_AUTH_VALIDATE=1 STAGING_AUTH_SOAK=1 npm run test:staging-auth:soak
```

Required variables:

- `STAGING_BASE_URL`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`
- `STAGING_CLINIC_SLUG`
- `STAGING_ADMIN_EMAIL`
- `STAGING_ADMIN_PASSWORD`

Optional but required for the full adversarial matrix:

- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_SECONDARY_ADMIN_EMAIL`
- `STAGING_SECONDARY_ADMIN_PASSWORD`
- `STAGING_SECONDARY_CLINIC_SLUG`
- `STAGING_PORTAL_EMAIL`
- `STAGING_PORTAL_PASSWORD`
- `STAGING_FOREIGN_TENANT_ID`
- `STAGING_FOREIGN_PATIENT_ID`
- `STAGING_STORAGE_BUCKET`
- `STAGING_STORAGE_FOREIGN_PATH`
- `STAGING_AUTH_SOAK_MS`
- `STAGING_AUTH_SOAK_MAX_ITERATIONS`

The suite intentionally skips instead of faking staging proof when a destructive or cross-tenant probe is missing its required credentials.
