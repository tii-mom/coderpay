export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { getMobileDevice } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const device = auth.device;

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const statusParam = url.searchParams.get("status") || "";
    const payType = url.searchParams.get("payType") || "";
    const keyword = url.searchParams.get("keyword") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";

    const now = new Date();
    const skip = (page - 1) * limit;

    const where: any = {
      app: { userId: device.userId }
    };

    if (payType) {
      where.payType = payType;
    }

    if (keyword) {
      where.OR = [
        { id: { contains: keyword } },
        { outOrderNo: { contains: keyword } },
        { title: { contains: keyword } }
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (statusParam === "expired") {
      where.status = "pending";
      where.expiresAt = { lte: now };
    } else if (statusParam === "pending") {
      where.status = "pending";
      where.expiresAt = { gt: now };
    } else if (statusParam && statusParam !== "all") {
      where.status = statusParam;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { app: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const mappedOrders = orders.map((order) => {
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
    });

    return NextResponse.json({
      orders: mappedOrders,
      total,
      page,
      limit,
      hasMore: total > skip + orders.length,
    });
  } catch (err: any) {
    console.error("Mobile get orders failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
