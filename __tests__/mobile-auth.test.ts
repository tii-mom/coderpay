import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getMobileDevice } from "@/lib/mobile-auth";
import CryptoJS from "crypto-js";

const device = {
  id: "dev-1",
  deviceCode: "device-1",
  deviceSecret: "secret-1",
  userId: "user-1",
  user: { id: "user-1", email: "u@example.com" }
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: {
      findUnique: vi.fn(({ where }) => where.deviceCode === device.deviceCode ? device : null)
    }
  }
}));

function signedRequest(overrides: Record<string, string> = {}) {
  const timestamp = overrides.timestamp || String(Date.now());
  const sign = overrides.sign || CryptoJS.HmacSHA256(`${device.deviceCode}:${timestamp}`, device.deviceSecret).toString();
  return new NextRequest("http://localhost/api/mobile/console", {
    headers: {
      "x-coderpay-device": overrides.deviceCode || device.deviceCode,
      "x-coderpay-timestamp": timestamp,
      "x-coderpay-sign": sign,
      "x-forwarded-for": overrides.ip || `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
    }
  });
}

describe("mobile device auth", () => {
  it("rejects missing mobile signature headers", async () => {
    const result = await getMobileDevice(new NextRequest("http://localhost/api/mobile/console"));
    expect(result.error?.status).toBe(401);
  });

  it("rejects invalid signatures and expired timestamps", async () => {
    const badSign = await getMobileDevice(signedRequest({ sign: "bad" }));
    expect(badSign.error?.status).toBe(401);

    const expired = await getMobileDevice(signedRequest({ timestamp: String(Date.now() - 11 * 60 * 1000) }));
    expect(expired.error?.status).toBe(401);
  });

  it("accepts a valid device HMAC signature", async () => {
    const result = await getMobileDevice(signedRequest());
    expect(result.device?.id).toBe(device.id);
  });
});
