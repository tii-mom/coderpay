import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/devices/heartbeat/route";

const mocks = vi.hoisted(() => ({
  device: null as any,
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: {
      findUnique: vi.fn(() => mocks.device),
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/random", () => ({
  randomHex: () => "abc123abc123abc123abc123abc123ab",
}));

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/devices/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("device heartbeat binding recovery", () => {
  beforeEach(() => {
    mocks.update.mockReset();
  });

  it("rotates the secret when an old binding is stale and the local app lost its secret", async () => {
    mocks.device = {
      id: "dev-1",
      deviceCode: "dev_code",
      deviceSecret: "old-secret",
      lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000),
      androidVersion: null,
      appVersion: null,
      deviceFingerprint: null,
      wechatListener: "stopped",
      alipayListener: "stopped",
      notificationPermission: false,
      batteryOptimization: "unknown",
    };
    mocks.update.mockImplementation(async ({ data }) => ({ ...mocks.device, ...data }));

    const res = await POST(request({
      deviceCode: "dev_code",
      wechatListener: "running",
      alipayListener: "running",
      notificationPermission: false,
      batteryOptimization: "optimized",
      androidVersion: "11",
      appVersion: "1.0.7",
      deviceFingerprint: "fingerprint-1",
      timestamp: Date.now(),
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviceSecret).toBe("sec_abc123abc123abc123abc123abc123ab");
    expect(body.recoveredBinding).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "dev-1" },
      data: expect.objectContaining({
        deviceSecret: "sec_abc123abc123abc123abc123abc123ab",
        bindingExpiresAt: null,
        appVersion: "1.0.7",
        deviceFingerprint: "fingerprint-1",
      }),
    });
  });

  it("keeps rejecting unsigned rebinds while the old device is recently online", async () => {
    mocks.device = {
      id: "dev-1",
      deviceCode: "dev_code",
      deviceSecret: "old-secret",
      lastHeartbeat: new Date(),
      androidVersion: null,
      appVersion: null,
      deviceFingerprint: null,
      wechatListener: "running",
      alipayListener: "running",
      notificationPermission: true,
      batteryOptimization: "ignored",
    };

    const res = await POST(request({
      deviceCode: "dev_code",
      wechatListener: "running",
      alipayListener: "running",
      notificationPermission: false,
      batteryOptimization: "optimized",
      timestamp: Date.now(),
    }));

    expect(res.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recovers a stale binding when the device fingerprint matches", async () => {
    mocks.device = {
      id: "dev-1",
      deviceCode: "dev_code",
      deviceSecret: "old-secret",
      lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000),
      androidVersion: "11",
      appVersion: "1.0.7",
      deviceFingerprint: "fingerprint-1",
      wechatListener: "stopped",
      alipayListener: "stopped",
      notificationPermission: false,
      batteryOptimization: "unknown",
    };
    mocks.update.mockImplementation(async ({ data }) => ({ ...mocks.device, ...data }));

    const res = await POST(request({
      deviceCode: "dev_code",
      wechatListener: "running",
      alipayListener: "running",
      notificationPermission: false,
      batteryOptimization: "optimized",
      androidVersion: "11",
      appVersion: "1.0.7",
      deviceFingerprint: "fingerprint-1",
      timestamp: Date.now(),
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviceSecret).toBe("sec_abc123abc123abc123abc123abc123ab");
    expect(body.recoveredBinding).toBe(true);
  });

  it("does not let a stale binding be taken over from another device fingerprint", async () => {
    mocks.device = {
      id: "dev-1",
      deviceCode: "dev_code",
      deviceSecret: "old-secret",
      lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000),
      androidVersion: "11",
      appVersion: "1.0.7",
      deviceFingerprint: "fingerprint-1",
      wechatListener: "stopped",
      alipayListener: "stopped",
      notificationPermission: false,
      batteryOptimization: "unknown",
    };

    const res = await POST(request({
      deviceCode: "dev_code",
      wechatListener: "running",
      alipayListener: "running",
      notificationPermission: false,
      batteryOptimization: "optimized",
      androidVersion: "11",
      appVersion: "1.0.7",
      deviceFingerprint: "fingerprint-2",
      timestamp: Date.now(),
    }));

    expect(res.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
