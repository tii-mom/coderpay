import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mobile/billing/recharge/route";

const mocks = vi.hoisted(() => ({
  auth: {
    device: {
      userId: "user-1",
    },
  } as any,
  rechargeOrder: null as any,
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileDevice: () => mocks.auth,
}));

vi.mock("@/lib/recharge", () => ({
  createRechargeOrder: vi.fn(() => mocks.rechargeOrder),
}));

vi.mock("@/lib/recharge-promotions", () => ({
  getRechargePromotion: () => null,
}));

vi.mock("@/lib/d1-binding", () => ({
  resolveEnvVar: (name: string) => name === "NEXT_PUBLIC_APP_URL" ? "https://www.3api.shop" : "",
}));

describe("mobile recharge", () => {
  beforeEach(() => {
    mocks.auth = {
      device: {
        userId: "user-1",
      },
    };
    mocks.rechargeOrder = {
      id: "RC123456789012",
      amount: 50,
      realAmount: 50.01,
      amountCents: 5000,
      realAmountCents: 5001,
      payType: "alipay",
      expiresAt: new Date("2026-06-13T00:10:00.000Z"),
      paymentCode: {
        id: "code-1",
        type: "alipay",
        directPayUrl: "alipays://platformapi/startapp",
        directPayMode: "alipay_to_account",
        qrPayload: "https://qr.alipay.com/example",
        alipayUserId: "2088",
      },
      requiresManualConfirm: false,
    };
  });

  it("returns a checkout payment url for Android to continue payment", async () => {
    const res = await POST(new NextRequest("http://localhost/api/mobile/billing/recharge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 50, payType: "alipay" }),
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.payment_url).toBe("https://www.3api.shop/pay/checkout?id=RC123456789012");
    expect(body.data.payment_code.directPayUrl).toBe("alipays://platformapi/startapp");
  });
});
