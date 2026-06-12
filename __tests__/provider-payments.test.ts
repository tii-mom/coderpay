import { describe, expect, it } from "vitest";
import { confirmProviderPayment, signProviderPayload, verifyProviderPayload } from "@/lib/provider-payments";

function makeDb(options: { failBatch?: boolean } = {}) {
  const state: any = {
    providerPayments: [] as any[],
    orders: [{
      id: "CP1",
      outOrderNo: "OUT1",
      payType: "alipay",
      amountCents: 1000,
      realAmountCents: 1000,
      status: "pending",
      expiresAt: "2099-01-01T00:00:00.000Z",
      userId: "u1",
    }],
    users: [{ id: "u1", feeBalance: 10, packageType: "trial", subscriptionExpiresAt: null }],
    events: [] as any[],
    billingRecords: [] as any[],
    exceptions: [] as any[],
  };
  const db = {
    state,
    batch: async (stmts: any[]) => {
      if (options.failBatch) throw new Error("batch failed");
      for (const stmt of stmts) await stmt.run();
      return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
    },
    prepare: (sql: string) => ({
      bind: (...values: any[]) => ({
        first: async () => {
          if (sql.includes("FROM ProviderPayment")) {
            const row = state.providerPayments.find((p: any) => p.providerId === values[0] && p.providerTradeNo === values[1]);
            if (!row) return null;
            const order = state.orders.find((o: any) => o.id === row.orderId);
            return { ...row, orderStatus: order?.status || null };
          }
          if (sql.includes('FROM "Order"') && sql.includes("JOIN App")) {
            return state.orders.find((o: any) => o.userId === values[0] && o.outOrderNo === values[1] && o.payType === values[2]) || null;
          }
          if (sql.includes("FROM User")) {
            return state.users.find((u: any) => u.id === values[0]) || null;
          }
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => {
          if (sql.includes('UPDATE "Order"')) {
            const order = state.orders.find((o: any) => o.id === values[1] && o.status === "pending");
            if (!order) return { success: true, meta: { changes: 0 } };
            order.status = "success";
            order.payTime = values[0];
            order.webhookStatus = "unsent";
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes("INSERT INTO ProviderPayment")) {
            state.providerPayments.push({
              id: values[0],
              providerId: values[1],
              orderId: values[2],
              providerTradeNo: values[3],
              outOrderNo: values[4],
              payType: values[5],
              amountCents: values[6],
              status: sql.includes("'amount_mismatch'") ? "amount_mismatch" : sql.includes("'unmatched'") ? "unmatched" : sql.includes("'ignored'") ? "ignored" : "success",
            });
          }
          if (sql.includes("INSERT INTO PaymentEvent")) state.events.push({ providerId: values[1], orderId: values[6] });
          if (sql.includes("UPDATE User")) {
            const user = state.users.find((u: any) => u.id === values[2]);
            user.feeBalance = values[0];
          }
          if (sql.includes("INSERT INTO BillingRecord")) state.billingRecords.push({ amount: values[1], balance: values[2] });
          if (sql.includes("INSERT INTO ExceptionItem")) state.exceptions.push({ type: values[1], title: values[2] });
          return { success: true, meta: { changes: 1 } };
        },
      }),
    }),
  };
  return db;
}

const provider = {
  id: "pp1",
  userId: "u1",
  name: "Provider",
};

describe("provider payments", () => {
  it("signs and verifies provider webhook payloads", async () => {
    const payload = { out_order_no: "OUT1", pay_type: "alipay", amount: "10.00", provider_trade_no: "T1" };
    const sign = await signProviderPayload(payload, "sec");
    expect(await verifyProviderPayload({ ...payload, sign }, "sec", sign)).toBe(true);
    expect(await verifyProviderPayload({ ...payload, amount: "11.00", sign }, "sec", sign)).toBe(false);
  });

  it("confirms a pending order once and records fee side effects", async () => {
    const db = makeDb();
    const result = await confirmProviderPayment(db as any, provider, {
      out_order_no: "OUT1",
      pay_type: "alipay",
      amount: "10.00",
      provider_trade_no: "T1",
      paid_at: "2026-06-12T10:00:00.000Z",
      sign: "unused",
    });

    expect(result).toMatchObject({ matched: true, orderId: "CP1", shouldTriggerWebhook: true });
    expect(db.state.orders[0].status).toBe("success");
    expect(db.state.providerPayments).toHaveLength(1);
    expect(db.state.events).toHaveLength(1);
    expect(db.state.billingRecords).toHaveLength(1);

    const duplicate = await confirmProviderPayment(db as any, provider, {
      out_order_no: "OUT1",
      pay_type: "alipay",
      amount: "10.00",
      provider_trade_no: "T1",
      sign: "unused",
    });
    expect(duplicate).toMatchObject({ duplicate: true, orderId: "CP1" });
    expect(db.state.billingRecords).toHaveLength(1);
  });

  it("does not confirm an order when amount mismatches", async () => {
    const db = makeDb();
    const result = await confirmProviderPayment(db as any, provider, {
      out_order_no: "OUT1",
      pay_type: "alipay",
      amount: "9.99",
      provider_trade_no: "T2",
      sign: "unused",
    });
    expect(result).toMatchObject({ matched: false, reason: "amount_mismatch", orderId: "CP1" });
    expect(db.state.orders[0].status).toBe("pending");
    expect(db.state.exceptions[0].title).toContain("金额不一致");
  });

  it("does not leave a half-success order when the atomic batch fails", async () => {
    const db = makeDb({ failBatch: true });
    await expect(confirmProviderPayment(db as any, provider, {
      out_order_no: "OUT1",
      pay_type: "alipay",
      amount: "10.00",
      provider_trade_no: "T3",
      sign: "unused",
    })).rejects.toThrow("batch failed");

    expect(db.state.orders[0].status).toBe("pending");
    expect(db.state.providerPayments).toHaveLength(0);
    expect(db.state.events).toHaveLength(0);
    expect(db.state.billingRecords).toHaveLength(0);
  });
}
);
