# 控制台优化任务清单（Console Improvement Backlog）

> 来源：2026-06-09 对 Web 控制台（`app/console/` + `components/console/` + `hooks/use-payment-state.ts`，约 6000 行）的只读审查。
> 结论：控制台功能完整、可上线，但可靠性与打磨层面有明显短板。建议上线前至少完成 P0，P1 随后迭代。
> 每项标注：文件位置、问题、修复方向。未改动任何代码。

---

## P0 — 上线前建议完成（可靠性短板）

> 进度：P0-2、P0-4 已于 2026-06-09 完成（见各项 ✅）。P0-1、P0-3 待办。

### P0-1 数据轮询机制粗糙
- **位置**：`hooks/use-payment-state.ts`（`fetchState` + `setInterval`）
- **问题**：每 3 秒无条件并发 8 个 fetch（apps/codes/devices/orders/events/exceptions/webhooks/billing）。页面切后台仍轮询；慢请求会堆叠；每次整体 `setState` 导致列表闪烁；每用户每分钟约 160 次请求，浪费 Cloudflare 额度。
- **修复方向**：页面 `visibilitychange` 隐藏时暂停轮询；间隔拉长到 10s 或改按需/SSE；mutation 成功后才强制刷新；用 `document.hidden` 守卫；避免无变化时整体替换 state。

### P0-2 多数 mutation 失败时静默无反馈 ✅ 已完成（2026-06-09）
- **位置**：`hooks/use-payment-state.ts` 的 `createPaymentCode` / `updatePaymentCode` / `deletePaymentCode` / `updateApp` / `deleteApp` 等
- **问题**：不检查 `res.ok`、不返回错误，直接 `await fetchState()`。后端返回 4xx/5xx 时用户毫无感知，误以为操作成功。（BillingTab 的充值/订阅是正面例子，已有 `.ok` 检查 + 错误 toast。）
- **修复方向**：所有 mutation 统一返回 `{ ok, error, data }`，调用方在失败时 `onTriggerToast(error, 'error')`。以 BillingTab 模式为模板推广到全部 tab。

### P0-3 网络异常导致按钮永久卡死
- **位置**：`components/console/BillingTab.tsx`（`rechargeLoading`）及其他带 loading 态的 tab
- **问题**：`db.rechargeFees` / `changePlan` 等内部 `fetch` 抛异常（断网）时，外层无 try/catch，`setLoading(false)` 不执行 → 按钮永久禁用，只能刷新页面。
- **修复方向**：mutation 调用包 `try/catch/finally`，在 `finally` 里复位 loading；db 层 fetch 包 try/catch 返回 `{ ok:false, error }` 而非抛出。

### P0-4 缺少全局错误边界 ✅ 已完成（2026-06-09）
- **位置**：`app/`（无 `error.tsx` / `global-error.tsx` / ErrorBoundary）
- **问题**：任一 tab 渲染期抛异常 → 整个控制台白屏，用户只能手动刷新。
- **修复方向**：新增 `app/console/error.tsx`（或全局 `app/error.tsx`）做降级 UI + 重试按钮；这是 Next.js 生产应用标配。

---

## P1 — 专业度与可用性（上线后迭代）

### P1-1 大量使用原生 alert() / confirm()
- **位置**：`AppsTab.tsx`（4 处，含 `:66`/`:87` 用 `alert()` 展示 App Secret）、`DevicesTab.tsx`（2）、`OrdersTab.tsx` / `CodesTab.tsx` / `app/console/page.tsx`（各 1）
- **问题**：阻塞式原生弹窗，移动端体验差、样式不可控、无复制按钮。用 alert 展示密钥对收款系统显得不成熟。
- **修复方向**：改用项目已有 Toast/Modal 体系；密钥展示做成带「一键复制」的 Modal；确认类操作用自定义确认对话框。

### P1-2 无障碍（a11y）几乎为零
- **位置**：`components/console/*.tsx`（96 个 `<button>`，`aria-*` 标签 0 个）
- **问题**：纯图标按钮对屏幕阅读器不可读。与 CLAUDE.md「生成代码需无障碍合规」要求不符。
- **修复方向**：图标按钮补 `aria-label`；表单补 `label`/`htmlFor`；模态补 `role="dialog"` 与焦点管理。

### P1-3 DevicesTab.tsx 过于臃肿（1000 行）
- **位置**：`components/console/DevicesTab.tsx`
- **问题**：单文件承担设备列表、绑定流程、密钥重置、状态展示，远超其他 tab，难维护。
- **修复方向**：拆分为 DeviceList / DeviceBindFlow / DeviceSecretReset 等子组件。

### P1-4 列表分页不统一
- **位置**：`OrdersTab.tsx` 有分页（`:82` slice + `:84` handlePageChange）；`EventsTab.tsx` / `ExceptionsTab.tsx` / `WebhooksTab.tsx` 似为全量渲染
- **问题**：订单/事件量大后渲染卡顿；后端 events 上限 100 条，前端无「加载更多」。
- **修复方向**：统一分页组件；大列表考虑虚拟滚动；配合后端做游标分页。

---

## P2 — 打磨（低优先级）

### P2-1 登录按钮可能永久禁用
- **位置**：`app/login/page.tsx:198`，`disabled={!!successText}`
- **问题**：成功提示残留时按钮永久禁用，疑似「点击登录无反应」的诱因之一（强制刷新可解）。
- **修复方向**：用独立 `submitting` 态控制禁用；跳转前/失败时清空 `successText`。

### P2-2 Toast id 用 performance.now() 可能撞号
- **位置**：`app/console/page.tsx`（`getUniqueToastId`）
- **修复方向**：改用递增计数器或 `crypto.randomUUID()`。

### P2-3 db 方法参数大量 any，类型安全弱
- **位置**：`hooks/use-payment-state.ts`（`createApp(app: any)` 等）
- **修复方向**：用 `types/` 中已有的领域类型替换 any。

### P2-4 文案硬编码、无 i18n
- **位置**：各 tab 组件内大量中文字符串
- **说明**：若仅面向国内可暂不处理；如需多语言再抽取。

---

## 总体评估

| 维度 | 现状 |
|---|---|
| 功能完整度 | 好（10 个 tab 覆盖全业务） |
| 代码组织 | 中（懒加载分包好，但 DevicesTab 过大、数据层 any 多） |
| 错误处理 | 弱（多数 mutation 静默失败、无错误边界、loading 易卡死） |
| 性能 | 中（3 秒全量轮询偏重，无可见性优化） |
| 体验打磨 | 中（原生 alert、无 a11y、分页不统一） |
| 安全 | 尚可（密钥仅展示一次逻辑正确，展示方式偏粗糙） |

**建议顺序**：P0-2、P0-4 最先（直接影响运营时用户能否看到错误、是否白屏）→ P0-1、P0-3 → P1 → P2。
