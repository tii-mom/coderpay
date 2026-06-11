// Shared API Specifications for CoderPay Docs

export const API_SPEC = {
  createOrder: {
    endpoint: '/api/order/create',
    method: 'POST',
    contentType: 'application/json',
    description: '在您的自建商城/打赏主站中，当买家确定下单并点击【支付】时，您的服务端向 CoderPay 发起此 POST 请求。CoderPay 将创建订单、分配收款通道，并返回收银台 URL（payment_url）。您应将买家重定向到该地址完成付款。',
    requestFields: [
      { name: 'app_id', type: 'string', required: true, desc: '开发者应用 App ID' },
      { name: 'out_order_no', type: 'string', required: true, desc: '商户本地订单号，同一应用下必须唯一' },
      { name: 'title', type: 'string', required: true, desc: '商品或订单名称' },
      { name: 'amount', type: 'number', required: true, desc: '订单金额，保留两位小数，例如 19.90' },
      { name: 'pay_type', type: 'string', required: true, desc: '支付渠道：wechat 或 alipay' },
      { name: 'sign', type: 'string', required: true, desc: '按签名规则计算出的请求签名' }
    ],
    responseFields: [
      { name: 'order_id', type: 'string', desc: 'CoderPay 订单号' },
      { name: 'out_order_no', type: 'string', desc: '商户本地订单号' },
      { name: 'amount', type: 'string', desc: '原始订单金额' },
      { name: 'real_amount', type: 'string', desc: '用户实际应付金额，可能包含尾差' },
      { name: 'pay_type', type: 'string', desc: '支付渠道' },
      { name: 'payment_url', type: 'string', desc: '托管收银台地址' },
      { name: 'expired_at', type: 'string', desc: '订单过期时间' },
      { name: 'confirm_mode', type: 'string', desc: 'auto 或 manual；manual 表示需商户人工确认' }
    ],
    requestExample: {
      app_id: '10042',
      out_order_no: 'TEST_ORDER_100234',
      title: '高级开发者包月套餐',
      amount: 19.90,
      pay_type: 'wechat',
      sign: '23c21c78...'
    },
    responseExample: {
      code: 200,
      msg: 'success',
      data: {
        order_id: 'CP482910',
        out_order_no: 'TEST_ORDER_100234',
        amount: '19.90',
        real_amount: '19.88',
        pay_type: 'wechat',
        payment_url: 'https://www.3api.shop/pay/checkout?id=CP482910',
        expired_at: '2026-06-06T03:30:00.000Z'
      }
    }
  },
  queryOrder: {
    endpoint: '/api/order/query',
    method: 'POST',
    contentType: 'application/json',
    description: '同步页面跳转可能因为网络刷新或用户关闭页面而中断。建议商户服务端在发货或核销前调用此接口确认订单状态。',
    requestFields: [
      { name: 'app_id', type: 'string', required: true, desc: '开发者应用 App ID' },
      { name: 'out_order_no', type: 'string', required: true, desc: '商户本地订单号' },
      { name: 'sign', type: 'string', required: true, desc: '按签名规则计算出的请求签名' }
    ],
    responseFields: [
      { name: 'order_id', type: 'string', desc: 'CoderPay 订单号' },
      { name: 'out_order_no', type: 'string', desc: '商户本地订单号' },
      { name: 'status', type: 'string', desc: 'pending、success、expired、manual_review 等' },
      { name: 'amount', type: 'string', desc: '原始订单金额' },
      { name: 'real_amount', type: 'string', desc: '实际应付金额' },
      { name: 'pay_time', type: 'string | null', desc: '成功付款时间' }
    ],
    requestExample: {
      app_id: '10042',
      out_order_no: 'TEST_ORDER_100234',
      sign: 'f3b392b95c9ec281...'
    },
    responseExample: {
      code: 200,
      msg: 'success',
      data: {
        order_id: 'CP482910',
        out_order_no: 'TEST_ORDER_100234',
        status: 'success',
        amount: '19.90',
        real_amount: '19.88',
        pay_time: '2026-06-06 03:22:14'
      }
    }
  },
  webhook: {
    description: '当安装了 CoderPay App 的 Android 设备监听到微信/支付宝到账，并由云端匹配到商户订单后，CoderPay 会向您预留的 notify_url 发起异步 POST 签名回调。',
    retryPolicy: '失败会记录异常，可在控制台手动重试；自动重试队列将在后续版本提供。',
    responseFormat: '当您的业务系统验证签名无误，并充值或发货处理完毕后，请务必向该 HTTP Response 输出文本 "success" (全英文小写无空格)。一旦收到非 success 串（或超时），CP 会判定推送失败。失败会记录异常，可在控制台手动重试；自动重试队列将在后续版本提供。',
    payloadExample: {
      app_id: '10042',
      order_id: 'CP482910',
      out_order_no: 'TEST_ORDER_100234',
      pay_type: 'wechat',
      amount: '19.90',
      real_amount: '19.88',
      pay_time: '2026-06-06 03:22:14',
      sign: 'f3b392b95c9ec28120b601f0faedee10bf23bf0450682'
    }
  },
  signatureRules: {
    steps: [
      {
        num: 1,
        title: '参数字典排序',
        desc: '剔除 sign 字段，将待签名数据的所有参数名（Keys）按照 ASCII 自然顺序（字母 A-Z）升序排序。'
      },
      {
        num: 2,
        title: '组装待签字符串',
        desc: '将排序后的参数以 key1=value1&key2=value2 格式拼接为 Query String。'
      },
      {
        num: 3,
        title: '追加应用密钥',
        desc: '在待签名字符串末尾直接拼接 &key=YOUR_APP_SECRET 后缀（商户 App Secret 仅保留于后台，严禁泄漏）。'
      },
      {
        num: 4,
        title: '计算 HMAC-SHA256 哈希值',
        desc: '以 App Secret 为秘钥计算 HMAC-SHA256 值（结果转小写，即为最终的 sign 值）。'
      }
    ]
  },
  statusValues: [
    { value: 'pending', desc: '待支付或待监听到账' },
    { value: 'success', desc: '已确认收款并完成回调流程' },
    { value: 'expired', desc: '订单已过期，不再建议继续支付' },
    { value: 'manual_review', desc: '同金额冲突或异常场景，需人工核对' }
  ],
  errorCodes: [
    { code: 400, desc: '参数缺失、金额非法、签名错误或订单已存在' },
    { code: 401, desc: '未登录或认证失败' },
    { code: 402, desc: '技术服务余额不足，无法创建或确认订单' },
    { code: 404, desc: '应用、订单或收款资源不存在' },
    { code: 409, desc: '订单状态冲突，例如重复确认' },
    { code: 500, desc: '服务端异常，请稍后重试或联系支持' }
  ],
  faq: [
    {
      q: 'CoderPay 是什么？',
      a: 'CoderPay 是面向个人开发者和小团队的微信、支付宝个人收款自动化工具。开发者上传自己的收款码，用户付款后资金直接进入开发者账户；CoderPay 负责订单创建、收款码调度、Android 到账监听、订单匹配、手续费扣除和 Webhook 回调。'
    },
    {
      q: '用户付款的钱会经过 CoderPay 吗？',
      a: '普通开发者订单不会经过 CoderPay。资金直接进入开发者自己的微信或支付宝账户，CoderPay 不代收、不托管、不清算用户支付资金。平台订阅充值属于另一条链路，资金进入平台配置的收款账户。'
    },
    {
      q: '微信可以像支付宝一样一键唤起 App 完成支付吗？',
      a: '不能稳定做到。微信个人收款码没有公开稳定的浏览器直达个人转账能力。微信场景通常依赖二维码识别、微信内长按识别或保存二维码后扫一扫识别。'
    },
    {
      q: '支付宝可以一键唤起并自动带入金额吗？',
      a: '可以，但需要开发者配置支付宝 PID，也就是支付宝收款账户的 2088 开头用户 ID。只有二维码内容但没有 PID 时，通常只能唤起支付宝识别收款码，金额仍需用户核对或手动输入。'
    },
    {
      q: '为什么要安装 Android App？',
      a: 'CoderPay 的自动确认依赖微信、支付宝到账通知。Android App 安装在开发者自己的收款手机上，用于读取系统通知栏里的到账金额，并把到账事件安全上报到云端进行订单匹配。'
    },
    {
      q: '收款手机需要 root 吗？',
      a: '不需要。CoderPay 通过 Android 系统通知读取权限工作，不需要 root，也不需要修改微信或支付宝 App。'
    },
    {
      q: '收款手机必须一直在线吗？',
      a: '如果希望订单自动确认和自动回调，收款手机需要保持在线，并确保通知读取、微信/支付宝通知和后台保活正常。手机离线时，普通开发者订单可进入人工确认模式，由开发者核对到账后点击“我已收款”。'
    },
    {
      q: '订单未支付成功会扣手续费吗？',
      a: '不会。只有订单被自动匹配成功，或开发者在控制台人工确认已收款后，系统才会扣除每笔交易手续费。未支付、已过期或取消的订单不扣手续费。'
    },
    {
      q: '用户已经付款，但开发者没有收到回调，可能是什么原因？',
      a: '常见原因包括收款手机离线、通知读取权限未开启、微信/支付宝没有展示到账金额、系统通知被静默或折叠、用户在订单过期后付款、Webhook 接口超时或未返回 success、同金额存在多笔候选订单进入人工审核。'
    },
    {
      q: '支付二维码过期后用户仍然付款，怎么办？',
      a: '过期订单不会自动成功回调。开发者可以在控制台订单管理中找到对应订单，核对实际到账后点击“我已收款”，CoderPay 会标记订单成功并触发回调。'
    },
    {
      q: 'CoderPay 稳定吗？会不会掉单？',
      a: 'CoderPay 已实现设备心跳、到账事件幂等、订单金额微调、同金额冲突拦截、异常记录、人工确认和回调重试等机制，目标是降低漏单和误单风险。但个人收款码免签方案仍依赖手机通知和后台保活，建议上线前完成真机小额闭环测试。'
    },
    {
      q: '微信收到款后通知栏没有金额怎么办？',
      a: '需要开启微信收款到账语音提醒和通知详情，同时在手机系统通知设置中允许微信显示通知详情。如果通知只显示“收到一条消息”，CoderPay 无法解析到账金额。'
    },
    {
      q: '支持支付宝官方收钱码吗？',
      a: '支持。CoderPay 支持支付宝普通个人收款码和官方收钱码。为了获得更好的手机端支付体验，建议同时填写支付宝 PID。'
    },
    {
      q: '可以自定义支付页面吗？',
      a: '当前推荐使用 CoderPay 托管收银台。后续可以提供 JSON 模式让开发者自行渲染付款页，但仍建议由 CoderPay 返回真实应付金额、二维码能力、过期时间和订单状态，避免错误处理金额微调和过期状态。'
    },
    {
      q: '技术服务余额的用途是什么？',
      a: '技术服务余额仅用于套餐订阅和每笔交易手续费，不作为现金账户；异常退款、特殊结算或大客户处理需联系平台人工审核。'
    },
    {
      q: '固定金额收款码可以自动识别吗？',
      a: 'CoderPay 会尝试从二维码 payload 中确定性解析常见金额参数，例如 amount、money、total_amount、total_fee。若二维码内容不包含金额，系统不做 OCR 猜测，开发者需手动选择通用码或固定金额码并核对金额。'
    },
    {
      q: '使用个人微信或支付宝收款有风险吗？',
      a: '有平台规则风险。CoderPay 的技术链路与普通二维码收款一致，资金也直接进入开发者账户；但个人收款码用于商业化收款仍可能受到微信、支付宝账户规则、频率、金额、投诉和风控影响。'
    }
  ]
};
