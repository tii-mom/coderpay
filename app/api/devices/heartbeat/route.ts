// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { deviceCode, wechatListener, alipayListener, notificationPermission, batteryOptimization } = await req.json();
    if (!deviceCode) {
      return NextResponse.json({ error: "Device code is required" }, { status: 400 });
    }
    
    let device = await prisma.device.findUnique({
      where: { deviceCode }
    });
    
    if (!device) {
      return NextResponse.json({ error: "Device not registered" }, { status: 404 });
    }
    
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        online: true,
        lastHeartbeat: new Date(),
        wechatListener: wechatListener || device.wechatListener,
        alipayListener: alipayListener || device.alipayListener,
        notificationPermission: notificationPermission !== undefined ? notificationPermission : device.notificationPermission,
        batteryOptimization: batteryOptimization || device.batteryOptimization
      }
    });
    
    return NextResponse.json({ status: "success", online: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
