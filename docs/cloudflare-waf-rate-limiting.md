# Cloudflare WAF 速率限制规则（/api/auth/*）

这是 CoderPay Web 认证接口的**真正防爆破层**。应用层内存限流（`lib/rate-limit.ts`）在 Cloudflare 分布式 isolate 下不可靠，只作弱第一层；下面的 WAF 规则在边缘按 IP 计数，跨 isolate 生效，是主防护。

## 前置条件

- `3api.shop` 已作为 zone 接入 Cloudflare（橙云代理已开启）。规则按 zone 配置，匹配 `path` 即可覆盖 `3api.shop` / `app.3api.shop` / `www.3api.shop` 所有子域。
- 规则数量与可选时间窗、封禁时长受套餐影响：
  - **Free**：通常仅 1 条速率规则，时间窗与封禁时长选项受限。→ 用下面的「Free 套餐合并规则」。
  - **Pro / Business / Enterprise**：可配多条、更长时间窗与自定义封禁时长。→ 用「分级规则（推荐）」。

## 进入位置

Cloudflare 控制台 → 选择 `3api.shop` 域 → **Security → WAF → Rate limiting rules** → **Create rule**
（部分账号新版菜单为 Security → Security rules → Rate limiting rules，字段一致。）

每条规则通用设置：
- **When incoming requests match**：用下方表达式（Edit expression，粘贴 Expression 字段）。
- **With the same characteristics（按什么计数）**：`IP`（IP source address / IP with NAT support）。
- **Rate / Period**：见下表。
- **Then take action**：`Block`（或 `Managed Challenge`，对真人更友好；爆破场景建议 Block）。
- **Duration / Mitigation timeout（封禁时长）**：10 分钟（Free 可能固定，按可选最大值）。
- **Response**：自定义返回 429（可选）。

---

## 分级规则（推荐，Pro+）

| # | 规则名 | 保护对象 | 计数 | 阈值 | 时间窗 | 动作 | 封禁时长 |
|---|--------|----------|------|------|--------|------|----------|
| 1 | auth-login | 密码爆破 | IP | 10 | 1 min | Block | 10 min |
| 2 | auth-email-send | 邮件轰炸 / 烧 Brevo 额度 | IP | 5 | 1 min | Block | 10 min |
| 3 | auth-token-verify | 令牌猜测 | IP | 15 | 1 min | Managed Challenge | 10 min |

### 规则 1 — auth-login
```
(http.request.uri.path eq "/api/auth/login" and http.request.method eq "POST")
```
Rate: **10** requests / **1 minute** / IP — Action: **Block** 10 min

### 规则 2 — auth-email-send（注册 + 找回密码 + 重发验证）
```
(http.request.method eq "POST" and (
  http.request.uri.path eq "/api/auth/register" or
  http.request.uri.path eq "/api/auth/forgot-password" or
  http.request.uri.path eq "/api/auth/resend-verification"
))
```
Rate: **5** requests / **1 minute** / IP — Action: **Block** 10 min

### 规则 3 — auth-token-verify（验证邮箱 + 重置密码）
```
(http.request.method eq "POST" and (
  http.request.uri.path eq "/api/auth/verify-email" or
  http.request.uri.path eq "/api/auth/reset-password"
))
```
Rate: **15** requests / **1 minute** / IP — Action: **Managed Challenge** 10 min

> 阈值与应用层限流（login 10/分、邮件类 5/分、令牌类合并后稍放宽）对齐，正常用户不会触发：真人登录失败几次、找回密码点一两次即可。

---

## Free 套餐合并规则（仅 1 条时）

覆盖所有 auth 接口，取最严的邮件类阈值偏紧但可接受：
```
(starts_with(http.request.uri.path, "/api/auth/") and http.request.method eq "POST")
```
Rate: **15** requests / **1 minute** / IP — Action: **Block**（或 Managed Challenge）

> 说明：合并规则无法对「邮件发送」单独收紧。若担心邮件轰炸，优先把这条阈值压到 **8/分**，宁可偶尔误伤连点用户，也别让攻击者刷爆 Brevo 额度。

---

## 验证（配置后）

连续快速请求应在超阈值后返回 **429**（或质询页）：
```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://3api.shop/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"identifier":"probe@example.com","password":"x"}'
done; echo
```
预期：前若干个 `401`，超过阈值后出现 `429`（Block）或 `403`/质询（Managed Challenge）。
与应用层不同，WAF 在边缘统一计数，会稳定触发。

## 注意事项

- **不要**对 `/api/order/create`、`/api/events` 配同样的 IP 限流——商户服务器和 Android 设备可能共用出口 IP 高频合法调用，会误伤。这些接口已有签名校验 + `notificationHash` 幂等兜底。
- 若启用 Cloudflare 代理的同时商户通过固定 IP 高频查单（`/api/order/query`），同理不要纳入。
- 规则仅在橙云代理的流量上生效；确保 auth 走的是代理域名而非直连 Pages `*.pages.dev`。
- 建议同时在 **Security → Events** 观察命中情况，先用 `Log`/`Managed Challenge` 跑几天再切 `Block`，避免误伤。
```
