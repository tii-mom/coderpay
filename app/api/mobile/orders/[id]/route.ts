export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { getMobileDevice } from "@/lib/mobile-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const device = auth.device;

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        app: true,
        paymentCode: {
          include: {
            device: true
          }
        },
        webhookLogs: {
          orderBy: { requestTime: "desc" },
          take: 5
        }
      }
    });

    if (!order || order.app.userId !== device.userId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const expiresAt = getOrderExpiresAt(order);
    const isExpired = order.status === "pending" && expiresAt.getTime() <= Date.now();

    const result = {
      id: order.id,
      outOrderNo: order.outOrderNo,
      title: order.title,
      payType: order.payType,
      amount: centsToAmount(getOrderAmountCents(order)),
      realAmount: centsToAmount(getOrderRealAmountCents(order)),
      amountCents: getOrderAmountCents(order),
      realAmountCents: getOrderRealAmountCents(order),
      status: isExpired ? "expired" : order.status,
      confirmMode: order.confirmMode,
      manualConfirmedAt: order.manualConfirmedAt,
      manualConfirmNote: order.manualConfirmNote,
      createdAt: order.createdAt,
      expiresAt: expiresAt,
      payTime: order.payTime,
      webhookStatus: order.webhookStatus,
      paymentCodeId: order.paymentCodeId,
      appId: order.app.appId,
      appName: order.app.name,
      notifyUrl: order.app.notifyUrl,
      returnUrl: order.returnUrl || order.app.returnUrl,
      paymentCode: order.paymentCode ? {
        id: order.paymentCode.id,
        type: order.paymentCode.type,
        codeType: order.paymentCode.codeType,
        amount: order.paymentCode.amount,
        imageUrl: order.paymentCode.imageUrl,
        deviceName: order.paymentCode.device?.name || null,
      } : null,
      webhookLogs: order.webhookLogs.map(log => ({
        id: log.id,
        requestTime: log.requestTime,
        statusCode: log.statusCode,
        result: log.result,
        responseSummary: log.responseSummary
      }))
    };

    return NextResponse.json({ status: "success", order: result });
  } catch (err: any) {
    console.error("Mobile get order detail failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
