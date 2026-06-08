export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { centsToAmount, getOrderRealAmountCents } from "@/lib/money";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        payTime: true,
        webhookStatus: true,
        realAmount: true,
        realAmountCents: true,
        expiresAt: true,
        app: {
          select: {
            expireMinutes: true,
            returnUrl: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const expired = order.status === "pending" && getOrderExpiresAt(order).getTime() <= Date.now();
    return NextResponse.json({
      ...order,
      status: expired ? "expired" : order.status,
      expiresAt: getOrderExpiresAt(order),
      realAmount: centsToAmount(getOrderRealAmountCents(order))
    });
  } catch (err) {
    console.error("Order status request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
