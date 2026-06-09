export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";
import { centsToAmount } from "@/lib/money";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;

    const { id } = await params;
    const rechargeOrder = await prisma.rechargeOrder.findUnique({
      where: { id },
      include: { paymentCode: true }
    });
    if (!rechargeOrder || rechargeOrder.userId !== auth.device.userId) {
      return NextResponse.json({ error: "Recharge order not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: rechargeOrder.id,
      amount: centsToAmount(rechargeOrder.amountCents),
      realAmount: centsToAmount(rechargeOrder.realAmountCents),
      payType: rechargeOrder.payType,
      status: rechargeOrder.status === "pending" && rechargeOrder.expiresAt.getTime() <= Date.now() ? "expired" : rechargeOrder.status,
      createdAt: rechargeOrder.createdAt,
      expiresAt: rechargeOrder.expiresAt,
      payTime: rechargeOrder.payTime,
      paymentCode: rechargeOrder.paymentCode
    });
  } catch (err) {
    console.error("Mobile recharge status failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
