# Coder Pay (CP) 接口配置与系统集成手册

版本：v1.0  
定位：面向个人开发者的商业化自动收款系统  
适用对象：Web 开发者、系统集成人员、测试及验收工程师

---

## 1. 系统集成总览

Coder Pay 核心集成思路为：**个人收款码 + 安卓通知栏到账监听 + 自动订单匹配 + 商户 Webhook 回调**。
整个收款链路资金均首尾直达您个人微信/支付宝账户，不经过 CP 中介代收，具有绝对的资金安全保障。

---

## 2. 开发者集成核心步骤

### 第一步：创建收款应用
1. 登录 Coder Pay 开发者控制台。
2. 进入 **[应用管理]**，创建新应用。
3. 设定应用名称、默认过期时间、商户 `notify_url`（用于接收支付到账通知）及签名方式（推荐 `HMAC-SHA256`）。
4. 创建成功后，安全记录系统为您分配的：
   * `App ID`（例如 `10042`）
   * `App Secret`（算签密钥，**切勿暴露在前端**）

### 第二步：添加收款通道与二维码
1. 进入 **[收款码管理]**。
2. 上传微信/支付宝收款码，支持：
   * **不固定金额二维码**：用于兜底，需要用户扫码后手动输入金额。
   * **固定金额二维码**：指定具体金额，用户扫码即付，体验最佳，支持防撞额微调。
3. 将收款码绑定至对应的安卓监听设备（若无设备可先进入“设备管理”创建并绑定）。

### 第三步：部署 CoderPay 监听客户端
1. 在专用安卓设备上安装 **CoderPay 安卓 App**。
2. 输入设备编号和绑定密钥，将 App 与您的开发者账户绑定。
3. 授予 App 关键权限：**通知读取权限**（Notification Access）、自启动及电池优化白名单。
4. 登录收款微信号/支付宝，并确保**开启收款到账语音提醒/消息提醒**及系统通知栏消息显示。

---

## 3. 开发者 API 交互规范

### 3.1 创建支付订单 API
商户主站在用户下单时，由服务端向 CP 发起此请求，生成待付单并获取收银台链接。

* **接口地址**：`POST /api/order/create`
* **内容类型**：`application/json`

#### 请求参数 (JSON Payload)：
| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `app_id` | string | 是 | 开发者应用 App ID |
| `out_order_no` | string | 是 | 商户本地系统订单号（需唯一） |
| `title` | string | 是 | 模拟或真实商品名称 |
| `amount` | number | 是 | 支付总额，保留至两位小数（例如 `19.90`） |
| `pay_type` | string | 是 | 支付渠道，可选：`wechat` (微信) / `alipay` (支付宝) |
| `notify_url` | string | 否 | 异步回调 URL，可覆盖应用默认配置 |
| `return_url` | string | 否 | 支付成功后前台跳转 URL |
| `sign` | string | 是 | 鉴权验证签名串（小写） |

#### 接口响应 (JSON)：
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "order_id": "CP482910",
    "out_order_no": "TEST_ORDER_100234",
    "amount": "19.90",
    "real_amount": "19.88",
    "pay_type": "wechat",
    "payment_url": "http://localhost:4000/pay/CP482910",
    "expired_at": "2026-06-06T03:30:00.000Z"
  }
}
```

---

### 3.2 查询订单状态 API
用于商户主动拉取核销支付单的到账状态。

* **接口地址**：`POST /api/order/query`
* **内容类型**：`application/json`

#### 请求参数 (JSON Payload)：
| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `app_id` | string | 是 | 开发者应用 App ID |
| `order_id` | string | 否 | CP 平台订单号（与 `out_order_no` 二选一） |
| `out_order_no` | string | 否 | 商家系统订单号（与 `order_id` 二选一） |
| `sign` | string | 是 | 参数签名（保护订单隐私安全） |

#### 接口响应 (JSON)：
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "order_id": "CP482910",
    "out_order_no": "TEST_ORDER_100234",
    "status": "success",
    "amount": "19.90",
    "real_amount": "19.88",
    "pay_time": "2026-06-06 03:22:14"
  }
}
```
*注：`status` 的可选值为：`new` (新订单), `pending` (待支付), `success` (支付成功并回调成功), `expired` (已过期)*

---

### 3.3 异步 Webhook 回调规范
当安卓设备监测到账后，CP Cloud 将自动向您的 `notify_url` 发起 **POST** 请求。

#### 回调参数 (JSON Payload)：
```json
{
  "app_id": "10042",
  "order_id": "CP482910",
  "out_order_no": "TEST_ORDER_100234",
  "pay_type": "wechat",
  "amount": "19.90",
  "real_amount": "19.88",
  "pay_time": "2026-06-06 03:22:14",
  "sign": "f3b392b95c9ec28120b601f0faedee10bf23bf0450682"
}
```
#### 🚨 商家响应要求：
商家验证 `sign` 合法后，若发货成功，必须向该 HTTP 响应输出且仅输出纯文本 **`success`** (全英文小写，无空格或 HTML 标签)。
若 CP 收到非 `success` 响应（或网络超时），系统判定推送失败，将遵循退避策略发起 **5 轮自动重试**（立即、1分钟后、2分钟后、4分钟后、16分钟后、64分钟后、300分钟后）直至商家成功响应。

---

## 4. 签名鉴权算法与实现

为防止请求伪造及参数篡改，所有 API 接口均强制算签。

### 算法步骤：
1. **参数字典排序**：排除 `sign` 字段，将所有传入（或回调）的键值对按 Key 字母升序（ASCII 自然序）进行排列。
2. **组装待签字符串**：将排好的键值对拼接为 `key1=val1&key2=val2` 格式的 Query 字符串。
3. **追加商户密钥**：在字符串末尾直接拼接 `&key=YOUR_APP_SECRET` 后缀。
4. **计算哈希值**：使用对应的算法（若为 `HMAC-SHA256` 则计算 HMAC，若为 `MD5` 则计算 MD5），结果取小写即为 `sign` 参数值。

#### Node.js 算签示例：
```javascript
import crypto from 'crypto';

const params = {
  app_id: "10042",
  out_order_no: "ORDER_998124",
  amount: "19.90",
  pay_type: "wechat"
};

// 1. 键名升序排列
const sortedKeys = Object.keys(params).sort();
// 2. 组装待签串
let queryStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
// 3. 追加密钥并计算 HMAC-SHA256
const stringToSign = queryStr + '&key=' + appSecret;
const sign = crypto.createHmac('sha256', appSecret)
                   .update(stringToSign)
                   .digest('hex');
```
