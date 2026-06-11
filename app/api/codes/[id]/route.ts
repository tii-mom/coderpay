export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { amountToCents, centsToAmount } from "@/lib/money";
import { normalizeDirectPayFields } from "@/lib/direct-pay";

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
    
    let normalizedAmount = amount;
    if (amount !== undefined) {
      try {
        normalizedAmount = centsToAmount(amountToCents(amount));
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    const nextType = code.type as "wechat" | "alipay";
    const nextAlipayUserId = nextType === "alipay"
      ? (body.alipayUserId === null || body.alipay_user_id === null
          ? null
          : String(body.alipayUserId || body.alipay_user_id || code.alipayUserId || "").trim() || null)
      : null;
    const directPay = normalizeDirectPayFields({
      type: nextType,
      amount: normalizedAmount !== undefined ? normalizedAmount : code.amount,
      alipayUserId: nextAlipayUserId,
      qrPayload: body.qrPayload ?? body.qr_payload ?? code.qrPayload,
      directPayUrl: body.directPayUrl ?? body.direct_pay_url ?? code.directPayUrl,
    });

    const updated = await prisma.paymentCode.update({
      where: { id },
      data: {
        status,
        deviceId: deviceId === null ? null : deviceId,
        amount: normalizedAmount !== undefined ? normalizedAmount : undefined,
        imageUrl,
        alipayUserId: nextAlipayUserId,
        qrPayload: directPay.qrPayload,
        directPayUrl: directPay.directPayUrl,
        directPayMode: directPay.directPayMode,
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
