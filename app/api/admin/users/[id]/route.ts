export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";

const SAFE_USER_FIELDS = `
  id, email, feeBalance, packageType, freeOrderUsed,
  subscriptionStartedAt, subscriptionExpiresAt, adminNote,
  createdAt, updatedAt
`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof NextResponse) return admin;

    const { id: userId } = await params;
    const db = getAuthD1();

    // Fetch user (safe fields only)
    const user = await db
      .prepare(`SELECT ${SAFE_USER_FIELDS} FROM User WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first<Record<string, unknown>>();

    if (!user) {
      return adminJson({ error: "User not found" }, { status: 404 });
    }

    // Fetch related records in parallel
    const [
      billingResult,
      rechargeResult,
      ordersResult,
      devicesResult,
      appsResult,
      auditResult,
    ] = await Promise.all([
      db
        .prepare(
          `SELECT id, type, amount, balance, description, createdAt
           FROM BillingRecord
           WHERE userId = ?
           ORDER BY createdAt DESC
           LIMIT 50`
        )
        .bind(userId)
        .all<Record<string, unknown>>(),

      db
        .prepare(
          `SELECT id, amount, realAmount, payType, status, createdAt, payTime
           FROM RechargeOrder
           WHERE userId = ?
           ORDER BY createdAt DESC
           LIMIT 50`
        )
        .bind(userId)
        .all<Record<string, unknown>>(),

      db
        .prepare(
          `SELECT o.id, o.outOrderNo, o.title, o.amount, o.realAmount,
                  o.status, o.payType, o.createdAt, o.payTime, o.webhookStatus
           FROM "Order" o
           INNER JOIN App a ON o.appId = a.id
           WHERE a.userId = ?
           ORDER BY o.createdAt DESC
           LIMIT 50`
        )
        .bind(userId)
        .all<Record<string, unknown>>(),

      db
        .prepare(
          `SELECT id, name, online, lastHeartbeat, status
           FROM Device
           WHERE userId = ?
           ORDER BY lastHeartbeat DESC
           LIMIT 50`
        )
        .bind(userId)
        .all<Record<string, unknown>>(),

      db
        .prepare(
          `SELECT id, name, appId, notifyUrl, returnUrl, createdAt
           FROM App
           WHERE userId = ?
           ORDER BY createdAt DESC
           LIMIT 50`
        )
        .bind(userId)
        .all<Record<string, unknown>>(),

      db
        .prepare(
          `SELECT id, adminEmail, action, targetType, targetId,
                  beforeJson, afterJson, reason, createdAt
           FROM AdminAuditLog
           WHERE targetId = ?
           ORDER BY createdAt DESC
           LIMIT 50`
        )
        .bind(userId)
        .all<Record<string, unknown>>(),
    ]);

    return adminJson({
      user,
      billingRecords: billingResult.results ?? [],
      rechargeOrders: rechargeResult.results ?? [],
      orders: ordersResult.results ?? [],
      devices: devicesResult.results ?? [],
      apps: appsResult.results ?? [],
      auditLogs: auditResult.results ?? [],
    });
  } catch (err) {
    console.error("Admin user detail failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
