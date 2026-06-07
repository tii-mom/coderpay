export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const body = await req.json();
    const { name, notifyUrl, returnUrl, feedbackUrl, expireMinutes, signType } = body;
    
    const app = await prisma.app.findUnique({ where: { id } });
    if (!app || app.userId !== user.id) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    
    const updated = await prisma.app.update({
      where: { id },
      data: {
        name,
        notifyUrl,
        returnUrl,
        feedbackUrl,
        expireMinutes: expireMinutes ? Number(expireMinutes) : undefined,
        signType
      }
    });
    
    return NextResponse.json(updated);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const app = await prisma.app.findUnique({ where: { id } });
    if (!app || app.userId !== user.id) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    
    await prisma.app.delete({ where: { id } });
    return NextResponse.json({ status: "success", message: "Application deleted successfully" });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
