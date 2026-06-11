export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getRechargeDisplayStatus } from "@/lib/recharge-status";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const records = await prisma.billingRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    const rechargeOrders = await prisma.rechargeOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json({
      feeBalance: user.feeBalance,
      packageType: user.packageType,
      freeOrderUsed: user.freeOrderUsed,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      firstProDiscountUsed: user.firstProDiscountUsed,
      firstMaxDiscountUsed: user.firstMaxDiscountUsed,
      records,
      rechargeOrders: rechargeOrders.map((order) => ({
        ...order,
        displayStatus: getRechargeDisplayStatus(order),
      }))
    });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
