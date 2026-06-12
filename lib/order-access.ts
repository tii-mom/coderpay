import { getEffectivePackageType } from "@/lib/billing-plans";

export type OrderAccessUser = {
  id: string;
  feeBalance: number;
  freeOrderUsed?: number;
  packageType?: string | null;
  subscriptionExpiresAt?: Date | string | null;
};

export function assertCanCreateOrder(user: OrderAccessUser, now = new Date()) {
  if (user.feeBalance <= 0) {
    throw Object.assign(new Error("账户余额已低于或等于 0 元，请充值后继续使用 CoderPay 服务"), { status: 402 });
  }

  return { mode: getEffectivePackageType(user, now), shouldIncrementFreeOrder: false };
}
