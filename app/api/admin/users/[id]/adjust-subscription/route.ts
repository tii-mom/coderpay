export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1, runAuthAtomic } from "@/lib/auth-d1";

const VALID_PACKAGE_TYPES = ["trial", "pro", "max"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const { id: userId } = await params;
    const body = await req.json();
    const { packageType, subscriptionExpiresAt, reason, confirmEmail } = body;

    // Validate packageType
    if (!packageType || !VALID_PACKAGE_TYPES.includes(packageType)) {
      return adminJson(
        { error: `packageType must be one of: ${VALID_PACKAGE_TYPES.join(", ")}` },
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

    // For pro/max: subscriptionExpiresAt must be a valid future date.
    // The trial plan is subscription-free, so it intentionally has no expiry.
    let expiresAt: string | null = null;
    if (packageType === "pro" || packageType === "max") {
      if (!subscriptionExpiresAt || typeof subscriptionExpiresAt !== "string") {
        return adminJson(
          { error: "subscriptionExpiresAt is required for pro/max plans" },
          { status: 400 }
        );
      }
      const parsed = new Date(subscriptionExpiresAt);
      if (isNaN(parsed.getTime())) {
        return adminJson(
          { error: "subscriptionExpiresAt must be a valid date" },
          { status: 400 }
        );
      }
      if (parsed.getTime() <= Date.now()) {
        return adminJson(
          { error: "subscriptionExpiresAt must be in the future" },
          { status: 400 }
        );
      }
      expiresAt = parsed.toISOString();
    }

    const db = getAuthD1();

    // Get current user
    const user = await db
      .prepare(
        `SELECT id, email, packageType, feeBalance, subscriptionStartedAt, subscriptionExpiresAt
         FROM User WHERE id = ? LIMIT 1`
      )
      .bind(userId)
      .first<{
        id: string;
        email: string;
        packageType: string;
        feeBalance: number;
        subscriptionStartedAt: string | null;
        subscriptionExpiresAt: string | null;
      }>();

    if (!user) {
      return adminJson({ error: "User not found" }, { status: 404 });
    }

    // P0-2: downgrading (to trial, or shortening the expiry of a paid plan) is
    // destructive, so require the admin to type the target user's email.
    const isDowngradeToTrial = packageType === "trial" && user.packageType !== "free" && user.packageType !== "trial";
    const oldExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() : null;
    const newExpiry = expiresAt ? new Date(expiresAt).getTime() : null;
    const isShortenExpiry =
      (packageType === "pro" || packageType === "max") &&
      oldExpiry !== null &&
      newExpiry !== null &&
      newExpiry < oldExpiry;
    const requiresConfirm = isDowngradeToTrial || isShortenExpiry;

    if (requiresConfirm) {
      const provided = typeof confirmEmail === "string" ? confirmEmail.trim().toLowerCase() : "";
      if (provided !== user.email.trim().toLowerCase()) {
        return adminJson(
          { error: "降级订阅或缩短到期时间需输入正确的目标用户邮箱进行确认" },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const billingId = crypto.randomUUID();
    const auditId = crypto.randomUUID();

    const beforeJson = JSON.stringify({
      packageType: user.packageType,
      subscriptionStartedAt: user.subscriptionStartedAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    });

    // For trial/pro/max, set subscriptionStartedAt to now if upgrading from historical free
    const subscriptionStartedAt =
      packageType === "trial"
        ? now
        : user.subscriptionStartedAt ?? now;

    const afterJson = JSON.stringify({
      packageType,
      subscriptionStartedAt,
      subscriptionExpiresAt: expiresAt,
    });

    const auditReason = requiresConfirm
      ? `${reason.trim()} [降级确认: ${user.email}]`
      : reason.trim();

    await runAuthAtomic(db, [
      db
        .prepare(
          `UPDATE User
           SET packageType = ?, subscriptionStartedAt = ?, subscriptionExpiresAt = ?, updatedAt = ?
           WHERE id = ?`
        )
        .bind(packageType, subscriptionStartedAt, expiresAt, now, userId),

      db
        .prepare(
          `INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          billingId,
          "admin_subscription",
          0,
          user.feeBalance ?? 0,
          `管理员调整订阅: ${packageType}, ${auditReason}`,
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
          "subscription_adjust",
          "user",
          userId,
          beforeJson,
          afterJson,
          auditReason,
          now
        ),
    ]);

    return adminJson({ status: "success" });
  } catch (err) {
    console.error("Admin adjust subscription failed:", err);
    return adminJson(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
