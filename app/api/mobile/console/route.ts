export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { omitDeviceSecret } from "@/lib/devices";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { getMobileDevice } from "@/lib/mobile-auth";
import { getRechargeDisplayStatus } from "@/lib/recharge-status";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const device = auth.device;

    const [orders, rechargeOrders, incomingRechargeOrders, paymentCodes, devices, billingRecords, exceptions] = await Promise.all([
      prisma.order.findMany({
        where: { app: { userId: device.userId } },
        include: { app: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.rechargeOrder.findMany({
        where: { userId: device.userId },
        include: { paymentCode: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.rechargeOrder.findMany({
        where: { paymentCode: { userId: device.userId } },
        include: {
          user: { select: { email: true } },
          paymentCode: true,
        },
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
      prisma.exceptionItem.findMany({
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
      rechargeOrders: rechargeOrders.map((order) => ({
        id: order.id,
        amount: centsToAmount(order.amountCents),
        realAmount: centsToAmount(order.realAmountCents),
        amountCents: order.amountCents,
        realAmountCents: order.realAmountCents,
        payType: order.payType,
        status: order.status,
        displayStatus: getRechargeDisplayStatus(order),
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        payTime: order.payTime,
        paymentCodeId: order.paymentCodeId,
      })),
      incomingRechargeOrders: incomingRechargeOrders.map((order) => ({
        id: order.id,
        rechargeUserEmail: order.user.email,
        amount: centsToAmount(order.amountCents),
        realAmount: centsToAmount(order.realAmountCents),
        amountCents: order.amountCents,
        realAmountCents: order.realAmountCents,
        payType: order.payType,
        status: order.status,
        displayStatus: getRechargeDisplayStatus(order),
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        payTime: order.payTime,
        paymentCodeId: order.paymentCodeId,
      })),
      paymentCodes,
      devices: devices.map(omitDeviceSecret),
      billingRecords,
      exceptions,
    });
  } catch (err) {
    console.error("Mobile console request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
