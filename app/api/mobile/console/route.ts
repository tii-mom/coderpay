export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDeviceSignature } from "@/lib/signature";
import { omitDeviceSecret } from "@/lib/devices";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";

export async function GET(req: NextRequest) {
  try {
    const deviceCode = req.headers.get("x-coderpay-device") || "";
    const timestamp = req.headers.get("x-coderpay-timestamp") || "";
    const sign = req.headers.get("x-coderpay-sign") || "";

    if (!deviceCode || !timestamp || !sign) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const device = await prisma.device.findUnique({
      where: { deviceCode },
      include: { user: true },
    });

    if (!device || !device.deviceSecret || !verifyDeviceSignature(deviceCode, timestamp, device.deviceSecret, sign)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [orders, paymentCodes, devices, billingRecords] = await Promise.all([
      prisma.order.findMany({
        where: { app: { userId: device.userId } },
        include: { app: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.paymentCode.findMany({
        where: { userId: device.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.device.findMany({
        where: { userId: device.userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.billingRecord.findMany({
        where: { userId: device.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      user: {
        email: device.user.email,
        feeBalance: device.user.feeBalance,
        packageType: device.user.packageType,
        freeOrderUsed: device.user.freeOrderUsed,
        subscriptionExpiresAt: device.user.subscriptionExpiresAt,
      },
      orders: orders.map((order) => ({
        id: order.id,
        outOrderNo: order.outOrderNo,
        title: order.title,
        payType: order.payType,
        amount: centsToAmount(getOrderAmountCents(order)),
        realAmount: centsToAmount(getOrderRealAmountCents(order)),
        amountCents: getOrderAmountCents(order),
        realAmountCents: getOrderRealAmountCents(order),
        status: order.status === "pending" && getOrderExpiresAt(order).getTime() <= Date.now() ? "expired" : order.status,
        createdAt: order.createdAt,
        expiresAt: getOrderExpiresAt(order),
        payTime: order.payTime,
        webhookStatus: order.webhookStatus,
        paymentCodeId: order.paymentCodeId,
        appId: order.app.appId,
      })),
      paymentCodes,
      devices: devices.map(omitDeviceSecret),
      billingRecords,
    });
  } catch (err) {
    console.error("Mobile console request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
