export type DirectPayType = "wechat" | "alipay";
export type DirectPayMode = "alipay_to_account" | "alipay_qr" | "wechat_qr" | "image_fallback";

export type DirectPayInput = {
  type: DirectPayType;
  alipayUserId?: string | null;
  qrPayload?: string | null;
  directPayUrl?: string | null;
  amount?: string | number | null;
};

export type CheckoutDirectPayInput = {
  type: DirectPayType;
  amount: string | number;
  alipayUserId?: string | null;
  qrPayload?: string | null;
  directPayUrl?: string | null;
};

function normalizeOptional(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function buildAlipayToAccountUrl(userId: string, amount: string | number) {
  return `alipays://platformapi/startapp?appId=09999988&actionType=toAccount&goBack=NO&userId=${encodeURIComponent(userId)}&amount=${encodeURIComponent(Number(amount).toFixed(2))}`;
}

export function buildAlipayQrScheme(qrPayload: string) {
  return `alipays://platformapi/startapp?saId=10000007&clientVersion=3.7.0.0718&qrcode=${encodeURIComponent(qrPayload)}`;
}

export function extractAlipayUserId(payload: string | null | undefined) {
  const text = normalizeOptional(payload);
  if (!text) return null;
  return text.match(/(?:userId|user_id|sellerId|seller_id)=([0-9]{16,32})/)?.[1] ?? null;
}

export function normalizeAlipayDirectUrl(url: string | null | undefined) {
  const text = normalizeOptional(url);
  if (!text) return null;
  if (text.startsWith("https://qr.alipay.com/") || text.startsWith("http://qr.alipay.com/")) {
    return buildAlipayQrScheme(text);
  }
  return text;
}

function hasPositiveAmount(amount: string | number | null | undefined) {
  return Number(amount) > 0;
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

  if (input.type === "alipay" && alipayUserId && hasPositiveAmount(input.amount)) {
    return {
      qrPayload,
      directPayUrl: buildAlipayToAccountUrl(alipayUserId, input.amount ?? 0),
      directPayMode: "alipay_to_account" as DirectPayMode,
    };
  }

  if (input.type === "alipay" && alipayUserId) {
    return {
      qrPayload,
      directPayUrl: null,
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

export function resolveCheckoutDirectPayUrl(input: CheckoutDirectPayInput) {
  const alipayUserId = normalizeOptional(input.alipayUserId);
  const directPayUrl = normalizeOptional(input.directPayUrl);
  const qrPayload = normalizeOptional(input.qrPayload);

  if (input.type === "alipay" && alipayUserId) {
    return buildAlipayToAccountUrl(alipayUserId, input.amount);
  }

  if (input.type === "alipay") {
    const candidate = normalizeAlipayDirectUrl(directPayUrl || qrPayload);
    return candidate || "";
  }

  return directPayUrl || qrPayload || "";
}
