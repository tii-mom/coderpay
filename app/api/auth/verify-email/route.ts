export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashAuthToken } from "@/lib/auth-tokens";
import { createSessionToken } from "@/lib/session";
import { getSessionCookieOptions } from "@/lib/session-cookie";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Throttle to slow brute-forcing of the verification token.
    const limited = enforceRateLimit(req, { name: "auth:verify-email", limit: 10, windowMs: 60_000 });
    if (limited) return limited;

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
    response.cookies.set("session_email", await createSessionToken(updated.email), getSessionCookieOptions(req));
    return response;
  } catch (err) {
    console.error("Email verification failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
