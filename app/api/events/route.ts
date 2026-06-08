export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { amountFromCents, centsFromAmount, formatAmount, getDirectD1, verifyDeviceSign } from "@/lib/d1-direct";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const events = await prisma.paymentEvent.findMany({
      where: {
        device: { userId: user.id }
      },
      select: {
        id: true,
        deviceId: true,
        payType: true,
        amount: true,
        receivedAt: true,
        matchStatus: true,
        matchedOrderId: true,
        confidence: true,
        notificationHash: true,
        createdAt: true
      },
      take: 100,
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json(events);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      deviceCode, 
      payType, 
      amount, 
      receivedAt, 
      notificationHash, 
      rawNotification,
      timestamp,
      sign
    } = body;
    
    if (!deviceCode || !payType || !amount || !notificationHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDirectD1();
    const device = await db.prepare(`SELECT id, userId, deviceSecret FROM Device WHERE deviceCode = ? LIMIT 1`)
      .bind(deviceCode)
      .first<any>();

    if (!device) {
      return NextResponse.json({ error: "Device not registered" }, { status: 404 });
    }

    if (device.deviceSecret) {
      if (!timestamp || !sign) {
        return NextResponse.json({ error: "Authentication credentials (timestamp and sign) required" }, { status: 401 });
      }
      const isSignValid = await verifyDeviceSign(deviceCode, String(timestamp), device.deviceSecret, sign);
      if (!isSignValid) {
        return NextResponse.json({ error: "Device signature verification failed" }, { status: 401 });
      }
    }

    if (payType !== "wechat" && payType !== "alipay") {
      return NextResponse.json({ error: "Invalid payType" }, { status: 400 });
    }

    let amountCents: number;
    try {
      amountCents = centsFromAmount(amount);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const eventTime = receivedAt ? new Date(receivedAt) : new Date();
    if (Number.isNaN(eventTime.getTime())) {
      return NextResponse.json({ error: "Invalid receivedAt" }, { status: 400 });
    }

    const existingEvent = await db.prepare(`SELECT * FROM PaymentEvent WHERE notificationHash = ? LIMIT 1`)
      .bind(notificationHash)
      .first<any>();
    if (existingEvent) {
      return NextResponse.json({
        status: "success",
        message: "Duplicate event ignored",
        matchStatus: existingEvent.matchStatus,
        matchedOrderId: existingEvent.matchedOrderId,
        event: existingEvent
      });
    }

    const candidates = (await db.prepare(`
      SELECT "Order".id
      FROM "Order"
      JOIN App ON App.id = "Order".appId
      JOIN PaymentCode ON PaymentCode.id = "Order".paymentCodeId
      WHERE App.userId = ?
        AND PaymentCode.deviceId = ?
        AND "Order".payType = ?
        AND "Order".realAmountCents = ?
        AND "Order".status = 'pending'
        AND "Order".expiresAt > ?
      ORDER BY "Order".createdAt ASC
    `).bind(device.userId, device.id, payType, amountCents, eventTime.toISOString()).all<any>()).results || [];

    let matchStatus = "unmatched";
    let matchedOrderId: string | null = null;
    let confidence = 0;

    if (candidates.length === 1) {
      matchedOrderId = candidates[0].id;
      await db.prepare(`UPDATE "Order" SET status = 'success', payTime = ?, webhookStatus = 'unsent' WHERE id = ? AND status = 'pending'`)
        .bind(eventTime.toISOString(), matchedOrderId)
        .run();
      matchStatus = "matched";
      confidence = 100;

      const user = await db.prepare(`SELECT feeBalance FROM User WHERE id = ? LIMIT 1`).bind(device.userId).first<any>();
      if (user) {
        const fee = Math.floor(amountCents * 1) / 10000;
        const newBalance = Math.max(0, Number(user.feeBalance || 0) - fee);
        await db.prepare(`UPDATE User SET feeBalance = ?, updatedAt = ? WHERE id = ?`)
          .bind(newBalance, new Date().toISOString(), device.userId)
          .run();
        await db.prepare(`
          INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
          VALUES (?, 'fee', ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          fee,
          newBalance,
          `技术服务费扣除 (1.0%): 订单 ${matchedOrderId}, 金额 ${formatAmount(amountCents)} 元`,
          new Date().toISOString(),
          device.userId
        ).run();
      }
    } else if (candidates.length > 1) {
      matchStatus = "conflict";
      confidence = 50;
      const ids = candidates.map(row => row.id);
      for (const id of ids) {
        await db.prepare(`UPDATE "Order" SET status = 'manual_review' WHERE id = ? AND status = 'pending'`).bind(id).run();
      }
      await db.prepare(`
        INSERT INTO ExceptionItem (id, type, title, description, createdAt, refId, status, userId)
        VALUES (?, 'payment_conflict', ?, ?, ?, ?, 'active', ?)
      `).bind(
        crypto.randomUUID(),
        `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatAmount(amountCents)} 元存在多笔候选订单`,
        "同一设备同一金额存在多笔待付款订单，系统已转入人工审核，未自动回调商户。",
        new Date().toISOString(),
        notificationHash,
        device.userId
      ).run();
    }

    const eventId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO PaymentEvent (id, deviceId, payType, amount, receivedAt, matchStatus, matchedOrderId, confidence, notificationHash, rawNotification, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      device.id,
      payType,
      amountFromCents(amountCents),
      eventTime.toISOString(),
      matchStatus,
      matchedOrderId,
      confidence,
      notificationHash,
      typeof rawNotification === "string" ? rawNotification.slice(0, 500) : null,
      new Date().toISOString()
    ).run();

    if (matchStatus === "unmatched") {
      await db.prepare(`
        INSERT INTO ExceptionItem (id, type, title, description, createdAt, refId, status, userId)
        VALUES (?, 'payment_unmatched', ?, ?, ?, ?, 'active', ?)
      `).bind(
        crypto.randomUUID(),
        `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatAmount(amountCents)} 元未匹配到订单`,
        `设备收到到账通知 ${formatAmount(amountCents)} 元，但系统云端未找到对应待付款订单。`,
        new Date().toISOString(),
        notificationHash,
        device.userId
      ).run();
    }

    await db.prepare(`UPDATE Device SET online = 1, lastHeartbeat = ?, updatedAt = ? WHERE id = ?`)
      .bind(new Date().toISOString(), new Date().toISOString(), device.id)
      .run();

    return NextResponse.json({
      status: "success",
      matchStatus,
      matchedOrderId,
      event: {
        id: eventId,
        deviceId: device.id,
        payType,
        amount: amountFromCents(amountCents),
        receivedAt: eventTime.toISOString(),
        matchStatus,
        matchedOrderId,
        confidence,
        notificationHash,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Payment event upload failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
