export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAuthD1, runAuthAtomic } from "@/lib/auth-d1";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { assertEmailConfigured, buildVerificationEmail, sendEmail } from "@/lib/email";
import { createUniqueInviteCode, normalizeInviteCode } from "@/lib/referrals";

const INVITE_SIGNUP_BONUS_CENTS = 1000;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    // Limit signups per IP to curb account spam.
    const limited = enforceRateLimit(req, { name: "auth:register", limit: 5, windowMs: 300_000 });
    if (limited) return limited;

    const { email, password, inviteCode, invite_code } = await req.json();
    const normalizedEmail = normalizeEmail(String(email || ""));
    const rawPassword = String(password || "");
    const normalizedInviteCode = normalizeInviteCode(inviteCode || invite_code);

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!rawPassword) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    assertEmailConfigured();

    const db = getAuthD1();
    const existing = await db.prepare(`SELECT id FROM User WHERE email = ? LIMIT 1`)
      .bind(normalizedEmail)
      .first();
    if (existing) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }

    let referrer: { id: string; email: string } | null = null;
    if (normalizedInviteCode) {
      referrer = await db.prepare(`SELECT id, email FROM User WHERE inviteCode = ? LIMIT 1`)
        .bind(normalizedInviteCode)
        .first<{ id: string; email: string }>();
      if (!referrer) {
        return NextResponse.json({ error: "Invalid inviteCode" }, { status: 400 });
      }
      if (normalizeEmail(referrer.email) === normalizedEmail) {
        return NextResponse.json({ error: "Cannot use your own inviteCode" }, { status: 400 });
      }
    }

    const token = createRawToken();
    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash: await hashPassword(rawPassword),
      feeBalance: referrer ? INVITE_SIGNUP_BONUS_CENTS / 100 : 0,
    };
    const now = new Date().toISOString();
    const userInviteCode = await createUniqueInviteCode(db);
    const packageType = "trial";

    const writes = [
      db.prepare(`
      INSERT INTO User (
        id, email, passwordHash, emailVerifyTokenHash, emailVerifyExpiresAt, feeBalance, packageType,
        freeOrderUsed, firstProDiscountUsed, firstMaxDiscountUsed, inviteCode, referredByUserId, referredAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      user.email,
      user.passwordHash,
      await hashAuthToken(token),
      addMinutes(new Date(), 24 * 60).toISOString(),
      user.feeBalance,
      packageType,
      userInviteCode,
      referrer?.id ?? null,
      referrer ? now : null,
      now,
      now
    ),
    ];

    if (referrer) {
      writes.push(
        db.prepare(`
          INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
          VALUES (?, 'invite_bonus', ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          user.feeBalance,
          user.feeBalance,
          `填写邀请码注册赠送: 邀请人 ${referrer.id}`,
          now,
          user.id
        )
      );
    }

    await runAuthAtomic(db, writes);

    await sendEmail({ to: user.email, ...buildVerificationEmail(user.email, token) });

    return NextResponse.json({
      status: "success",
      requiresVerification: true,
      user: {
        id: user.id,
        email: user.email,
        feeBalance: user.feeBalance,
        packageType,
        inviteCode: userInviteCode,
      },
    });
  } catch (err) {
    console.error("Registration failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
