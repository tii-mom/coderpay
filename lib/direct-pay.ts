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

export type PaymentCodeCapability = {
  canOpenApp: boolean;
  canPrefillAmount: boolean;
  needsAlipayUserId: boolean;
  mode: DirectPayMode;
  label: string;
};

export type PaymentPayloadChannel = DirectPayType | "unknown";

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

function toAmount(value: string | null) {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(decoded)) return null;
  const amount = Number(decoded);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function extractAmountFromQrPayload(payload: string | null | undefined) {
  const text = normalizeOptional(payload);
  if (!text) return null;

  try {
    const url = new URL(text);
    for (const key of ["amount", "money", "total_amount", "total_fee"]) {
      const amount = toAmount(url.searchParams.get(key));
      if (amount != null) return amount;
    }
  } catch {
    // Not all QR payloads are full URLs. Fall back to parameter-style parsing.
  }

  const match = text.match(/(?:amount|money|total_amount|total_fee)=([0-9]+(?:\.[0-9]{1,2})?)/i);
  return toAmount(match?.[1] ?? null);
}

export function detectPaymentPayloadChannel(payload: string | null | undefined): PaymentPayloadChannel {
  const text = normalizeOptional(payload)?.toLowerCase();
  if (!text) return "unknown";
  if (
    text.startsWith("wxp://") ||
    text.startsWith("weixin://") ||
    text.includes("tenpay.com") ||
    text.includes("wx.tenpay.com")
  ) {
    return "wechat";
  }
  if (
    text.startsWith("https://qr.alipay.com/") ||
    text.startsWith("http://qr.alipay.com/") ||
    text.startsWith("alipays://") ||
    text.includes("alipay.com")
  ) {
    return "alipay";
  }
  return "unknown";
}

export function getPaymentPayloadChannelError(type: DirectPayType, payload: string | null | undefined) {
  const channel = detectPaymentPayloadChannel(payload);
  if (channel !== "unknown" && channel !== type) {
    return "二维码渠道与选择渠道不一致，请切换渠道或重新上传正确二维码";
  }
  return null;
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

export function getPaymentCodeCapability(input: {
  type: DirectPayType;
  alipayUserId?: string | null;
  qrPayload?: string | null;
  directPayUrl?: string | null;
  directPayMode?: DirectPayMode | null;
}, runtimeEnvironment: "mobile" | "desktop" = "mobile"): PaymentCodeCapability {
  const alipayUserId = normalizeOptional(input.alipayUserId);
  const directPayUrl = normalizeOptional(input.directPayUrl);
  const qrPayload = normalizeOptional(input.qrPayload);
  const mode = input.directPayMode || normalizeDirectPayFields({
    type: input.type,
    alipayUserId,
    directPayUrl,
    qrPayload,
  }).directPayMode;

  if (input.type === "alipay" && alipayUserId) {
    return {
      canOpenApp: runtimeEnvironment === "mobile",
      canPrefillAmount: true,
      needsAlipayUserId: false,
      mode: "alipay_to_account",
      label: runtimeEnvironment === "mobile" ? "支付宝转账直达，金额可预填" : "手机端可直达支付宝转账",
    };
  }

  if (input.type === "alipay" && (directPayUrl || qrPayload)) {
    return {
      canOpenApp: runtimeEnvironment === "mobile",
      canPrefillAmount: false,
      needsAlipayUserId: true,
      mode: "alipay_qr",
      label: runtimeEnvironment === "mobile" ? "可唤起支付宝识别收款码，金额需核对" : "桌面端建议扫码支付，补 PID 可金额预填",
    };
  }

  if (input.type === "wechat" && (directPayUrl || qrPayload)) {
    return {
      canOpenApp: runtimeEnvironment === "mobile",
      canPrefillAmount: false,
      needsAlipayUserId: false,
      mode: "wechat_qr",
      label: runtimeEnvironment === "mobile" ? "可尝试唤起微信，失败时扫码兜底" : "微信个人码建议扫码支付",
    };
  }

  return {
    canOpenApp: false,
    canPrefillAmount: false,
    needsAlipayUserId: input.type === "alipay",
    mode: "image_fallback",
    label: "仅二维码兜底",
  };
}
