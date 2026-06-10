export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { amountFromCents, centsFromAmount, formatAmount, getDirectD1, randomOrderId, verifyMerchantSign } from "@/lib/d1-direct";
import { FREE_ORDER_LIMIT, LOW_BALANCE_WARNING_YUAN, getEffectivePackageType, BILLING_PLANS, assertOrderAmountWithinPlanLimit } from "@/lib/billing-plans";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { app_id, out_order_no, title, amount, pay_type, sign } = body;
    
    if (!app_id || !out_order_no || !title || !amount || !pay_type || !sign) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const db = getDirectD1();
    const app = await db.prepare(`
      SELECT App.id, App.appId, App.appSecret, App.signType, App.expireMinutes, App.userId,
             User.feeBalance, User.packageType, User.freeOrderUsed, User.subscriptionExpiresAt
      FROM App
      JOIN User ON User.id = App.userId
      WHERE App.appId = ?
    `).bind(app_id).first<any>();

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const isSignValid = await verifyMerchantSign(body, app.appSecret, app.signType, sign);
    if (!isSignValid) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }

    const existingOrder = await db.prepare(`SELECT id FROM "Order" WHERE appId = ? AND outOrderNo = ? LIMIT 1`)
      .bind(app.id, out_order_no)
      .first();
    if (existingOrder) {
      return NextResponse.json({ error: "Duplicate out_order_no" }, { status: 400 });
    }

    if (Number(app.feeBalance) <= 0) {
      return NextResponse.json({ error: "账户余额已低于或等于 0 元，请充值后继续使用 CoderPay 服务" }, { status: 402 });
    }
    // Effective package falls back to "free" when a paid subscription has expired,
    // so expired users are correctly subject to the free debug quota again.
    const effectivePackageType = getEffectivePackageType({
      packageType: app.packageType,
      subscriptionExpiresAt: app.subscriptionExpiresAt
    });
    const isFreeTier = effectivePackageType === "free";
    if (isFreeTier && Number(app.freeOrderUsed || 0) >= FREE_ORDER_LIMIT) {
      return NextResponse.json({ error: "免费调试额度已用完，请开通订阅后继续创建订单" }, { status: 403 });
    }

    // Strict input validation
    if (pay_type !== "wechat" && pay_type !== "alipay") {
      return NextResponse.json({ error: "Invalid pay_type. Must be 'wechat' or 'alipay'" }, { status: 400 });
    }

    let amountCents: number;
    try {
      amountCents = centsFromAmount(amount);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    try {
      assertOrderAmountWithinPlanLimit(amountCents, effectivePackageType);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000).toISOString();
    const activeCodes = (await db.prepare(`
      SELECT PaymentCode.id, PaymentCode.codeType, PaymentCode.amount, PaymentCode.deviceId,
             Device.online, Device.status AS deviceStatus, Device.lastHeartbeat
      FROM PaymentCode
      LEFT JOIN Device ON Device.id = PaymentCode.deviceId
      WHERE PaymentCode.userId = ? AND PaymentCode.type = ? AND PaymentCode.status = 'active'
      ORDER BY CASE WHEN PaymentCode.codeType = 'fixed' THEN 0 ELSE 1 END, PaymentCode.createdAt ASC
    `).bind(app.userId, pay_type).all<any>()).results || [];

    if (activeCodes.length === 0) {
      return NextResponse.json({ error: "No active payment channels configured for this payment method" }, { status: 400 });
    }

    const onlineCodes = activeCodes.filter(code =>
      code.online === 1 &&
      code.deviceStatus === "active" &&
      code.lastHeartbeat &&
      new Date(code.lastHeartbeat).toISOString() >= threeMinutesAgo
    );
    const candidateCodes = onlineCodes.length > 0 ? onlineCodes : activeCodes;

    let selectedCode: any = null;
    let realAmountCents = amountCents;
    for (const code of candidateCodes.filter(c => c.codeType === "fixed" && Math.round(Number(c.amount) * 100) === amountCents)) {
      const conflict = await db.prepare(`
        SELECT id FROM "Order"
        WHERE paymentCodeId = ? AND realAmountCents = ? AND status = 'pending' AND expiresAt > ?
        LIMIT 1
      `).bind(code.id, amountCents, now.toISOString()).first();
      if (!conflict) {
        selectedCode = code;
        break;
      }
    }

    if (!selectedCode) {
      const anyCodes = candidateCodes.filter(c => c.codeType === "any");
      if (anyCodes.length === 0) {
        return NextResponse.json({ error: "No matching payment code (fixed or any) found" }, { status: 400 });
      }
      selectedCode = anyCodes[0];
      const occupiedRows = (await db.prepare(`
        SELECT realAmountCents FROM "Order"
        JOIN PaymentCode ON PaymentCode.id = "Order".paymentCodeId
        WHERE PaymentCode.deviceId = ? AND "Order".payType = ? AND "Order".status = 'pending' AND "Order".expiresAt > ?
      `).bind(selectedCode.deviceId, pay_type, now.toISOString()).all<any>()).results || [];
      const occupied = new Set(occupiedRows.map(row => Number(row.realAmountCents)));
      const offsets = [0, -1, -2, 1, 2, -3, 3, -4, 4, -5, 5, -6, 6];
      const available = offsets.map(offset => amountCents + offset).find(value => value >= 1 && !occupied.has(value));
      if (!available) {
        return NextResponse.json({ error: "All payment slots for this amount are currently occupied. Please try again later." }, { status: 409 });
      }
      realAmountCents = available;
    }

    const orderId = randomOrderId();
    const expiresAt = new Date(Date.now() + app.expireMinutes * 60 * 1000);
    try {
      await db.prepare(`
        INSERT INTO "Order" (id, outOrderNo, title, payType, amount, realAmount, amountCents, realAmountCents, status, createdAt, expiresAt, webhookStatus, appId, paymentCodeId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'unsent', ?, ?)
      `).bind(
        orderId,
        out_order_no,
        title,
        pay_type,
        amountFromCents(amountCents),
        amountFromCents(realAmountCents),
        amountCents,
        realAmountCents,
        now.toISOString(),
        expiresAt.toISOString(),
        app.id,
        selectedCode.id
      ).run();
    } catch (insertErr: any) {
      // Unique index on (appId, outOrderNo) makes duplicate creation atomic:
      // concurrent requests with the same merchant order number collide here.
      if (String(insertErr?.message || "").includes("UNIQUE") || String(insertErr?.cause?.message || "").includes("UNIQUE")) {
        return NextResponse.json({ error: "Duplicate out_order_no" }, { status: 400 });
      }
      throw insertErr;
    }

    if (isFreeTier) {
      await db.prepare(`UPDATE User SET freeOrderUsed = COALESCE(freeOrderUsed, 0) + 1, updatedAt = ? WHERE id = ?`)
        .bind(new Date().toISOString(), app.userId)
        .run();
    }
    
    // Dynamic fallback for APP URL to avoid broken links
    let origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin) {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
      const proto = req.headers.get("x-forwarded-proto") || "http";
      origin = `${proto}://${host}`;
    }
    if (origin.endsWith("/")) {
      origin = origin.slice(0, -1);
    }
    const paymentUrl = `${origin}/pay/${orderId}`;
    
    return NextResponse.json({
      code: 200,
      msg: "success",
      data: {
        order_id: orderId,
        out_order_no,
        amount: formatAmount(amountCents),
        real_amount: formatAmount(realAmountCents),
        pay_type,
        payment_url: paymentUrl,
        expired_at: expiresAt.toISOString(),
        free_order_remaining: isFreeTier ? Math.max(0, FREE_ORDER_LIMIT - Number(app.freeOrderUsed || 0) - 1) : null,
        low_balance_warning: Number(app.feeBalance) <= LOW_BALANCE_WARNING_YUAN
      }
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
