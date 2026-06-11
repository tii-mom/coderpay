export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1, runAuthAtomic } from "@/lib/auth-d1";
import { amountFromCents, formatAmount } from "@/lib/d1-direct";
import {
  getRechargePromotion,
  getRechargePromotionDescription,
  getRechargePromotionUpdate,
} from "@/lib/recharge-promotions";
import { buildReferralRewardStatements } from "@/lib/referrals";

// Manually confirm a real recharge payment that the automatic notification
// matcher missed (e.g. RC96251105). Admin-only, requires typing the target
// user's email, credits balance + promotion exactly like the auto path, and is
// idempotent: a recharge already in 'success' cannot be credited twice.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const { id: rechargeId } = await params;
    const body = await req.json();
    const { confirmEmail, reason } = body;

    const db = getAuthD1();

    const recharge = await db
      .prepare(
        `SELECT id, userId, amountCents, realAmountCents, payType, status FROM RechargeOrder WHERE id = ? LIMIT 1`
      )
      .bind(rechargeId)
      .first<{
        id: string;
        userId: string;
        amountCents: number;
        realAmountCents: number;
        payType: string;
        status: string;
      }>();

    if (!recharge) {
      return adminJson({ error: "充值单不存在" }, { status: 404 });
    }

    if (recharge.status === "success") {
      return adminJson(
        { error: "该充值单已入账，不能重复确认" },
        { status: 409 }
      );
    }

    const user = await db
      .prepare(
        `SELECT id, email, feeBalance, packageType, subscriptionExpiresAt FROM User WHERE id = ? LIMIT 1`
      )
      .bind(recharge.userId)
      .first<{
        id: string;
        email: string;
        feeBalance: number;
        packageType: string;
        subscriptionExpiresAt: string | null;
      }>();

    if (!user) {
      return adminJson({ error: "充值单对应用户不存在" }, { status: 404 });
    }

    // Require typing the target user's email, matching the deduction-confirm
    // pattern used by adjust-balance so a credit can't go to the wrong account.
    const provided =
      typeof confirmEmail === "string" ? confirmEmail.trim().toLowerCase() : "";
    if (provided !== user.email.trim().toLowerCase()) {
      return adminJson(
        { error: "人工确认充值需输入正确的目标用户邮箱进行确认" },
        { status: 400 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const chargeAmount = amountFromCents(Number(recharge.amountCents));
    const currentBalance = Number(user.feeBalance || 0);
    const newBalance = Number((currentBalance + chargeAmount).toFixed(2));

    const promotion = getRechargePromotion(Number(recharge.amountCents));
    const promotionUpdate = promotion
      ? getRechargePromotionUpdate(user, promotion, now)
      : null;

    const auditReason = `人工确认充值到账 [确认: ${user.email}]${reason && typeof reason === "string" && reason.trim() ? ` - ${reason.trim()}` : ""}`;

    // Atomically claim the recharge. Every mutating statement is guarded by the
    // current recharge status, so a concurrent second confirmation becomes a
    // no-op instead of crediting the balance or writing duplicate bills.
    const writes: Parameters<typeof runAuthAtomic>[1] = [];

    if (promotionUpdate) {
      writes.push(
        db
          .prepare(
            `UPDATE User
             SET feeBalance = ?, packageType = ?, subscriptionExpiresAt = ?, updatedAt = ?
             WHERE id = ?
               AND EXISTS (SELECT 1 FROM RechargeOrder WHERE id = ? AND status != 'success')`
          )
          .bind(
            newBalance,
            promotionUpdate.packageType,
            promotionUpdate.subscriptionExpiresAt.toISOString(),
            nowIso,
            user.id,
            rechargeId
          )
      );
    } else {
      writes.push(
        db
          .prepare(
            `UPDATE User
             SET feeBalance = ?, updatedAt = ?
             WHERE id = ?
               AND EXISTS (SELECT 1 FROM RechargeOrder WHERE id = ? AND status != 'success')`
          )
          .bind(newBalance, nowIso, user.id, rechargeId)
      );
    }

    writes.push(
      db
        .prepare(
          `INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
           SELECT ?, 'charge', ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM RechargeOrder WHERE id = ? AND status != 'success')`
        )
        .bind(
          crypto.randomUUID(),
          chargeAmount,
          newBalance,
          `人工确认充值入账: 充值单 ${rechargeId}, 实付 ${formatAmount(Number(recharge.realAmountCents))} 元 (操作管理员: ${admin.email})`,
          nowIso,
          user.id,
          rechargeId
        )
    );

    if (promotion && promotionUpdate) {
      writes.push(
        db
          .prepare(
            `INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
             SELECT ?, 'promotion', 0, ?, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM RechargeOrder WHERE id = ? AND status != 'success')`
          )
          .bind(
            crypto.randomUUID(),
            newBalance,
            `${getRechargePromotionDescription(promotion)}: 充值单 ${rechargeId}`,
            nowIso,
            user.id,
            rechargeId
          )
      );
    }

    writes.push(
      db
        .prepare(
          `INSERT INTO AdminAuditLog (id, adminEmail, action, targetType, targetId, beforeJson, afterJson, reason, createdAt)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM RechargeOrder WHERE id = ? AND status != 'success')`
        )
        .bind(
          crypto.randomUUID(),
          admin.email,
          "recharge_manual_confirm",
          "recharge_order",
          rechargeId,
          JSON.stringify({
            status: recharge.status,
            feeBalance: currentBalance,
          }),
          JSON.stringify({
            status: "success",
            feeBalance: newBalance,
            promotion: promotion?.title ?? null,
          }),
          auditReason,
          nowIso,
          rechargeId
        )
    );

    writes.push(
      ...(await buildReferralRewardStatements(db, {
        id: rechargeId,
        userId: user.id,
        amountCents: Number(recharge.amountCents),
      }, nowIso, { requireRechargeNotSuccess: true }))
    );

    writes.push(
      db
        .prepare(
          `UPDATE RechargeOrder SET status = 'success', payTime = ? WHERE id = ? AND status != 'success'`
        )
        .bind(nowIso, rechargeId)
    );

    const results = await runAuthAtomic(db, writes);
    const claimResult = results[results.length - 1];
    if (claimResult?.meta?.changes === 0) {
      return adminJson(
        { error: "该充值单已入账，不能重复确认" },
        { status: 409 }
      );
    }

    return adminJson({
      status: "success",
      rechargeId,
      feeBalance: newBalance,
      promotion: promotion?.title ?? null,
    });
  } catch (err) {
    console.error("Admin manual recharge confirm failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
