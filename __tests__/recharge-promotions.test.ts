import { describe, expect, it } from "vitest";
import { getRechargePromotion, getRechargePromotionUpdate } from "@/lib/recharge-promotions";

describe("recharge promotions", () => {
  it("selects the highest matching recharge promotion tier", () => {
    expect(getRechargePromotion(1000)).toBeNull();
    expect(getRechargePromotion(49999)).toBeNull();
    expect(getRechargePromotion(50000)).toMatchObject({ packageType: "pro", months: 1 });
    expect(getRechargePromotion(199999)).toMatchObject({ packageType: "pro", months: 1 });
    expect(getRechargePromotion(200000)).toMatchObject({ packageType: "max", months: 1 });
    expect(getRechargePromotion(499999)).toMatchObject({ packageType: "max", months: 1 });
    expect(getRechargePromotion(500000)).toMatchObject({ packageType: "max", months: 3 });
    expect(getRechargePromotion(1000000)).toMatchObject({ packageType: "max", months: 3 });
  });

  it("starts a promotion subscription from now when there is no active subscription", () => {
    const now = new Date("2026-06-10T10:00:00Z");
    const promotion = getRechargePromotion(50000);

    const update = getRechargePromotionUpdate({ packageType: "free", subscriptionExpiresAt: null }, promotion!, now);

    expect(update?.packageType).toBe("pro");
    expect(update?.subscriptionExpiresAt.toISOString()).toBe("2026-07-10T10:00:00.000Z");
  });

  it("starts from now when the existing subscription is expired", () => {
    const now = new Date("2026-06-10T10:00:00Z");
    const promotion = getRechargePromotion(200000);

    const update = getRechargePromotionUpdate(
      { packageType: "pro", subscriptionExpiresAt: "2026-06-01T10:00:00.000Z" },
      promotion!,
      now
    );

    expect(update?.packageType).toBe("max");
    expect(update?.subscriptionExpiresAt.toISOString()).toBe("2026-07-10T10:00:00.000Z");
  });

  it("extends from the current expiry when the subscription is active", () => {
    const now = new Date("2026-06-10T10:00:00Z");
    const promotion = getRechargePromotion(500000);

    const update = getRechargePromotionUpdate(
      { packageType: "max", subscriptionExpiresAt: "2026-07-15T10:00:00.000Z" },
      promotion!,
      now
    );

    expect(update?.packageType).toBe("max");
    expect(update?.subscriptionExpiresAt.toISOString()).toBe("2026-10-15T10:00:00.000Z");
  });

  it("does not downgrade an active max subscription for a pro promotion", () => {
    const now = new Date("2026-06-10T10:00:00Z");
    const promotion = getRechargePromotion(50000);

    const update = getRechargePromotionUpdate(
      { packageType: "max", subscriptionExpiresAt: "2026-07-10T10:00:00.000Z" },
      promotion!,
      now
    );

    expect(update).toBeNull();
  });

  it("does not treat an expired max subscription as active for a pro promotion", () => {
    const now = new Date("2026-06-10T10:00:00Z");
    const promotion = getRechargePromotion(50000);

    const update = getRechargePromotionUpdate(
      { packageType: "max", subscriptionExpiresAt: "2026-06-01T10:00:00.000Z" },
      promotion!,
      now
    );

    expect(update?.packageType).toBe("pro");
    expect(update?.subscriptionExpiresAt.toISOString()).toBe("2026-07-10T10:00:00.000Z");
  });
});
