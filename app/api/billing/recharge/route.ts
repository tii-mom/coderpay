export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
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

function getRechargeErrorMessage(message: string) {
  if (message.includes("PLATFORM_RECHARGE_USER_EMAIL")) {
    return "平台收款账户未配置，请联系管理员检查 PLATFORM_RECHARGE_USER_EMAIL。";
  }
  if (message.includes("Platform recharge user not found")) {
    return "平台收款账户不存在，请先创建并配置平台收款账号。";
  }
  if (message.includes("No active platform recharge payment code configured")) {
    return "平台未配置对应支付方式的 active 收款码，请先上传微信/支付宝收款码。";
  }
  if (message.includes("No online platform recharge Watcher device available")) {
    return "平台收款手机不在线、通知监听未连接或心跳超过 3 分钟，请打开安卓监听端并确认通知/监听/保活均为正常后重试。";
  }
  if (message.includes("No platform recharge any-amount payment code configured")) {
    return "平台未配置任意金额收款码，请上传任意金额微信/支付宝收款码后重试。";
  }
  if (message.includes("All platform recharge payment slots are currently occupied")) {
    return "当前充值金额尾数已被占用，请稍后重试或换一个充值金额。";
  }
  return message || "Internal server error";
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
        requires_manual_confirm: Boolean((rechargeOrder as any).requiresManualConfirm),
        promotion,
      },
    });
  } catch (err: any) {
    console.error("Recharge creation failed:", err);
    return NextResponse.json({ error: getRechargeErrorMessage(err.message || "") }, { status: err.status || 500 });
  }
}
