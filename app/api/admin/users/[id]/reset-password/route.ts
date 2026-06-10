export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1, runAuthAtomic } from "@/lib/auth-d1";
import { hashPassword } from "@/lib/password";

// Manual password reset for support cases where a user forgot their password
// and email delivery is unavailable. The admin must confirm the target email.
// The new password and its hash are NEVER written to the audit log or returned.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const { id: userId } = await params;
    const body = await req.json();
    const { newPassword, reason, confirmEmail } = body;

    if (typeof newPassword !== "string" || !newPassword.trim()) {
      return adminJson({ error: "newPassword is required" }, { status: 400 });
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

    const provided = typeof confirmEmail === "string" ? confirmEmail.trim().toLowerCase() : "";
    if (provided !== user.email.trim().toLowerCase()) {
      return adminJson(
        { error: "重置密码需输入正确的目标用户邮箱进行确认" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    const auditId = crypto.randomUUID();

    await runAuthAtomic(db, [
      db
        .prepare(
          `UPDATE User SET passwordHash = ?, passwordResetTokenHash = NULL, passwordResetExpiresAt = NULL, updatedAt = ? WHERE id = ?`
        )
        .bind(passwordHash, now, userId),

      db
        .prepare(
          `INSERT INTO AdminAuditLog (id, adminEmail, action, targetType, targetId, beforeJson, afterJson, reason, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          admin.email,
          "password_reset",
          "user",
          userId,
          // never log password material — only that a reset happened.
          JSON.stringify({ passwordReset: true }),
          JSON.stringify({ passwordReset: true }),
          `${reason.trim()} [重置确认: ${user.email}]`,
          now
        ),
    ]);

    return adminJson({ status: "success" });
  } catch (err) {
    console.error("Admin reset password failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
