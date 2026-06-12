export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { chargeOrderFee } from "@/lib/billing";
import { isDeviceReadyForRecharge } from "@/lib/recharge";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        app: {
          select: {
            name: true,
            expireMinutes: true,
            returnUrl: true,
            feedbackUrl: true
          }
        },
        paymentCode: {
          select: {
            type: true,
            codeType: true,
            amount: true,
            imageUrl: true,
            alipayUserId: true,
            qrPayload: true,
            directPayUrl: true,
            directPayMode: true,
          }
        }
      }
    });
    
    if (!order) {
      const rechargeOrder = await prisma.rechargeOrder.findUnique({
        where: { id },
        include: {
          paymentCode: {
            include: { device: true },
          }
        }
      });
      if (!rechargeOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      const { device: _device, ...paymentCode } = rechargeOrder.paymentCode || {};
      const autoConfirmAvailable = rechargeOrder.paymentCode
        ? isDeviceReadyForRecharge(
            { device: rechargeOrder.paymentCode.device },
            rechargeOrder.payType as "wechat" | "alipay",
            new Date(Date.now() - 3 * 60 * 1000)
          )
        : false;
      return NextResponse.json({
        id: rechargeOrder.id,
        outOrderNo: rechargeOrder.id,
        title: "CoderPay 账户余额充值",
        payType: rechargeOrder.payType,
        amount: centsToAmount(rechargeOrder.amountCents),
        realAmount: centsToAmount(rechargeOrder.realAmountCents),
        amountCents: rechargeOrder.amountCents,
        realAmountCents: rechargeOrder.realAmountCents,
        status: rechargeOrder.status === "pending" && rechargeOrder.expiresAt.getTime() <= Date.now() ? "expired" : rechargeOrder.status,
        createdAt: rechargeOrder.createdAt,
        expiresAt: rechargeOrder.expiresAt,
        payTime: rechargeOrder.payTime,
        webhookStatus: "unsent",
        confirmMode: autoConfirmAvailable ? "auto" : "manual",
        requiresManualConfirm: !autoConfirmAvailable,
        manualConfirmedAt: null,
        manualConfirmedBy: null,
        manualConfirmNote: null,
        app: {
          name: "CoderPay 账户余额充值",
          expireMinutes: 10,
          returnUrl: "/console",
          feedbackUrl: null,
        },
        paymentCode,
        orderType: "recharge",
      });
    }
    
    return NextResponse.json({
      id: order.id,
      outOrderNo: order.outOrderNo,
      title: order.title,
      payType: order.payType,
      amount: order.amount,
      realAmount: centsToAmount(getOrderRealAmountCents(order)),
      amountCents: getOrderAmountCents(order),
      realAmountCents: getOrderRealAmountCents(order),
      status: order.status === "pending" && getOrderExpiresAt(order).getTime() <= Date.now() ? "expired" : order.status,
      createdAt: order.createdAt,
      expiresAt: getOrderExpiresAt(order),
      payTime: order.payTime,
      webhookStatus: order.webhookStatus,
      confirmMode: order.confirmMode,
      manualConfirmedAt: order.manualConfirmedAt,
      manualConfirmedBy: order.manualConfirmedBy,
      manualConfirmNote: order.manualConfirmNote,
      returnUrl: order.returnUrl || order.app?.returnUrl || "",
      app: order.app,
      paymentCode: order.paymentCode,
      orderType: "order",
    });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const body = await req.json();
    const { status } = body;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: { app: true }
    });
    
    if (!order || order.app.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    const previousStatus = order.status;
    
    if (status === "success" && previousStatus !== "success") {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        await chargeOrderFee(tx as any, user, order);
        return tx.order.update({
          where: { id },
          data: {
            status: "success",
            payTime: new Date(),
            webhookStatus: "unsent"
          }
        });
      });

      await triggerWebhook(order.id);
      
      return NextResponse.json(updatedOrder);
    } else {
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { status }
      });
      return NextResponse.json(updatedOrder);
    }
    
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
