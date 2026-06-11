import { prisma } from "@/lib/prisma";
import { calculateFeeCents, getFeeRate } from "@/lib/billing-plans";
import { formatCents, getOrderAmountCents } from "@/lib/money";

type BillingTx = typeof prisma;

type ChargeUser = {
  id: string;
  feeBalance: number;
  packageType?: string | null;
  subscriptionExpiresAt?: Date | string | null;
};

export function centsToBillingAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function formatRatePercent(rate: number) {
  return Number((rate * 100).toFixed(2)).toString();
}

export async function chargeOrderFee(tx: BillingTx, user: ChargeUser, order: { id: string; amount: number; amountCents?: number | null }) {
  const amountCents = getOrderAmountCents(order);
  const feeCents = calculateFeeCents(amountCents, user);
  if (feeCents <= 0) return { feeCents: 0, balance: user.feeBalance };

  const fee = centsToBillingAmount(feeCents);
  const newBalance = Number((user.feeBalance - fee).toFixed(2));
  const updatedUser = await tx.user.update({
    where: { id: user.id },
    data: { feeBalance: newBalance },
  });

  const rate = getFeeRate(user);
  await tx.billingRecord.create({
    data: {
      type: "fee",
      amount: -fee,
      balance: updatedUser.feeBalance,
      description: `技术服务费扣除 (${formatRatePercent(rate)}%): 订单 ${order.id}, 金额 ${formatCents(amountCents)} 元`,
      userId: user.id,
    },
  });

  return { feeCents, balance: updatedUser.feeBalance };
}
