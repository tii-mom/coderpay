export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/signature";
import { getSessionUser } from "@/lib/auth";
import { randomNumericCode } from "@/lib/random";
import { amountToCents, centsToAmount, formatCents } from "@/lib/money";
import { selectPaymentChannel } from "@/lib/payment-matching";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { app_id, out_order_no, title, amount, pay_type, sign } = body;
    
    if (!app_id || !out_order_no || !title || !amount || !pay_type || !sign) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Find app
    const app = await prisma.app.findUnique({
      where: { appId: app_id }
    });
    
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    
    // Verify signature unless this is a logged-in console sandbox request for the same merchant app.
    const sessionUser = await getSessionUser(req);
    const isOwnedConsoleRequest = Boolean(
      sessionUser &&
      sessionUser.id === app.userId &&
      req.headers.get("x-coderpay-console-sandbox") === "1"
    );
    
    if (!isOwnedConsoleRequest) {
      const isSignValid = verifySignature(body, app.appSecret, app.signType, sign);
      if (!isSignValid) {
        return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
      }
    }
    
    // Check if out_order_no already exists for this app
    const existingOrder = await prisma.order.findFirst({
      where: {
        appId: app.id,
        outOrderNo: out_order_no
      }
    });
    if (existingOrder) {
      return NextResponse.json({ error: "Duplicate out_order_no" }, { status: 400 });
    }
    
    // Strict input validation
    if (pay_type !== "wechat" && pay_type !== "alipay") {
      return NextResponse.json({ error: "Invalid pay_type. Must be 'wechat' or 'alipay'" }, { status: 400 });
    }

    let amountCents: number;
    try {
      amountCents = amountToCents(amount);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    let channel;
    try {
      channel = await selectPaymentChannel({
        userId: app.userId,
        payType: pay_type,
        amount
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Payment channel selection failed" }, { status: err.status || 500 });
    }
    
    // Create the order
    const orderId = `CP${randomNumericCode(6)}`;
    const expiresAt = new Date(Date.now() + app.expireMinutes * 60 * 1000);
    const newOrder = await prisma.order.create({
      data: {
        id: orderId,
        outOrderNo: out_order_no,
        title,
        payType: pay_type,
        amount: centsToAmount(amountCents),
        realAmount: centsToAmount(channel.realAmountCents),
        amountCents,
        realAmountCents: channel.realAmountCents,
        expiresAt,
        status: "pending",
        appId: app.id,
        paymentCodeId: channel.selectedCode.id
      }
    });
    
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
    const paymentUrl = `${origin}/pay/${newOrder.id}`;
    
    return NextResponse.json({
      code: 200,
      msg: "success",
      data: {
        order_id: newOrder.id,
        out_order_no: newOrder.outOrderNo,
        amount: formatCents(newOrder.amountCents),
        real_amount: formatCents(newOrder.realAmountCents),
        pay_type: newOrder.payType,
        payment_url: paymentUrl,
        expired_at: expiresAt.toISOString()
      }
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
