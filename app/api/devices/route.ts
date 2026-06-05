// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const devices = await prisma.device.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(devices);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    
    const deviceCode = `dev-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const device = await prisma.device.create({
      data: {
        deviceCode,
        name,
        online: true,
        wechatListener: "running",
        alipayListener: "running",
        notificationPermission: true,
        batteryOptimization: "ignored",
        status: "active",
        userId: user.id
      }
    });
    
    return NextResponse.json(device);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
