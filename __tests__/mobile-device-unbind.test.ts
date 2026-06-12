import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/mobile/devices/unbind/route";

const mocks = vi.hoisted(() => ({
  auth: {} as any,
  update: vi.fn(),
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileDevice: () => mocks.auth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: { update: mocks.update },
  },
}));

describe("mobile device unbind", () => {
  beforeEach(() => {
    mocks.auth = {
      device: {
        id: "dev-1",
        deviceCode: "dev_abc",
      },
    };
    mocks.update.mockReset();
  });

  it("requires signed mobile authentication", async () => {
    mocks.auth = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

    const res = await POST(new NextRequest("http://localhost/api/mobile/devices/unbind", { method: "POST" }));

    expect(res.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("clears the server binding so the same device code can pair again", async () => {
    const res = await POST(new NextRequest("http://localhost/api/mobile/devices/unbind", { method: "POST" }));

    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "dev-1" },
      data: expect.objectContaining({
        deviceSecret: "",
        boundAt: null,
        online: false,
      }),
    });
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.deviceCode).toBe("dev_abc");
  });
});
