export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { omitDeviceSecret } from "@/lib/devices";
import { prisma } from "@/lib/prisma";
import { randomHex } from "@/lib/random";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device || device.userId !== user.id) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        deviceCode: `dev_${randomHex(10)}`,
        deviceSecret: "",
        bindingExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        boundAt: null,
        online: false,
        lastHeartbeat: new Date(),
      },
    });

    return NextResponse.json({
      status: "success",
      device: omitDeviceSecret(updated),
      message: "Device secret reset. Use the new device code to reconnect this device from the Android app.",
    });
  } catch (err) {
    console.error("Device secret reset failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
