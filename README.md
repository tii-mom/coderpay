# CoderPay

CoderPay 是一款面向独立开发者的微信/支付宝个人免签自动收款系统，由 **Web/云端系统** 与 **Android App** 共同构成。

## 核心架构

1. **Web / 云端系统**：负责应用管理、密钥分发、收款码调度、订单管理、设备在线状态监控、到账匹配引擎以及异步 Webhook 回调推送。
2. **Android App**：负责通知监听、到账事件补传、设备健康检查，以及受限移动运营能力，包括充值、套餐订阅、收款码上传/管理和异常查看。

## 本地开发指南

本项目采用 Next.js + React + TailwindCSS 构建 Web 控制台，Android App 位于 `coderpay-android/`。

1. **安装依赖**：
   ```bash
   npm install
   ```

2. **运行开发服务器**：
   ```bash
   npm run dev
   ```
   打开 [http://localhost:3000](http://localhost:3000) 即可预览控制台界面。

## 上线前检查

生产发布前先运行自动化验证：

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run check:prod
```

Android 构建：

```bash
cd coderpay-android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleDebug
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ./gradlew assembleRelease
```

`npm run check:prod` 会检查生产环境变量、邮件配置、平台充值账号和 Android release 签名配置。它不会打印密钥值。

## 生产部署

生产环境使用 Cloudflare Pages + D1。上线前按顺序执行：

```bash
npm run verify
npm run pages:build
npm run check:prod
npm run db:backup
npm run d1:migrate:remote
node scripts/setup-platform-recharge.mjs --check --remote
node scripts/deploy-pages.mjs --dry-run
npm run pages:deploy
```

Cloudflare 边缘限流规则必须按 `docs/cloudflare-rate-limits.md` 配置。代码内存限流只作为轻量兜底，不能替代 Cloudflare WAF / Rate Limiting。

上线后 smoke test：

1. 登录控制台并创建应用。
2. 上传真实收款码，确认设备心跳、通知监听、通知权限、电池豁免均正常。
3. 创建一笔商户订单，打开扫码页并完成小额到账测试。
4. 确认到账事件匹配订单，商户 Webhook 返回 `success`。
5. 发起一笔余额充值，确认平台充值订单入账。
6. Android App 冷启动、重启后自启动、锁屏保活均正常。
