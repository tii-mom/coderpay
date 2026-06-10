export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1, runAuthAtomic } from "@/lib/auth-d1";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const { id: userId } = await params;
    const body = await req.json();
    const { adminNote, reason } = body;

    // Validate adminNote
    if (typeof adminNote !== "string") {
      return adminJson(
        { error: "adminNote must be a string" },
        { status: 400 }
      );
    }

    if (adminNote.length > 1000) {
      return adminJson(
        { error: "adminNote must be at most 1000 characters" },
        { status: 400 }
      );
    }

    // Validate reason
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return adminJson(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    const db = getAuthD1();

    // Get current user
    const user = await db
      .prepare(`SELECT id, adminNote FROM User WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first<{ id: string; adminNote: string | null }>();

    if (!user) {
      return adminJson({ error: "User not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const auditId = crypto.randomUUID();

    const beforeJson = JSON.stringify({ adminNote: user.adminNote });
    const afterJson = JSON.stringify({ adminNote });

    await runAuthAtomic(db, [
      db
        .prepare(
          `UPDATE User SET adminNote = ?, updatedAt = ? WHERE id = ?`
        )
        .bind(adminNote, now, userId),

      db
        .prepare(
          `INSERT INTO AdminAuditLog (id, adminEmail, action, targetType, targetId, beforeJson, afterJson, reason, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          admin.email,
          "user_note",
          "user",
          userId,
          beforeJson,
          afterJson,
          reason.trim(),
          now
        ),
    ]);

    return adminJson({ status: "success" });
  } catch (err) {
    console.error("Admin update note failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
