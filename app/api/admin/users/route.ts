export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";

const SAFE_USER_FIELDS = `
  id, email, feeBalance, packageType, freeOrderUsed,
  subscriptionStartedAt, subscriptionExpiresAt, adminNote,
  createdAt, updatedAt
`;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof NextResponse) return admin;

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
    const offset = (page - 1) * pageSize;

    const db = getAuthD1();

    let totalResult: { total: number } | null;
    let usersResult: { results?: Record<string, unknown>[] };

    if (q) {
      const pattern = `%${q}%`;
      totalResult = await db
        .prepare(`SELECT COUNT(*) as total FROM User WHERE email LIKE ?`)
        .bind(pattern)
        .first<{ total: number }>();

      usersResult = await db
        .prepare(
          `SELECT ${SAFE_USER_FIELDS} FROM User WHERE email LIKE ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`
        )
        .bind(pattern, pageSize, offset)
        .all<Record<string, unknown>>();
    } else {
      totalResult = await db
        .prepare(`SELECT COUNT(*) as total FROM User`)
        .first<{ total: number }>();

      usersResult = await db
        .prepare(
          `SELECT ${SAFE_USER_FIELDS} FROM User ORDER BY createdAt DESC LIMIT ? OFFSET ?`
        )
        .bind(pageSize, offset)
        .all<Record<string, unknown>>();
    }

    return adminJson({
      users: usersResult.results ?? [],
      page,
      pageSize,
      total: totalResult?.total ?? 0,
    });
  } catch (err) {
    console.error("Admin users list failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
