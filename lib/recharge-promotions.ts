import { BILLING_PLANS, getEffectivePackageType, PaidPackageType, BillingUser } from "@/lib/billing-plans";

export type RechargePromotion = {
  packageType: PaidPackageType;
  months: number;
  title: string;
};

export type RechargePromotionUpdate = {
  packageType: PaidPackageType;
  subscriptionExpiresAt: Date;
};

const MONTH_MS_FALLBACK = 31 * 24 * 60 * 60 * 1000;

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setMonth(next.getMonth() + months);

  // JS Date rolls dates like Jan 31 + 1 month into March. Clamp to the last day
  // of the target month so subscription extensions stay calendar-month based.
  if (next.getDate() !== originalDay) {
    next.setDate(0);
  }
  if (Number.isNaN(next.getTime())) {
    return new Date(date.getTime() + months * MONTH_MS_FALLBACK);
  }
  return next;
}

export function getRechargePromotion(amountCents: number): RechargePromotion | null {
  if (amountCents >= 500000) {
    return {
      packageType: "max",
      months: 3,
      title: "充值满 ¥5000 赠送 3 个月高级版订阅",
    };
  }
  if (amountCents >= 200000) {
    return {
      packageType: "max",
      months: 1,
      title: "充值满 ¥2000 赠送 1 个月高级版订阅",
    };
  }
  if (amountCents >= 50000) {
    return {
      packageType: "pro",
      months: 1,
      title: "充值满 ¥500 赠送 1 个月专业版订阅",
    };
  }
  return null;
}

export function getRechargePromotionDescription(promotion: RechargePromotion) {
  const planName = BILLING_PLANS[promotion.packageType].name;
  return `充值活动赠送: 赠送 ${promotion.months} 个月${planName}订阅`;
}

export function getRechargePromotionUpdate(
  user: BillingUser,
  promotion: RechargePromotion,
  now = new Date()
): RechargePromotionUpdate | null {
  const effectivePackageType = getEffectivePackageType(user, now);
  if (effectivePackageType === "max" && promotion.packageType === "pro") {
    return null;
  }

  const packageType = effectivePackageType === "max" || promotion.packageType === "max"
    ? "max"
    : promotion.packageType;

  const currentExpiresAt = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
  const base = currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;
  return {
    packageType,
    subscriptionExpiresAt: addMonths(base, promotion.months),
  };
}
