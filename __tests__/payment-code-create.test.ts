import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  sessionEmail: "user@example.com" as string | null,
  auth: {
    device: {
      id: "dev-1",
      userId: "user-1",
    },
  } as any,
  inserts: [] as any[],
}));

function statement(sql: string) {
  const state = { sql, values: [] as any[] };
  return {
    bind: (...values: any[]) => {
      state.values = values;
      return {
        first: async () => {
          if (sql.includes("FROM User")) return { id: "user-1", email: "user@example.com" };
          if (sql.includes("FROM Device")) return { id: "dev-1", userId: "user-1" };
          if (sql.includes("FROM PaymentCode")) return { id: "code-1" };
          return null;
        },
        run: async () => {
          if (sql.includes("INSERT INTO PaymentCode")) mocks.inserts.push(state.values);
          return { success: true };
        },
        all: async () => ({ results: [] }),
      };
    },
  };
}

vi.mock("@/lib/session", () => ({
  readSessionEmail: () => Promise.resolve(mocks.sessionEmail),
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileDevice: () => mocks.auth,
}));

vi.mock("@/lib/d1-binding", () => ({
  resolveD1: () => ({ prepare: statement }),
}));

function request(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  type: "wechat",
  codeType: "any",
  amount: 19.9,
  imageUrl: "data:image/png;base64,abc",
  deviceId: "dev-1",
  qrPayload: "wxp://f2f19znp",
};

describe("payment code creation validation", () => {
  beforeEach(() => {
    mocks.sessionEmail = "user@example.com";
    mocks.auth = { device: { id: "dev-1", userId: "user-1" } };
    mocks.inserts = [];
  });

  it("stores any-amount web payment codes with amount zero", async () => {
    const { POST } = await import("@/app/api/codes/route");
    const res = await POST(request("http://localhost/api/codes", baseBody));

    expect(res.status).toBe(200);
    expect(mocks.inserts[0][3]).toBe(0);
  });

  it("rejects fixed web payment codes without a valid amount", async () => {
    const { POST } = await import("@/app/api/codes/route");
    const res = await POST(request("http://localhost/api/codes", {
      ...baseBody,
      codeType: "fixed",
      amount: "",
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "固定金额模式必须填写有效金额，最多保留两位小数",
    });
    expect(mocks.inserts).toHaveLength(0);
  });

  it("rejects web payment codes whose selected channel does not match QR payload", async () => {
    const { POST } = await import("@/app/api/codes/route");
    const res = await POST(request("http://localhost/api/codes", {
      ...baseBody,
      type: "wechat",
      qrPayload: "https://qr.alipay.com/fkx12345",
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "二维码渠道与选择渠道不一致，请切换渠道或重新上传正确二维码",
    });
    expect(mocks.inserts).toHaveLength(0);
  });

  it("applies the same validation to mobile payment code creation", async () => {
    const { POST } = await import("@/app/api/mobile/codes/route");
    const res = await POST(request("http://localhost/api/mobile/codes", {
      ...baseBody,
      type: "alipay",
      qrPayload: "wxp://f2f19znp",
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "二维码渠道与选择渠道不一致，请切换渠道或重新上传正确二维码",
    });
    expect(mocks.inserts).toHaveLength(0);
  });
});
