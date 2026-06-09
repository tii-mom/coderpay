# CoderPay 工作交接文档（Handoff）

> 交接时间：2026-06-09。本文件汇总当前上线进度、阻塞项、待办任务、以及接手所需的关键操作命令。
> 配套文档：`production-launch-checklist.md`（上线验收清单）、`console-improvement-backlog.md`（控制台优化）、`cloudflare-waf-rate-limiting.md`（WAF 配置）。

---

## 1. 项目与生产环境

- **架构**：Next.js Web 控制台（Cloudflare Pages）+ Cloudflare D1 数据库 + Android Watcher App。免签个人微信/支付宝收款系统。
- **生产域名**：`3api.shop` / `app.3api.shop`（Cloudflare Pages 项目 `coderpay`）。
- **数据库**：Cloudflare D1，名 `coderpay-db`（binding `DB`，见 wrangler.json）。
- **当前生产部署**：`2e332381`（2026-06-09）。注意：交接前曾观察到多人并行部署（e5b1bf66 → fa3638fe → 2e332381），**接手后请先确认是否有其他人也在部署，避免互相覆盖**。
- **Cloudflare 账号**：348421501@qq.com（wrangler 通过 `CLOUDFLARE_API_TOKEN` 环境变量认证）。

### 常用命令
```bash
npm run verify            # 全套门禁：test + tsc + lint + build
npm run check:prod        # 生产配置校验（含产物 .db 泄漏检查）
npm run pages:build       # 重建 Pages 产物
npm run pages:deploy      # 重建+校验修复标志+部署（务必用这个，不要手动 wrangler deploy 旧产物）
npm run d1:migrate:remote # 应用迁移到远端 D1
npm run platform:check -- --remote   # 校验平台充值链就绪度
```

<!-- HANDOFF_PLACEHOLDER -->

---

## 2. 已完成（已上线生产并验证）

- **后端资金正确性（P0/P1）**：支付成功后触发商户 webhook 回调；登录改为完整邮箱（修越权）；`Order` 加 `@@unique([appId,outOrderNo])`（防重复订单）；会话 token 加 30 天时效；过期到账识别（expired_payment）；到账处理「原子认领 + D1 batch」防重复扣费/入账/回调；订阅过期回落免费额度。
- **到账一致性（A）**：`/api/events` 用 `runAtomic`（D1 batch）把余额/账单/事件打包提交。残留窗口：认领后 batch 失败 → 订单仍成功、webhook 仍发，仅少一笔服务费/审计，可对账恢复。**不是完整事务**，措辞勿夸大。
- **发布安全（C）**：`npm run pages:deploy`（强制重建+校验产物新鲜度+校验修复标志，拒绝旧/缺修复产物）；`.github/workflows/ci.yml`（push/PR 跑 verify，无 secret、不部署）。
- **设备签名防重放**：时间窗 10min → 2min。
- **Web 认证限流（弱层）**：`lib/rate-limit.ts` 给 login/register/forgot/resend/reset/verify 加内存限流。**已知局限：Cloudflare 多 isolate 下不可靠，真正防护靠 WAF（见任务 T3）**。
- **DB 默认值与索引**：`User.feeBalance` 默认 0；补回 `Order` 性能索引到 schema（修 drift）。迁移 `20260609120000` 已应用到本地 + 远端。
- **控制台可靠性（P0-1~P0-4）**：错误边界（不再白屏）；mutation 失败弹错误 toast（修了 3 个隐藏 bug：createDevice 崩溃、异常 resolve/ignore 假成功、webhook 重推假成功）；轮询重构（防堆叠、后台暂停、5s 间隔、容错解析）；套餐购买双击保护。

---

## 3. 🔴 上线硬阻塞（必须解决才能运营）

### T1 — 平台收款账号不存在（最高优先级）
- **现状**：`.env` 配的 `platform-billing@3api.shop` 在生产 D1 **不存在**（已确认 COUNT=0）。
- **影响链**：开发者无法充值 → 余额恒为 0 → `feeBalance>0` 校验挡住 → **无法创建任何订单**。整个收款-计费闭环跑不通。
- **它是什么**：平台运营方自己的收款账号（收开发者充值的钱进它绑定的微信/支付宝码）。不是测试账号，无管理员特权（系统无角色概念）。
- **待决策**：建议改用一个**真实能收信的邮箱**（当前邮箱收不到验证邮件，找回密码会卡）。
- **执行步骤**：
  1. 改 `.env` 的 `PLATFORM_RECHARGE_USER_EMAIL` 为真实邮箱，并同步到 Cloudflare Pages 生产环境变量。
  2. 创建账号（密码自己定，经环境变量传入，不入日志）：
     ```bash
     PLATFORM_RECHARGE_PASSWORD='你的密码' npm run platform:setup -- --remote
     ```
  3. 用该账号登录控制台 → 绑定一台 Watcher 设备（真机装 App + dev_ 码）→ 上传真实平台收款码。
  4. 校验：`npm run platform:check -- --remote`，看到 "READY" 即解除。
- **注意**：步骤 3 必须真机操作，无法脚本化（收款码图片是真实资产）。

### T2 — 真实支付闭环从未端到端验证
- 创建订单 → 真机微信/支付宝到账 → 订单转 success + 商户收到恰好一次回调。涉及真机+真钱，只能人工跑。
- 验收清单见 `production-launch-checklist.md` 的 "Real Payment Acceptance" 段。
- 安全连通性测试可先用控制台的 `/api/integration/webhook-ping`（登录态，不动订单数据）。

### T3 — Cloudflare WAF 速率规则未配置
- 应用层限流不可靠（见上）。需在 Cloudflare 控制台对 `/api/auth/*` 配 WAF 速率规则。
- **完整配置清单**：`docs/cloudflare-waf-rate-limiting.md`（含表达式、阈值、验证命令）。这是控制台操作，代码已就绪。

<!-- HANDOFF_PLACEHOLDER_2 -->

---

## 4. 🟠 上线前应做（非死锁，但影响质量/体验）

### T4 — 邮件投递真实性未验证
- `check:prod` 只校验 Brevo key 非占位，**从没真正发过邮件成功**。注册/找回密码强依赖邮件。
- 风险：若 Brevo key 失效或 `3api.shop` 域未在 Brevo 配 SPF/DKIM → 新用户无法注册、无法重置密码。
- 验证：用一个真实邮箱走注册，确认收到验证信。

### T5 — 控制台 P1 优化（`console-improvement-backlog.md`）
- P1-1 大量原生 `alert()`/`confirm()`（密钥用 alert 弹窗展示）→ 改 Modal + 一键复制。
- P1-2 无障碍几乎为零（96 个 button，0 个 aria-label）。
- P1-3 `DevicesTab.tsx` 1000 行过臃肿 → 拆分。
- P1-4 列表分页不统一（仅 OrdersTab 有分页）。

### T6 — 监控/告警缺失
- 系统写 `ExceptionItem`（设备离线、回调失败、未匹配到账）入库，但**无任何外部告警**。运营时设备掉线/webhook 连续失败无人知。建议接一个告警通道。

---

## 5. ⚫ 业务/合规（非代码，需运营决策）

- 微信/支付宝**个人收款码**商用免签违反其商户协议，有**封号/冻结资金**风险（此类系统固有风险）。
- 缺失：用户服务协议、退款/纠纷流程、资金结算与发票、"二清"性质的法律评估。
- 这部分需业务/法务决策，非工程能解决。

---

## 6. 🟢 可选后续迭代（不阻塞）

- Android 端加 nonce 做强防重放（本轮只缩窗到 2min；nonce 需跨端协议改动 + 旧 App 强制升级，适合随下个 App 版本）。
- 控制台 P2 打磨：登录按钮 `disabled={!!successText}` 潜在卡死、Toast id 撞号、`db` 方法 any 类型、i18n。
- A 阶段一致性可进一步升级为更强的幂等恢复逻辑（当前已是 batch + 原子认领，够用）。
- CI 增加 PR preview 部署 + 自动 smoke test。

---

## 7. 接手第一步建议顺序

1. 读本文件 + `production-launch-checklist.md`，确认理解现状。
2. 确认无其他人正在部署（见第 1 节警告）。
3. 跑 `npm run verify` 确认本地门禁全绿，`npm run platform:check -- --remote` 看 T1 状态。
4. 优先推进 **T1（平台账号）→ T2（支付闭环）→ T3（WAF）→ T4（邮件）**，这是「能不能开门做生意」的关键路径。
5. T5/T6 与业务合规（第 5 节）并行推进。

> 当前可运营度判断：**代码与基础设施已基本就绪，真正卡住「能否开张」的是 T1（平台收款账号）+ T2（支付闭环验证）**，这两项都需要真机和真实收款资产，无法由 AI 代做。


