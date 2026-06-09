# Launch Checklist — Additions (merge into production-launch-checklist.md)

> NOTE: `docs/production-launch-checklist.md` is currently locked at the OS level
> (even `touch` / `chmod` fail with EPERM), so these two sections could not be
> inserted automatically. After unlocking that file (close any editor holding it,
> or clear its ACL/flags), paste these sections in — `Platform Recharge Setup`
> after the Android signing lines, and `Security Hardening` before
> `## Real Payment Acceptance`.

## Platform Recharge Setup (required before any order can be created)

Developer balance recharge — and therefore order creation (`feeBalance > 0` is
required) — depends on a configured platform account.

- The user from `PLATFORM_RECHARGE_USER_EMAIL` exists in production D1.
- That user has at least one bound, online Watcher device.
- That user has at least one active payment code (WeChat and/or Alipay).
- A small real recharge to that account credits the developer's balance.

## Security Hardening

- Cloudflare WAF rate-limiting rules for `/api/auth/*` are configured and
  verified — see `docs/cloudflare-waf-rate-limiting.md`. (The in-app limiter in
  `lib/rate-limit.ts` is a weak fallback only; WAF is the real protection.)
- Auth endpoints return `429` under rapid repeated requests at the edge.
- `NEXT_PUBLIC_ENABLE_SANDBOX` is `false` in production.
- Email delivery verified end-to-end: a real registration receives the
  verification email; password reset email arrives.
