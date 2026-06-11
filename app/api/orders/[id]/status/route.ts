export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { centsToAmount, getOrderRealAmountCents } from "@/lib/money";
import { isDeviceReadyForRecharge } from "@/lib/recharge";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        payTime: true,
        webhookStatus: true,
        confirmMode: true,
        manualConfirmedAt: true,
        manualConfirmedBy: true,
        manualConfirmNote: true,
        realAmount: true,
        realAmountCents: true,
        expiresAt: true,
        app: {
          select: {
            expireMinutes: true,
            returnUrl: true
          }
        }
      }
    });

    if (!order) {
      const rechargeOrder = await prisma.rechargeOrder.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          payTime: true,
          realAmount: true,
          realAmountCents: true,
          expiresAt: true,
          payType: true,
          paymentCode: {
            include: { device: true },
          },
        }
      });
      if (!rechargeOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      const autoConfirmAvailable = rechargeOrder.paymentCode
        ? isDeviceReadyForRecharge(
            { device: rechargeOrder.paymentCode.device },
            rechargeOrder.payType as "wechat" | "alipay",
            new Date(Date.now() - 3 * 60 * 1000)
          )
        : false;
      return NextResponse.json({
        ...rechargeOrder,
        status: rechargeOrder.status === "pending" && rechargeOrder.expiresAt.getTime() <= Date.now() ? "expired" : rechargeOrder.status,
        webhookStatus: "unsent",
        confirmMode: autoConfirmAvailable ? "auto" : "manual",
        requiresManualConfirm: !autoConfirmAvailable,
        manualConfirmedAt: null,
        manualConfirmedBy: null,
        manualConfirmNote: null,
        realAmount: centsToAmount(getOrderRealAmountCents(rechargeOrder)),
        app: {
          expireMinutes: 10,
          returnUrl: "/console"
        },
        orderType: "recharge"
      });
    }

    const expired = order.status === "pending" && getOrderExpiresAt(order).getTime() <= Date.now();
    return NextResponse.json({
      ...order,
      status: expired ? "expired" : order.status,
      expiresAt: getOrderExpiresAt(order),
      realAmount: centsToAmount(getOrderRealAmountCents(order)),
      orderType: "order"
    });
  } catch (err) {
    console.error("Order status request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
