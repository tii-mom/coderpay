export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";
import { getSessionCookieOptions } from "@/lib/session-cookie";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getAuthD1 } from "@/lib/auth-d1";

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

    const db = getAuthD1();
    let user = await db.prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
      .bind(loginId)
      .first<any>();
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 401 });
    }

    if (user.passwordHash === "password_hash") {
      const passwordHash = await hashPassword(password);
      await db.prepare(`UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?`)
        .bind(passwordHash, new Date().toISOString(), user.id)
        .run();
      user = { ...user, passwordHash };
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
