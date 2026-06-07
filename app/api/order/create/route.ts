export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/signature";
import { getSessionUser } from "@/lib/auth";
import { randomNumericCode } from "@/lib/random";

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

    const amountStr = String(amount).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
      return NextResponse.json({ error: "Invalid amount format. Must be a positive number with up to 2 decimal places" }, { status: 400 });
    }
    const numAmount = Number(amountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number greater than 0" }, { status: 400 });
    }
    
    // Find active payment codes for this user & pay_type, including their device info
    const activeCodes = await prisma.paymentCode.findMany({
      where: {
        userId: app.userId,
        type: pay_type,
        status: "active"
      },
      include: {
        device: true
      }
    });
    
    if (activeCodes.length === 0) {
      return NextResponse.json({ error: "No active payment channels configured for this payment method" }, { status: 400 });
    }
    
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    // Categorize codes into: bound to online devices, bound to offline devices, unbound
    const onlineCodes = activeCodes.filter(c => 
      c.device && 
      c.device.online && 
      c.device.lastHeartbeat && 
      new Date(c.device.lastHeartbeat) >= threeMinutesAgo
    );
    
    const fallbackCodes = onlineCodes.length > 0 ? onlineCodes : activeCodes;
    
    // 1. Try to find a fixed amount code on an online/available device without amount conflict
    let selectedCode = null;
    let realAmount = numAmount;
    
    // Try to find a fixed code first
    const fixedCodes = fallbackCodes.filter(c => c.codeType === "fixed" && Math.abs(c.amount - numAmount) < 0.001);
    
    for (const code of fixedCodes) {
      if (code.deviceId) {
        // Check if there is an active pending order with the same realAmount on this device
        const conflict = await prisma.order.findFirst({
          where: {
            paymentCode: { deviceId: code.deviceId },
            realAmount: numAmount,
            status: "pending"
          }
        });
        if (!conflict) {
          selectedCode = code;
          break;
        }
      } else {
        // Unbound code has no device-scoped conflicts
        selectedCode = code;
        break;
      }
    }
    
    if (!selectedCode) {
      // 2. Fall back to "any" amount code
      const anyCodes = fallbackCodes.filter(c => c.codeType === "any");
      if (anyCodes.length === 0) {
        return NextResponse.json({ error: "No matching payment code (fixed or any) found" }, { status: 400 });
      }
      
      // Select the device with the fewest pending orders (least-loaded polling)
      let bestCode = anyCodes[0];
      let minPendingCount = Infinity;
      
      for (const code of anyCodes) {
        if (code.deviceId) {
          const pendingCount = await prisma.order.count({
            where: {
              paymentCode: { deviceId: code.deviceId },
              status: "pending"
            }
          });
          if (pendingCount < minPendingCount) {
            minPendingCount = pendingCount;
            bestCode = code;
          }
        }
      }
      
      selectedCode = bestCode;
      
      // Calculate a unique realAmount scoped to this device
      const pendingOrders = await prisma.order.findMany({
        where: {
          paymentCode: { deviceId: selectedCode.deviceId },
          payType: pay_type,
          status: "pending"
        },
        select: { realAmount: true }
      });
      const occupied = new Set(pendingOrders.map(o => o.realAmount.toFixed(2)));
      
      const offsets = [0, -0.01, -0.02, 0.01, 0.02, -0.03, 0.03, -0.04, 0.04, -0.05, 0.05, -0.06, 0.06];
      let foundUnique = false;
      for (const offset of offsets) {
        const testAmount = Number((numAmount + offset).toFixed(2));
        if (testAmount > 0.05 && !occupied.has(testAmount.toFixed(2))) {
          realAmount = testAmount;
          foundUnique = true;
          break;
        }
      }
      
      if (!foundUnique) {
        return NextResponse.json({ error: "All payment slots for this amount are currently occupied. Please try again later." }, { status: 409 });
      }
    }
    
    // Create the order
    const orderId = `CP${randomNumericCode(6)}`;
    const newOrder = await prisma.order.create({
      data: {
        id: orderId,
        outOrderNo: out_order_no,
        title,
        payType: pay_type,
        amount: numAmount,
        realAmount,
        status: "pending",
        appId: app.id,
        paymentCodeId: selectedCode.id
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
        amount: newOrder.amount.toFixed(2),
        real_amount: newOrder.realAmount.toFixed(2),
        pay_type: newOrder.payType,
        payment_url: paymentUrl,
        expired_at: new Date(Date.now() + app.expireMinutes * 60 * 1000).toISOString()
      }
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
