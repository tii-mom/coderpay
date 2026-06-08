export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function checkHttpsUrl(value?: string | null) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [apps, devices, codes, recentWebhookLogs] = await Promise.all([
      prisma.app.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.device.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.paymentCode.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.webhookLog.findMany({
        where: { order: { app: { userId: user.id } } },
        orderBy: { requestTime: "desc" },
        take: 10,
      }),
    ]);

    const activeDevices = devices.filter(d => d.status === "active" && d.online);
    const readyDevices = activeDevices.filter(d => d.notificationPermission && d.batteryOptimization === "ignored");
    const activeCodes = codes.filter(c => c.status === "active");
    const fixedCodes = activeCodes.filter(c => c.codeType === "fixed");
    const anyCodes = activeCodes.filter(c => c.codeType === "any");
    const fixedCoverage = new Set(fixedCodes.map(c => `${c.type}:${c.amount.toFixed(2)}:${c.deviceId || "none"}`));
    const webhookHttpsApps = apps.filter(a => checkHttpsUrl(a.notifyUrl));
    const successfulWebhookLogs = recentWebhookLogs.filter(l => l.result === "success" && l.responseSummary?.toLowerCase().includes("success"));

    const checks = [
      {
        id: "app",
        label: "应用凭据",
        status: apps.length > 0 ? "pass" : "fail",
        detail: apps.length > 0 ? `已创建 ${apps.length} 个应用` : "请先创建应用并保存 App Secret",
      },
      {
        id: "webhook-url",
        label: "Webhook 地址",
        status: apps.length > 0 && webhookHttpsApps.length === apps.length ? "pass" : webhookHttpsApps.length > 0 ? "warn" : "fail",
        detail: webhookHttpsApps.length > 0 ? `${webhookHttpsApps.length}/${apps.length} 个应用使用 HTTPS notify_url` : "notify_url 必须是 HTTPS URL",
      },
      {
        id: "device-online",
        label: "Android 监听端",
        status: readyDevices.length > 0 ? "pass" : activeDevices.length > 0 ? "warn" : "fail",
        detail: readyDevices.length > 0 ? `${readyDevices.length} 台设备在线且权限完整` : activeDevices.length > 0 ? "设备在线，但通知权限或电池保活未全部通过" : "没有在线监听设备",
      },
      {
        id: "payment-code",
        label: "收款码覆盖",
        status: activeCodes.length > 0 && (fixedCodes.length > 0 || anyCodes.length > 0) ? "pass" : "fail",
        detail: `固定码 ${fixedCodes.length} 个，通用码 ${anyCodes.length} 个，固定覆盖 ${fixedCoverage.size} 组`,
      },
      {
        id: "webhook-success",
        label: "回调响应",
        status: successfulWebhookLogs.length > 0 ? "pass" : recentWebhookLogs.length > 0 ? "warn" : "warn",
        detail: successfulWebhookLogs.length > 0 ? `最近 ${successfulWebhookLogs.length} 次回调返回 success` : recentWebhookLogs.length > 0 ? "最近有回调记录，但未确认 success 响应" : "暂无真实回调记录，请完成一笔小额联调",
      },
      {
        id: "balance",
        label: "服务费余额",
        status: user.feeBalance > 0 ? "pass" : "warn",
        detail: user.feeBalance > 0 ? `余额 ¥${user.feeBalance.toFixed(2)}` : "余额不足会影响真实订单回调",
      },
    ];

    return NextResponse.json({
      summary: {
        pass: checks.filter(c => c.status === "pass").length,
        warn: checks.filter(c => c.status === "warn").length,
        fail: checks.filter(c => c.status === "fail").length,
      },
      checks,
    });
  } catch (err) {
    console.error("Integration checkup failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
