import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/devices/[id]/reset-secret/route";

const mocks = vi.hoisted(() => ({
  sessionUser: null as { id: string; email: string } | null,
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: () => mocks.sessionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: { findUnique: mocks.findUnique, update: mocks.update },
  },
}));

vi.mock("@/lib/random", () => ({
  randomHex: () => "abc123def0",
}));

describe("device secret reset", () => {
  it("requires ownership", async () => {
    mocks.sessionUser = { id: "user-1", email: "u@example.com" };
    mocks.findUnique.mockResolvedValue({ id: "dev-1", userId: "other-user" });

    const res = await POST(new NextRequest("http://localhost/api/devices/dev-1/reset-secret", { method: "POST" }), {
      params: Promise.resolve({ id: "dev-1" }),
    });

    expect(res.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("clears the old secret and returns a new binding code", async () => {
    mocks.sessionUser = { id: "user-1", email: "u@example.com" };
    mocks.findUnique.mockResolvedValue({ id: "dev-1", userId: "user-1" });
    mocks.update.mockResolvedValue({
      id: "dev-1",
      userId: "user-1",
      deviceCode: "dev_abc123def0",
      deviceSecret: "",
      bindingExpiresAt: new Date("2026-06-13T00:00:00.000Z"),
      boundAt: null,
      online: false,
      lastHeartbeat: new Date("2026-06-12T00:00:00.000Z"),
    });

    const res = await POST(new NextRequest("http://localhost/api/devices/dev-1/reset-secret", { method: "POST" }), {
      params: Promise.resolve({ id: "dev-1" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "dev-1" },
      data: expect.objectContaining({
        deviceCode: "dev_abc123def0",
        deviceSecret: "",
        boundAt: null,
        online: false,
      }),
    });
    const body = await res.json();
    expect(body.device.deviceCode).toBe("dev_abc123def0");
    expect(body.message).toContain("old device code is invalid");
  });

  it("rejects anonymous callers", async () => {
    mocks.sessionUser = null;

    const res = await POST(new NextRequest("http://localhost/api/devices/dev-1/reset-secret", { method: "POST" }), {
      params: Promise.resolve({ id: "dev-1" }),
    });

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(401);
  });
});
