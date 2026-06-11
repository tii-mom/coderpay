# CoderPay Production Launch Checklist

## Launch Decision

Current code is suitable for controlled launch / small-scope real payment
acceptance, not broad public rollout.

Before opening traffic beyond trusted merchants, finish the P0 checklist below
and keep the worktree clean at a reviewed commit.

## P0 Controlled Launch Gate

- Current changes are committed and `git status --short` is empty.
- A fresh remote D1 export has been saved outside git.
- Production D1 migrations have been applied with `npm run d1:migrate:remote`.
- `npm run verify` passes.
- `npm run check:prod` passes.
- `npm run pages:deploy` completes and the production alias serves the new build.
- Production smoke test passes:
  - registration and login create a valid `session_email` session;
  - console auth APIs load with that session;
  - app creation works;
  - order creation rejects missing fields and bad signatures;
  - a signed order reaches the expected business gate.
- Real-device payment acceptance passes:
  - create order;
  - WeChat / Alipay real payment arrives;
  - Android Watcher uploads `/api/events`;
  - order becomes `success`;
  - merchant receives exactly one Webhook.
- Developer recharge acceptance passes:
  - platform recharge account exists;
  - platform Watcher device is bound and online;
  - platform recharge payment code exists;
  - recharge order creation works;
  - real recharge credits balance;
  - recharge promotion grants subscription only after real arrival;
  - merchant Webhook is not triggered for recharge orders.

## P1 First-Week Operations

- Configure Cloudflare WAF rate limiting for `/api/auth/*`,
  `/api/order/create`, `/api/events`, and `/api/billing/recharge`.
- Automate daily D1 cold backups to R2/S3 or equivalent storage with retention.
- Add device-offline alerting for stale Watcher heartbeats.
- Add automatic Webhook compensation by Cron or Queue while keeping manual retry.
- Maintain an operator acceptance runbook for device permissions, payment tests,
  merchant callbacks, recharge, refund / exception handling, and reconciliation.

## P2 Stabilization Backlog

- Add nonce-based Android event replay hardening.
- Strengthen amount slot reservation for high-concurrency same-amount orders.
- Add daily reconciliation reports for orders, fees, recharge, subscriptions,
  manual adjustments, and balance movements.
- Add Sentry or equivalent edge logging for production 500 / D1 / Webhook /
  Android upload errors.
- Improve the device keep-alive guide by Android manufacturer.

## Automated Gates

Run these before every production release:

```bash
npm run verify
npm run check:prod
cd coderpay-android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleRelease
```

`npm run verify` validates code quality and Web production build.
`npm run check:prod` validates production configuration and Android release signing prerequisites.

## Production Configuration

- `.env` contains `NEXT_PUBLIC_APP_URL`.
- `.env` contains `SESSION_SECRET` with at least 32 characters.
- `.env` contains `EMAIL_PROVIDER` and the matching provider API key.
- `.env` contains `EMAIL_FROM`.
- `.env` contains `PLATFORM_RECHARGE_USER_EMAIL`.
- `wrangler.json` contains the Cloudflare D1 binding named `DB`.
- Production D1 migrations have been applied.
- Android `coderpay-android/keystore.properties` exists and points to a production keystore.
- The release APK is signed, not `app-release-unsigned.apk`.

## Platform Recharge Setup

Developer balance recharge, and therefore normal order creation after the
zero-balance gate, depends on a configured platform account.

- The user from `PLATFORM_RECHARGE_USER_EMAIL` exists in production D1.
- That user has at least one bound, online Watcher device.
- That user has at least one active payment code for the intended recharge
  method.
- A small real recharge to that account credits the developer's balance.

## Security Hardening

- Cloudflare WAF rate-limiting rules are configured and verified for auth,
  order creation, event upload, and recharge endpoints.
- Auth endpoints return `429` under rapid repeated requests at the edge.
- `NEXT_PUBLIC_ENABLE_SANDBOX` is `false` in production.
- Password reset email delivery is verified end-to-end.

## Real Payment Acceptance

- WeChat fixed-amount payment code creates and completes an order.
- Alipay fixed-amount payment code creates and completes an order.
- Universal payment code uses unique adjusted amount and completes the correct order.
- Same device, same channel, same amount, multiple pending orders enter manual review.
- Different devices with the same amount do not match each other's orders.
- Expired orders are not automatically matched and do not trigger merchant Webhook.
- Duplicate notification hash does not repeat balance credit, fee deduction, or Webhook delivery.
- Developer balance recharge credits the correct user balance.
- Balance subscription activates or renews the selected package.

## Android Device Acceptance

- Fresh device can bind using a `dev_` one-time code before expiry.
- Expired binding code cannot bind.
- Resetting device secret invalidates old HMAC signatures.
- Notification listener permission is detected correctly.
- Battery optimization status is detected correctly.
- Device offline state prevents unsafe order allocation.
- Offline payment events are queued and uploaded after network recovery.
- App logs do not display device secrets, app secrets, or raw HMAC signatures.

## Webhook Acceptance

- Merchant signature examples in docs pass backend verification.
- Successful payment sends exactly one Webhook.
- Webhook response must be `success` to mark delivery successful.
- Failed Webhook is recorded and can be manually retried.
- Webhook payload keeps backward-compatible `amount` and `real_amount` fields.
