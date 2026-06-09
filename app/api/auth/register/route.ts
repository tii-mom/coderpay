export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { assertEmailConfigured, buildVerificationEmail, sendEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPassword(value: string) {
  return value.length >= 8;
}

export async function POST(req: NextRequest) {
  try {
    // Limit signups per IP to curb account spam and verification-email abuse.
    const limited = enforceRateLimit(req, { name: "auth:register", limit: 5, windowMs: 300_000 });
    if (limited) return limited;

    const { email, password } = await req.json();
    const normalizedEmail = normalizeEmail(String(email || ""));
    const rawPassword = String(password || "");

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!isValidPassword(rawPassword)) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    assertEmailConfigured();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }

    const token = createRawToken();
    const tokenHash = await hashAuthToken(token);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await hashPassword(rawPassword),
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: addMinutes(new Date(), 24 * 60),
        feeBalance: 0,
        packageType: "free",
      },
    });

    const emailContent = buildVerificationEmail(user.email, token);
    await sendEmail({ to: user.email, ...emailContent });

    return NextResponse.json({
      status: "success",
      message: "Verification email sent",
      email: user.email,
    });
  } catch (err) {
    console.error("Registration failed:", err);
    const status = typeof (err as any)?.status === "number" ? (err as any).status : 500;
    let error = "Internal server error";
    if (status === 503) {
      error = "Email service is not configured";
    } else if ((err as any)?.message === "Email send failed") {
      error = "Email send failed";
    }
    return NextResponse.json({ error }, { status });
  }
}
