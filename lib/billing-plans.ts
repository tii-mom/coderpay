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
}> = {
  pro: {
    id: "pro",
    name: "专业版",
    monthlyPriceCents: 6900,
    firstDiscountCents: 3000,
    feeRate: 0.005,
  },
  max: {
    id: "max",
    name: "至尊免服务费版",
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
