// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const records = await prisma.billingRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json({
      feeBalance: user.feeBalance,
      records
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
