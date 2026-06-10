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
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50", 10) || 50));
    const offset = (page - 1) * pageSize;

    const targetId = url.searchParams.get("targetId")?.trim() || "";
    const adminEmail = url.searchParams.get("adminEmail")?.trim() || "";
    const action = url.searchParams.get("action")?.trim() || "";
    const from = url.searchParams.get("from")?.trim() || "";
    const to = url.searchParams.get("to")?.trim() || "";

    const db = getAuthD1();

    // Build dynamic WHERE clause
    const conditions: string[] = [];
    const bindValues: unknown[] = [];

    if (targetId) {
      conditions.push("targetId = ?");
      bindValues.push(targetId);
    }
    if (adminEmail) {
      conditions.push("LOWER(adminEmail) = LOWER(?)");
      bindValues.push(adminEmail);
    }
    if (action) {
      conditions.push("action = ?");
      bindValues.push(action);
    }
    if (from) {
      conditions.push("createdAt >= ?");
      bindValues.push(from);
    }
    if (to) {
      conditions.push("createdAt <= ?");
      bindValues.push(to);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Count query
    const totalResult = await db
      .prepare(`SELECT COUNT(*) as total FROM AdminAuditLog ${whereClause}`)
      .bind(...bindValues)
      .first<{ total: number }>();

    // Data query
    const logsResult = await db
      .prepare(
        `SELECT id, adminEmail, action, targetType, targetId,
                beforeJson, afterJson, reason, createdAt
         FROM AdminAuditLog
         ${whereClause}
         ORDER BY createdAt DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...bindValues, pageSize, offset)
      .all<Record<string, unknown>>();

    return adminJson({
      logs: logsResult.results ?? [],
      page,
      pageSize,
      total: totalResult?.total ?? 0,
    });
  } catch (err) {
    console.error("Admin audit logs failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
