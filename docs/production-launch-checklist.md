# CoderPay Production Launch Checklist

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
