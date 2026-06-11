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
    const status = url.searchParams.get("status") || "";
    const type = url.searchParams.get("type") || "";

    const skip = (page - 1) * limit;

    const where: any = {
      userId: device.userId
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [exceptions, total] = await Promise.all([
      prisma.exceptionItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.exceptionItem.count({ where }),
    ]);

    return NextResponse.json({
      exceptions,
      total,
      page,
      limit,
      hasMore: total > skip + exceptions.length,
    });
  } catch (err: any) {
    console.error("Mobile get exceptions failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
