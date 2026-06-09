export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";
import { randomHex } from "@/lib/random";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;
    const deviceSecret = `sec_${randomHex(32)}`;
    await prisma.device.update({
      where: { id: auth.device.id },
      data: { deviceSecret, boundAt: new Date() }
    });
    return NextResponse.json({ status: "success", deviceSecret });
  } catch (err) {
    console.error("Mobile device secret reset failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
