# Cloudflare Edge Protection

CoderPay keeps in-process rate limits in the application as a lightweight fallback. Cloudflare Pages Functions can run in multiple isolates, so production abuse protection must be enforced at the Cloudflare edge.

## Required Rules

Configure Cloudflare WAF / Rate Limiting rules for these paths before production launch:

| Path | Suggested key | Suggested threshold | Action |
| --- | --- | ---: | --- |
| `/api/auth/login` | IP | 10 requests / minute | Managed challenge, then block on repeat |
| `/api/auth/register` | IP | 5 requests / 5 minutes | Managed challenge |
| `/api/auth/forgot-password` | IP | 5 requests / 5 minutes | Managed challenge |
| `/api/auth/reset-password` | IP | 10 requests / minute | Managed challenge |
| `/api/order/create` | IP + `app_id` when available | 60 requests / minute | Block or challenge |
| `/api/events` | IP + `deviceCode` when available | 120 requests / minute | Block |
| `/api/devices/heartbeat` | IP + `deviceCode` when available | 120 requests / minute | Block |
| `/api/mobile/*` | IP + `x-coderpay-device` | 120 requests / minute | Block |

## Launch Checklist

1. Enable the rules in the Cloudflare project that serves `coderpay`.
2. Keep logs in simulate/log mode briefly if the production traffic profile is unknown.
3. Switch auth and device-event rules to enforce mode before public launch.
4. Record the final thresholds, action, and owner in the release notes.
5. If a real device or merchant is blocked, verify request signatures before allowlisting.
