export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";

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
            alipayUserId: true
          }
        }
      }
    });
    
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
      app: order.app,
      paymentCode: order.paymentCode
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
      // Calculate technical fee based on packageType
      let rate = 0.01;
      if (user.packageType === "starter") rate = 0.008;
      else if (user.packageType === "pro") rate = 0.005;
      else if (user.packageType === "max") rate = 0.003;
      
      const fee = Number((order.amount * rate).toFixed(3));
      
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { feeBalance: Number((user.feeBalance - fee).toFixed(3)) }
      });
      
      await prisma.billingRecord.create({
        data: {
          type: "fee",
          amount: -fee,
          balance: updatedUser.feeBalance,
          description: `技术服务费扣除 (${(rate * 100).toFixed(1)}% - 管理员手动确认已付款): 订单 ${order.id}, 金额 ${order.amount.toFixed(2)} 元`,
          userId: user.id
        }
      });
      
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status: "success",
          payTime: new Date(),
          webhookStatus: "unsent"
        }
      });
      
      triggerWebhook(order.id).catch(err => console.error("Error triggering webhook in background:", err));
      
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
