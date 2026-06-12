export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAuthD1 } from "@/lib/auth-d1";
import { resolveEnvVar } from "@/lib/d1-binding";
import { createUniqueInviteCode, getNextReferralTier, getReferralTier, REFERRAL_ACTIVE_RECHARGE_CENTS, REFERRAL_TIER_RULES } from "@/lib/referrals";

function getOrigin(req: NextRequest) {
  let origin = resolveEnvVar("NEXT_PUBLIC_APP_URL");
  if (!origin) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    origin = `${proto}://${host}`;
  }
  return origin.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getAuthD1();
    let inviteCode = String(user.inviteCode || "");
    if (!inviteCode) {
      inviteCode = await createUniqueInviteCode(db);
      await db.prepare(`UPDATE User SET inviteCode = ?, updatedAt = ? WHERE id = ? AND inviteCode IS NULL`)
        .bind(inviteCode, new Date().toISOString(), user.id)
        .run();
    }

    const activeRow = await db.prepare(`
      SELECT COUNT(*) AS c
      FROM User u
      WHERE u.referredByUserId = ?
        AND EXISTS (
          SELECT 1
          FROM RechargeOrder r
          WHERE r.userId = u.id
            AND r.status = 'success'
            AND r.amountCents >= ?
        )
    `).bind(user.id, REFERRAL_ACTIVE_RECHARGE_CENTS).first<{ c: number }>();
    const activeDirectCount = Number(activeRow?.c || 0);
    const tier = getReferralTier(activeDirectCount);

    const totals = await db.prepare(`
      SELECT
        COALESCE(SUM(rewardCents), 0) AS totalRewardCents,
        COUNT(*) AS rewardCount
      FROM ReferralReward
      WHERE beneficiaryUserId = ? AND status = 'credited'
    `).bind(user.id).first<{ totalRewardCents: number; rewardCount: number }>();

    const recent = (await db.prepare(`
      SELECT rr.id, rr.rechargeOrderId, rr.invitedUserId, u.email AS invitedUserEmail,
             rr.depth, rr.tier, rr.rateBps, rr.baseAmountCents, rr.rewardCents,
             rr.status, rr.createdAt, rr.creditedAt
      FROM ReferralReward rr
      LEFT JOIN User u ON u.id = rr.invitedUserId
      WHERE rr.beneficiaryUserId = ?
      ORDER BY rr.createdAt DESC
      LIMIT 50
    `).bind(user.id).all<Record<string, unknown>>()).results || [];

    const directInvites = (await db.prepare(`
      SELECT
        u.id,
        u.email,
        u.createdAt,
        COALESCE(SUM(CASE WHEN r.status = 'success' THEN r.amountCents ELSE 0 END), 0) AS totalRechargeCents,
        MAX(CASE WHEN r.status = 'success' AND r.amountCents >= ? THEN 1 ELSE 0 END) AS isEffective,
        COALESCE((
          SELECT SUM(rr.rewardCents)
          FROM ReferralReward rr
          WHERE rr.invitedUserId = u.id
            AND rr.beneficiaryUserId = ?
            AND rr.status = 'credited'
        ), 0) AS contributedRewardCents
      FROM User u
      LEFT JOIN RechargeOrder r ON r.userId = u.id
      WHERE u.referredByUserId = ?
      GROUP BY u.id, u.email, u.createdAt
      ORDER BY u.createdAt DESC
      LIMIT 50
    `).bind(REFERRAL_ACTIVE_RECHARGE_CENTS, user.id, user.id).all<Record<string, unknown>>()).results || [];

    return NextResponse.json({
      inviteCode,
      referralLink: `${getOrigin(req)}/login?ref=${encodeURIComponent(inviteCode)}`,
      activeDirectCount,
      tier: tier.tier,
      directRateBps: tier.directRateBps,
      indirectRateBps: tier.indirectRateBps,
      tierRules: REFERRAL_TIER_RULES,
      nextTier: getNextReferralTier(activeDirectCount),
      totalRewardCents: Number(totals?.totalRewardCents || 0),
      rewardCount: Number(totals?.rewardCount || 0),
      recentRewards: recent,
      directInvites,
    });
  } catch (err) {
    console.error("Referral summary failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
