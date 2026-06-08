export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashAuthToken } from "@/lib/auth-tokens";
import { createSessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawToken = String(token || "");
    if (!normalizedEmail || !rawToken) {
      return NextResponse.json({ error: "Email and token are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.emailVerifyTokenHash || !user.emailVerifyExpiresAt) {
      return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
    }
    if (user.emailVerifyExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Verification link expired" }, { status: 400 });
    }

    const tokenHash = await hashAuthToken(rawToken);
    if (tokenHash !== user.emailVerifyTokenHash) {
      return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
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
    console.error("Email verification failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
