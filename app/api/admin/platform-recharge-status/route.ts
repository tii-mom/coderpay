export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1 } from "@/lib/auth-d1";
import { resolveEnvVar } from "@/lib/d1-binding";

// Mirrors the readiness logic in scripts/setup-platform-recharge.mjs:
// a payment code is "usable now" if its bound device is online, active, has
// sent a heartbeat within the last 3 minutes, and its notification listener is
// actually running for that payment type.
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const email = (resolveEnvVar("PLATFORM_RECHARGE_USER_EMAIL") || "").trim().toLowerCase();
    if (!email) {
      return adminJson({
        configured: false,
        ready: false,
        gaps: ["未配置 PLATFORM_RECHARGE_USER_EMAIL 环境变量"],
      });
    }

    const db = getAuthD1();

    const user = await db
      .prepare(`SELECT id, email FROM User WHERE LOWER(email) = ? LIMIT 1`)
      .bind(email)
      .first<{ id: string; email: string }>();

    if (!user) {
      return adminJson({
        configured: true,
        email,
        userExists: false,
        ready: false,
        boundDevices: 0,
        onlineDevices: 0,
        activeCodes: 0,
        usableCodes: 0,
        hasWechat: false,
        hasAlipay: false,
        lastHeartbeat: null,
        gaps: [`平台收款用户 ${email} 在数据库中不存在，请运行 platform:setup 创建`],
      });
    }

    const onlineThresholdMs = Date.now() - 3 * 60 * 1000;

    const [deviceCount, codeRows] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) AS c FROM Device WHERE userId = ?`)
        .bind(user.id)
        .first<{ c: number }>(),
      db
        .prepare(
          `SELECT pc.type AS type, pc.status AS status,
                  d.online AS online, d.status AS deviceStatus, d.lastHeartbeat AS lastHeartbeat,
                  d.wechatListener AS wechatListener, d.alipayListener AS alipayListener,
                  d.notificationPermission AS notificationPermission,
                  d.batteryOptimization AS batteryOptimization
           FROM PaymentCode pc
           LEFT JOIN Device d ON d.id = pc.deviceId
           WHERE pc.userId = ? AND pc.status = 'active'`
        )
        .bind(user.id)
        .all<{
          type: string;
          status: string;
          online: number | null;
          deviceStatus: string | null;
          lastHeartbeat: string | null;
          wechatListener: string | null;
          alipayListener: string | null;
          notificationPermission: number | boolean | null;
          batteryOptimization: string | null;
        }>(),
    ]);

    const codes = codeRows.results ?? [];
    const usable = codes.filter(
      (c) =>
        Number(c.online) === 1 &&
        c.deviceStatus === "active" &&
        c.lastHeartbeat &&
        new Date(c.lastHeartbeat).getTime() >= onlineThresholdMs &&
        (c.notificationPermission === true || Number(c.notificationPermission) === 1) &&
        c.batteryOptimization === "ignored" &&
        (c.type === "wechat" ? c.wechatListener : c.alipayListener) === "running"
    );
    const usableTypes = new Set(usable.map((c) => c.type));
    const hasWechat = usableTypes.has("wechat");
    const hasAlipay = usableTypes.has("alipay");

    // Online device count for this platform user.
    const onlineDevices = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM Device WHERE userId = ? AND online = 1 AND status = 'active' AND lastHeartbeat >= ?`
      )
      .bind(user.id, new Date(onlineThresholdMs).toISOString().replace("Z", "+00:00"))
      .first<{ c: number }>();

    // Most recent heartbeat across this user's devices.
    const lastHb = await db
      .prepare(
        `SELECT lastHeartbeat FROM Device WHERE userId = ? AND lastHeartbeat IS NOT NULL ORDER BY lastHeartbeat DESC LIMIT 1`
      )
      .bind(user.id)
      .first<{ lastHeartbeat: string | null }>();

    const boundDevices = Number(deviceCount?.c) || 0;
    const gaps: string[] = [];
    if (boundDevices === 0) gaps.push("尚未绑定任何 Watcher 设备");
    if (codes.length === 0) gaps.push("没有 active 状态的收款码");
    if (!hasWechat) gaps.push("缺少可用的微信收款码（设备需在线，且微信通知监听需 running）");
    if (!hasAlipay) gaps.push("缺少可用的支付宝收款码（设备需在线，且支付宝通知监听需 running）");

    const ready = usable.length > 0 && hasWechat && hasAlipay;

    return adminJson({
      configured: true,
      email: user.email,
      userExists: true,
      ready,
      boundDevices,
      onlineDevices: Number(onlineDevices?.c) || 0,
      activeCodes: codes.length,
      usableCodes: usable.length,
      hasWechat,
      hasAlipay,
      lastHeartbeat: lastHb?.lastHeartbeat ?? null,
      gaps,
    });
  } catch (err) {
    console.error("Admin platform recharge status failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
