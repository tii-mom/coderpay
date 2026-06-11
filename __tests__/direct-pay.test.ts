import { describe, expect, it } from "vitest";
import {
  buildAlipayQrScheme,
  extractAmountFromQrPayload,
  getPaymentCodeCapability,
  normalizeDirectPayFields,
  resolveCheckoutDirectPayUrl,
} from "@/lib/direct-pay";
import { getRechargeDisplayStatus } from "@/lib/recharge-status";

describe("direct pay helpers", () => {
  it("builds checkout Alipay transfer URL from PID and the current order amount", () => {
    const url = resolveCheckoutDirectPayUrl({
      type: "alipay",
      amount: 10.03,
      alipayUserId: "2088123412341234",
      directPayUrl: "alipays://platformapi/startapp?amount=0.00",
      qrPayload: "https://qr.alipay.com/example",
    });

    expect(url).toContain("actionType=toAccount");
    expect(url).toContain("userId=2088123412341234");
    expect(url).toContain("amount=10.03");
    expect(url).not.toContain("amount=0.00");
  });

  it("wraps Alipay QR short links so mobile browsers can hand off to Alipay", () => {
    const qr = "https://qr.alipay.com/fkx12345";

    expect(buildAlipayQrScheme(qr)).toBe(
      `alipays://platformapi/startapp?saId=10000007&clientVersion=3.7.0.0718&qrcode=${encodeURIComponent(qr)}`
    );
    expect(resolveCheckoutDirectPayUrl({
      type: "alipay",
      amount: 10,
      qrPayload: qr,
    })).toBe(buildAlipayQrScheme(qr));
  });

  it("does not persist a zero-amount Alipay transfer URL for any-amount codes", () => {
    const directPay = normalizeDirectPayFields({
      type: "alipay",
      amount: 0,
      alipayUserId: "2088123412341234",
      qrPayload: "https://qr.alipay.com/fkx12345",
    });

    expect(directPay.directPayMode).toBe("alipay_to_account");
    expect(directPay.directPayUrl).toBeNull();
  });

  it("extracts fixed amounts from common QR payload parameters", () => {
    expect(extractAmountFromQrPayload("https://example.com/pay?amount=12.34")).toBe(12.34);
    expect(extractAmountFromQrPayload("https://example.com/pay?total_amount=8.8")).toBe(8.8);
    expect(extractAmountFromQrPayload("money=6.66&memo=test")).toBe(6.66);
    expect(extractAmountFromQrPayload("https://qr.alipay.com/fkx12345")).toBeNull();
  });

  it("describes desktop Alipay QR payloads as scan-oriented instead of direct transfer", () => {
    const capability = getPaymentCodeCapability({
      type: "alipay",
      qrPayload: "https://qr.alipay.com/fkx12345",
      directPayMode: "alipay_qr",
    }, "desktop");

    expect(capability.canOpenApp).toBe(false);
    expect(capability.canPrefillAmount).toBe(false);
    expect(capability.needsAlipayUserId).toBe(true);
  });

  it("derives expired recharge display status without mutating persisted status", () => {
    expect(getRechargeDisplayStatus({
      status: "pending",
      expiresAt: "2026-06-11T08:00:00.000Z",
    }, new Date("2026-06-11T08:01:00.000Z"))).toBe("expired");
    expect(getRechargeDisplayStatus({
      status: "success",
      expiresAt: "2026-06-11T08:00:00.000Z",
    }, new Date("2026-06-11T08:01:00.000Z"))).toBe("success");
  });
});
