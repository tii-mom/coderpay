import { describe, expect, it } from "vitest";
import { calculateFeeCents, getSubscriptionChargeCents } from "@/lib/billing-plans";
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
    expect(getSubscriptionChargeCents("pro", false)).toBe(3900);
    expect(getSubscriptionChargeCents("pro", true)).toBe(6900);
    expect(getSubscriptionChargeCents("max", false)).toBe(14900);
    expect(getSubscriptionChargeCents("max", true)).toBe(19900);

    const activePro = { packageType: "pro", subscriptionExpiresAt: new Date(Date.now() + 86400000) };
    const activeMax = { packageType: "max", subscriptionExpiresAt: new Date(Date.now() + 86400000) };
    expect(calculateFeeCents(10000, activePro)).toBe(50);
    expect(calculateFeeCents(10000, activeMax)).toBe(20);
  });
});
