// Shared API Specifications for CoderPay Docs

export const API_SPEC = {
  createOrder: {
    endpoint: '/api/order/create',
    method: 'POST',
    contentType: 'application/json',
    description: '在您的自建商城/打赏主站中，当买家确定下单并点击【支付】瞬间，您的 Web 服务器需向 CP 宿主系统发出此 POST 参数请求。CP 将实时分派订单价、挂机锁定个人收款通道，并返回一个收银付款台定向 URL（payment_url）。您应将买家重定向导流向该地址扫码。',
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
    description: '同步页面跳转可能由于意外的网络刷新而被阻断。我们强烈提倡在您收发货完成前，由您的服务器或者前端以 POST 形式，调拨此状态查询接口以确认交易核销情况。',
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
    description: '一旦安装了 CoderPay App 的 Android 设备监听到微信/支付宝收款到达，CP 核心云将在 500ms 内触发对您预留 notify_url 的异步 POST 签名回调网络推送。',
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
  }
};
