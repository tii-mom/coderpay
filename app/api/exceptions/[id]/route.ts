// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const body = await req.json();
    const { status } = body;
    
    const exception = await prisma.exceptionItem.findUnique({ where: { id } });
    if (!exception || exception.userId !== user.id) {
      return NextResponse.json({ error: "Exception item not found" }, { status: 404 });
    }
    
    const updated = await prisma.exceptionItem.update({
      where: { id },
      data: { status }
    });
    
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
