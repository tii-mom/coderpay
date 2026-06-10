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

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const db = getAuthD1();
    const now = Date.now();
    const todayStart = shanghaiTodayStart(now);
    const onlineThreshold = isoUtcOffset(now - 3 * 60 * 1000);

    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const [
      totalUsers,
      todayUsers,
      todayOrderAmount,
      todayFee,
      onlineDevices,
      rechargePending,
      rechargeFailed,
      webhookFailed,
    ] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS v FROM User`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM User WHERE createdAt >= ?`).bind(todayStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(realAmount), 0) AS v FROM "Order" WHERE status = 'success' AND payTime >= ?`
      ).bind(todayStart).first<{ v: number }>(),
      // fee BillingRecord amounts are stored negative; income is the absolute total.
      db.prepare(
        `SELECT -COALESCE(SUM(amount), 0) AS v FROM BillingRecord WHERE type = 'fee' AND createdAt >= ?`
      ).bind(todayStart).first<{ v: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS v FROM Device WHERE online = 1 AND status = 'active' AND lastHeartbeat >= ?`
      ).bind(onlineThreshold).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM RechargeOrder WHERE status = 'pending'`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM RechargeOrder WHERE status = 'failed'`).first<{ v: number }>(),
      db.prepare(`SELECT COUNT(*) AS v FROM "Order" WHERE webhookStatus = 'failed'`).first<{ v: number }>(),
    ]);

    return adminJson({
      totalUsers: num(totalUsers?.v),
      todayNewUsers: num(todayUsers?.v),
      todaySuccessOrderAmount: Math.round(num(todayOrderAmount?.v) * 100) / 100,
      todayFeeIncome: Math.round(num(todayFee?.v) * 100) / 100,
      onlineDevices: num(onlineDevices?.v),
      rechargePending: num(rechargePending?.v),
      rechargeFailed: num(rechargeFailed?.v),
      webhookFailed: num(webhookFailed?.v),
      generatedAt: isoUtcOffset(now),
    });
  } catch (err) {
    console.error("Admin summary failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
