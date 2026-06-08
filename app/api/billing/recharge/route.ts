export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createRechargeOrder } from "@/lib/recharge";

function getOrigin(req: NextRequest) {
  let origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    origin = `${proto}://${host}`;
  }
  return origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const payType = body.payType || body.pay_type || "alipay";
    if (payType !== "wechat" && payType !== "alipay") {
      return NextResponse.json({ error: "Invalid payType" }, { status: 400 });
    }

    const rechargeOrder = await createRechargeOrder({
      userId: user.id,
      amount: body.amount,
      payType,
    });
    const origin = getOrigin(req);
    return NextResponse.json({
      status: "success",
      data: {
        recharge_id: rechargeOrder.id,
        amount: rechargeOrder.amount.toFixed(2),
        real_amount: rechargeOrder.realAmount.toFixed(2),
        pay_type: rechargeOrder.payType,
        payment_url: `${origin}/pay/${rechargeOrder.id}`,
        expired_at: rechargeOrder.expiresAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Recharge creation failed:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: err.status || 500 });
  }
}
