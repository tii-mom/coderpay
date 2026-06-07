export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { identifier, email, password } = await req.json();
    const loginId = String(identifier || email || "").trim();
    if (!loginId) {
      return NextResponse.json({ error: "Account is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
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
    if (!user && demoMode) {
      user = await prisma.user.create({
        data: {
          email: loginId.includes("@") ? loginId : `${loginId}@example.com`,
          passwordHash: "password_hash",
          feeBalance: 100.0
        }
      });
    }
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 401 });
    }
    if (user.passwordHash === "password_hash" && password !== "password123") {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    
    const response = NextResponse.json({
      status: "success",
      user: { id: user.id, email: user.email, feeBalance: user.feeBalance }
    });
    
    response.cookies.set("session_email", user.email, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    
    return response;
  } catch (err) {
    console.error("Login failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
