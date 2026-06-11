export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";
import { amountToCents, centsToAmount } from "@/lib/money";
import { normalizeDirectPayFields } from "@/lib/direct-pay";

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
    const nextType = code.type as "wechat" | "alipay";
    const nextAlipayUserId = nextType === "alipay"
      ? (body.alipayUserId === null || body.alipay_user_id === null
          ? null
          : String(body.alipayUserId || body.alipay_user_id || code.alipayUserId || "").trim() || null)
      : null;
    const directPay = normalizeDirectPayFields({
      type: nextType,
      amount: amount !== undefined ? amount : code.amount,
      alipayUserId: nextAlipayUserId,
      qrPayload: body.qrPayload ?? body.qr_payload ?? code.qrPayload,
      directPayUrl: body.directPayUrl ?? body.direct_pay_url ?? code.directPayUrl,
    });

    const updated = await prisma.paymentCode.update({
      where: { id },
      data: {
        status: body.status,
        deviceId: body.deviceId === null ? null : deviceId,
        amount,
        imageUrl: body.imageUrl || body.image_url,
        alipayUserId: nextAlipayUserId,
        qrPayload: directPay.qrPayload,
        directPayUrl: directPay.directPayUrl,
        directPayMode: directPay.directPayMode,
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
