import { describe, expect, it } from "vitest";
import { calculateFeeCents, getSubscriptionChargeCents, assertOrderAmountWithinPlanLimit } from "@/lib/billing-plans";
import { assertCanCreateOrder } from "@/lib/order-access";

describe("billing plans", () => {
  it("allows exactly 10 free order creations while balance is positive", () => {
    expect(assertCanCreateOrder({ id: "u1", feeBalance: 1, freeOrderUsed: 9, packageType: "free" })).toEqual({
      mode: "free",
      shouldIncrementFreeOrder: true,
    });
    expect(() => assertCanCreateOrder({ id: "u1", feeBalance: 1, freeOrderUsed: 10, packageType: "free" })).toThrow(/免费调试额度/);
  });

  it("blocks order creation when balance is zero even before checking plan", () => {
    expect(() => assertCanCreateOrder({
      id: "u1",
      feeBalance: 0,
      freeOrderUsed: 0,
      packageType: "pro",
      subscriptionExpiresAt: new Date(Date.now() + 86400000),
    })).toThrow(/余额/);
  });

  it("calculates first subscription discounts and paid plan fee rates", () => {
    expect(getSubscriptionChargeCents("pro", false)).toBe(4900);
    expect(getSubscriptionChargeCents("pro", true)).toBe(6900);
    expect(getSubscriptionChargeCents("max", false)).toBe(14900);
    expect(getSubscriptionChargeCents("max", true)).toBe(19900);

    const activePro = { packageType: "pro", subscriptionExpiresAt: new Date(Date.now() + 86400000) };
    const activeMax = { packageType: "max", subscriptionExpiresAt: new Date(Date.now() + 86400000) };
    expect(calculateFeeCents(10000, activePro)).toBe(50);
    expect(calculateFeeCents(10000, activeMax)).toBe(20);

    // Minimum fee tests
    expect(calculateFeeCents(1, activePro)).toBe(1);
    expect(calculateFeeCents(1, activeMax)).toBe(1);
    expect(calculateFeeCents(1, { packageType: "free" })).toBe(0);
  });

  it("supports a subscription-free trial plan with 1.98% fee and 0.10 minimum", () => {
    expect(calculateFeeCents(100, { packageType: "trial" })).toBe(10);
    expect(calculateFeeCents(10000, { packageType: "trial" })).toBe(198);
    expect(assertCanCreateOrder({ id: "u1", feeBalance: 1, freeOrderUsed: 10, packageType: "trial" })).toEqual({
      mode: "subscription",
      shouldIncrementFreeOrder: false,
    });
  });

  it("enforces order amount limit checks by package type", () => {
    // Pro limit is 10,000.00 CNY (1,000,000 cents)
    expect(() => assertOrderAmountWithinPlanLimit(1000000, "pro")).not.toThrow();
    expect(() => assertOrderAmountWithinPlanLimit(1000001, "pro")).toThrow("订单金额超过当前套餐单笔上限");

    // Max limit is unlimited
    expect(() => assertOrderAmountWithinPlanLimit(1000000000, "max")).not.toThrow();

    // Free limit is not enforced here
    expect(() => assertOrderAmountWithinPlanLimit(1000000000, "free")).not.toThrow();
  });
});
