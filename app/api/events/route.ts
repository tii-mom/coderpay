export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyDeviceSignature } from "@/lib/signature";
import { recordPaymentEvent } from "@/lib/payment-matching";

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

    const eventResult = await recordPaymentEvent({
      deviceCode,
      payType,
      amount,
      receivedAt,
      notificationHash,
      rawNotification
    });
    const result = eventResult.result;
    
    return NextResponse.json({
      status: "success",
      message: eventResult.duplicate ? "Duplicate event ignored" : undefined,
      matchStatus: eventResult.matchStatus,
      matchedOrderId: eventResult.matchedOrderId,
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
