export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { amountToCents, centsToAmount } from "@/lib/money";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const codes = await prisma.paymentCode.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(codes);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { type, codeType, amount, imageUrl, deviceId } = await req.json();
    if (!type || !codeType || !imageUrl) {
      return NextResponse.json({ error: "Type, codeType, and imageUrl are required" }, { status: 400 });
    }
    if (type !== "wechat" && type !== "alipay") {
      return NextResponse.json({ error: "Invalid payment code type" }, { status: 400 });
    }
    if (codeType !== "fixed" && codeType !== "any") {
      return NextResponse.json({ error: "Invalid payment code mode" }, { status: 400 });
    }
    let normalizedAmount = 0;
    if (codeType === "fixed") {
      try {
        normalizedAmount = centsToAmount(amountToCents(amount));
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    if (deviceId) {
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!device || device.userId !== user.id) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }
    }
    
    const code = await prisma.paymentCode.create({
      data: {
        type,
        codeType,
        amount: codeType === "any" ? 0.0 : normalizedAmount,
        imageUrl,
        status: "active",
        deviceId: deviceId || null,
        userId: user.id
      }
    });
    
    return NextResponse.json(code);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
