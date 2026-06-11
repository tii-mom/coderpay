export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";

// Operational record only — no automatic refund is performed. This logs a
// refund note to AdminAuditLog so support actions are auditable. No money moves
// and no balance is changed here.
const VALID_KINDS = ["refund_note"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const { id: userId } = await params;
    const body = await req.json();
    const { kind, amount, channel, note, reason } = body;

    if (!kind || !VALID_KINDS.includes(kind)) {
      return adminJson(
        { error: `kind must be one of: ${VALID_KINDS.join(", ")}` },
        { status: 400 }
      );
    }

    const amountNum = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return adminJson({ error: "amount must be a positive number" }, { status: 400 });
    }

    if (!channel || typeof channel !== "string" || !channel.trim()) {
      return adminJson({ error: "channel is required" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return adminJson({ error: "reason is required" }, { status: 400 });
    }

    const db = getAuthD1();

    const user = await db
      .prepare(`SELECT id, email FROM User WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first<{ id: string; email: string }>();

    if (!user) {
      return adminJson({ error: "User not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const auditId = crypto.randomUUID();
    const noteText = typeof note === "string" ? note.trim() : "";

    const detail = {
      amount: Math.round(amountNum * 100) / 100,
      channel: channel.trim(),
      note: noteText,
    };

    await db
      .prepare(
        `INSERT INTO AdminAuditLog (id, adminEmail, action, targetType, targetId, beforeJson, afterJson, reason, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        admin.email,
        kind,
        "user",
        userId,
        null,
        JSON.stringify(detail),
        reason.trim(),
        now
      )
      .run();

    return adminJson({ status: "success" });
  } catch (err) {
    console.error("Admin refund note failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
