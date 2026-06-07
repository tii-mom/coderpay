export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const orders = await prisma.order.findMany({
      where: {
        app: { userId: user.id }
      },
      include: { app: true },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(orders);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
