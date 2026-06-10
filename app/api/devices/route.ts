export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { randomHex } from "@/lib/random";
import { omitDeviceSecret } from "@/lib/devices";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const devices = await prisma.device.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(devices.map(omitDeviceSecret));
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    
    const deviceCode = `dev_${randomHex(10)}`;
    const bindingExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const device = await prisma.device.create({
      data: {
        deviceCode,
        name,
        bindingExpiresAt,
        online: false,
        wechatListener: "stopped",
        alipayListener: "stopped",
        notificationPermission: false,
        batteryOptimization: "unknown",
        status: "active",
        userId: user.id
      }
    });
    
    return NextResponse.json(omitDeviceSecret(device));
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
