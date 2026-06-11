import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const now = new Date("2026-06-11T08:10:00.000Z");

vi.useFakeTimers();
vi.setSystemTime(now);

vi.mock("@/lib/mobile-auth", () => ({
  getMobileDevice: () => ({
    device: {
      id: "dev-platform",
      userId: "platform-user",
      user: {
        email: "platform@example.com",
        feeBalance: 0,
        packageType: "free",
        freeOrderUsed: 0,
        subscriptionExpiresAt: null,
      },
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(() => []),
    },
    rechargeOrder: {
      findMany: vi.fn(({ where }) => {
        if (where.userId === "platform-user") return [];
        if (where.paymentCode?.userId === "platform-user") {
          return [
            {
              id: "RC50411154",
              userId: "developer-user",
              amountCents: 10,
              realAmountCents: 10,
              payType: "alipay",
              status: "pending",
              createdAt: new Date("2026-06-11T07:49:16.699Z"),
              expiresAt: new Date("2026-06-11T07:59:16.699Z"),
              payTime: null,
              paymentCodeId: "code-platform-alipay",
              user: { email: "1@qq.com" },
              paymentCode: { id: "code-platform-alipay" },
            },
          ];
        }
        return [];
      }),
    },
    paymentCode: {
      findMany: vi.fn(() => []),
    },
    device: {
      findMany: vi.fn(() => []),
    },
    billingRecord: {
      findMany: vi.fn(() => []),
    },
    exceptionItem: {
      findMany: vi.fn(() => []),
    },
  },
}));

describe("mobile console", () => {
  it("returns incoming platform recharge orders collected by the current device user", async () => {
    const { GET } = await import("@/app/api/mobile/console/route");
    const res = await GET(new NextRequest("http://localhost/api/mobile/console"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rechargeOrders).toEqual([]);
    expect(data.incomingRechargeOrders).toHaveLength(1);
    expect(data.incomingRechargeOrders[0]).toMatchObject({
      id: "RC50411154",
      rechargeUserEmail: "1@qq.com",
      payType: "alipay",
      status: "pending",
      displayStatus: "expired",
      paymentCodeId: "code-platform-alipay",
    });
  });
});
