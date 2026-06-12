import { calculateFeeCents, getFeeRate } from "@/lib/billing-plans";
import { amountFromCents, getDirectD1, runAtomic } from "@/lib/d1-direct";
import { formatCents } from "@/lib/money";

type D1DatabaseLike = ReturnType<typeof getDirectD1>;

type ManualConfirmUser = {
  id: string;
  email: string;
  feeBalance: number;
  packageType?: string | null;
  subscriptionExpiresAt?: Date | string | null;
};

type ManualConfirmResult =
  | { ok: true; orderId: string; webhookStatus: "unsent" }
  | { ok: false; status: number; error: string };

function formatRatePercent(rate: number) {
  return Number((rate * 100).toFixed(2)).toString();
}

function normalizeDateValue(value: unknown) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(String(value));
}

export async function manuallyConfirmOrderPaid(
  db: D1DatabaseLike,
  orderId: string,
  user: ManualConfirmUser,
  note = "",
  now = new Date()
): Promise<ManualConfirmResult> {
  const order = await db.prepare(`
    SELECT "Order".id, "Order".status, "Order".amount, "Order".amountCents,
           App.userId
    FROM "Order"
    JOIN App ON App.id = "Order".appId
    WHERE "Order".id = ?
    LIMIT 1
  `).bind(orderId).first<any>();

  if (!order || order.userId !== user.id) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  if (order.status === "success") {
    return { ok: false, status: 400, error: "订单已成功，不能重复人工确认" };
  }

  if (!["pending", "manual_review", "expired"].includes(order.status)) {
    return { ok: false, status: 400, error: "当前订单状态不允许人工确认" };
  }

  const amountCents = Number(order.amountCents || Math.round(Number(order.amount || 0) * 100));
  const billingUser = {
    ...user,
    subscriptionExpiresAt: normalizeDateValue(user.subscriptionExpiresAt),
  };
  const feeCents = calculateFeeCents(amountCents, billingUser);
  const balanceCents = Math.round(Number(user.feeBalance || 0) * 100);
  if (feeCents > balanceCents) {
    return { ok: false, status: 402, error: "账户余额不足，无法人工确认该订单，请先充值余额。" };
  }

  const nowIso = now.toISOString();
  const cleanNote = note.trim().slice(0, 500);
  const statements = [
    db.prepare(`
      UPDATE "Order"
      SET status = 'success',
          confirmMode = 'manual',
          payTime = ?,
          webhookStatus = 'unsent',
          manualConfirmedAt = ?,
          manualConfirmedBy = ?,
          manualConfirmNote = ?
      WHERE id = ? AND status != 'success'
    `).bind(nowIso, nowIso, user.email, cleanNote || null, orderId),
    db.prepare(`
      UPDATE ExceptionItem
      SET status = 'resolved'
      WHERE refId = ? AND status = 'active'
    `).bind(orderId),
  ];

  if (feeCents > 0) {
    const fee = amountFromCents(feeCents);
    const newBalance = amountFromCents(balanceCents - feeCents);
    const rate = getFeeRate(billingUser);
    statements.push(
      db.prepare(`UPDATE User SET feeBalance = ?, updatedAt = ? WHERE id = ?`)
        .bind(newBalance, nowIso, user.id),
      db.prepare(`
        INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
        VALUES (?, 'fee', ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        -fee,
        newBalance,
        `技术服务费扣除 (${formatRatePercent(rate)}%): 订单 ${orderId}, 金额 ${formatCents(amountCents)} 元`,
        nowIso,
        user.id
      )
    );
  }

  const results = await runAtomic(db, statements);
  const orderUpdateChanges = results[0]?.meta?.changes ?? 0;
  if (orderUpdateChanges !== 1) {
    return { ok: false, status: 400, error: "订单已成功，不能重复人工确认" };
  }

  return { ok: true, orderId, webhookStatus: "unsent" };
}
