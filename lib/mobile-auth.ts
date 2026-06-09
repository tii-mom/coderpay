import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDeviceSignature } from "@/lib/signature";

const globalRateLimit = globalThis as unknown as {
  coderpayMobileRateLimit?: Map<string, { count: number; resetAt: number }>;
};
const rateLimitBuckets = globalRateLimit.coderpayMobileRateLimit || new Map<string, { count: number; resetAt: number }>();
globalRateLimit.coderpayMobileRateLimit = rateLimitBuckets;

function isRateLimited(key: string, now = Date.now()) {
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 120;
}

export async function getMobileDevice(req: NextRequest) {
  const deviceCode = req.headers.get("x-coderpay-device") || "";
  const timestamp = req.headers.get("x-coderpay-timestamp") || "";
  const sign = req.headers.get("x-coderpay-sign") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateKey = `${deviceCode || "anonymous"}:${ip}`;

  if (isRateLimited(rateKey)) {
    return { error: NextResponse.json({ error: "Too many requests" }, { status: 429 }) };
  }

  if (!deviceCode || !timestamp || !sign) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const device = await prisma.device.findUnique({
    where: { deviceCode },
    include: { user: true }
  });

  if (!device || !device.deviceSecret || !verifyDeviceSignature(deviceCode, timestamp, device.deviceSecret, sign)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { device };
}
