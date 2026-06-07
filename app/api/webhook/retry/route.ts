export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { app: true }
    });
    
    if (!order || order.app.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    // Trigger the webhook dispatcher
    await triggerWebhook(order.id);
    
    const latestLog = await prisma.webhookLog.findFirst({
      where: { orderId: order.id },
      orderBy: { requestTime: "desc" }
    });
    
    // Resolve the webhook_failed exception if it exists
    await prisma.exceptionItem.updateMany({
      where: {
        refId: order.id,
        type: "webhook_failed",
        status: "active"
      },
      data: { status: "resolved" }
    });
    
    return NextResponse.json({
      status: "success",
      message: "Webhook retry processed",
      log: latestLog
    });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
