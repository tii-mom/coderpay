export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDevice } from "@/lib/mobile-auth";
import { amountToCents, centsToAmount } from "@/lib/money";
import { getDirectD1 } from "@/lib/d1-direct";
import { getPaymentPayloadChannelError, normalizeDirectPayFields } from "@/lib/direct-pay";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const type = body.type;
    const codeType = body.codeType || body.code_type;
    const imageUrl = String(body.imageUrl || body.image_url || "");
    const deviceId = body.deviceId || body.device_id || auth.device.id;
    if (type !== "wechat" && type !== "alipay") {
      return NextResponse.json({ error: "Invalid payment code type" }, { status: 400 });
    }
    if (codeType !== "fixed" && codeType !== "any") {
      return NextResponse.json({ error: "Invalid payment code mode" }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }
    const qrPayload = body.qrPayload || body.qr_payload;
    const directPayUrl = body.directPayUrl || body.direct_pay_url;
    const channelError = getPaymentPayloadChannelError(type, qrPayload) || getPaymentPayloadChannelError(type, directPayUrl);
    if (channelError) {
      return NextResponse.json({ error: channelError }, { status: 400 });
    }
    const db = getDirectD1();
    const device = await db.prepare(`SELECT id, userId FROM Device WHERE id = ? LIMIT 1`)
      .bind(deviceId)
      .first<any>();
    if (!device || device.userId !== auth.device.userId) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    let normalizedAmount = 0;
    if (codeType === "fixed") {
      try {
        normalizedAmount = centsToAmount(amountToCents(body.amount));
      } catch {
        return NextResponse.json({ error: "固定金额模式必须填写有效金额，最多保留两位小数" }, { status: 400 });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const alipayUserId = type === "alipay" ? (body.alipayUserId || body.alipay_user_id || null) : null;
    const directPay = normalizeDirectPayFields({
      type,
      amount: codeType === "fixed" ? normalizedAmount : 0,
      alipayUserId,
      qrPayload,
      directPayUrl,
    });
    await db.prepare(`
      INSERT INTO PaymentCode (id, type, codeType, amount, imageUrl, alipayUserId, qrPayload, directPayUrl, directPayMode, status, createdAt, updatedAt, userId, deviceId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).bind(
      id,
      type,
      codeType,
      normalizedAmount,
      imageUrl,
      alipayUserId,
      directPay.qrPayload,
      directPay.directPayUrl,
      directPay.directPayMode,
      now,
      now,
      auth.device.userId,
      deviceId
    ).run();

    const code = await db.prepare(`SELECT * FROM PaymentCode WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();

    return NextResponse.json({ status: "success", code });
  } catch (err: any) {
    console.error("Mobile payment code create failed:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: err.status || 500 });
  }
}
