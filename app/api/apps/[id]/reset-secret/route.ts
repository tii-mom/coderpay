// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const app = await prisma.app.findUnique({ where: { id } });
    if (!app || app.userId !== user.id) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    
    const appSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    await prisma.app.update({
      where: { id },
      data: { appSecret }
    });
    
    return NextResponse.json({ status: "success", appSecret });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
