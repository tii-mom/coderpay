import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectRechargePaymentChannel } from "@/lib/recharge";

const state: any = {};

vi.mock("@/lib/d1-binding", () => ({
  resolveEnvVar: (name: string) => name === "PLATFORM_RECHARGE_USER_EMAIL" ? "platform@example.com" : "",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(({ where }) => state.users.find((u: any) => u.email === where.email || u.id === where.id) || null),
    },
    paymentCode: {
      findMany: vi.fn(({ where }) => state.codes.filter((c: any) =>
        c.userId === where.userId &&
        c.type === where.type &&
        c.status === where.status
      )),
    },
    rechargeOrder: {
      count: vi.fn(() => 0),
      findMany: vi.fn(() => []),
    },
  },
}));

function resetState() {
  state.users = [{ id: "platform-1", email: "platform@example.com" }];
  state.codes = [];
}

function paymentCode(overrides: any = {}) {
  const now = new Date("2026-06-11T08:00:00Z");
  return {
    id: overrides.id ?? "code-1",
    type: overrides.type ?? "alipay",
    codeType: overrides.codeType ?? "any",
    amount: overrides.amount ?? 0,
    status: "active",
    userId: "platform-1",
    deviceId: "dev-1",
    device: {
      id: "dev-1",
      online: true,
      status: "active",
      lastHeartbeat: overrides.lastHeartbeat ?? new Date(now.getTime() - 60 * 1000),
      wechatListener: "running",
      alipayListener: "running",
      notificationPermission: true,
      batteryOptimization: "ignored",
      ...overrides.device,
    },
    ...overrides,
  };
}

describe("platform recharge channel selection", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("does not use a heartbeat-only device when the payment listener is stopped", async () => {
    state.codes.push(paymentCode({
      device: { alipayListener: "stopped" },
    }));

    await expect(selectRechargePaymentChannel({
      payType: "alipay",
      amountCents: 100,
      now: new Date("2026-06-11T08:00:00Z"),
    })).rejects.toMatchObject({
      message: "No online platform recharge Watcher device available",
      status: 503,
    });
  });

  it("requires notification permission and battery exemption before selecting a recharge code", async () => {
    state.codes.push(
      paymentCode({ id: "no-notification", device: { notificationPermission: false } }),
      paymentCode({ id: "battery-optimized", device: { batteryOptimization: "optimized" } }),
    );

    await expect(selectRechargePaymentChannel({
      payType: "alipay",
      amountCents: 100,
      now: new Date("2026-06-11T08:00:00Z"),
    })).rejects.toMatchObject({ status: 503 });
  });

  it("selects an active recent device whose listener chain is ready", async () => {
    state.codes.push(paymentCode({ id: "ready-code" }));

    const result = await selectRechargePaymentChannel({
      payType: "alipay",
      amountCents: 100,
      now: new Date("2026-06-11T08:00:00Z"),
    });

    expect(result.selectedCode.id).toBe("ready-code");
    expect(result.realAmountCents).toBe(100);
  });
});
