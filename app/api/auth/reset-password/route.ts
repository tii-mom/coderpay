export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashAuthToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, token, password } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawToken = String(token || "");
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawToken) {
      return NextResponse.json({ error: "Email and token are required" }, { status: 400 });
    }
    if (rawPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
    }
    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Reset link expired" }, { status: 400 });
    }

    const tokenHash = await hashAuthToken(rawToken);
    if (tokenHash !== user.passwordResetTokenHash) {
      return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(rawPassword),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
      },
    });

    const response = NextResponse.json({ status: "success" });
    const cookieDomain = req.nextUrl.hostname.endsWith("3api.shop") ? ".3api.shop" : undefined;
    response.cookies.set("session_email", await createSessionToken(updated.email), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: cookieDomain,
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    console.error("Password reset failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
