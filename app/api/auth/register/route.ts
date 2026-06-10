export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/session";
import { getSessionCookieOptions } from "@/lib/session-cookie";
import { enforceRateLimit } from "@/lib/rate-limit";

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

    const { email, password } = await req.json();
    const normalizedEmail = normalizeEmail(String(email || ""));
    const rawPassword = String(password || "");

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!rawPassword) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await hashPassword(rawPassword),
        feeBalance: 0,
        packageType: "free",
        emailVerifiedAt: new Date(),
      },
    });

    const response = NextResponse.json({
      status: "success",
      user: {
        id: user.id,
        email: user.email,
        feeBalance: user.feeBalance,
      },
    });

    response.cookies.set("session_email", await createSessionToken(user.email), getSessionCookieOptions(req));

    return response;
  } catch (err) {
    console.error("Registration failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
