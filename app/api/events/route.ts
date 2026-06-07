export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";
import { verifyDeviceSignature } from "@/lib/signature";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const events = await prisma.paymentEvent.findMany({
      where: {
        device: { userId: user.id }
      },
      include: { device: true },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(events);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      deviceCode, 
      payType, 
      amount, 
      receivedAt, 
      notificationHash, 
      rawNotification,
      timestamp,
      sign
    } = body;
    
    if (!deviceCode || !payType || !amount || !notificationHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // 1. Idempotency Check: check if event already uploaded
    const existingEvent = await prisma.paymentEvent.findUnique({
      where: { notificationHash }
    });
    if (existingEvent) {
      return NextResponse.json({
        status: "success",
        message: "Duplicate event ignored",
        event: existingEvent
      });
    }
    
    // 2. Find device
    const device = await prisma.device.findUnique({
      where: { deviceCode }
    });
    
    if (!device) {
      return NextResponse.json({ error: "Device not registered" }, { status: 404 });
    }

    // HMAC signature validation
    if (device.deviceSecret) {
      if (!timestamp || !sign) {
        return NextResponse.json({ error: "Authentication credentials (timestamp and sign) required" }, { status: 401 });
      }
      const isSignValid = verifyDeviceSignature(deviceCode, String(timestamp), device.deviceSecret, sign);
      if (!isSignValid) {
        return NextResponse.json({ error: "Device signature verification failed" }, { status: 401 });
      }
    }
    
    const numAmount = Number(amount);
    const eventTime = receivedAt ? new Date(receivedAt) : new Date();
    
    // 3. Search for a pending order to match
    const matchingOrder = await prisma.order.findFirst({
      where: {
        app: { userId: device.userId },
        payType,
        realAmount: numAmount,
        status: "pending"
      },
      include: { app: true }
    });
    
    let matchStatus = "unmatched";
    let matchedOrderId = null;
    let confidence = 0;
    
    if (matchingOrder) {
      matchStatus = "matched";
      matchedOrderId = matchingOrder.id;
      confidence = 100;
      
      // Update User Balance & create BillingRecord
      const user = await prisma.user.findUnique({ where: { id: device.userId } });
      if (user) {
        // Calculate technical fee based on packageType
        let rate = 0.01; // default free
        if (user.packageType === "starter") rate = 0.008;
        else if (user.packageType === "pro") rate = 0.005;
        else if (user.packageType === "max") rate = 0.003;
        
        const fee = Number((matchingOrder.amount * rate).toFixed(3));
        const newBalance = Number((user.feeBalance - fee).toFixed(3));
        
        await prisma.user.update({
          where: { id: user.id },
          data: { feeBalance: newBalance }
        });
        
        await prisma.billingRecord.create({
          data: {
            type: "fee",
            amount: -fee,
            balance: newBalance,
            description: `技术服务费扣除 (${(rate * 100).toFixed(1)}%): 订单 ${matchingOrder.id}, 金额 ${matchingOrder.amount.toFixed(2)} 元`,
            userId: user.id
          }
        });
      }
      
      // Update Order Status to success
      await prisma.order.update({
        where: { id: matchingOrder.id },
        data: {
          status: "success",
          payTime: eventTime,
          webhookStatus: "success"
        }
      });
      
      // Increment device stats
      await prisma.device.update({
        where: { id: device.id },
        data: {
          online: true,
          lastHeartbeat: new Date()
        }
      });
      
      // Trigger async Webhook in background
      triggerWebhook(matchingOrder.id).catch(err => console.error("Error triggering webhook in background:", err));
      
    } else {
      // Create exception for unmatched payment
      await prisma.exceptionItem.create({
        data: {
          type: "payment_unmatched",
          title: `${payType === "wechat" ? "微信" : "支付宝"}收到 ${numAmount.toFixed(2)} 元未匹配到订单`,
          description: `设备收到到账通知 ${numAmount.toFixed(2)} 元，但系统云端未找到对应待付款订单，且设备已在线关联。`,
          refId: notificationHash,
          status: "active",
          userId: device.userId
        }
      });
    }
    
    // 4. Create the PaymentEvent
    const newEvent = await prisma.paymentEvent.create({
      data: {
        deviceId: device.id,
        payType,
        amount: numAmount,
        receivedAt: eventTime,
        matchStatus,
        matchedOrderId,
        confidence,
        notificationHash,
        rawNotification
      }
    });
    
    return NextResponse.json({
      status: "success",
      matchStatus,
      matchedOrderId,
      event: newEvent
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
