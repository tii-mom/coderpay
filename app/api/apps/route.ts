export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { randomHex, randomNumericCode } from "@/lib/random";

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const apps = await prisma.app.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        appId: true,
        notifyUrl: true,
        returnUrl: true,
        feedbackUrl: true,
        expireMinutes: true,
        signType: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(apps);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    if (!isHttpsUrl(notifyUrl)) {
      return NextResponse.json({ error: "notifyUrl must be a valid https URL" }, { status: 400 });
    }
    if (returnUrl && !isHttpsUrl(returnUrl)) {
      return NextResponse.json({ error: "returnUrl must be a valid https URL" }, { status: 400 });
    }
    if (feedbackUrl && !isHttpsUrl(feedbackUrl)) {
      return NextResponse.json({ error: "feedbackUrl must be a valid https URL" }, { status: 400 });
    }
    
    const appId = randomNumericCode(10);
    const appSecret = randomHex(16);
    
    const app = await prisma.app.create({
      data: {
        appId,
        appSecret,
        name,
        notifyUrl,
        returnUrl: returnUrl || "",
        feedbackUrl: feedbackUrl || "",
        expireMinutes: expireMinutes ? Number(expireMinutes) : 5,
        signType: signType || "HMAC-SHA256",
        userId: user.id
      }
    });
    
    return NextResponse.json(app);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
