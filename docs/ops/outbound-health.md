# Outbound Network Health Check

Use the `health:outbound` script to validate outbound connectivity to external providers
(captcha, email, webhooks) from the current environment.

## Configuration
Set `OUTBOUND_HEALTHCHECK_URLS` as a comma-separated list:

```
OUTBOUND_HEALTHCHECK_URLS=https://hcaptcha.com/siteverify,https://api.resend.com
```

## Run
```
npm run health:outbound
```

If no URLs are configured, the script skips without failing.
