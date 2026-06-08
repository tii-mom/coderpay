import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordPaymentEvent } from "@/lib/payment-matching";

vi.mock("@/lib/webhook", () => ({
  triggerWebhook: vi.fn(() => Promise.resolve())
}));

const state: any = {};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentEvent: {
      findUnique: vi.fn(({ where }) => state.events.find((e: any) => e.notificationHash === where.notificationHash) || null),
      create: vi.fn(async ({ data }) => {
        const event = { id: `evt-${state.events.length + 1}`, createdAt: new Date(), ...data };
        state.events.push(event);
        return event;
      })
    },
    device: {
      findUnique: vi.fn(({ where }) => state.devices.find((d: any) => d.deviceCode === where.deviceCode || d.id === where.id) || null),
      update: vi.fn(({ where, data }) => {
        const device = state.devices.find((d: any) => d.id === where.id);
        Object.assign(device, data);
        return device;
      })
    },
    order: {
      findMany: vi.fn(({ where }) => state.orders.filter((o: any) =>
        o.app.userId === where.app.userId &&
        o.paymentCode.deviceId === where.paymentCode.deviceId &&
        o.payType === where.payType &&
        o.realAmountCents === where.realAmountCents &&
        o.status === where.status &&
        o.expiresAt > where.expiresAt.gt
      )),
      findFirst: vi.fn(({ where }) => state.orders.find((o: any) =>
        o.app.userId === where.app.userId &&
        o.paymentCode.deviceId === where.paymentCode.deviceId &&
        o.payType === where.payType &&
        o.realAmountCents === where.realAmountCents &&
        o.status === where.status &&
        o.expiresAt <= where.expiresAt.lte
      ) || null),
      updateMany: vi.fn(({ where, data }) => {
        const ids = where.id?.in || (where.id ? [where.id] : []);
        let count = 0;
        for (const order of state.orders) {
          if (ids.includes(order.id) && (!where.status || order.status === where.status)) {
            Object.assign(order, data);
            count += 1;
          }
        }
        return { count };
      })
    },
    user: {
      findUnique: vi.fn(({ where }) => state.users.find((u: any) => u.id === where.id) || null),
      update: vi.fn(({ where, data }) => {
        const user = state.users.find((u: any) => u.id === where.id);
        Object.assign(user, data);
        return user;
      })
    },
    billingRecord: {
      create: vi.fn(({ data }) => {
        state.billing.push(data);
        return data;
      })
    },
    exceptionItem: {
      create: vi.fn(({ data }) => {
        state.exceptions.push(data);
        return data;
      })
    }
  }
}));

function resetState() {
  const now = new Date("2026-06-08T10:00:00Z");
  state.users = [{ id: "user-1", feeBalance: 100, packageType: "pro", subscriptionExpiresAt: new Date("2026-07-08T10:00:00Z") }];
  state.devices = [
    { id: "dev-1", deviceCode: "device-1", userId: "user-1" },
    { id: "dev-2", deviceCode: "device-2", userId: "user-1" }
  ];
  state.orders = [];
  state.events = [];
  state.billing = [];
  state.exceptions = [];
  state.now = now;
}

function order(overrides: any) {
  return {
    id: overrides.id,
    app: { userId: "user-1" },
    paymentCode: { deviceId: overrides.deviceId },
    payType: "wechat",
    amount: 9.9,
    amountCents: 990,
    realAmount: 9.9,
    realAmountCents: 990,
    status: "pending",
    expiresAt: new Date("2026-06-08T10:05:00Z"),
    createdAt: new Date("2026-06-08T10:00:00Z"),
    ...overrides
  };
}

describe("payment event matching", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("moves same-device same-amount multiple pending orders to manual review", async () => {
    state.orders.push(order({ id: "CP1", deviceId: "dev-1" }), order({ id: "CP2", deviceId: "dev-1" }));

    const result = await recordPaymentEvent({
      deviceCode: "device-1",
      payType: "wechat",
      amount: "9.90",
      receivedAt: "2026-06-08T10:01:00Z",
      notificationHash: "hash-conflict"
    });

    expect(result.matchStatus).toBe("conflict");
    expect(state.orders.map((o: any) => o.status)).toEqual(["manual_review", "manual_review"]);
    expect(state.billing).toHaveLength(0);
    expect(state.exceptions[0].type).toBe("payment_conflict");
  });

  it("does not match same-amount orders assigned to another device", async () => {
    state.orders.push(order({ id: "CP-other-device", deviceId: "dev-2" }));

    const result = await recordPaymentEvent({
      deviceCode: "device-1",
      payType: "wechat",
      amount: "9.90",
      receivedAt: "2026-06-08T10:01:00Z",
      notificationHash: "hash-unmatched"
    });

    expect(result.matchStatus).toBe("unmatched");
    expect(state.orders[0].status).toBe("pending");
    expect(state.exceptions[0].type).toBe("payment_unmatched");
  });

  it("does not match expired orders or trigger billing", async () => {
    state.orders.push(order({
      id: "CP-expired",
      deviceId: "dev-1",
      expiresAt: new Date("2026-06-08T09:59:00Z")
    }));

    const result = await recordPaymentEvent({
      deviceCode: "device-1",
      payType: "wechat",
      amount: "9.90",
      receivedAt: "2026-06-08T10:01:00Z",
      notificationHash: "hash-expired"
    });

    expect(result.matchStatus).toBe("unmatched");
    expect(state.orders[0].status).toBe("pending");
    expect(state.billing).toHaveLength(0);
    expect(state.exceptions[0].type).toBe("expired_payment");
  });

  it("ignores duplicate notification hashes without repeating side effects", async () => {
    state.orders.push(order({ id: "CP1", deviceId: "dev-1" }));
    const payload = {
      deviceCode: "device-1",
      payType: "wechat",
      amount: "9.90",
      receivedAt: "2026-06-08T10:01:00Z",
      notificationHash: "hash-repeat"
    };

    const first = await recordPaymentEvent(payload);
    const second = await recordPaymentEvent(payload);

    expect(first.matchStatus).toBe("matched");
    expect(second.duplicate).toBe(true);
    expect(state.events).toHaveLength(1);
    expect(state.billing).toHaveLength(1);
    expect(state.billing[0].amount).toBe(-0.05);
  });
});
