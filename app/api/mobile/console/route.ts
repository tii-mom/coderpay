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

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      recentOrders,
      totalOrders,
      successCount,
      failedCount,
      manualReviewCount,
      pendingCount,
      expiredCount,
      rechargeOrders,
      incomingRechargeOrders,
      paymentCodes,
      devices,
      billingRecords,
      exceptions,
      todayEvents,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { app: { userId: device.userId } },
        include: { app: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.order.count({ where: { app: { userId: device.userId } } }),
      prisma.order.count({ where: { app: { userId: device.userId }, status: "success" } }),
      prisma.order.count({ where: { app: { userId: device.userId }, status: "failed" } }),
      prisma.order.count({ where: { app: { userId: device.userId }, status: "manual_review" } }),
      prisma.order.count({ where: { app: { userId: device.userId }, status: "pending", expiresAt: { gt: now } } }),
      prisma.order.count({ where: { app: { userId: device.userId }, status: "pending", expiresAt: { lte: now } } }),
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
        include: { device: true },
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
      prisma.paymentEvent.findMany({
        where: {
          device: { userId: device.userId },
          createdAt: { gte: startOfToday },
        },
      }),
    ]);

    const orderSummary = {
      total: totalOrders,
      pending: pendingCount,
      success: successCount,
      expired: expiredCount,
      failed: failedCount,
      manualReview: manualReviewCount,
    };

    return NextResponse.json({
      user: {
        email: device.user.email,
        feeBalance: device.user.feeBalance,
        packageType: device.user.packageType,
        freeOrderUsed: device.user.freeOrderUsed,
        subscriptionExpiresAt: device.user.subscriptionExpiresAt,
      },
      orderSummary,
      orders: recentOrders.map((order) => {
        const expiresAt = getOrderExpiresAt(order);
        const isExpired = order.status === "pending" && expiresAt.getTime() <= now.getTime();
        return {
          id: order.id,
          outOrderNo: order.outOrderNo,
          title: order.title,
          payType: order.payType,
          amount: centsToAmount(getOrderAmountCents(order)),
          realAmount: centsToAmount(getOrderRealAmountCents(order)),
          amountCents: getOrderAmountCents(order),
          realAmountCents: getOrderRealAmountCents(order),
          status: isExpired ? "expired" : order.status,
          confirmMode: order.confirmMode,
          manualConfirmedAt: order.manualConfirmedAt,
          manualConfirmNote: order.manualConfirmNote,
          createdAt: order.createdAt,
          expiresAt: expiresAt,
          payTime: order.payTime,
          webhookStatus: order.webhookStatus,
          paymentCodeId: order.paymentCodeId,
          appId: order.app.appId,
        };
      }),
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
        requiresManualConfirm: order.confirmMode === "manual",
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
        requiresManualConfirm: order.confirmMode === "manual",
      })),
      paymentCodes: paymentCodes.map((code) => ({
        id: code.id,
        type: code.type,
        codeType: code.codeType,
        amount: code.amount,
        imageUrl: code.imageUrl,
        alipayUserId: code.alipayUserId,
        qrPayload: code.qrPayload,
        directPayUrl: code.directPayUrl,
        directPayMode: code.directPayMode,
        status: code.status,
        createdAt: code.createdAt,
        updatedAt: code.updatedAt,
        userId: code.userId,
        deviceId: code.deviceId,
        deviceName: code.device?.name || null,
      })),
      devices: devices.map((d) => {
        const omitted = omitDeviceSecret(d);
        const deviceEvents = todayEvents.filter((e) => e.deviceId === d.id);
        const todayEventCount = deviceEvents.length;
        const todayMatchCount = deviceEvents.filter((e) => e.matchStatus === "matched").length;
        return {
          ...omitted,
          todayEventCount,
          todayMatchCount,
        };
      }),
      billingRecords,
      exceptions,
    });
  } catch (err) {
    console.error("Mobile console request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
