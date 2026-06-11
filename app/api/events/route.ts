export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { amountFromCents, centsFromAmount, formatAmount, getDirectD1, verifyDeviceSign, runAtomic } from "@/lib/d1-direct";
import { calculateFeeCents } from "@/lib/billing-plans";
import { triggerWebhook } from "@/lib/webhook";
import { getRechargePromotion, getRechargePromotionDescription, getRechargePromotionUpdate } from "@/lib/recharge-promotions";

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
      SELECT "Order".id, "Order".amountCents
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
    let shouldTriggerWebhook = false;
    const nowIso = new Date().toISOString();
    const eventId = crypto.randomUUID();
    // Writes that must commit together with the PaymentEvent row once an order or
    // recharge is claimed. The claim UPDATE itself stays separate (it's the
    // idempotency gate via meta.changes); everything after the claim — balance
    // change, billing record, and the PaymentEvent audit row — is batched into a
    // single atomic commit so we can't leave a charged-but-unrecorded state.
    const financialWrites: ReturnType<ReturnType<typeof db.prepare>["bind"]>[] = [];

    const rechargeCandidates = (await db.prepare(`
      SELECT RechargeOrder.id, RechargeOrder.userId, RechargeOrder.amountCents, RechargeOrder.realAmountCents
      FROM RechargeOrder
      JOIN PaymentCode ON PaymentCode.id = RechargeOrder.paymentCodeId
      WHERE PaymentCode.userId = ?
        AND PaymentCode.deviceId = ?
        AND RechargeOrder.payType = ?
        AND RechargeOrder.realAmountCents = ?
        AND RechargeOrder.status = 'pending'
        AND RechargeOrder.expiresAt > ?
      ORDER BY RechargeOrder.createdAt ASC
    `).bind(device.userId, device.id, payType, amountCents, eventTime.toISOString()).all<any>()).results || [];

    if (rechargeCandidates.length === 1) {
      const rechargeOrder = rechargeCandidates[0];
      // Atomically claim the recharge order: only the request whose UPDATE flips
      // the row from 'pending' credits the balance, so retries can't double-credit.
      const claim = await db.prepare(`UPDATE RechargeOrder SET status = 'success', payTime = ? WHERE id = ? AND status = 'pending'`)
        .bind(eventTime.toISOString(), rechargeOrder.id)
        .run();
      if ((claim?.meta?.changes ?? 0) > 0) {
        matchedOrderId = rechargeOrder.id;
        matchStatus = "matched";
        confidence = 100;

        const user = await db.prepare(`SELECT feeBalance, packageType, subscriptionExpiresAt FROM User WHERE id = ? LIMIT 1`).bind(rechargeOrder.userId).first<any>();
        if (user) {
          const chargeAmount = amountFromCents(Number(rechargeOrder.amountCents));
          const newBalance = Number((Number(user.feeBalance || 0) + chargeAmount).toFixed(2));
          const promotion = getRechargePromotion(Number(rechargeOrder.amountCents));
          const promotionUpdate = promotion ? getRechargePromotionUpdate(user, promotion, eventTime) : null;
          if (promotionUpdate) {
            financialWrites.push(
              db.prepare(`UPDATE User SET feeBalance = ?, packageType = ?, subscriptionExpiresAt = ?, updatedAt = ? WHERE id = ?`)
                .bind(newBalance, promotionUpdate.packageType, promotionUpdate.subscriptionExpiresAt.toISOString(), nowIso, rechargeOrder.userId)
            );
          } else {
            financialWrites.push(
              db.prepare(`UPDATE User SET feeBalance = ?, updatedAt = ? WHERE id = ?`)
                .bind(newBalance, nowIso, rechargeOrder.userId)
            );
          }
          financialWrites.push(
            db.prepare(`
              INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
              VALUES (?, 'charge', ?, ?, ?, ?, ?)
            `).bind(
              crypto.randomUUID(),
              chargeAmount,
              newBalance,
              `真实充值入账: 充值单 ${rechargeOrder.id}, 实付 ${formatAmount(Number(rechargeOrder.realAmountCents))} 元`,
              nowIso,
              rechargeOrder.userId
            )
          );
          if (promotion && promotionUpdate) {
            financialWrites.push(
              db.prepare(`
                INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
                VALUES (?, 'promotion', 0, ?, ?, ?, ?)
              `).bind(
                crypto.randomUUID(),
                newBalance,
                `${getRechargePromotionDescription(promotion)}: 充值单 ${rechargeOrder.id}`,
                nowIso,
                rechargeOrder.userId
              )
            );
          }
        }
      }
    } else if (rechargeCandidates.length > 1) {
      matchStatus = "conflict";
      confidence = 50;
      await db.prepare(`
        INSERT INTO ExceptionItem (id, type, title, description, createdAt, refId, status, userId)
        VALUES (?, 'payment_conflict', ?, ?, ?, ?, 'active', ?)
      `).bind(
        crypto.randomUUID(),
        `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatAmount(amountCents)} 元存在多笔充值候选`,
        "平台充值收款码同一设备同一金额存在多笔待充值单，系统已转入人工审核，未自动入账。",
        new Date().toISOString(),
        notificationHash,
        device.userId
      ).run();
    } else if (candidates.length === 1) {
      const candidate = candidates[0];
      // Atomically claim the order. Only the request that flips it from 'pending'
      // charges the fee and fires the merchant webhook, so a retried or concurrent
      // event cannot double-charge or send a second callback.
      const claim = await db.prepare(`UPDATE "Order" SET status = 'success', payTime = ?, webhookStatus = 'unsent' WHERE id = ? AND status = 'pending'`)
        .bind(eventTime.toISOString(), candidate.id)
        .run();
      if ((claim?.meta?.changes ?? 0) > 0) {
        matchedOrderId = candidate.id;
        matchStatus = "matched";
        confidence = 100;
        shouldTriggerWebhook = true;

        const user = await db.prepare(`SELECT feeBalance, packageType, subscriptionExpiresAt FROM User WHERE id = ? LIMIT 1`).bind(device.userId).first<any>();
        if (user) {
          const feeCents = calculateFeeCents(Number(candidate.amountCents), user);
          const fee = amountFromCents(feeCents);
          const newBalance = Math.max(0, Number(user.feeBalance || 0) - fee);
          if (feeCents > 0) {
            financialWrites.push(
              db.prepare(`UPDATE User SET feeBalance = ?, updatedAt = ? WHERE id = ?`)
                .bind(newBalance, nowIso, device.userId),
              db.prepare(`
                INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
                VALUES (?, 'fee', ?, ?, ?, ?, ?)
              `).bind(
                crypto.randomUUID(),
                -fee,
                newBalance,
                `技术服务费扣除: 订单 ${candidate.id}, 金额 ${formatAmount(Number(candidate.amountCents))} 元`,
                nowIso,
                device.userId
              )
            );
          }
        }
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

    // Commit the PaymentEvent audit row together with any balance/billing writes
    // in one atomic batch. The PaymentEvent's unique notificationHash is the
    // idempotency anchor; if two concurrent requests reach here for the same
    // notification, the second batch fails on the unique constraint and leaves
    // no partial financial effect.
    const paymentEventInsert = db.prepare(`
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
      nowIso
    );

    try {
      await runAtomic(db, [...financialWrites, paymentEventInsert]);
    } catch (commitErr: any) {
      // A duplicate notificationHash racing in parallel can collide here. The
      // order/recharge was already claimed atomically above, so surface success
      // with the duplicate-safe state rather than 500-ing the device retry loop.
      const dupe = await db.prepare(`SELECT matchStatus, matchedOrderId FROM PaymentEvent WHERE notificationHash = ? LIMIT 1`)
        .bind(notificationHash).first<any>();
      if (!dupe) throw commitErr;
      matchStatus = dupe.matchStatus;
      matchedOrderId = dupe.matchedOrderId;
      shouldTriggerWebhook = false;
    }

    if (matchStatus === "unmatched") {
      // Distinguish "received money for an order that already expired" from a
      // genuinely unknown payment, so operators can reconcile expired orders.
      const expiredOrder = await db.prepare(`
        SELECT "Order".id
        FROM "Order"
        JOIN App ON App.id = "Order".appId
        JOIN PaymentCode ON PaymentCode.id = "Order".paymentCodeId
        WHERE App.userId = ?
          AND PaymentCode.deviceId = ?
          AND "Order".payType = ?
          AND "Order".realAmountCents = ?
          AND "Order".status = 'pending'
          AND "Order".expiresAt <= ?
        ORDER BY "Order".createdAt DESC
        LIMIT 1
      `).bind(device.userId, device.id, payType, amountCents, eventTime.toISOString()).first<any>();

      // Same reconciliation for platform recharges: a real payment that landed
      // after the recharge window expired should surface as an exception with
      // the recharge id, so an operator can manually confirm it via the admin
      // panel rather than the money silently going unrecorded.
      const expiredRecharge = expiredOrder ? null : await db.prepare(`
        SELECT RechargeOrder.id
        FROM RechargeOrder
        JOIN PaymentCode ON PaymentCode.id = RechargeOrder.paymentCodeId
        WHERE PaymentCode.userId = ?
          AND PaymentCode.deviceId = ?
          AND RechargeOrder.payType = ?
          AND RechargeOrder.realAmountCents = ?
          AND RechargeOrder.status = 'pending'
          AND RechargeOrder.expiresAt <= ?
        ORDER BY RechargeOrder.createdAt DESC
        LIMIT 1
      `).bind(device.userId, device.id, payType, amountCents, eventTime.toISOString()).first<any>();

      if (expiredOrder) {
        await db.prepare(`
          INSERT INTO ExceptionItem (id, type, title, description, createdAt, refId, status, userId)
          VALUES (?, 'expired_payment', ?, ?, ?, ?, 'active', ?)
        `).bind(
          crypto.randomUUID(),
          `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatAmount(amountCents)} 元，但订单已过期`,
          `设备收到到账通知 ${formatAmount(amountCents)} 元，疑似对应已过期订单 ${expiredOrder.id}，未自动回调商户。`,
          new Date().toISOString(),
          expiredOrder.id,
          device.userId
        ).run();
      } else if (expiredRecharge) {
        await db.prepare(`
          INSERT INTO ExceptionItem (id, type, title, description, createdAt, refId, status, userId)
          VALUES (?, 'expired_recharge', ?, ?, ?, ?, 'active', ?)
        `).bind(
          crypto.randomUUID(),
          `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatAmount(amountCents)} 元，但充值单已过期`,
          `设备收到到账通知 ${formatAmount(amountCents)} 元，疑似对应已过期充值单 ${expiredRecharge.id}，未自动入账。可在管理后台人工确认充值到账。`,
          new Date().toISOString(),
          expiredRecharge.id,
          device.userId
        ).run();
      } else {
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
    }

    await db.prepare(`UPDATE Device SET online = 1, lastHeartbeat = ?, updatedAt = ? WHERE id = ?`)
      .bind(new Date().toISOString(), new Date().toISOString(), device.id)
      .run();

    // Fire the merchant webhook for a freshly matched real order. Recharge matches
    // (shouldTriggerWebhook stays false) credit balance internally and have no callback.
    if (matchedOrderId && shouldTriggerWebhook) {
      triggerWebhook(matchedOrderId).catch(err => console.error("Error triggering webhook in background:", err));
    }

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
