export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const orders = await prisma.order.findMany({
      where: {
        app: { userId: user.id }
      },
      include: { app: true },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(orders.map(order => ({
      ...order,
      amount: centsToAmount(getOrderAmountCents(order)),
      realAmount: centsToAmount(getOrderRealAmountCents(order)),
      amountCents: getOrderAmountCents(order),
      realAmountCents: getOrderRealAmountCents(order),
      expiresAt: getOrderExpiresAt(order),
      status: order.status === "pending" && getOrderExpiresAt(order).getTime() <= Date.now() ? "expired" : order.status
    })));
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
