export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { buildVerificationEmail, sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { identifier, email, password } = await req.json();
    const loginId = String(identifier || email || "").trim().toLowerCase();
    if (!loginId) {
      return NextResponse.json({ error: "Account is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    
    const emailLike = loginId.includes("@") ? loginId : `${loginId}@`;
    let user = loginId.includes("@")
      ? await prisma.user.findUnique({ where: { email: loginId } })
      : await prisma.user.findFirst({
        where: {
          email: {
            startsWith: emailLike
          }
        }
      });
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
      const token = createRawToken();
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifyTokenHash: await hashAuthToken(token),
          emailVerifyExpiresAt: addMinutes(new Date(), 24 * 60),
        },
      });
      const emailContent = buildVerificationEmail(updated.email, token);
      await sendEmail({ to: updated.email, ...emailContent });
      return NextResponse.json({ error: "Email not verified", email: updated.email }, { status: 403 });
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
