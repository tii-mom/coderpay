import { describe, expect, it } from "vitest";
import CryptoJS from "crypto-js";
import { verifyMerchantSign } from "@/lib/d1-direct";

describe("D1 direct signature verification", () => {
  it("accepts legacy MD5 merchant signatures", async () => {
    const appSecret = "secret";
    const params = {
      app_id: "10043",
      amount: "29.90",
      out_order_no: "ORDER_1",
      pay_type: "alipay"
    };
    const payload = "amount=29.90&app_id=10043&out_order_no=ORDER_1&pay_type=alipay&key=secret";
    const sign = CryptoJS.MD5(payload).toString();

    await expect(verifyMerchantSign({ ...params, sign }, appSecret, "MD5", sign)).resolves.toBe(true);
  });
});
