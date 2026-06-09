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

function getBrevoApiKey() {
  return process.env.BREVO_API_KEY || "";
}

function getEmailProvider() {
  const configured = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (configured) return configured;
  if (getBrevoApiKey()) return "brevo";
  if (getResendApiKey()) return "resend";
  return "";
}

export function assertEmailConfigured() {
  if (process.env.NODE_ENV !== "production") return;
  if (!getEmailProvider()) {
    throw Object.assign(new Error("Email service is not configured"), { status: 503 });
  }
}

function parseEmailFrom(value: string) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) return { email: value.trim() };
  return {
    name: match[1].trim(),
    email: match[2].trim(),
  };
}

async function sendResendEmail(input: SendEmailInput) {
  const resendApiKey = getResendApiKey();
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
  return response;
}

async function sendBrevoEmail(input: SendEmailInput) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": getBrevoApiKey(),
    },
    body: JSON.stringify({
      sender: parseEmailFrom(getEmailFrom()),
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    }),
  });
  return response;
}

export async function sendEmail(input: SendEmailInput) {
  const provider = getEmailProvider();
  if (!provider) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[EMAIL:DEV] ${input.subject} -> ${input.to}\n${input.text}`);
      return;
    }
    throw Object.assign(new Error("Email service is not configured"), { status: 503 });
  }

  const response = provider === "brevo"
    ? await sendBrevoEmail(input)
    : await sendResendEmail(input);

  if (!response.ok) {
    const body = await response.text();
    console.error(`${provider} email send failed:`, response.status, body.slice(0, 500));
    throw Object.assign(new Error("Email send failed"), { status: 500 });
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
