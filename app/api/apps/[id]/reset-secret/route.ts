export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { randomHex } from "@/lib/random";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const app = await prisma.app.findUnique({ where: { id } });
    if (!app || app.userId !== user.id) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    
    const appSecret = randomHex(16);
    
    await prisma.app.update({
      where: { id },
      data: { appSecret }
    });
    
    return NextResponse.json({ status: "success", appSecret });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
