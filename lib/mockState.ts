'use client';

import { App, PaymentCode, Device, Order, OrderStatus, PaymentEvent, WebhookLog, ExceptionItem, Plan, BillingRecord } from '@/types';

export interface CoderPayState {
  apps: App[];
  paymentCodes: PaymentCode[];
  devices: Device[];
  orders: Order[];
  events: PaymentEvent[];
  webhookLogs: WebhookLog[];
  exceptions: ExceptionItem[];
  billingRecords: BillingRecord[];
  feeBalance: number;
  currentAppId: string; // Active app filter in dashboard
  currentPlanId: string;
  isLoggedIn: boolean;
  userEmail: string;
}

const DEFAULT_APPS: App[] = [
  {
    id: 'app-1',
    name: '独立开发者客栈',
    appId: '10042',
    appSecret: 'e29e9cfb23ca41b2b8c9b36edef2',
    notifyUrl: 'https://api.indie-developer.quest/v1/payment/callback',
    returnUrl: 'https://indie-developer.quest/pay/success',
    feedbackUrl: 'https://indie-developer.quest/feedback',
    expireMinutes: 5,
    signType: 'HMAC-SHA256',
    createdAt: '2026-05-15 10:24:00',
  },
  {
    id: 'app-2',
    name: '网盘自动化工具插件',
    appId: '10043',
    appSecret: 'a1a8c88fdceb485fb0b04bd1fb9c',
    notifyUrl: 'https://api.pan-tool.com/webhook/pay',
    returnUrl: 'https://pan-tool.com/member',
    feedbackUrl: 'https://pan-tool.com/help',
    expireMinutes: 10,
    signType: 'MD5',
    createdAt: '2026-05-20 14:12:30',
  }
];

const DEFAULT_DEVICES: Device[] = [
  {
    id: 'dev-1',
    name: 'Xiaomi MI 11 (CP Watcher Pro)',
    online: true,
    lastHeartbeat: '2026-06-05 16:59:22',
    androidVersion: '13.0',
    appVersion: 'v2.4.2',
    wechatListener: 'running',
    alipayListener: 'running',
    notificationPermission: true,
    batteryOptimization: 'ignored',
    todayEvents: 12,
    todayMatchedOrders: 10,
    weight: 10,
    todayLimit: 5000,
    status: 'active'
  },
  {
    id: 'dev-2',
    name: 'Redmi Note 10 (Spare)',
    online: false,
    lastHeartbeat: '2026-06-04 12:00:15',
    androidVersion: '12.0',
    appVersion: 'v2.4.0',
    wechatListener: 'stopped',
    alipayListener: 'running',
    notificationPermission: true,
    batteryOptimization: 'optimized',
    todayEvents: 1,
    todayMatchedOrders: 0,
    weight: 5,
    todayLimit: 2000,
    status: 'active'
  }
];

const DEFAULT_CODES: PaymentCode[] = [
  {
    id: 'code-1',
    type: 'wechat',
    codeType: 'any',
    amount: 0,
    imageUrl: 'https://picsum.photos/seed/wxqrcode/400/400',
    deviceId: 'dev-1',
    status: 'active',
    todayOrders: 4,
    lastUsedAt: '2026-06-05 16:45:10',
    createdAt: '2026-05-15 11:30:00'
  },
  {
    id: 'code-2',
    type: 'alipay',
    codeType: 'any',
    amount: 0,
    imageUrl: 'https://picsum.photos/seed/alipayqrcode/400/400',
    deviceId: 'dev-1',
    status: 'active',
    todayOrders: 5,
    lastUsedAt: '2026-06-05 16:32:00',
    createdAt: '2026-05-15 11:31:00'
  },
  {
    id: 'code-3',
    type: 'wechat',
    codeType: 'fixed',
    amount: 9.90,
    imageUrl: 'https://picsum.photos/seed/wx99/400/400',
    deviceId: 'dev-1',
    status: 'active',
    todayOrders: 1,
    lastUsedAt: '2026-06-05 15:12:00',
    createdAt: '2026-05-16 09:20:00'
  },
  {
    id: 'code-4',
    type: 'alipay',
    codeType: 'fixed',
    amount: 29.90,
    imageUrl: 'https://picsum.photos/seed/ali299/400/400',
    deviceId: 'dev-2',
    status: 'active',
    todayOrders: 0,
    lastUsedAt: null,
    createdAt: '2026-05-21 15:40:00'
  }
];

const DEFAULT_ORDERS: Order[] = [
  {
    id: 'CP100824',
    outOrderNo: 'OUT_98248381',
    appId: '10042',
    title: '1个月VIP技术服务',
    payType: 'wechat',
    amount: 9.90,
    realAmount: 9.90,
    status: 'success',
    createdAt: '2026-06-05 16:44:02',
    payTime: '2026-06-05 16:45:12',
    webhookStatus: 'success',
    paymentCodeId: 'code-3'
  },
  {
    id: 'CP100825',
    outOrderNo: 'OUT_98248382',
    appId: '10043',
    title: '文件搜索插件高级版',
    payType: 'alipay',
    amount: 29.90,
    realAmount: 29.90,
    status: 'success',
    createdAt: '2026-06-05 16:30:15',
    payTime: '2026-06-05 16:32:01',
    webhookStatus: 'success',
    paymentCodeId: 'code-2'
  },
  {
    id: 'CP100826',
    outOrderNo: 'OUT_98248383',
    appId: '10042',
    title: '网盘助手激活码',
    payType: 'wechat',
    amount: 15.00,
    realAmount: 14.98, // Multi-order amount random suffix for matching
    status: 'pending',
    createdAt: '2026-06-05 16:55:00',
    payTime: null,
    webhookStatus: 'unsent',
    paymentCodeId: 'code-1'
  },
  {
    id: 'CP100827',
    outOrderNo: 'OUT_98248384',
    appId: '10042',
    title: '1个月VIP技术服务',
    payType: 'wechat',
    amount: 9.90,
    realAmount: 9.90,
    status: 'expired',
    createdAt: '2026-06-05 16:00:00',
    payTime: null,
    webhookStatus: 'unsent',
    paymentCodeId: 'code-3'
  },
  {
    id: 'CP100828',
    outOrderNo: 'OUT_98248385',
    appId: '10043',
    title: 'SaaS部署脚手架',
    payType: 'alipay',
    amount: 99.00,
    realAmount: 99.00,
    status: 'manual_review',
    createdAt: '2026-06-05 15:45:00',
    payTime: null,
    webhookStatus: 'failed',
    paymentCodeId: 'code-2'
  }
];

const DEFAULT_EVENTS: PaymentEvent[] = [
  {
    id: 'evt-1',
    deviceId: 'dev-1',
    payType: 'wechat',
    amount: 9.90,
    receivedAt: '2026-06-05 16:45:10',
    matchStatus: 'matched',
    matchedOrderId: 'CP100824',
    confidence: 100
  },
  {
    id: 'evt-2',
    deviceId: 'dev-1',
    payType: 'alipay',
    amount: 29.90,
    receivedAt: '2026-06-05 16:32:00',
    matchStatus: 'matched',
    matchedOrderId: 'CP100825',
    confidence: 100
  },
  {
    id: 'evt-3',
    deviceId: 'dev-1',
    payType: 'wechat',
    amount: 10.00,
    receivedAt: '2026-06-05 16:58:30',
    matchStatus: 'unmatched',
    matchedOrderId: null,
    confidence: 0
  },
  {
    id: 'evt-4',
    deviceId: 'dev-1',
    payType: 'wechat',
    amount: 9.90,
    receivedAt: '2026-06-05 16:10:00',
    matchStatus: 'unmatched', // Arrived on an expired order
    matchedOrderId: null,
    confidence: 30
  }
];

const DEFAULT_EXCEPTIONS: ExceptionItem[] = [
  {
    id: 'exc-1',
    type: 'payment_unmatched',
    title: '微信收款 10.00 元未匹配到订单',
    description: '设备: Xiaomi MI 11，收到收款通知10.00元，但系统内没有该金额的待支付订单。',
    createdAt: '2026-06-05 16:58:30',
    refId: 'evt-3',
    status: 'active'
  },
  {
    id: 'exc-2',
    type: 'expired_payment',
    title: '订单已过期后到账风险',
    description: '收到微信收款9.90元，疑似对应已过期订单 CP100827，请人工核对并手动补单。',
    createdAt: '2026-06-05 16:10:00',
    refId: 'CP100827',
    status: 'active'
  },
  {
    id: 'exc-3',
    type: 'webhook_failed',
    title: '应用 [网盘自动化工具插件] 回调商户超时失败',
    description: '订单 CP100828 支付回调已重试 3 次均超时响应，商户接收端地址可能有异常。',
    createdAt: '2026-06-05 15:50:30',
    refId: 'CP100828',
    status: 'active'
  },
  {
    id: 'exc-4',
    type: 'device_offline',
    title: '监听设备 [Redmi Note 10] 离线警报',
    description: '该备用监控设备已超过 21 小时未与 CP 云端同步心跳，可能会丢失到账通知！',
    createdAt: '2026-06-04 12:30:00',
    refId: 'dev-2',
    status: 'active'
  }
];

const DEFAULT_WEBHOOK_LOGS: WebhookLog[] = [
  {
    id: 'log-1',
    orderId: 'CP100824',
    url: 'https://api.indie-developer.quest/v1/payment/callback',
    requestTime: '2026-06-05 16:45:13',
    statusCode: 200,
    responseSummary: 'success',
    retryCount: 0,
    result: 'success',
    requestBody: JSON.stringify({
      orderId: 'CP100824',
      outOrderNo: 'OUT_98248381',
      amount: 9.90,
      realAmount: 9.90,
      payType: 'wechat',
      status: 'success',
      payTime: '2026-06-05 16:45:12',
      sign: 'ad982b6c72e90f23cb41b2b8c9b36edef223cb2bc82ef3bc104ad9e'
    }, null, 2),
    responseBody: 'success'
  },
  {
    id: 'log-2',
    orderId: 'CP100825',
    url: 'https://api.pan-tool.com/webhook/pay',
    requestTime: '2026-06-05 16:32:02',
    statusCode: 200,
    responseSummary: 'ok',
    retryCount: 0,
    result: 'success',
    requestBody: JSON.stringify({
      orderId: 'CP100825',
      outOrderNo: 'OUT_98248382',
      amount: 29.90,
      realAmount: 29.90,
      payType: 'alipay',
      status: 'success',
      payTime: '2026-06-05 16:32:01',
      sign: 'fb88a8c88fdceb485fb0b04bd1fb9c4a'
    }, null, 2),
    responseBody: 'ok'
  },
  {
    id: 'log-3',
    orderId: 'CP100828',
    url: 'https://api.pan-tool.com/webhook/pay',
    requestTime: '2026-06-05 15:45:10',
    statusCode: 504,
    responseSummary: 'Gateway Timeout',
    retryCount: 3,
    result: 'failed',
    requestBody: JSON.stringify({
      orderId: 'CP100828',
      outOrderNo: 'OUT_98248385',
      amount: 99.00,
      realAmount: 99.00,
      payType: 'alipay',
      status: 'success',
      payTime: '2026-06-05 15:45:00',
      sign: '5a2b3c2e1fde0cbae2391bde4cfa9e3d'
    }, null, 2),
    responseBody: '<html><head><title>504 Gateway Time-out</title></head><body><center><h1>504 Gateway Time-out</h1></center><hr><center>nginx</center></body></html>'
  }
];

const DEFAULT_BILLING: BillingRecord[] = [
  {
    id: 'bill-1',
    type: 'charge',
    amount: 100.00,
    balance: 100.00,
    description: '通过支付宝充值技术服务费',
    createdAt: '2026-05-15 10:00:00'
  },
  {
    id: 'bill-2',
    type: 'fee',
    amount: -0.099, // 1% fee on 9.90
    balance: 99.901,
    description: '技术服务费扣除: 订单 CP100824, 金额 9.90 元',
    createdAt: '2026-06-05 16:45:13'
  },
  {
    id: 'bill-3',
    type: 'fee',
    amount: -0.299, // 1% fee on 29.90
    balance: 99.602,
    description: '技术服务费扣除: 订单 CP100825, 金额 29.90 元',
    createdAt: '2026-06-05 16:32:02'
  }
];

const STORAGE_KEY = 'coder_pay_app_state';

export function getInitialState(): CoderPayState {
  if (typeof window === 'undefined') {
    return {
      apps: DEFAULT_APPS,
      paymentCodes: DEFAULT_CODES,
      devices: DEFAULT_DEVICES,
      orders: DEFAULT_ORDERS,
      events: DEFAULT_EVENTS,
      webhookLogs: DEFAULT_WEBHOOK_LOGS,
      exceptions: DEFAULT_EXCEPTIONS,
      billingRecords: DEFAULT_BILLING,
      feeBalance: 99.602,
      currentAppId: 'all',
      currentPlanId: 'plan-basic',
      isLoggedIn: true,
      userEmail: 'yudeyou0118@gmail.com',
    };
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing stored storage state', e);
    }
  }

  // Fallback / Initial seed
  const initialState: CoderPayState = {
    apps: DEFAULT_APPS,
    paymentCodes: DEFAULT_CODES,
    devices: DEFAULT_DEVICES,
    orders: DEFAULT_ORDERS,
    events: DEFAULT_EVENTS,
    webhookLogs: DEFAULT_WEBHOOK_LOGS,
    exceptions: DEFAULT_EXCEPTIONS,
    billingRecords: DEFAULT_BILLING,
    feeBalance: 99.602,
    currentAppId: 'all',
    currentPlanId: 'plan-basic',
    isLoggedIn: true,
    userEmail: 'yudeyou0118@gmail.com',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
  return initialState;
}

export function saveState(state: CoderPayState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Dispatch a custom event so other mounted client components can capture the state change instantly
    window.dispatchEvent(new CustomEvent('coder-pay-state-changed', { detail: state }));
  }
}

// Global API mutations to interact with the mock DB
export const mockDb = {
  getState: getInitialState,
  saveState: saveState,

  login: (email: string) => {
    const s = getInitialState();
    s.isLoggedIn = true;
    s.userEmail = email;
    saveState(s);
    return s;
  },

  logout: () => {
    const s = getInitialState();
    s.isLoggedIn = false;
    saveState(s);
    return s;
  },

  setAppIdFilter: (appId: string) => {
    const s = getInitialState();
    s.currentAppId = appId;
    saveState(s);
    return s;
  },

  // App management
  createApp: (app: Omit<App, 'id' | 'createdAt' | 'appId' | 'appSecret'>) => {
    const s = getInitialState();
    const newId = `app-${Date.now()}`;
    const appId = Math.floor(10000 + Math.random() * 90000).toString();
    const appSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    const newApp: App = {
      ...app,
      id: newId,
      appId,
      appSecret,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    s.apps.push(newApp);
    saveState(s);
    return newApp;
  },

  updateApp: (id: string, updates: Partial<App>) => {
    const s = getInitialState();
    s.apps = s.apps.map(a => a.id === id ? { ...a, ...updates } : a);
    saveState(s);
    return s.apps.find(a => a.id === id);
  },

  resetAppSecret: (id: string) => {
    const s = getInitialState();
    const appSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    s.apps = s.apps.map(a => a.id === id ? { ...a, appSecret } : a);
    saveState(s);
    return appSecret;
  },

  deleteApp: (id: string) => {
    const s = getInitialState();
    s.apps = s.apps.filter(a => a.id !== id);
    saveState(s);
  },

  // Payment Code Management
  createPaymentCode: (code: Omit<PaymentCode, 'id' | 'todayOrders' | 'lastUsedAt' | 'createdAt'>) => {
    const s = getInitialState();
    const newCode: PaymentCode = {
      ...code,
      id: `code-${Date.now()}`,
      todayOrders: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    s.paymentCodes.push(newCode);
    saveState(s);
    return newCode;
  },

  updatePaymentCode: (id: string, updates: Partial<PaymentCode>) => {
    const s = getInitialState();
    s.paymentCodes = s.paymentCodes.map(c => c.id === id ? { ...c, ...updates } : c);
    saveState(s);
    return s.paymentCodes.find(c => c.id === id);
  },

  deletePaymentCode: (id: string) => {
    const s = getInitialState();
    s.paymentCodes = s.paymentCodes.filter(c => c.id !== id);
    saveState(s);
  },

  // Device Management
  createDevice: (name: string, todayLimit = 5000) => {
    const s = getInitialState();
    const newDev: Device = {
      id: `dev-${Date.now()}`,
      name,
      online: true,
      lastHeartbeat: new Date().toISOString().slice(0, 19).replace('T', ' '),
      androidVersion: '13.0',
      appVersion: 'v2.4.2',
      wechatListener: 'running',
      alipayListener: 'running',
      notificationPermission: true,
      batteryOptimization: 'ignored',
      todayEvents: 0,
      todayMatchedOrders: 0,
      weight: 10,
      todayLimit,
      status: 'active'
    };
    s.devices.push(newDev);
    saveState(s);
    return newDev;
  },

  updateDevice: (id: string, updates: Partial<Device>) => {
    const s = getInitialState();
    s.devices = s.devices.map(d => d.id === id ? { ...d, ...updates } : d);
    saveState(s);
    return s.devices.find(d => d.id === id);
  },

  deleteDevice: (id: string) => {
    const s = getInitialState();
    s.devices = s.devices.filter(d => d.id !== id);
    saveState(s);
  },

  toggleDeviceStatus: (id: string) => {
    const s = getInitialState();
    s.devices = s.devices.map(d => d.id === id ? { ...d, status: d.status === 'active' ? 'inactive' : 'active' } : d);
    saveState(s);
  },

  // Order Management
  createOrder: (order: Omit<Order, 'id' | 'createdAt' | 'payTime' | 'webhookStatus'>) => {
    const s = getInitialState();
    const id = `CP${Math.floor(100000 + Math.random() * 900000)}`;

    // Calculate a unique realAmount with random slight decimals to distinguish payments for the same fixed pricing (e.g. 9.90 vs 9.89 or 9.91)
    let realAmount = order.amount;
    const isConflictAmount = s.orders.some(o => o.status === 'new' || o.status === 'pending');
    if (isConflictAmount && order.amount > 0.5) {
      // Pick a random unique offset between -0.05 and +0.05
      const offsets = [-0.02, -0.01, 0.01, 0.02, -0.03, 0.03];
      const selectedOffset = offsets[Math.floor(Math.random() * offsets.length)];
      realAmount = Number((order.amount + selectedOffset).toFixed(2));
    }

    const newOrder: Order = {
      ...order,
      id,
      realAmount,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      payTime: null,
      webhookStatus: 'unsent',
    };

    s.orders.push(newOrder);
    saveState(s);
    return newOrder;
  },

  updateOrderStatus: (id: string, status: OrderStatus, payTime: string | null = null) => {
    const s = getInitialState();
    s.orders = s.orders.map(o => {
      if (o.id === id) {
        const actualPayTime = payTime || (status === 'success' || status === 'paid' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null);
        
        // Fee calculation if transitioning to success
        let addedBilling = false;
        if ((status === 'success' || status === 'paid') && o.status !== 'success' && o.status !== 'paid') {
          const feeRate = 0.01; // 1%
          const fee = Number((o.amount * feeRate).toFixed(3));
          s.feeBalance = Number((s.feeBalance - fee).toFixed(3));
          s.billingRecords.unshift({
            id: `bill-${Date.now()}`,
            type: 'fee',
            amount: -fee,
            balance: s.feeBalance,
            description: `技术服务费扣除: 订单 ${o.id}, 金额 ${o.amount} 元`,
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          });
          addedBilling = true;
        }

        return { 
          ...o, 
          status, 
          payTime: actualPayTime, 
          webhookStatus: status === 'success' ? 'success' : o.webhookStatus 
        };
      }
      return o;
    });

    saveState(s);
    return s.orders.find(o => o.id === id);
  },

  retryWebhook: (orderId: string) => {
    const s = getInitialState();
    const order = s.orders.find(o => o.id === orderId);
    if (!order) return;

    // Simulate sending log
    const app = s.apps.find(a => a.appId === order.appId);
    const url = app ? app.notifyUrl : 'https://api.merchant.com/pay-notify';
    const requestTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Create log success
    const newLog: WebhookLog = {
      id: `log-${Date.now()}`,
      orderId,
      url,
      requestTime,
      statusCode: 200,
      responseSummary: 'success',
      retryCount: 1,
      result: 'success',
      requestBody: JSON.stringify({
        orderId,
        outOrderNo: order.outOrderNo,
        amount: order.amount,
        realAmount: order.realAmount,
        payType: order.payType,
        status: 'success',
        payTime: order.payTime || requestTime,
        sign: '2bc82ef3bc104ad9e8dbad982b6c72e90f23cb41b2b8c9b36edef'
      }, null, 2),
      responseBody: 'success'
    };

    s.orders = s.orders.map(o => o.id === orderId ? { ...o, webhookStatus: 'success' } : o);
    s.webhookLogs.unshift(newLog);

    // If there was an active webhook_failed exception, resolve it
    s.exceptions = s.exceptions.map(exc => 
      (exc.type === 'webhook_failed' && exc.refId === orderId) 
        ? { ...exc, status: 'resolved' as const } 
        : exc
    );

    saveState(s);
    return newLog;
  },

  // Arriving Notifications Simulator (CP Watcher Event Input!)
  uploadPaymentEvent: (deviceId: string, payType: 'wechat' | 'alipay', amount: number) => {
    const s = getInitialState();
    const eventId = `evt-${Date.now()}`;
    const receivedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Match criteria: Is there a pending/new and matching payType and realAmount order?
    // Let's search inside active orders
    const matchingOrder = s.orders.find(o => 
      (o.status === 'pending' || o.status === 'new') && 
      o.payType === payType && 
      Math.abs(o.realAmount - amount) < 0.001
    );

    let matchStatus: PaymentEvent['matchStatus'] = 'unmatched';
    let matchedOrderId: string | null = null;
    let confidence = 0;

    if (matchingOrder) {
      matchStatus = 'matched';
      matchedOrderId = matchingOrder.id;
      confidence = 100;

      // Update Order Status to success
      const fee = Number((matchingOrder.amount * 0.01).toFixed(3));
      s.feeBalance = Number((s.feeBalance - fee).toFixed(3));
      
      s.orders = s.orders.map(o => o.id === matchingOrder.id ? {
        ...o,
        status: 'success',
        payTime: receivedAt,
        webhookStatus: 'success',
      } : o);

      // Create Webhook log
      const app = s.apps.find(a => a.appId === matchingOrder.appId);
      const url = app ? app.notifyUrl : 'https://api.merchant.com/notify';
      s.webhookLogs.unshift({
        id: `log-${Date.now()}`,
        orderId: matchingOrder.id,
        url,
        requestTime: receivedAt,
        statusCode: 200,
        responseSummary: 'success',
        retryCount: 0,
        result: 'success',
        requestBody: JSON.stringify({
          orderId: matchingOrder.id,
          outOrderNo: matchingOrder.outOrderNo,
          amount: matchingOrder.amount,
          realAmount: matchingOrder.realAmount,
          payType,
          status: 'success',
          payTime: receivedAt,
          sign: 'ad982b6c72e90f23cb41b2b8'
        }, null, 2),
        responseBody: 'success'
      });

      // Deduct billing fee
      s.billingRecords.unshift({
        id: `bill-${Date.now()}`,
        type: 'fee',
        amount: -fee,
        balance: s.feeBalance,
        description: `技术服务费扣除: 订单 ${matchingOrder.id}, 金额 ${matchingOrder.amount} 元`,
        createdAt: receivedAt,
      });

      // Update payment code stats if matching code found
      if (matchingOrder.paymentCodeId) {
        s.paymentCodes = s.paymentCodes.map(c => c.id === matchingOrder.paymentCodeId ? {
          ...c,
          todayOrders: c.todayOrders + 1,
          lastUsedAt: receivedAt
        } : c);
      }
    } else {
      // Unmatched order! Create exception item
      const excId = `exc-${Date.now()}`;
      s.exceptions.unshift({
        id: excId,
        type: 'payment_unmatched',
        title: `${payType === 'wechat' ? '微信' : '支付宝'}收到 ${amount.toFixed(2)} 元未匹配到订单`,
        description: `设备收到到账通知 ${amount.toFixed(2)} 元，但系统云端未找到对应待付款订单，疑似用户手动付款或多订单撞额。`,
        createdAt: receivedAt,
        refId: eventId,
        status: 'active'
      });
    }

    // Append PaymentEvent
    const newEvent: PaymentEvent = {
      id: eventId,
      deviceId,
      payType,
      amount,
      receivedAt,
      matchStatus,
      matchedOrderId,
      confidence
    };
    s.events.unshift(newEvent);

    // Increment device total stats
    s.devices = s.devices.map(d => d.id === deviceId ? {
      ...d,
      todayEvents: d.todayEvents + 1,
      todayMatchedOrders: d.todayMatchedOrders + (matchingOrder ? 1 : 0),
      online: true,
      lastHeartbeat: receivedAt
    } : d);

    saveState(s);
    return newEvent;
  },

  // Manual Match / Force success
  manuallyMatchOrderAndEvent: (orderId: string, eventId: string) => {
    const s = getInitialState();
    const order = s.orders.find(o => o.id === orderId);
    const event = s.events.find(e => e.id === eventId);
    if (!order || !event) return;

    const receivedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Link Order & Event
    s.orders = s.orders.map(o => o.id === orderId ? {
      ...o,
      status: 'success',
      payTime: event.receivedAt,
      webhookStatus: 'success',
    } : o);

    s.events = s.events.map(e => e.id === eventId ? {
      ...e,
      matchStatus: 'matched',
      matchedOrderId: orderId,
      confidence: 100
    } : e);

    // Deduct technical fee
    const fee = Number((order.amount * 0.01).toFixed(3));
    s.feeBalance = Number((s.feeBalance - fee).toFixed(3));
    s.billingRecords.unshift({
      id: `bill-${Date.now()}`,
      type: 'fee',
      amount: -fee,
      balance: s.feeBalance,
      description: `手动匹配成功 - 技术服务费扣除: 订单 ${order.id}, 金额 ${order.amount} 元`,
      createdAt: receivedAt,
    });

    // Resolve exception
    s.exceptions = s.exceptions.map(exc => 
      (exc.refId === eventId || exc.refId === orderId) 
        ? { ...exc, status: 'resolved' as const } 
        : exc
    );

    // Send Webhook simulation
    const app = s.apps.find(a => a.appId === order.appId);
    s.webhookLogs.unshift({
      id: `log-${Date.now()}`,
      orderId,
      url: app ? app.notifyUrl : 'https://api.merchant.com/notify',
      requestTime: receivedAt,
      statusCode: 200,
      responseSummary: 'success',
      retryCount: 0,
      result: 'success',
      requestBody: JSON.stringify({
        orderId,
        outOrderNo: order.outOrderNo,
        amount: order.amount,
        realAmount: order.realAmount,
        payType: order.payType,
        status: 'success',
        payTime: event.receivedAt,
        sign: 'manual_signed_ab93da2847fb'
      }, null, 2),
      responseBody: 'success'
    });

    saveState(s);
  },

  // Manual Confirm Success
  manuallyConfirmPaid: (orderId: string) => {
    const s = getInitialState();
    const order = s.orders.find(o => o.id === orderId);
    if (!order) return;

    const receivedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    s.orders = s.orders.map(o => o.id === orderId ? {
      ...o,
      status: 'success',
      payTime: receivedAt,
      webhookStatus: 'success'
    } : o);

    // Fee
    const fee = Number((order.amount * 0.01).toFixed(3));
    s.feeBalance = Number((s.feeBalance - fee).toFixed(3));
    s.billingRecords.unshift({
      id: `bill-${Date.now()}`,
      type: 'fee',
      amount: -fee,
      balance: s.feeBalance,
      description: `技术服务费扣除 (管理员手动确认已付款): 订单 ${order.id}, 金额 ${order.amount} 元`,
      createdAt: receivedAt,
    });

    // Notify Merchant URL
    const app = s.apps.find(a => a.appId === order.appId);
    s.webhookLogs.unshift({
      id: `log-${Date.now()}`,
      orderId,
      url: app ? app.notifyUrl : 'https://api.merchant.com/notify',
      requestTime: receivedAt,
      statusCode: 200,
      responseSummary: 'success (manual fee)',
      retryCount: 0,
      result: 'success',
      requestBody: JSON.stringify({
        orderId,
        outOrderNo: order.outOrderNo,
        amount: order.amount,
        realAmount: order.realAmount,
        payType: order.payType,
        status: 'success',
        payTime: receivedAt,
        sign: 'manual_confirmed_8c9d3e8a71'
      }, null, 2),
      responseBody: 'success'
    });

    // Resolve active exception if exists
    s.exceptions = s.exceptions.map(exc => 
      (exc.refId === orderId) 
        ? { ...exc, status: 'resolved' as const } 
        : exc
    );

    saveState(s);
  },

  // Ignore / Resolve Exception
  createException: (type: ExceptionItem['type'], title: string, description: string, refId: string) => {
    const s = getInitialState();
    const newExc: ExceptionItem = {
      id: `exc-${Date.now()}`,
      type,
      title,
      description,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      refId,
      status: 'active'
    };
    s.exceptions.unshift(newExc);
    saveState(s);
    return s;
  },

  resolveException: (id: string) => {
    const s = getInitialState();
    s.exceptions = s.exceptions.map(exc => exc.id === id ? { ...exc, status: 'resolved' as const } : exc);
    saveState(s);
  },

  ignoreException: (id: string) => {
    const s = getInitialState();
    s.exceptions = s.exceptions.map(exc => exc.id === id ? { ...exc, status: 'ignored' as const } : exc);
    saveState(s);
  },

  // Billing Top Up charges
  rechargeFees: (amount: number) => {
    const s = getInitialState();
    s.feeBalance = Number((s.feeBalance + amount).toFixed(3));
    s.billingRecords.unshift({
      id: `bill-${Date.now()}`,
      type: 'charge',
      amount,
      balance: s.feeBalance,
      description: `成功充值技术服务费 ¥${amount.toFixed(2)} 元`,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    saveState(s);
    return s;
  },

  // Change Plan
  changePlan: (planId: string) => {
    const s = getInitialState();
    s.currentPlanId = planId;
    saveState(s);
  }
};
