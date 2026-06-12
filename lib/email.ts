import { resolveEnvVar } from "./d1-binding";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getAppUrl() {
  return (resolveEnvVar("NEXT_PUBLIC_APP_URL") || "https://www.3api.shop").replace(/\/$/, "");
}

function getEmailFrom() {
  return resolveEnvVar("EMAIL_FROM") || "CoderPay <noreply@3api.shop>";
}

function getResendApiKey() {
  return resolveEnvVar("RESEND_API_KEY") || "";
}

function getBrevoApiKey() {
  return resolveEnvVar("BREVO_API_KEY") || "";
}

function getEmailProvider() {
  const configured = (resolveEnvVar("EMAIL_PROVIDER") || "").toLowerCase();
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const logoUrl = `${getAppUrl()}/logo.png`;
  const safeUrl = escapeHtml(url);
  const safeLogoUrl = escapeHtml(logoUrl);
  return {
    subject: "验证邮箱，开始使用 CoderPay",
    text: `你好，欢迎加入 CoderPay。\n\nCoderPay 为独立开发者提供个人微信/支付宝免签收款能力。为了让你的账户可以安全地创建应用、接收订单、绑定 Android 监听设备并推送 Webhook，请先验证邮箱地址。\n\n点击以下链接激活账户：\n${url}\n\n该验证链接 24 小时内有效。如果这不是你本人的操作，请忽略本邮件。`,
    html: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>验证邮箱，开始使用 CoderPay</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Microsoft YaHei',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.10);">
            <tr>
              <td style="padding:28px 32px 20px;background:#0b1020;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${safeLogoUrl}" width="40" height="40" alt="CoderPay" style="display:block;border-radius:12px;border:1px solid rgba(255,255,255,0.16);">
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="font-size:18px;font-weight:800;line-height:1;color:#ffffff;">CoderPay</div>
                      <div style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:4px;">Developer payment infrastructure</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="font-size:13px;font-weight:700;color:#2563eb;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">Email Verification</div>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.28;color:#0f172a;">验证邮箱，开始使用 CoderPay</h1>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:#334155;">你好，欢迎加入 CoderPay。</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#334155;">CoderPay 为独立开发者提供个人微信/支付宝免签收款能力。为了让你的账户可以安全地创建应用、接收订单、绑定 Android 监听设备并推送 Webhook，请先验证邮箱地址。</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:12px;background:#2563eb;">
                      <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:800;line-height:1;color:#ffffff;text-decoration:none;border-radius:12px;">激活 CoderPay 账户</a>
                    </td>
                  </tr>
                </table>
                <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
                  <div style="font-size:13px;font-weight:700;color:#475569;margin-bottom:8px;">如果按钮无法打开，也可以复制下面的链接完成验证：</div>
                  <a href="${safeUrl}" target="_blank" rel="noopener" style="font-size:13px;line-height:1.6;color:#2563eb;word-break:break-all;">${safeUrl}</a>
                </div>
                <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#64748b;">该验证链接 24 小时内有效。如果这不是你本人的操作，请忽略本邮件。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;border-top:1px solid #e2e8f0;background:#fbfdff;">
                <div style="font-size:12px;line-height:1.7;color:#94a3b8;">这是一封自动发送的账户安全邮件，请不要直接回复。为了账户安全，请不要将验证链接转发给他人。</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
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
