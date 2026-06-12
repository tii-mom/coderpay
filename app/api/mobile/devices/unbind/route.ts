export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;

    const bindingExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.device.update({
      where: { id: auth.device.id },
      data: {
        deviceSecret: "",
        boundAt: null,
        bindingExpiresAt,
        online: false,
        lastHeartbeat: new Date(),
      }
    });

    return NextResponse.json({
      status: "success",
      deviceCode: auth.device.deviceCode,
      bindingExpiresAt: bindingExpiresAt.toISOString(),
    });
  } catch (err) {
    console.error("Mobile device unbind failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
