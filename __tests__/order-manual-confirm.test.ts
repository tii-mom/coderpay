import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let sessionUser: any = null;
const state: any = {};

vi.mock("@/lib/auth", () => ({
  getSessionUser: () => sessionUser,
}));

const triggerWebhook: any = vi.fn(() => Promise.resolve());
vi.mock("@/lib/webhook", () => ({
  triggerWebhook: (orderId: string) => triggerWebhook(orderId),
}));

const tx: any = {
  order: {
    updateMany: vi.fn(async ({ where, data }) => {
      const order = state.orders.find((o: any) => o.id === where.id);
      if (!order || order.status === "success") return { count: 0 };
      Object.assign(order, data);
      return { count: 1 };
    }),
    findUnique: vi.fn(async ({ where }) => state.orders.find((o: any) => o.id === where.id) || null),
  },
  user: {
    update: vi.fn(async ({ where, data }) => {
      const user = state.users.find((u: any) => u.id === where.id);
      Object.assign(user, data);
      return user;
    }),
  },
  billingRecord: {
    create: vi.fn(async ({ data }) => {
      state.billingRecords.push(data);
      return data;
    }),
  },
  exceptionItem: {
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(async ({ where }) => state.orders.find((o: any) => o.id === where.id) || null),
    },
    $transaction: vi.fn(async (fn) => fn(tx)),
  },
}));

function req(body: unknown = {}) {
  return new NextRequest("http://localhost/api/orders/CP1/manual-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id = "CP1") {
  return { params: Promise.resolve({ id }) };
}

function resetState() {
  vi.clearAllMocks();
  sessionUser = {
    id: "user-1",
    email: "dev@example.com",
    feeBalance: 10,
    packageType: "pro",
    subscriptionExpiresAt: new Date("2026-07-01T00:00:00Z"),
  };
  state.users = [sessionUser];
  state.billingRecords = [];
  state.orders = [
    {
      id: "CP1",
      outOrderNo: "OUT1",
      title: "Test order",
      payType: "wechat",
      amount: 100,
      amountCents: 10000,
      realAmount: 100,
      realAmountCents: 10000,
      status: "pending",
      confirmMode: "manual",
      app: { userId: "user-1" },
    },
  ];
}

describe("manual order confirmation", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns 401 when not logged in", async () => {
    sessionUser = null;
    const { POST } = await import("@/app/api/orders/[id]/manual-confirm/route");

    const res = await POST(req(), params());

    expect(res.status).toBe(401);
  });

  it("returns 404 for orders owned by another developer", async () => {
    state.orders[0].app.userId = "other-user";
    const { POST } = await import("@/app/api/orders/[id]/manual-confirm/route");

    const res = await POST(req(), params());

    expect(res.status).toBe(404);
  });

  it("returns 402 when fee balance is insufficient", async () => {
    sessionUser.feeBalance = 0;
    const { POST } = await import("@/app/api/orders/[id]/manual-confirm/route");

    const res = await POST(req(), params());
    const data = await res.json();

    expect(res.status).toBe(402);
    expect(data.error).toBe("账户余额不足，无法人工确认该订单，请先充值余额。");
    expect(state.orders[0].status).toBe("pending");
    expect(state.billingRecords).toHaveLength(0);
  });

  it("marks order success, charges fee, writes manual audit fields, and triggers webhook", async () => {
    const { POST } = await import("@/app/api/orders/[id]/manual-confirm/route");

    const res = await POST(req({ note: "已核对支付宝到账截图" }), params());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ status: "success", orderId: "CP1", webhookStatus: "unsent" });
    expect(state.orders[0]).toMatchObject({
      status: "success",
      confirmMode: "manual",
      webhookStatus: "unsent",
      manualConfirmedBy: "dev@example.com",
      manualConfirmNote: "已核对支付宝到账截图",
    });
    expect(state.orders[0].manualConfirmedAt).toBeInstanceOf(Date);
    expect(state.billingRecords).toHaveLength(1);
    expect(state.billingRecords[0]).toMatchObject({ type: "fee", amount: -0.5, userId: "user-1" });
    expect(triggerWebhook).toHaveBeenCalledWith("CP1");
  });

  it("rejects repeated confirmation without charging a second fee", async () => {
    state.orders[0].status = "success";
    const { POST } = await import("@/app/api/orders/[id]/manual-confirm/route");

    const res = await POST(req(), params());

    expect(res.status).toBe(400);
    expect(state.billingRecords).toHaveLength(0);
    expect(triggerWebhook).not.toHaveBeenCalled();
  });
});
