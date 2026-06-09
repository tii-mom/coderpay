export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";
import { amountToCents, centsToAmount } from "@/lib/money";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const { id } = await params;
    const code = await prisma.paymentCode.findUnique({ where: { id } });
    if (!code || code.userId !== auth.device.userId) {
      return NextResponse.json({ error: "Payment code not found" }, { status: 404 });
    }

    const body = await req.json();
    const deviceId = body.deviceId === null ? null : (body.deviceId || body.device_id);
    if (deviceId) {
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!device || device.userId !== auth.device.userId) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }
    }

    let amount = body.amount;
    if (amount !== undefined) {
      amount = centsToAmount(amountToCents(amount));
    }

    const updated = await prisma.paymentCode.update({
      where: { id },
      data: {
        status: body.status,
        deviceId: body.deviceId === null ? null : deviceId,
        amount,
        imageUrl: body.imageUrl || body.image_url,
        alipayUserId: body.alipayUserId || body.alipay_user_id
      }
    });
    return NextResponse.json({ status: "success", code: updated });
  } catch (err: any) {
    console.error("Mobile payment code update failed:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: err.status || 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileDevice(_req);
    if (auth.error) return auth.error;
    const { id } = await params;
    const code = await prisma.paymentCode.findUnique({ where: { id } });
    if (!code || code.userId !== auth.device.userId) {
      return NextResponse.json({ error: "Payment code not found" }, { status: 404 });
    }
    await prisma.paymentCode.delete({ where: { id } });
    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("Mobile payment code delete failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
