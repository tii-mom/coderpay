import { FREE_ORDER_LIMIT, getEffectivePackageType } from "@/lib/billing-plans";

export type OrderAccessUser = {
  id: string;
  feeBalance: number;
  freeOrderUsed: number;
  packageType?: string | null;
  subscriptionExpiresAt?: Date | string | null;
};

export function assertCanCreateOrder(user: OrderAccessUser, now = new Date()) {
  if (user.feeBalance <= 0) {
    throw Object.assign(new Error("账户余额已低于或等于 0 元，请充值后继续使用 CoderPay 服务"), { status: 402 });
  }

  if (getEffectivePackageType(user, now) !== "free") {
    return { mode: "subscription" as const, shouldIncrementFreeOrder: false };
  }

  if (user.freeOrderUsed < FREE_ORDER_LIMIT) {
    return { mode: "free" as const, shouldIncrementFreeOrder: true };
  }

  throw Object.assign(new Error("免费调试额度已用完，请开通订阅后继续创建订单"), { status: 403 });
}
