import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/order/query/route";
import { signPayload } from "@/lib/webhook";

const apps = [
  { id: "app-row-a", appId: "app_a", appSecret: "secret-a", signType: "HMAC-SHA256" },
  { id: "app-row-b", appId: "app_b", appSecret: "secret-b", signType: "HMAC-SHA256" },
];

const orders = [
  {
    id: "order-a",
    outOrderNo: "out-a",
    status: "success",
    confirmMode: "auto",
    manualConfirmedAt: null,
    manualConfirmedBy: null,
    manualConfirmNote: null,
    amount: 10,
    realAmount: 10,
    amountCents: 1000,
    realAmountCents: 1000,
    payTime: new Date("2026-06-12T08:00:00.000Z"),
    appId: "app-row-a",
  },
  {
    id: "order-b",
    outOrderNo: "out-b",
    status: "pending",
    confirmMode: "auto",
    manualConfirmedAt: null,
    manualConfirmedBy: null,
    manualConfirmNote: null,
    amount: 20,
    realAmount: 20,
    amountCents: 2000,
    realAmountCents: 2000,
    payTime: null,
    appId: "app-row-b",
  },
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    app: {
      findUnique: vi.fn(({ where }) => apps.find((app) => app.appId === where.appId) || null),
    },
    order: {
      findFirst: vi.fn(({ where }) => orders.find((order) => {
        if (where.id) return order.id === where.id && order.appId === where.appId;
        return order.appId === where.appId && order.outOrderNo === where.outOrderNo;
      }) || null),
    },
  },
}));

function signedBody(body: Record<string, unknown>, appSecret = "secret-a") {
  return {
    ...body,
    sign: signPayload(body, appSecret, "HMAC-SHA256"),
  };
}

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/order/query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("merchant order query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an app to query its own order by order_id", async () => {
    const res = await POST(request(signedBody({ app_id: "app_a", order_id: "order-a" })));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.order_id).toBe("order-a");
    expect(json.data.out_order_no).toBe("out-a");
  });

  it("does not allow app A to query app B order_id", async () => {
    const res = await POST(request(signedBody({ app_id: "app_a", order_id: "order-b" })));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Order not found" });
  });

  it("continues to query by out_order_no within the app", async () => {
    const res = await POST(request(signedBody({ app_id: "app_a", out_order_no: "out-a" })));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.order_id).toBe("order-a");
  });
});
