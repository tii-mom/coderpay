export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/session";
import { getSessionCookieOptions } from "@/lib/session-cookie";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";

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

    const response = NextResponse.json({
      status: "success",
      user: { id: user.id, email: user.email, feeBalance: user.feeBalance }
    });

    response.cookies.set("session_email", await createSessionToken(user.email), getSessionCookieOptions(req));
    
    return response;
  } catch (err) {
    console.error("Login failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
