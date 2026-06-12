export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
    const offset = (page - 1) * pageSize;

    const status = url.searchParams.get("status")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";

    const db = getAuthD1();

    const conditions: string[] = [];
    const bindValues: unknown[] = [];

    if (status) {
      conditions.push("r.status = ?");
      bindValues.push(status);
    }
    if (search) {
      conditions.push("(r.id LIKE ? OR u.email LIKE ?)");
      const pattern = `%${search}%`;
      bindValues.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Count query
    const totalResult = await db
      .prepare(
        `SELECT COUNT(*) as total FROM RechargeOrder r LEFT JOIN User u ON r.userId = u.id ${whereClause}`
      )
      .bind(...bindValues)
      .first<{ total: number }>();

    // Data query
    const ordersResult = await db
      .prepare(
        `SELECT r.id, r.amount, r.realAmount, r.amountCents, r.realAmountCents,
                r.payType, r.status, r.createdAt, r.expiresAt, r.payTime, r.confirmMode,
                u.email as userEmail
         FROM RechargeOrder r
         LEFT JOIN User u ON r.userId = u.id
         ${whereClause}
         ORDER BY r.createdAt DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...bindValues, pageSize, offset)
      .all<Record<string, unknown>>();

    return adminJson({
      orders: ordersResult.results ?? [],
      page,
      pageSize,
      total: totalResult?.total ?? 0,
    });
  } catch (err) {
    console.error("Admin recharge orders list failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
