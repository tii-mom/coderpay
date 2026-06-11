export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const device = auth.device;

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const type = url.searchParams.get("type") || "";

    const skip = (page - 1) * limit;

    const where: any = {
      userId: device.userId
    };

    if (type) {
      where.type = type;
    }

    const [billingRecords, total] = await Promise.all([
      prisma.billingRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.billingRecord.count({ where }),
    ]);

    return NextResponse.json({
      billingRecords,
      total,
      page,
      limit,
      hasMore: total > skip + billingRecords.length,
    });
  } catch (err: any) {
    console.error("Mobile get billing records failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
