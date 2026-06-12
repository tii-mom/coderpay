import { beforeEach, describe, expect, it, vi } from "vitest";
import { manuallyConfirmOrderPaid } from "@/lib/manual-order-confirm";

function makeStatement(db: any, query: string) {
  return {
    bind: (...values: unknown[]) => ({
      first: async () => db.first(query, values),
      all: async () => ({ results: [] }),
      run: async () => db.run(query, values),
    }),
    first: async () => db.first(query, []),
    all: async () => ({ results: [] }),
    run: async () => db.run(query, []),
  };
}

function makeDb(state: any) {
  return {
    prepare: vi.fn((query: string) => makeStatement(db, query)),
    batch: vi.fn(async (statements: Array<{ run: () => Promise<any> }>) => {
      const snapshot = structuredClone(state);
      const results = [];
      try {
        for (const statement of statements) {
          results.push(await statement.run());
        }
        return results;
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      }
    }),
    first: vi.fn(async (query: string, values: unknown[]) => {
      if (query.includes('FROM "Order"') && query.includes("JOIN App")) {
        const order = state.orders.find((item: any) => item.id === values[0]);
        if (!order) return null;
        const app = state.apps.find((item: any) => item.id === order.appId);
        return { ...order, userId: app?.userId };
      }
      return null;
    }),
    run: vi.fn(async (query: string, values: unknown[]) => {
      if (query.includes('UPDATE "Order"')) {
        const orderId = values[4];
        const order = state.orders.find((item: any) => item.id === orderId);
        if (!order || order.status === "success") return { meta: { changes: 0 } };
        Object.assign(order, {
          status: "success",
          confirmMode: "manual",
          payTime: values[0],
          webhookStatus: "unsent",
          manualConfirmedAt: values[1],
          manualConfirmedBy: values[2],
          manualConfirmNote: values[3],
        });
        return { meta: { changes: 1 } };
      }
      if (query.includes("UPDATE ExceptionItem")) {
        const orderId = values[0];
        let changes = 0;
        for (const item of state.exceptions) {
          if (item.refId === orderId && item.status === "active") {
            item.status = "resolved";
            changes += 1;
          }
        }
        return { meta: { changes } };
      }
      if (query.includes("UPDATE User")) {
        const user = state.users.find((item: any) => item.id === values[2]);
        user.feeBalance = values[0];
        return { meta: { changes: 1 } };
      }
      if (query.includes("INSERT INTO BillingRecord")) {
        state.billingRecords.push({
          id: values[0],
          type: "fee",
          amount: values[1],
          balance: values[2],
          description: values[3],
          createdAt: values[4],
          userId: values[5],
        });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }),
  };
}

let db: any;
let state: any;
let user: any;

function resetState() {
  user = {
    id: "user-1",
    email: "dev@example.com",
    feeBalance: 10,
    packageType: "pro",
    subscriptionExpiresAt: new Date("2026-07-01T00:00:00Z"),
  };
  state = {
    users: [user],
    apps: [{ id: "app-1", userId: "user-1" }],
    orders: [{
      id: "CP1",
      outOrderNo: "OUT1",
      title: "Test order",
      payType: "alipay",
      amount: 100,
      amountCents: 10000,
      realAmount: 100,
      realAmountCents: 10000,
      status: "pending",
      confirmMode: "manual",
      appId: "app-1",
    }],
    exceptions: [{ id: "ex-1", refId: "CP1", status: "active" }],
    billingRecords: [],
  };
  db = makeDb(state);
}

describe("manual order confirmation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("billing-1");
    resetState();
  });

  it("returns 404 for orders owned by another developer", async () => {
    state.apps[0].userId = "other-user";

    const result = await manuallyConfirmOrderPaid(db, "CP1", user);

    expect(result).toEqual({ ok: false, status: 404, error: "Order not found" });
  });

  it("returns 402 when fee balance is insufficient", async () => {
    user.feeBalance = 0;

    const result = await manuallyConfirmOrderPaid(db, "CP1", user);

    expect(result).toEqual({ ok: false, status: 402, error: "账户余额不足，无法人工确认该订单，请先充值余额。" });
    expect(state.orders[0].status).toBe("pending");
    expect(state.billingRecords).toHaveLength(0);
  });

  it("marks order success, charges fee, and resolves active exceptions", async () => {
    const now = new Date("2026-06-12T12:00:00.000Z");

    const result = await manuallyConfirmOrderPaid(db, "CP1", user, "已核对支付宝到账截图", now);

    expect(result).toEqual({ ok: true, orderId: "CP1", webhookStatus: "unsent" });
    expect(state.orders[0]).toMatchObject({
      status: "success",
      confirmMode: "manual",
      payTime: now.toISOString(),
      webhookStatus: "unsent",
      manualConfirmedAt: now.toISOString(),
      manualConfirmedBy: "dev@example.com",
      manualConfirmNote: "已核对支付宝到账截图",
    });
    expect(state.exceptions[0].status).toBe("resolved");
    expect(state.users[0].feeBalance).toBe(9.5);
    expect(state.billingRecords).toHaveLength(1);
    expect(state.billingRecords[0]).toMatchObject({
      id: "billing-1",
      type: "fee",
      amount: -0.5,
      balance: 9.5,
      userId: "user-1",
    });
  });

  it("rejects repeated confirmation without charging a second fee", async () => {
    state.orders[0].status = "success";

    const result = await manuallyConfirmOrderPaid(db, "CP1", user);

    expect(result).toEqual({ ok: false, status: 400, error: "订单已成功，不能重复人工确认" });
    expect(state.billingRecords).toHaveLength(0);
  });
});
