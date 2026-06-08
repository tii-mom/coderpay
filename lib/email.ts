type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.3api.shop").replace(/\/$/, "");
}

function getEmailFrom() {
  return process.env.EMAIL_FROM || "CoderPay <noreply@3api.shop>";
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY || "";
}

export function assertEmailConfigured() {
  if (process.env.NODE_ENV !== "production") return;
  if (!getResendApiKey()) {
    throw Object.assign(new Error("Email service is not configured"), { status: 503 });
  }
}

export async function sendEmail(input: SendEmailInput) {
  const resendApiKey = getResendApiKey();
  if (!resendApiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[EMAIL:DEV] ${input.subject} -> ${input.to}\n${input.text}`);
      return;
    }
    throw Object.assign(new Error("Email service is not configured"), { status: 503 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Email send failed:", response.status, body.slice(0, 500));
    throw Object.assign(new Error("Email send failed"), { status: 502 });
  }
}

export function buildVerificationEmail(email: string, token: string) {
  const url = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return {
    subject: "验证你的 CoderPay 邮箱",
    text: `请打开以下链接完成 CoderPay 邮箱验证：\n${url}\n\n该链接 24 小时内有效。`,
    html: `<p>请点击下面的链接完成 CoderPay 邮箱验证：</p><p><a href="${url}">${url}</a></p><p>该链接 24 小时内有效。</p>`,
  };
}

export function buildPasswordResetEmail(email: string, token: string) {
  const url = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return {
    subject: "重置你的 CoderPay 密码",
    text: `请打开以下链接重置 CoderPay 密码：\n${url}\n\n该链接 30 分钟内有效。如果不是你本人操作，请忽略此邮件。`,
    html: `<p>请点击下面的链接重置 CoderPay 密码：</p><p><a href="${url}">${url}</a></p><p>该链接 30 分钟内有效。如果不是你本人操作，请忽略此邮件。</p>`,
  };
}
