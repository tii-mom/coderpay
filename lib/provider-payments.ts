import { amountFromCents, centsFromAmount, formatAmount, hmacSha256Hex, runAtomic } from "@/lib/d1-direct";
import { calculateFeeCents } from "@/lib/billing-plans";

type D1DatabaseLike = ReturnType<typeof import("@/lib/d1-direct").getDirectD1>;

export type ProviderWebhookPayload = {
  out_order_no: string;
  pay_type: "wechat" | "alipay";
  amount: string | number;
  provider_trade_no: string;
  paid_at?: string;
  sign: string;
};

export function normalizeProviderChannels(input: unknown) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const channels = values
    .map(value => String(value).trim())
    .filter(value => value === "wechat" || value === "alipay");
  return Array.from(new Set(channels));
}

export function providerSupportsChannel(channels: string | null | undefined, payType: string) {
  return String(channels || "")
    .split(",")
    .map(channel => channel.trim())
    .includes(payType);
}

export function signProviderPayload(params: Record<string, unknown>, secret: string) {
  const query = Object.keys(params)
    .filter(key => key !== "sign" && params[key] !== undefined && params[key] !== null)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  return hmacSha256Hex(`${query}&key=${secret}`, secret);
}

export async function verifyProviderPayload(params: Record<string, unknown>, secret: string, providedSign: string) {
  if (!providedSign) return false;
  const expected = await signProviderPayload(params, secret);
  return expected.toLowerCase() === providedSign.toLowerCase();
}

export function normalizeProviderWebhookBody(body: any): ProviderWebhookPayload {
  const payload = {
    out_order_no: String(body.out_order_no || body.outOrderNo || "").trim(),
    pay_type: String(body.pay_type || body.payType || "").trim(),
    amount: body.amount,
    provider_trade_no: String(body.provider_trade_no || body.providerTradeNo || "").trim(),
    paid_at: body.paid_at || body.paidAt || undefined,
    sign: String(body.sign || "").trim(),
  };
  if (!payload.out_order_no) throw Object.assign(new Error("out_order_no is required"), { status: 400 });
  if (payload.pay_type !== "wechat" && payload.pay_type !== "alipay") {
    throw Object.assign(new Error("pay_type must be wechat or alipay"), { status: 400 });
  }
  if (!payload.provider_trade_no) throw Object.assign(new Error("provider_trade_no is required"), { status: 400 });
  centsFromAmount(payload.amount);
  if (!payload.sign) throw Object.assign(new Error("sign is required"), { status: 400 });
  return payload as ProviderWebhookPayload;
}

async function createProviderException(
  db: D1DatabaseLike,
  provider: any,
  type: string,
  title: string,
  description: string,
  refId: string
) {
  await db.prepare(`
    INSERT INTO ExceptionItem (id, type, title, description, createdAt, refId, status, userId)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).bind(
    crypto.randomUUID(),
    type,
    title,
    description,
    new Date().toISOString(),
    refId,
    provider.userId
  ).run();
}

export async function confirmProviderPayment(db: D1DatabaseLike, provider: any, payload: ProviderWebhookPayload) {
  const amountCents = centsFromAmount(payload.amount);
  const paidAt = payload.paid_at ? new Date(payload.paid_at) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw Object.assign(new Error("paid_at is invalid"), { status: 400 });
  }

  const existing = await db.prepare(`
    SELECT ProviderPayment.id, ProviderPayment.orderId, ProviderPayment.status, "Order".status AS orderStatus
    FROM ProviderPayment
    LEFT JOIN "Order" ON "Order".id = ProviderPayment.orderId
    WHERE ProviderPayment.providerId = ? AND ProviderPayment.providerTradeNo = ?
    LIMIT 1
  `).bind(provider.id, payload.provider_trade_no).first<any>();
  if (existing) {
    return {
      duplicate: true,
      matched: existing.status === "success",
      orderId: existing.orderId,
      orderStatus: existing.orderStatus || null,
    };
  }

  const order = await db.prepare(`
    SELECT "Order".id, "Order".outOrderNo, "Order".payType, "Order".amountCents, "Order".realAmountCents,
           "Order".status, "Order".expiresAt, App.userId
    FROM "Order"
    JOIN App ON App.id = "Order".appId
    WHERE App.userId = ? AND "Order".outOrderNo = ? AND "Order".payType = ?
    LIMIT 1
  `).bind(provider.userId, payload.out_order_no, payload.pay_type).first<any>();

  const rawPayload = JSON.stringify(payload).slice(0, 1000);
  const nowIso = new Date().toISOString();
  const dedupeKey = `${provider.id}:${payload.provider_trade_no}`;
  const eventId = crypto.randomUUID();

  if (!order) {
    await db.prepare(`
      INSERT INTO ProviderPayment (id, providerId, orderId, providerTradeNo, outOrderNo, payType, amountCents, status, rawPayload, createdAt)
      VALUES (?, ?, NULL, ?, ?, ?, ?, 'unmatched', ?, ?)
    `).bind(
      crypto.randomUUID(),
      provider.id,
      payload.provider_trade_no,
      payload.out_order_no,
      payload.pay_type,
      amountCents,
      rawPayload,
      nowIso
    ).run();
    await createProviderException(
      db,
      provider,
      "payment_unmatched",
      "无安卓通道收到未匹配订单回调",
      `Provider ${provider.name} 收到 ${payload.pay_type} ${formatAmount(amountCents)} 元回调，但未找到商户订单号 ${payload.out_order_no}。`,
      payload.provider_trade_no
    );
    return { duplicate: false, matched: false, orderId: null, reason: "order_not_found" };
  }

  if (Number(order.realAmountCents || order.amountCents) !== amountCents) {
    await db.prepare(`
      INSERT INTO ProviderPayment (id, providerId, orderId, providerTradeNo, outOrderNo, payType, amountCents, status, rawPayload, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'amount_mismatch', ?, ?)
    `).bind(
      crypto.randomUUID(),
      provider.id,
      order.id,
      payload.provider_trade_no,
      payload.out_order_no,
      payload.pay_type,
      amountCents,
      rawPayload,
      nowIso
    ).run();
    await createProviderException(
      db,
      provider,
      "payment_unmatched",
      "无安卓通道回调金额不一致",
      `订单 ${order.id} 应收 ${formatAmount(Number(order.realAmountCents || order.amountCents))} 元，Provider 回调金额为 ${formatAmount(amountCents)} 元，未自动确认。`,
      order.id
    );
    return { duplicate: false, matched: false, orderId: order.id, reason: "amount_mismatch" };
  }

  if (order.status !== "pending") {
    await db.prepare(`
      INSERT INTO ProviderPayment (id, providerId, orderId, providerTradeNo, outOrderNo, payType, amountCents, status, rawPayload, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ignored', ?, ?)
    `).bind(
      crypto.randomUUID(),
      provider.id,
      order.id,
      payload.provider_trade_no,
      payload.out_order_no,
      payload.pay_type,
      amountCents,
      rawPayload,
      nowIso
    ).run();
    return { duplicate: false, matched: false, orderId: order.id, reason: `order_${order.status}` };
  }

  if (order.expiresAt && new Date(order.expiresAt).getTime() <= paidAt.getTime()) {
    await db.prepare(`
      INSERT INTO ProviderPayment (id, providerId, orderId, providerTradeNo, outOrderNo, payType, amountCents, status, rawPayload, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'expired', ?, ?)
    `).bind(
      crypto.randomUUID(),
      provider.id,
      order.id,
      payload.provider_trade_no,
      payload.out_order_no,
      payload.pay_type,
      amountCents,
      rawPayload,
      nowIso
    ).run();
    await createProviderException(
      db,
      provider,
      "expired_payment",
      "无安卓通道收到已过期订单回调",
      `Provider 回调订单 ${order.id} 已过期，未自动回调商户。`,
      order.id
    );
    return { duplicate: false, matched: false, orderId: order.id, reason: "expired" };
  }

  const writes = [
    db.prepare(`
      INSERT INTO ProviderPayment (id, providerId, orderId, providerTradeNo, outOrderNo, payType, amountCents, status, rawPayload, createdAt)
      SELECT ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?
      WHERE EXISTS (SELECT 1 FROM "Order" WHERE id = ? AND status = 'pending')
    `).bind(
      crypto.randomUUID(),
      provider.id,
      order.id,
      payload.provider_trade_no,
      payload.out_order_no,
      payload.pay_type,
      amountCents,
      rawPayload,
      nowIso,
      order.id
    ),
    db.prepare(`
      INSERT INTO PaymentEvent (id, deviceId, sourceType, sourceId, payType, amount, receivedAt, matchStatus, matchedOrderId, confidence, notificationHash, dedupeKey, rawNotification, createdAt)
      SELECT ?, NULL, 'provider_webhook', ?, ?, ?, ?, 'matched', ?, 100, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM "Order" WHERE id = ? AND status = 'pending')
    `).bind(
      eventId,
      provider.id,
      payload.pay_type,
      amountFromCents(amountCents),
      paidAt.toISOString(),
      order.id,
      dedupeKey,
      dedupeKey,
      rawPayload,
      nowIso,
      order.id
    ),
  ];

  const user = await db.prepare(`SELECT feeBalance, packageType, subscriptionExpiresAt FROM User WHERE id = ? LIMIT 1`)
    .bind(provider.userId)
    .first<any>();
  if (user) {
    const feeCents = calculateFeeCents(Number(order.amountCents), user);
    if (feeCents > 0) {
      const fee = amountFromCents(feeCents);
      const newBalance = Math.max(0, Number(user.feeBalance || 0) - fee);
      writes.push(
        db.prepare(`
          UPDATE User
          SET feeBalance = ?, updatedAt = ?
          WHERE id = ? AND EXISTS (SELECT 1 FROM "Order" WHERE id = ? AND status = 'pending')
        `).bind(newBalance, nowIso, provider.userId, order.id),
        db.prepare(`
          INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
          SELECT ?, 'fee', ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM "Order" WHERE id = ? AND status = 'pending')
        `).bind(
          crypto.randomUUID(),
          -fee,
          newBalance,
          `技术服务费扣除: 无安卓通道订单 ${order.id}, 金额 ${formatAmount(Number(order.amountCents))} 元`,
          nowIso,
          provider.userId,
          order.id
        )
      );
    }
  }

  writes.push(
    db.prepare(`
      UPDATE "Order"
      SET status = 'success', payTime = ?, webhookStatus = 'unsent'
      WHERE id = ? AND status = 'pending'
    `).bind(paidAt.toISOString(), order.id)
  );

  const results = await runAtomic(db, writes);
  if ((results?.[results.length - 1]?.meta?.changes ?? 0) !== 1) {
    return { duplicate: false, matched: false, orderId: order.id, reason: "claim_failed" };
  }
  return { duplicate: false, matched: true, orderId: order.id, shouldTriggerWebhook: true };
}
