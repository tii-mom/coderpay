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
    const { status, deviceId, amount, imageUrl } = body;
    
    const code = await prisma.paymentCode.findUnique({ where: { id } });
    if (!code || code.userId !== user.id) {
      return NextResponse.json({ error: "Payment code not found" }, { status: 404 });
    }
    if (deviceId) {
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!device || device.userId !== user.id) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }
    }
    
    const updated = await prisma.paymentCode.update({
      where: { id },
      data: {
        status,
        deviceId: deviceId === null ? null : deviceId,
        amount: amount !== undefined ? Number(amount) : undefined,
        imageUrl
      }
    });
    
    return NextResponse.json(updated);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const code = await prisma.paymentCode.findUnique({ where: { id } });
    if (!code || code.userId !== user.id) {
      return NextResponse.json({ error: "Payment code not found" }, { status: 404 });
    }
    
    await prisma.paymentCode.delete({ where: { id } });
    return NextResponse.json({ status: "success", message: "Payment code deleted successfully" });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
