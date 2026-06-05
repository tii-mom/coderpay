// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const apps = await prisma.app.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(apps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { name, notifyUrl, returnUrl, feedbackUrl, expireMinutes, signType } = await req.json();
    if (!name || !notifyUrl) {
      return NextResponse.json({ error: "Name and notifyUrl are required" }, { status: 400 });
    }
    
    const appId = Math.floor(10000 + Math.random() * 90000).toString();
    const appSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    const app = await prisma.app.create({
      data: {
        appId,
        appSecret,
        name,
        notifyUrl,
        returnUrl: returnUrl || "https://example.com/success",
        feedbackUrl: feedbackUrl || "https://example.com/support",
        expireMinutes: expireMinutes ? Number(expireMinutes) : 5,
        signType: signType || "HMAC-SHA256",
        userId: user.id
      }
    });
    
    return NextResponse.json(app);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
