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
    const { delta, reason, confirmEmail } = body;

    // Validate delta
    if (typeof delta !== "number" || !Number.isFinite(delta)) {
      return adminJson(
        { error: "delta must be a finite number" },
        { status: 400 }
      );
    }

    // Max 2 decimal places
    const rounded = Math.round(delta * 100) / 100;
    if (Math.abs(delta - rounded) > 1e-9) {
      return adminJson(
        { error: "delta must have at most 2 decimal places" },
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

    // Get current balance
    const user = await db
      .prepare(`SELECT id, feeBalance, email FROM User WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first<{ id: string; feeBalance: number; email: string }>();

    if (!user) {
      return adminJson({ error: "User not found" }, { status: 404 });
    }

    // P0-2: deductions require typing the target user's email to confirm.
    if (delta < 0) {
      const provided = typeof confirmEmail === "string" ? confirmEmail.trim().toLowerCase() : "";
      if (provided !== user.email.trim().toLowerCase()) {
        return adminJson(
          { error: "扣减余额需输入正确的目标用户邮箱进行确认" },
          { status: 400 }
        );
      }
    }

    const currentBalance = user.feeBalance ?? 0;
    const newBalance = Math.round((currentBalance + delta) * 100) / 100;

    if (newBalance < 0) {
      return adminJson(
        {
          error: `Resulting balance would be negative (${newBalance}). Current: ${currentBalance}, delta: ${delta}`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const billingId = crypto.randomUUID();
    const auditId = crypto.randomUUID();

    const beforeJson = JSON.stringify({ feeBalance: currentBalance });
    const afterJson = JSON.stringify({ feeBalance: newBalance });
    const auditReason = delta < 0
      ? `${reason.trim()} [扣减确认: ${user.email}]`
      : reason.trim();

    await runAuthAtomic(db, [
      db
        .prepare(
          `UPDATE User SET feeBalance = ?, updatedAt = ? WHERE id = ?`
        )
        .bind(newBalance, now, userId),

      db
        .prepare(
          `INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          billingId,
          "admin_adjust",
          delta,
          newBalance,
          `管理员调整余额: ${auditReason}`,
          now,
          userId
        ),

      db
        .prepare(
          `INSERT INTO AdminAuditLog (id, adminEmail, action, targetType, targetId, beforeJson, afterJson, reason, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          admin.email,
          "balance_adjust",
          "user",
          userId,
          beforeJson,
          afterJson,
          auditReason,
          now
        ),
    ]);

    return adminJson({
      status: "success",
      feeBalance: newBalance,
    });
  } catch (err) {
    console.error("Admin adjust balance failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
