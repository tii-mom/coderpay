import { describe, expect, it } from "vitest";
import {
  buildAlipayQrScheme,
  normalizeDirectPayFields,
  resolveCheckoutDirectPayUrl,
} from "@/lib/direct-pay";

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
});
