export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";
import { chargeOrderFee } from "@/lib/billing";

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
    
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "success",
          payTime: event.receivedAt,
          webhookStatus: "unsent"
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
      
      await chargeOrderFee(tx as any, user, order);
      
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
