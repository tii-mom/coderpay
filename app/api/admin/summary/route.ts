export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";

// Timestamps in D1 are stored as ISO strings with a +00:00 suffix
// (e.g. "2026-06-10T04:35:48.247+00:00"). We build threshold strings in the
// same format so lexicographic comparison in SQLite is exact.
function isoUtcOffset(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "+00:00");
}

// Start of "today" in Asia/Shanghai (UTC+8, no DST), expressed as a UTC instant.
function shanghaiTodayStart(now: number): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  const startUtcMs = Math.floor((now + offsetMs) / dayMs) * dayMs - offsetMs;
  return isoUtcOffset(startUtcMs);
}

function shanghaiDayStart(now: number, daysAgo: number): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStartUtcMs = Math.floor((now + offsetMs) / dayMs) * dayMs - offsetMs;
  return isoUtcOffset(todayStartUtcMs - daysAgo * dayMs);
}

function shanghaiPeriodStart(now: number, days: number): string {
  return shanghaiDayStart(now, Math.max(0, days - 1));
}

function formatDayLabel(value: string) {
  return value.slice(5, 10);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const db = getAuthD1();
    const now = Date.now();
    const todayStart = shanghaiTodayStart(now);
    const yesterdayStart = shanghaiDayStart(now, 1);
    const weekStart = shanghaiPeriodStart(now, 7);
    const monthStart = shanghaiPeriodStart(now, 30);
    const onlineThreshold = isoUtcOffset(now - 3 * 60 * 1000);

    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
    const money = (v: unknown) => Math.round(num(v) * 100) / 100;

    const dayBuckets = Array.from({ length: 14 }, (_, index) => {
      const start = shanghaiDayStart(now, 13 - index);
      return { day: start.slice(0, 10), label: formatDayLabel(start), users: 0, rechargeAmount: 0 };
    });
    const bucketMap = new Map(dayBuckets.map((item) => [item.day, item]));

    const [
      totalUsers,
      todayUsers,
      weekUsers,
      monthUsers,
      todayOrderAmount,
      todayFee,
      todayRechargeAmount,
      yesterdayRechargeAmount,
      weekRechargeAmount,
      monthRechargeAmount,
      pendingRechargeAmount,
      failedRechargeAmount,
      totalDeveloperBalance,
      lowBalanceUsers,
      activeUsers,
      usersWithDevices,
      usersWithCodes,
      usersWithSuccessOrders,
      onlineDevices,
      rechargePending,
      rechargeFailed,
      webhookFailed,
      packageRows,
      referralRows,
      userGrowthRows,
      rechargeTrendRows,
    ] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS v FROM User`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM User WHERE createdAt >= ?`).bind(todayStart).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM User WHERE createdAt >= ?`).bind(weekStart).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM User WHERE createdAt >= ?`).bind(monthStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(realAmount), 0) AS v FROM "Order" WHERE status = 'success' AND payTime >= ?`
      ).bind(todayStart).first<{ v: number }>(),
      // fee BillingRecord amounts are stored negative; income is the absolute total.
      db.prepare(
        `SELECT -COALESCE(SUM(amount), 0) AS v FROM BillingRecord WHERE type = 'fee' AND createdAt >= ?`
      ).bind(todayStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS v FROM RechargeOrder WHERE status = 'success' AND payTime >= ?`
      ).bind(todayStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS v FROM RechargeOrder WHERE status = 'success' AND payTime >= ? AND payTime < ?`
      ).bind(yesterdayStart, todayStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS v FROM RechargeOrder WHERE status = 'success' AND payTime >= ?`
      ).bind(weekStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS v FROM RechargeOrder WHERE status = 'success' AND payTime >= ?`
      ).bind(monthStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS v FROM RechargeOrder WHERE status = 'pending'`
      ).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS v FROM RechargeOrder WHERE status = 'failed'`
      ).first<{ v: number }>(),
      db.prepare(`SELECT COALESCE(SUM(feeBalance), 0) AS v FROM User`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM User WHERE feeBalance > 0 AND feeBalance < 5`).first<{ v: number }>(),
      db.prepare(
        `SELECT COUNT(DISTINCT app.userId) AS v FROM "Order" o JOIN App app ON app.id = o.appId WHERE o.createdAt >= ?`
      ).bind(weekStart).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(DISTINCT userId) AS v FROM Device`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(DISTINCT userId) AS v FROM PaymentCode`).first<{ v: number }>(),
      db.prepare(
        `SELECT COUNT(DISTINCT app.userId) AS v FROM "Order" o JOIN App app ON app.id = o.appId WHERE o.status = 'success'`
      ).first<{ v: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS v FROM Device WHERE online = 1 AND status = 'active' AND lastHeartbeat >= ?`
      ).bind(onlineThreshold).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM RechargeOrder WHERE status = 'pending'`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM RechargeOrder WHERE status = 'failed'`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM "Order" WHERE webhookStatus = 'failed'`).first<{ v: number }>(),
      db.prepare(
        `SELECT packageType, COUNT(*) AS count FROM User GROUP BY packageType ORDER BY count DESC`
      ).all<{ packageType: string; count: number }>(),
      db.prepare(
        `SELECT CASE WHEN referredByUserId IS NULL OR referredByUserId = '' THEN 'direct' ELSE 'invite' END AS source,
                COUNT(*) AS count
           FROM User
          GROUP BY source
          ORDER BY count DESC`
      ).all<{ source: string; count: number }>(),
      db.prepare(
        `SELECT substr(createdAt, 1, 10) AS day, COUNT(*) AS count
           FROM User
          WHERE createdAt >= ?
          GROUP BY day
          ORDER BY day ASC`
      ).bind(shanghaiDayStart(now, 13)).all<{ day: string; count: number }>(),
      db.prepare(
        `SELECT substr(COALESCE(payTime, createdAt), 1, 10) AS day, COALESCE(SUM(amount), 0) AS amount
           FROM RechargeOrder
          WHERE status = 'success' AND COALESCE(payTime, createdAt) >= ?
          GROUP BY day
          ORDER BY day ASC`
      ).bind(shanghaiDayStart(now, 13)).all<{ day: string; amount: number }>(),
    ]);

    for (const row of userGrowthRows.results ?? []) {
      const bucket = bucketMap.get(row.day);
      if (bucket) bucket.users = num(row.count);
    }
    for (const row of rechargeTrendRows.results ?? []) {
      const bucket = bucketMap.get(row.day);
      if (bucket) bucket.rechargeAmount = money(row.amount);
    }

    const total = num(totalUsers?.v);
    const funnel = {
      registered: total,
      boundDevice: num(usersWithDevices?.v),
      uploadedCode: num(usersWithCodes?.v),
      activeThisWeek: num(activeUsers?.v),
      successfulPayee: num(usersWithSuccessOrders?.v),
    };

    return adminJson({
      totalUsers: total,
      todayNewUsers: num(todayUsers?.v),
      weekNewUsers: num(weekUsers?.v),
      monthNewUsers: num(monthUsers?.v),
      todaySuccessOrderAmount: money(todayOrderAmount?.v),
      todayFeeIncome: money(todayFee?.v),
      todayRechargeAmount: money(todayRechargeAmount?.v),
      yesterdayRechargeAmount: money(yesterdayRechargeAmount?.v),
      weekRechargeAmount: money(weekRechargeAmount?.v),
      monthRechargeAmount: money(monthRechargeAmount?.v),
      pendingRechargeAmount: money(pendingRechargeAmount?.v),
      failedRechargeAmount: money(failedRechargeAmount?.v),
      totalDeveloperBalance: money(totalDeveloperBalance?.v),
      lowBalanceUsers: num(lowBalanceUsers?.v),
      activeUsers: num(activeUsers?.v),
      onlineDevices: num(onlineDevices?.v),
      rechargePending: num(rechargePending?.v),
      rechargeFailed: num(rechargeFailed?.v),
      webhookFailed: num(webhookFailed?.v),
      packageDistribution: (packageRows.results ?? []).map((row) => ({
        packageType: row.packageType || "free",
        count: num(row.count),
      })),
      acquisitionSources: (referralRows.results ?? []).map((row) => ({
        source: row.source,
        count: num(row.count),
      })),
      funnel,
      trends: dayBuckets,
      generatedAt: isoUtcOffset(now),
    });
  } catch (err) {
    console.error("Admin summary failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
