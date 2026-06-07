export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const body = await req.json();
    const { name, online, status, wechatListener, alipayListener } = body;
    
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device || device.userId !== user.id) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    
    const updated = await prisma.device.update({
      where: { id },
      data: {
        name,
        online,
        status,
        wechatListener,
        alipayListener
      }
    });
    
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device || device.userId !== user.id) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    
    await prisma.device.delete({ where: { id } });
    return NextResponse.json({ status: "success", message: "Device deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
