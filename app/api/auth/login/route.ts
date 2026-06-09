export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { buildVerificationEmail, sendEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

async function sendVerificationEmailIfPossible(email: string) {
  const token = createRawToken();
  const updated = await prisma.user.update({
    where: { email },
    data: {
      emailVerifyTokenHash: await hashAuthToken(token),
      emailVerifyExpiresAt: addMinutes(new Date(), 24 * 60),
    },
  });
  const emailContent = buildVerificationEmail(updated.email, token);
  await sendEmail({ to: updated.email, ...emailContent });
  return updated.email;
}

export async function POST(req: NextRequest) {
  try {
    // Throttle password attempts to slow credential brute-forcing.
    const limited = enforceRateLimit(req, { name: "auth:login", limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    const { identifier, email, password } = await req.json();
    const loginId = String(identifier || email || "").trim().toLowerCase();
    if (!loginId) {
      return NextResponse.json({ error: "Account is required" }, { status: 400 });
    }
    if (!loginId.includes("@")) {
      // Login must use the full registered email. Matching by local-part prefix
      // could resolve to a different user (emails sharing a local-part).
      return NextResponse.json({ error: "请输入完整的注册邮箱" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email: loginId } });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 401 });
    }

    if (user.passwordHash === "password_hash") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) }
      });
    } else if (!(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!user.emailVerifiedAt) {
      try {
        const email = await sendVerificationEmailIfPossible(user.email);
        return NextResponse.json({ error: "Email not verified", email }, { status: 403 });
      } catch (emailErr) {
        console.error("Verification resend during login failed:", emailErr);
        return NextResponse.json({
          error: "Email not verified",
          email: user.email,
          emailSent: false,
        }, { status: 403 });
      }
    }
    
    const response = NextResponse.json({
      status: "success",
      user: { id: user.id, email: user.email, feeBalance: user.feeBalance }
    });

    const cookieDomain = req.nextUrl.hostname.endsWith("3api.shop") ? ".3api.shop" : undefined;
    
    response.cookies.set("session_email", await createSessionToken(user.email), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: cookieDomain,
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    return response;
  } catch (err) {
    console.error("Login failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
