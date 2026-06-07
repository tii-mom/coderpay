export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id: orderId } = await params;
    const body = await req.json();
    const { eventId } = body;
    
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { app: true }
    });
    
    if (!order || order.app.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    const event = await prisma.paymentEvent.findUnique({
      where: { id: eventId },
      include: { device: true }
    });
    
    if (!event || event.device.userId !== user.id) {
      return NextResponse.json({ error: "Payment event not found" }, { status: 404 });
    }
    
    const fee = Number((order.amount * 0.01).toFixed(3));
    
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "success",
          payTime: event.receivedAt,
          webhookStatus: "success"
        }
      });
      
      await tx.paymentEvent.update({
        where: { id: eventId },
        data: {
          matchStatus: "matched",
          matchedOrderId: orderId,
          confidence: 100
        }
      });
      
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { feeBalance: Number((user.feeBalance - fee).toFixed(3)) }
      });
      
      await tx.billingRecord.create({
        data: {
          type: "fee",
          amount: -fee,
          balance: updatedUser.feeBalance,
          description: `手动匹配成功 - 技术服务费扣除: 订单 ${orderId}, 金额 ${order.amount.toFixed(2)} 元`,
          userId: user.id
        }
      });
      
      await tx.exceptionItem.updateMany({
        where: {
          OR: [
            { refId: orderId },
            { refId: event.notificationHash }
          ],
          status: "active"
        },
        data: { status: "resolved" }
      });
    });
    
    triggerWebhook(order.id).catch(err => console.error("Error triggering webhook in background:", err));
    
    return NextResponse.json({ status: "success", message: "Order and payment event manually matched successfully" });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
