export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAuthD1 } from "@/lib/auth-d1";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { assertEmailConfigured, buildVerificationEmail, sendEmail } from "@/lib/email";
import { createUniqueInviteCode, normalizeInviteCode } from "@/lib/referrals";

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
      feeBalance: 0,
    };
    const now = new Date().toISOString();
    const userInviteCode = await createUniqueInviteCode(db);

    await db.prepare(`
      INSERT INTO User (
        id, email, passwordHash, emailVerifyTokenHash, emailVerifyExpiresAt, feeBalance, packageType,
        freeOrderUsed, firstProDiscountUsed, firstMaxDiscountUsed, inviteCode, referredByUserId, referredAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 0, 'free', 0, 0, 0, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      user.email,
      user.passwordHash,
      await hashAuthToken(token),
      addMinutes(new Date(), 24 * 60).toISOString(),
      userInviteCode,
      referrer?.id ?? null,
      referrer ? now : null,
      now,
      now
    ).run();

    await sendEmail({ to: user.email, ...buildVerificationEmail(user.email, token) });

    return NextResponse.json({
      status: "success",
      requiresVerification: true,
      user: {
        id: user.id,
        email: user.email,
        feeBalance: user.feeBalance,
        inviteCode: userInviteCode,
      },
    });
  } catch (err) {
    console.error("Registration failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
