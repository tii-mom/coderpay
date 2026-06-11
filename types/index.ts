export interface App {
  id: string;
  name: string;
  appId: string;
  appSecret?: string;
  notifyUrl: string;
  returnUrl: string;
  feedbackUrl: string;
  expireMinutes: number;
  signType: 'HMAC-SHA256' | 'MD5';
  createdAt: string;
}

export interface PaymentCode {
  id: string;
  type: 'wechat' | 'alipay';
  codeType: 'fixed' | 'any';
  amount: number; // 0 if any amount
  imageUrl: string;
  deviceId: string;
  status: 'active' | 'inactive';
  todayOrders: number;
  lastUsedAt: string | null;
  createdAt: string;
  alipayUserId?: string | null;
  qrPayload?: string | null;
  directPayUrl?: string | null;
  directPayMode?: 'alipay_to_account' | 'alipay_qr' | 'wechat_qr' | 'image_fallback' | null;
}

export interface Device {
  id: string;
  deviceCode: string;
  name: string;
  online: boolean;
  lastHeartbeat: string;
  androidVersion: string;
  appVersion: string;
  wechatListener: 'running' | 'stopped';
  alipayListener: 'running' | 'stopped';
  notificationPermission: boolean;
  batteryOptimization: 'optimized' | 'ignored';
  todayEvents: number;
  todayMatchedOrders: number;
  weight: number;
  todayLimit: number;
  status: 'active' | 'inactive';
}

export type OrderStatus = 'new' | 'pending' | 'paid' | 'success' | 'expired' | 'failed' | 'manual_review';

export interface Order {
  id: string;
  outOrderNo: string;
  appId: string;
  title: string;
  payType: 'wechat' | 'alipay';
  amount: number;
  realAmount: number;
  amountCents?: number;
  realAmountCents?: number;
  status: OrderStatus;
  confirmMode?: 'auto' | 'manual';
  createdAt: string;
  expiresAt?: string | null;
  payTime: string | null;
  manualConfirmedAt?: string | null;
  manualConfirmedBy?: string | null;
  manualConfirmNote?: string | null;
  webhookStatus: 'unsent' | 'success' | 'failed' | 'retrying';
  paymentCodeId: string | null;
}

export interface PaymentEvent {
  id: string;
  deviceId: string;
  payType: 'wechat' | 'alipay';
  amount: number;
  receivedAt: string;
  matchStatus: 'matched' | 'unmatched' | 'conflict' | 'ignored' | 'manual';
  matchedOrderId: string | null;
  confidence: number;
}

export interface WebhookLog {
  id: string;
  orderId: string;
  url: string;
  requestTime: string;
  statusCode: number;
  responseSummary: string;
  retryCount: number;
  result: 'success' | 'failed';
  requestBody: string;
  responseBody: string;
}

export interface ExceptionItem {
  id: string;
  type: 'payment_unmatched' | 'payment_conflict' | 'expired_payment' | 'webhook_failed' | 'device_offline' | 'balance_insufficient';
  title: string;
  description: string;
  createdAt: string;
  refId: string;
  status: 'active' | 'resolved' | 'ignored';
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  duration: string;
  techServiceRate: number; // e.g. 0.01 (1%)
  features: string[];
  subscriptionExpiresAt?: string | null;
  freeOrderUsed?: number;
  firstProDiscountUsed?: boolean;
  firstMaxDiscountUsed?: boolean;
}

export interface BillingRecord {
  id: string;
  type: 'charge' | 'fee' | 'subscription' | 'refund' | 'promotion' | 'referral_reward' | 'admin_adjust' | 'admin_subscription';
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

export interface ReferralSummary {
  inviteCode: string;
  referralLink: string;
  activeDirectCount: number;
  tier: 'level1' | 'level2' | 'level3' | 'level4';
  directRateBps: number;
  indirectRateBps: number;
  totalRewardCents: number;
  rewardCount: number;
  recentRewards: Array<{
    id: string;
    rechargeOrderId: string;
    invitedUserId: string;
    depth: number;
    tier: string;
    rateBps: number;
    baseAmountCents: number;
    rewardCents: number;
    status: string;
    createdAt: string;
    creditedAt: string | null;
  }>;
}

export interface RechargeOrder {
  id: string;
  amount: number;
  realAmount: number;
  payType: 'wechat' | 'alipay';
  status: 'pending' | 'success' | 'expired' | 'failed';
  displayStatus?: 'pending' | 'success' | 'expired' | 'failed';
  rechargeUserEmail?: string;
  createdAt: string;
  expiresAt: string;
  payTime: string | null;
}

export interface CoderPayState {
  apps: App[];
  paymentCodes: PaymentCode[];
  devices: Device[];
  orders: Order[];
  events: PaymentEvent[];
  webhookLogs: WebhookLog[];
  exceptions: ExceptionItem[];
  billingRecords: BillingRecord[];
  rechargeOrders: RechargeOrder[];
  feeBalance: number;
  currentAppId: string;
  currentPlanId: string;
  packageType: string;
  freeOrderUsed: number;
  subscriptionExpiresAt: string | null;
  firstProDiscountUsed: boolean;
  firstMaxDiscountUsed: boolean;
  referralSummary: ReferralSummary | null;
  isLoggedIn: boolean;
  isAuthChecked: boolean;
  userEmail: string;
}
