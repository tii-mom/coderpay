export const LOW_BALANCE_WARNING_YUAN = 10;

export type PaidPackageType = "pro" | "max";
export type PackageType = "trial" | PaidPackageType;

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
  minFeeCents: number;
  maxOrderAmountCents?: number;
}> = {
  pro: {
    id: "pro",
    name: "专业版",
    monthlyPriceCents: 6900,
    firstDiscountCents: 2000,
    feeRate: 0.005,
    minFeeCents: 1,
    maxOrderAmountCents: 1000000, // 10000 CNY in cents
  },
  max: {
    id: "max",
    name: "高级版",
    monthlyPriceCents: 19900,
    firstDiscountCents: 5000,
    feeRate: 0.002,
    minFeeCents: 1,
  },
};

export const TRIAL_PLAN = {
  id: "trial" as const,
  name: "体验版",
  monthlyPriceCents: 0,
  feeRate: 0.0198,
  minFeeCents: 10,
};

export function normalizePackageType(value?: string | null): PackageType {
  if (value === "starter" || value === "plan-elite") return "pro";
  if (value === "plan-premium") return "max";
  if (value === "free" || value === "trial") return "trial";
  if (value === "pro" || value === "max") return value;
  return "trial";
}

export function isSubscriptionActive(user: BillingUser, now = new Date()) {
  const packageType = normalizePackageType(user.packageType);
  if (packageType === "trial") return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > now.getTime();
}

export function getEffectivePackageType(user: BillingUser, now = new Date()): PackageType {
  const packageType = normalizePackageType(user.packageType);
  if (packageType === "trial") return "trial";
  return isSubscriptionActive(user, now) ? packageType : "trial";
}

export function getFeeRate(user: BillingUser, now = new Date()) {
  const packageType = getEffectivePackageType(user, now);
  if (packageType === "trial") return TRIAL_PLAN.feeRate;
  return BILLING_PLANS[packageType].feeRate;
}

export function calculateFeeCents(amountCents: number, user: BillingUser, now = new Date()) {
  const packageType = getEffectivePackageType(user, now);
  const plan = packageType === "trial" ? TRIAL_PLAN : BILLING_PLANS[packageType];
  return Math.max(plan.minFeeCents, Math.ceil(Math.round(amountCents * plan.feeRate * 1e6) / 1e6));
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
  if (normalized !== "trial") {
    const plan = BILLING_PLANS[normalized];
    if (plan && plan.maxOrderAmountCents && amountCents > plan.maxOrderAmountCents) {
      throw new Error("订单金额超过当前套餐单笔上限");
    }
  }
}
