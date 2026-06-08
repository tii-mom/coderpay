export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";
import { verifyDeviceSignature } from "@/lib/signature";

function getFeeRate(packageType: string | null | undefined) {
  if (packageType === "starter") return 0.008;
  if (packageType === "pro") return 0.005;
  if (packageType === "max") return 0.003;
  return 0.01;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const events = await prisma.paymentEvent.findMany({
      where: {
        device: { userId: user.id }
      },
      select: {
        id: true,
        deviceId: true,
        payType: true,
        amount: true,
        receivedAt: true,
        matchStatus: true,
        matchedOrderId: true,
        confidence: true,
        notificationHash: true,
        createdAt: true
      },
      take: 100,
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(events);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const eventTime = receivedAt ? new Date(receivedAt) : new Date();
    if (Number.isNaN(eventTime.getTime())) {
      return NextResponse.json({ error: "Invalid receivedAt" }, { status: 400 });
    }

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

    const safeRawNotification = typeof rawNotification === "string"
      ? rawNotification.slice(0, 500)
      : undefined;

    const existingEvent = await prisma.paymentEvent.findUnique({
      where: { notificationHash }
    });
    if (existingEvent) {
      return NextResponse.json({
        status: "success",
        message: "Duplicate event ignored",
        matchStatus: existingEvent.matchStatus,
        matchedOrderId: existingEvent.matchedOrderId,
        event: existingEvent
      });
    }

    const matchingOrder = await prisma.order.findFirst({
      where: {
        app: { userId: device.userId },
        payType,
        realAmount: numAmount,
        status: "pending"
      },
      include: { app: true },
      orderBy: { createdAt: "asc" }
    });

    let matchStatus = "unmatched";
    let matchedOrderId: string | null = null;
    let confidence = 0;
    let shouldTriggerWebhook = false;

    if (matchingOrder) {
      const claimedOrder = await prisma.order.updateMany({
        where: {
          id: matchingOrder.id,
          status: "pending"
        },
        data: {
          status: "success",
          payTime: eventTime,
          webhookStatus: "success"
        }
      });

      if (claimedOrder.count > 0) {
        matchStatus = "matched";
        matchedOrderId = matchingOrder.id;
        confidence = 100;
        shouldTriggerWebhook = true;

        try {
          const user = await prisma.user.findUnique({ where: { id: device.userId } });
          if (user) {
            const rate = getFeeRate(user.packageType);
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
        } catch (billingErr) {
          console.error("Payment event billing write failed:", billingErr);
        }
      }
    }

    const result = await prisma.paymentEvent.create({
      data: {
        deviceId: device.id,
        payType,
        amount: numAmount,
        receivedAt: eventTime,
        matchStatus,
        matchedOrderId,
        confidence,
        notificationHash,
        rawNotification: safeRawNotification
      }
    }).catch(async err => {
      const duplicate = await prisma.paymentEvent.findUnique({
        where: { notificationHash }
      });
      if (duplicate) return duplicate;
      throw err;
    });

    if (matchStatus === "unmatched") {
      try {
        await prisma.exceptionItem.create({
          data: {
            type: "payment_unmatched",
            title: `${payType === "wechat" ? "微信" : "支付宝"}收到 ${numAmount.toFixed(2)} 元未匹配到订单`,
            description: `设备收到到账通知 ${numAmount.toFixed(2)} 元，但系统云端未找到对应待付款订单。`,
            refId: notificationHash,
            status: "active",
            userId: device.userId
          }
        });
      } catch (exceptionErr) {
        console.error("Payment unmatched exception write failed:", exceptionErr);
      }
    }

    try {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          online: true,
          lastHeartbeat: new Date()
        }
      });
    } catch (heartbeatErr) {
      console.error("Payment event device heartbeat update failed:", heartbeatErr);
    }

    if (matchedOrderId && shouldTriggerWebhook) {
      triggerWebhook(matchedOrderId).catch(err => console.error("Error triggering webhook in background:", err));
    }
    
    return NextResponse.json({
      status: "success",
      matchStatus,
      matchedOrderId,
      event: {
        id: result.id,
        deviceId: result.deviceId,
        payType: result.payType,
        amount: result.amount,
        receivedAt: result.receivedAt,
        matchStatus: result.matchStatus,
        matchedOrderId: result.matchedOrderId,
        confidence: result.confidence,
        notificationHash: result.notificationHash,
        createdAt: result.createdAt
      }
    });
  } catch (err) {
    console.error("Payment event upload failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
