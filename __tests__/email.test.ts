import { describe, expect, it, vi } from "vitest";
import { buildVerificationEmail } from "@/lib/email";

vi.mock("@/lib/d1-binding", () => ({
  resolveEnvVar: (name: string) => {
    if (name === "NEXT_PUBLIC_APP_URL") return "https://www.3api.shop";
    return "";
  },
}));

describe("verification email template", () => {
  it("builds a branded developer-friendly verification email", () => {
    const email = buildVerificationEmail("user@example.com", "token-123");

    expect(email.subject).toBe("验证邮箱，开始使用 CoderPay");
    expect(email.text).toContain("你好，欢迎加入 CoderPay");
    expect(email.text).toContain("个人微信/支付宝免签收款能力");
    expect(email.text).toContain("https://www.3api.shop/verify-email?token=token-123&email=user%40example.com");

    expect(email.html).toContain("https://www.3api.shop/logo.png");
    expect(email.html).toContain("激活 CoderPay 账户");
    expect(email.html).toContain("绑定 Android 监听设备并推送 Webhook");
    expect(email.html).toContain("如果按钮无法打开");
    expect(email.html).toContain("请不要将验证链接转发给他人");
  });
});
