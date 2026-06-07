export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { deviceCode, name, androidVersion, appVersion } = await req.json();
    if (!deviceCode) {
      return NextResponse.json({ error: "Device code is required" }, { status: 400 });
    }
    
    let device = await prisma.device.findUnique({
      where: { deviceCode }
    });
    
    if (!device) {
      return NextResponse.json({ error: "Invalid device binding code" }, { status: 404 });
    }
    
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        name: name || device.name,
        androidVersion,
        appVersion,
        online: true,
        lastHeartbeat: new Date(),
        userId: user.id
      }
    });
    
    return NextResponse.json({ status: "success", device });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
