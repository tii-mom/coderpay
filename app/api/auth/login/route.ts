export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && demoMode) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: "password_hash",
          feeBalance: 100.0
        }
      });
    }
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 401 });
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
