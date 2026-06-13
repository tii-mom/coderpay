export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getAuthD1 } from "@/lib/auth-d1";
import { getDirectD1 } from "@/lib/d1-direct";
import { centsToAmount, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { getOrderExpiresAt } from "@/lib/payment-matching";
import { omitDeviceSecret } from "@/lib/devices";
import { getRechargeDisplayStatus } from "@/lib/recharge-status";
import { createUniqueInviteCode, getReferralTier, REFERRAL_ACTIVE_RECHARGE_CENTS, REFERRAL_TIER_RULES, getNextReferralTier } from "@/lib/referrals";

function getOrigin(req: NextRequest) {
  let origin = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!origin) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    origin = `${proto}://${host}`;
  }
  return origin.replace(/\/$/, "");
}

function serializeProvider(row: any, origin: string) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status,
    channels: String(row.channels || "").split(",").filter(Boolean),
    secretPreview: row.secretPreview,
    configJson: row.configJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    webhookUrl: `${origin}/api/provider-webhooks/custom/${row.id}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAuthD1();
    const origin = getOrigin(req);

    // Run all queries concurrently in a single HTTP request handler
    const [
      appsRaw,
      codesRaw,
      providersRaw,
      devicesRaw,
      ordersRaw,
      eventsRaw,
      exceptionsRaw,
      webhookLogsRaw,
      billingRecordsRaw,
      rechargeOrdersRaw,
      referralSummaryData,
      noticeData
    ] = await Promise.all([
      // 1. Apps
      prisma.app.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          appId: true,
          appSecret: true,
          notifyUrl: true,
          returnUrl: true,
          feedbackUrl: true,
          expireMinutes: true,
          signType: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: "desc" }
      }),

      // 2. Codes
      getDirectD1().prepare(`
        SELECT * FROM PaymentCode WHERE userId = ? ORDER BY createdAt DESC
      `).bind(user.id).all(),

      // 3. Providers
      getDirectD1().prepare(`
        SELECT * FROM PaymentProvider WHERE userId = ? ORDER BY createdAt DESC
      `).bind(user.id).all<any>(),

      // 4. Devices
      prisma.device.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" }
      }),

      // 5. Orders
      prisma.order.findMany({
        where: { app: { userId: user.id } },
        include: { app: true },
        orderBy: { createdAt: "desc" }
      }),

      // 6. Events
      prisma.paymentEvent.findMany({
        where: { device: { userId: user.id } },
        select: {
          id: true,
          deviceId: true,
          sourceType: true,
          sourceId: true,
          payType: true,
          amount: true,
          receivedAt: true,
          matchStatus: true,
          matchedOrderId: true,
          confidence: true,
          notificationHash: true,
          createdAt: true
        },
        take: 100,
        orderBy: { createdAt: "desc" }
      }),

      // 7. Exceptions
      prisma.exceptionItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" }
      }),

      // 8. Webhook logs
      prisma.webhookLog.findMany({
        where: { order: { app: { userId: user.id } } },
        orderBy: { requestTime: "desc" }
      }),

      // 9. Billing records
      prisma.billingRecord.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" }
      }),

      // 10. Recharge orders
      prisma.rechargeOrder.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" }
      }),

      // 11. Referral data
      (async () => {
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

        return {
          inviteCode,
          referralLink: `${origin}/login?ref=${encodeURIComponent(inviteCode)}`,
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
        };
      })(),

      // 12. Active system notice
      (async () => {
        const GLOBAL_NOTICE_ID = "global";
        const notice = await db
          .prepare(`SELECT * FROM SystemNotice WHERE id = ? LIMIT 1`)
          .bind(GLOBAL_NOTICE_ID)
          .first<any>();

        if (!notice) return null;

        const enabled = notice.enabled === true || Number(notice.enabled) === 1;
        if (!enabled) return null;

        const now = new Date().getTime();
        if (notice.startsAt && new Date(notice.startsAt).getTime() > now) return null;
        if (notice.endsAt && new Date(notice.endsAt).getTime() < now) return null;

        return {
          id: notice.id,
          title: notice.title,
          content: notice.content,
          level: notice.level,
          enabled: true,
          updatedAt: notice.updatedAt,
        };
      })()
    ]);

    // Format individual datasets
    const maskedApps = appsRaw.map((app) => {
      const secret = app.appSecret || "";
      const appSecretMasked = secret.length >= 8 
        ? `${secret.slice(0, 4)}...${secret.slice(-4)}` 
        : secret;
      return {
        ...app,
        appSecret: appSecretMasked,
      };
    });

    const codes = codesRaw.results || [];

    const providers = (providersRaw.results || []).map(row => serializeProvider(row, origin));

    const devices = devicesRaw.map(omitDeviceSecret);

    const orders = ordersRaw.map(order => ({
      ...order,
      amount: centsToAmount(getOrderAmountCents(order)),
      realAmount: centsToAmount(getOrderRealAmountCents(order)),
      amountCents: getOrderAmountCents(order),
      realAmountCents: getOrderRealAmountCents(order),
      expiresAt: getOrderExpiresAt(order),
      status: order.status === "pending" && getOrderExpiresAt(order).getTime() <= Date.now() ? "expired" : order.status
    }));

    const billing = {
      feeBalance: user.feeBalance,
      packageType: user.packageType,
      freeOrderUsed: user.freeOrderUsed,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      firstProDiscountUsed: user.firstProDiscountUsed,
      firstMaxDiscountUsed: user.firstMaxDiscountUsed,
      records: billingRecordsRaw,
      rechargeOrders: rechargeOrdersRaw.map((order) => ({
        ...order,
        displayStatus: getRechargeDisplayStatus(order),
      }))
    };

    return NextResponse.json({
      apps: maskedApps,
      paymentCodes: codes,
      paymentProviders: providers,
      devices,
      orders,
      events: eventsRaw,
      exceptions: exceptionsRaw,
      webhookLogs: webhookLogsRaw,
      billing,
      referrals: referralSummaryData,
      notice: noticeData,
    });
  } catch (err) {
    console.error("Unified console profile API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
