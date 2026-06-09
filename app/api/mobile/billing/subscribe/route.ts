export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";
import { BILLING_PLANS, getNextSubscriptionExpiresAt, getSubscriptionChargeCents, PaidPackageType } from "@/lib/billing-plans";
import { centsToBillingAmount } from "@/lib/billing";

function isPaidPackageType(value: string): value is PaidPackageType {
  return value === "pro" || value === "max";
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const user = auth.device.user;

    const body = await req.json();
    const planId = String(body.planId || body.plan_id || "");
    if (!isPaidPackageType(planId)) {
      return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
    }

    const firstDiscountUsed = planId === "pro" ? user.firstProDiscountUsed : user.firstMaxDiscountUsed;
    const charge = centsToBillingAmount(getSubscriptionChargeCents(planId, firstDiscountUsed));
    if (user.feeBalance < charge) {
      return NextResponse.json({ error: `余额不足，开通 ${BILLING_PLANS[planId].name} 需要 ¥${charge.toFixed(2)}` }, { status: 402 });
    }

    const now = new Date();
    const expiresAt = getNextSubscriptionExpiresAt(user.subscriptionExpiresAt, now);
    const newBalance = Number((user.feeBalance - charge).toFixed(2));
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          packageType: planId,
          subscriptionStartedAt: now,
          subscriptionExpiresAt: expiresAt,
          feeBalance: newBalance,
          firstProDiscountUsed: planId === "pro" ? true : user.firstProDiscountUsed,
          firstMaxDiscountUsed: planId === "max" ? true : user.firstMaxDiscountUsed,
        },
      });
      await tx.billingRecord.create({
        data: {
          type: "subscription",
          amount: -charge,
          balance: newBalance,
          description: `${firstDiscountUsed ? "续费" : "首次优惠订阅"} ${BILLING_PLANS[planId].name}: ¥${charge.toFixed(2)}`,
          userId: user.id,
        },
      });
      return updated;
    });

    return NextResponse.json({
      status: "success",
      packageType: updatedUser.packageType,
      feeBalance: updatedUser.feeBalance,
      subscriptionExpiresAt: updatedUser.subscriptionExpiresAt,
    });
  } catch (err) {
    console.error("Mobile subscribe failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
