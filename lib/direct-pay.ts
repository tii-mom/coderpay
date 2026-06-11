export type DirectPayType = "wechat" | "alipay";
export type DirectPayMode = "alipay_to_account" | "alipay_qr" | "wechat_qr" | "image_fallback";

export type DirectPayInput = {
  type: DirectPayType;
  alipayUserId?: string | null;
  qrPayload?: string | null;
  directPayUrl?: string | null;
  amount?: string | number | null;
};

function normalizeOptional(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function buildAlipayToAccountUrl(userId: string, amount: string | number) {
  return `alipays://platformapi/startapp?appId=09999988&actionType=toAccount&goBack=NO&userId=${encodeURIComponent(userId)}&amount=${encodeURIComponent(Number(amount).toFixed(2))}`;
}

export function normalizeDirectPayFields(input: DirectPayInput) {
  const qrPayload = normalizeOptional(input.qrPayload);
  const explicitUrl = normalizeOptional(input.directPayUrl);
  const alipayUserId = normalizeOptional(input.alipayUserId);

  if (explicitUrl) {
    return {
      qrPayload,
      directPayUrl: explicitUrl,
      directPayMode: input.type === "alipay" ? "alipay_qr" as DirectPayMode : "wechat_qr" as DirectPayMode,
    };
  }

  if (input.type === "alipay" && alipayUserId && input.amount != null) {
    return {
      qrPayload,
      directPayUrl: buildAlipayToAccountUrl(alipayUserId, input.amount),
      directPayMode: "alipay_to_account" as DirectPayMode,
    };
  }

  if (qrPayload) {
    return {
      qrPayload,
      directPayUrl: qrPayload,
      directPayMode: input.type === "alipay" ? "alipay_qr" as DirectPayMode : "wechat_qr" as DirectPayMode,
    };
  }

  return {
    qrPayload,
    directPayUrl: null,
    directPayMode: "image_fallback" as DirectPayMode,
  };
}

