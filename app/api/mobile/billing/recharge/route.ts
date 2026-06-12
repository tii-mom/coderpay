export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getMobileDevice } from "@/lib/mobile-auth";
import { createRechargeOrder } from "@/lib/recharge";
import { getRechargePromotion } from "@/lib/recharge-promotions";
import { resolveEnvVar } from "@/lib/d1-binding";

function getOrigin(req: NextRequest) {
  let origin = resolveEnvVar("NEXT_PUBLIC_APP_URL");
  if (!origin) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    origin = `${proto}://${host}`;
  }
  return origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getMobileDevice(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const payType = body.payType || body.pay_type || "alipay";
    if (payType !== "wechat" && payType !== "alipay") {
      return NextResponse.json({ error: "Invalid payType" }, { status: 400 });
    }

    const rechargeOrder = await createRechargeOrder({
      userId: auth.device.userId,
      amount: body.amount,
      payType
    });
    const origin = getOrigin(req);
    const promotion = getRechargePromotion(rechargeOrder.amountCents);

    return NextResponse.json({
      status: "success",
      data: {
        recharge_id: rechargeOrder.id,
        amount: rechargeOrder.amount.toFixed(2),
        real_amount: rechargeOrder.realAmount.toFixed(2),
        pay_type: rechargeOrder.payType,
        payment_url: `${origin}/pay/checkout?id=${encodeURIComponent(rechargeOrder.id)}`,
        expired_at: rechargeOrder.expiresAt.toISOString(),
        payment_code: rechargeOrder.paymentCode,
        requires_manual_confirm: Boolean((rechargeOrder as any).requiresManualConfirm),
        promotion
      }
    });
  } catch (err: any) {
    console.error("Mobile recharge creation failed:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: err.status || 500 });
  }
}
