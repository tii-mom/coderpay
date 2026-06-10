export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";

// Read-only CSV export, admin-protected. type = users | billing | audit.
// Capped row count to keep edge responses bounded.
const MAX_ROWS = 10000;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  // Prepend BOM so Excel reads UTF-8 (Chinese text) correctly.
  return "﻿" + lines.join("\r\n");
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "users";
    const db = getAuthD1();

    let headers: string[];
    let rows: Record<string, unknown>[];
    let filename: string;

    if (type === "users") {
      headers = [
        "id", "email", "feeBalance", "packageType", "freeOrderUsed",
        "subscriptionStartedAt", "subscriptionExpiresAt", "adminNote", "createdAt",
      ];
      const result = await db
        .prepare(
          `SELECT id, email, feeBalance, packageType, freeOrderUsed,
                  subscriptionStartedAt, subscriptionExpiresAt, adminNote, createdAt
           FROM User ORDER BY createdAt DESC LIMIT ?`
        )
        .bind(MAX_ROWS)
        .all<Record<string, unknown>>();
      rows = result.results ?? [];
      filename = "users";
    } else if (type === "billing") {
      headers = ["id", "userId", "type", "amount", "balance", "description", "createdAt"];
      const userId = url.searchParams.get("userId")?.trim() || "";
      const sql = userId
        ? `SELECT id, userId, type, amount, balance, description, createdAt FROM BillingRecord WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`
        : `SELECT id, userId, type, amount, balance, description, createdAt FROM BillingRecord ORDER BY createdAt DESC LIMIT ?`;
      const stmt = userId ? db.prepare(sql).bind(userId, MAX_ROWS) : db.prepare(sql).bind(MAX_ROWS);
      const result = await stmt.all<Record<string, unknown>>();
      rows = result.results ?? [];
      filename = "billing";
    } else if (type === "audit") {
      headers = [
        "id", "adminEmail", "action", "targetType", "targetId",
        "beforeJson", "afterJson", "reason", "createdAt",
      ];
      const result = await db
        .prepare(
          `SELECT id, adminEmail, action, targetType, targetId,
                  beforeJson, afterJson, reason, createdAt
           FROM AdminAuditLog ORDER BY createdAt DESC LIMIT ?`
        )
        .bind(MAX_ROWS)
        .all<Record<string, unknown>>();
      rows = result.results ?? [];
      filename = "audit-logs";
    } else {
      const res = NextResponse.json({ error: "invalid type" }, { status: 400 });
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }

    const csv = toCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="coderpay-${filename}-${stamp}.csv"`,
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Admin export failed:", err);
    const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
}
