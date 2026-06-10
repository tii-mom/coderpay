export const FREE_ORDER_LIMIT = 10;
export const LOW_BALANCE_WARNING_YUAN = 10;

export type PaidPackageType = "pro" | "max";
export type PackageType = "free" | PaidPackageType;

export type BillingUser = {
  packageType?: string | null;
  subscriptionExpiresAt?: Date | string | null;
};

export const BILLING_PLANS: Record<PaidPackageType, {
  id: PaidPackageType;
  name: string;
  monthlyPriceCents: number;
  firstDiscountCents: number;
  feeRate: number;
  maxOrderAmountCents?: number;
}> = {
  pro: {
    id: "pro",
    name: "专业版",
    monthlyPriceCents: 6900,
    firstDiscountCents: 2000,
    feeRate: 0.005,
    maxOrderAmountCents: 1000000, // 10000 CNY in cents
  },
  max: {
    id: "max",
    name: "高级版",
    monthlyPriceCents: 19900,
    firstDiscountCents: 5000,
    feeRate: 0.002,
  },
};

export function normalizePackageType(value?: string | null): PackageType {
  if (value === "starter" || value === "plan-elite") return "pro";
  if (value === "plan-premium") return "max";
  if (value === "pro" || value === "max") return value;
  return "free";
}

export function isSubscriptionActive(user: BillingUser, now = new Date()) {
  const packageType = normalizePackageType(user.packageType);
  if (packageType === "free") return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > now.getTime();
}

export function getEffectivePackageType(user: BillingUser, now = new Date()): PackageType {
  const packageType = normalizePackageType(user.packageType);
  if (packageType === "free") return "free";
  return isSubscriptionActive(user, now) ? packageType : "free";
}

export function getFeeRate(user: BillingUser, now = new Date()) {
  const packageType = getEffectivePackageType(user, now);
  if (packageType === "free") return 0;
  return BILLING_PLANS[packageType].feeRate;
}

export function calculateFeeCents(amountCents: number, user: BillingUser, now = new Date()) {
  const rate = getFeeRate(user, now);
  return Math.ceil(amountCents * rate);
}

export function getSubscriptionChargeCents(planId: PaidPackageType, firstDiscountUsed: boolean) {
  const plan = BILLING_PLANS[planId];
  return firstDiscountUsed ? plan.monthlyPriceCents : plan.monthlyPriceCents - plan.firstDiscountCents;
}

export function getNextSubscriptionExpiresAt(currentExpiresAt?: Date | string | null, now = new Date()) {
  const base = currentExpiresAt && new Date(currentExpiresAt).getTime() > now.getTime()
    ? new Date(currentExpiresAt)
    : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function assertOrderAmountWithinPlanLimit(amountCents: number, packageType: string) {
  const normalized = normalizePackageType(packageType);
  if (normalized !== "free") {
    const plan = BILLING_PLANS[normalized];
    if (plan && plan.maxOrderAmountCents && amountCents > plan.maxOrderAmountCents) {
      throw new Error("订单金额超过当前套餐单笔上限");
    }
  }
}
