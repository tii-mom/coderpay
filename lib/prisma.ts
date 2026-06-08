import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { hashPassword } from "./password";
import { randomHex } from "./random";

const globalForPrisma = globalThis as unknown as { prisma: any };

let prismaInstance: any = null;
const LOCAL_QR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23fff'/%3E%3Crect x='56' y='56' width='96' height='96' fill='%230f172a'/%3E%3Crect x='248' y='56' width='96' height='96' fill='%230f172a'/%3E%3Crect x='56' y='248' width='96' height='96' fill='%230f172a'/%3E%3Cpath d='M200 200h32v32h-32zm48 0h32v32h-32zm0 48h32v32h-32zm48 0h48v48h-48zm-96 48h32v48h-32z' fill='%230f172a'/%3E%3C/svg%3E";

function getRuntimeRequire() {
  try {
    return Function("return typeof require === 'undefined' ? undefined : require")();
  } catch {
    return undefined;
  }
}

function getPrisma(): PrismaClient {
  if (prismaInstance) return prismaInstance;

  const env = process.env as any;
  const req = getRuntimeRequire();

  if (env.DB) {
    const adapter = new PrismaD1(env.DB);
    prismaInstance = new PrismaClient({ adapter });
  } else {
    let d1: any = null;
    if (req) {
      try {
        const clPackage = ["@cloudflare", "next-on-pages"].join("/");
        const { getRequestContext } = req(clPackage);
        d1 = getRequestContext().env.DB;
      } catch (e) {}
    }

    if (d1) {
      const adapter = new PrismaD1(d1);
      prismaInstance = new PrismaClient({ adapter });
    } else {
      // Local fallback for Node.js runtime (next dev / build / CLI)
      if (req) {
        try {
          const sqliteAdapterPackage = ["@prisma", "adapter-better-sqlite3"].join("/");
          const { PrismaBetterSqlite3 } = req(sqliteAdapterPackage);
          const dbUrl = env.DATABASE_URL || "file:./dev.db";
          const adapter = new PrismaBetterSqlite3({ url: dbUrl });
          prismaInstance = new PrismaClient({ adapter });
        } catch (err) {
          console.warn("Prisma fallback adapter loading failed, creating default client:", err);
          prismaInstance = new PrismaClient();
        }
      } else {
        // Safe fallback for edge runtime evaluation at build time
        prismaInstance = new PrismaClient();
      }
    }
  }
  return prismaInstance;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const instance = getPrisma();
    const value = Reflect.get(instance, prop);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  }
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Auto seed function
export async function autoSeed() {
  // Guard for production environment
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_SEED !== "true") {
    console.log("Production environment detected. Auto-seed skipped.");
    return;
  }

  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("Database is empty. Running auto-seed...");
      // create default user
      const user = await prisma.user.create({
        data: {
          email: "local-dev@coderpay.local",
          passwordHash: await hashPassword("local-dev-password"),
          feeBalance: 99.60,
          packageType: "free",
          freeOrderUsed: 0,
        }
      });

      // create apps
      const app1 = await prisma.app.create({
        data: {
          appId: "10042",
          appSecret: randomHex(32),
          name: "网盘自动化工具插件",
          notifyUrl: "https://api.pan-tool.com/webhook/pay",
          returnUrl: "https://example.com/success",
          feedbackUrl: "https://example.com/support",
          expireMinutes: 5,
          signType: "HMAC-SHA256",
          userId: user.id
        }
      });

      const app2 = await prisma.app.create({
        data: {
          appId: "10043",
          appSecret: randomHex(32),
          name: "赞助打赏与支持独立开发",
          notifyUrl: "https://api.indie-developer.quest/v1/payment/callback",
          returnUrl: "https://example.com/success",
          feedbackUrl: "https://example.com/support",
          expireMinutes: 10,
          signType: "MD5",
          userId: user.id
        }
      });

      // create devices
      const dev1 = await prisma.device.create({
        data: {
          deviceCode: "dev-1",
          deviceSecret: `sec_${randomHex(32)}`,
          name: "Redmi Note 10",
          online: true,
          wechatListener: "running",
          alipayListener: "running",
          notificationPermission: true,
          batteryOptimization: "ignored",
          status: "active",
          userId: user.id
        }
      });

      const dev2 = await prisma.device.create({
        data: {
          deviceCode: "dev-2",
          deviceSecret: `sec_${randomHex(32)}`,
          name: "Redmi Note 10 (备用监控)",
          online: false,
          wechatListener: "stopped",
          alipayListener: "stopped",
          notificationPermission: true,
          batteryOptimization: "ignored",
          status: "active",
          userId: user.id
        }
      });

      // create codes
      const code1 = await prisma.paymentCode.create({
        data: {
          type: "wechat",
          codeType: "any",
          amount: 0.0,
          imageUrl: LOCAL_QR_PLACEHOLDER,
          status: "active",
          deviceId: dev1.id,
          userId: user.id
        }
      });

      const code2 = await prisma.paymentCode.create({
        data: {
          type: "alipay",
          codeType: "any",
          amount: 0.0,
          imageUrl: LOCAL_QR_PLACEHOLDER,
          status: "active",
          deviceId: dev1.id,
          userId: user.id
        }
      });

      const code3 = await prisma.paymentCode.create({
        data: {
          type: "wechat",
          codeType: "fixed",
          amount: 9.90,
          imageUrl: LOCAL_QR_PLACEHOLDER,
          status: "active",
          deviceId: dev1.id,
          userId: user.id
        }
      });

      const code4 = await prisma.paymentCode.create({
        data: {
          type: "alipay",
          codeType: "fixed",
          amount: 29.90,
          imageUrl: LOCAL_QR_PLACEHOLDER,
          status: "active",
          deviceId: dev2.id,
          userId: user.id
        }
      });

      // create orders
      await prisma.order.createMany({
        data: [
          {
            id: "CP100824",
            outOrderNo: "OUT_98248381",
            appId: app1.id,
            title: "1个月VIP技术服务",
            payType: "wechat",
            amount: 9.90,
            realAmount: 9.90,
            amountCents: 990,
            realAmountCents: 990,
            status: "success",
            createdAt: new Date("2026-06-05T16:44:02Z"),
            expiresAt: new Date("2026-06-05T16:49:02Z"),
            payTime: new Date("2026-06-05T16:45:12Z"),
            webhookStatus: "success",
            paymentCodeId: code3.id
          },
          {
            id: "CP100825",
            outOrderNo: "OUT_98248382",
            appId: app2.id,
            title: "文件搜索插件高级版",
            payType: "alipay",
            amount: 29.90,
            realAmount: 29.90,
            amountCents: 2990,
            realAmountCents: 2990,
            status: "success",
            createdAt: new Date("2026-06-05T16:30:15Z"),
            expiresAt: new Date("2026-06-05T16:40:15Z"),
            payTime: new Date("2026-06-05T16:32:01Z"),
            webhookStatus: "success",
            paymentCodeId: code4.id
          },
          {
            id: "CP100826",
            outOrderNo: "OUT_98248383",
            appId: app1.id,
            title: "网盘助手激活码",
            payType: "wechat",
            amount: 15.00,
            realAmount: 14.98,
            amountCents: 1500,
            realAmountCents: 1498,
            status: "pending",
            createdAt: new Date("2026-06-05T16:55:00Z"),
            expiresAt: new Date("2026-06-05T17:00:00Z"),
            webhookStatus: "unsent",
            paymentCodeId: code1.id
          },
          {
            id: "CP100827",
            outOrderNo: "OUT_98248384",
            appId: app1.id,
            title: "1个月VIP技术服务",
            payType: "wechat",
            amount: 9.90,
            realAmount: 9.90,
            status: "expired",
            createdAt: new Date("2026-06-05T16:00:00Z"),
            expiresAt: new Date("2026-06-05T16:05:00Z"),
            webhookStatus: "unsent",
            paymentCodeId: code3.id
          },
          {
            id: "CP100828",
            outOrderNo: "OUT_98248385",
            appId: app2.id,
            title: "SaaS部署脚手架",
            payType: "alipay",
            amount: 99.00,
            realAmount: 99.00,
            amountCents: 9900,
            realAmountCents: 9900,
            status: "manual_review",
            createdAt: new Date("2026-06-05T15:45:00Z"),
            expiresAt: new Date("2026-06-05T15:55:00Z"),
            webhookStatus: "failed",
            paymentCodeId: code2.id
          }
        ]
      });

      // create events
      await prisma.paymentEvent.createMany({
        data: [
          {
            id: "evt-1",
            deviceId: dev1.id,
            payType: "wechat",
            amount: 9.90,
            receivedAt: new Date("2026-06-05T16:45:10Z"),
            matchStatus: "matched",
            matchedOrderId: "CP100824",
            confidence: 100,
            notificationHash: "hash-evt-1"
          },
          {
            id: "evt-2",
            deviceId: dev1.id,
            payType: "alipay",
            amount: 29.90,
            receivedAt: new Date("2026-06-05T16:32:00Z"),
            matchStatus: "matched",
            matchedOrderId: "CP100825",
            confidence: 100,
            notificationHash: "hash-evt-2"
          },
          {
            id: "evt-3",
            deviceId: dev1.id,
            payType: "wechat",
            amount: 10.00,
            receivedAt: new Date("2026-06-05T16:58:30Z"),
            matchStatus: "unmatched",
            confidence: 0,
            notificationHash: "hash-evt-3"
          },
          {
            id: "evt-4",
            deviceId: dev1.id,
            payType: "wechat",
            amount: 9.90,
            receivedAt: new Date("2026-06-05T16:10:00Z"),
            matchStatus: "unmatched",
            confidence: 30,
            notificationHash: "hash-evt-4"
          }
        ]
      });

      // create exceptions
      await prisma.exceptionItem.createMany({
        data: [
          {
            id: "exc-1",
            type: "payment_unmatched",
            title: "微信收款 10.00 元未匹配到订单",
            description: "设备: Xiaomi MI 11，收到收款通知10.00元，但系统内没有该金额的待支付订单。",
            createdAt: new Date("2026-06-05T16:58:30Z"),
            refId: "evt-3",
            status: "active",
            userId: user.id
          },
          {
            id: "exc-2",
            type: "expired_payment",
            title: "订单已过期后到账风险",
            description: "收到微信收款9.90元，疑似对应已过期订单 CP100827，请人工核对并手动补单。",
            createdAt: new Date("2026-06-05T16:10:00Z"),
            refId: "CP100827",
            status: "active",
            userId: user.id
          },
          {
            id: "exc-3",
            type: "webhook_failed",
            title: "应用 [网盘自动化工具插件] 回调商户超时失败",
            description: "订单 CP100828 支付回调已重试 3 次均超时响应，商户接收端地址可能有异常。",
            createdAt: new Date("2026-06-05T15:50:30Z"),
            refId: "CP100828",
            status: "active",
            userId: user.id
          },
          {
            id: "exc-4",
            type: "device_offline",
            title: "监听设备 [Redmi Note 10] 离线警报",
            description: "该备用监控设备已超过 21 小时未与 CP 云端同步心跳，可能会丢失到账通知！",
            createdAt: new Date("2026-06-04T12:30:00Z"),
            refId: "dev-2",
            status: "active",
            userId: user.id
          }
        ]
      });

      // create webhook logs
      await prisma.webhookLog.createMany({
        data: [
          {
            id: "log-1",
            orderId: "CP100824",
            url: "https://api.indie-developer.quest/v1/payment/callback",
            requestTime: new Date("2026-06-05T16:45:13Z"),
            statusCode: 200,
            responseSummary: "success",
            retryCount: 0,
            result: "success",
            requestBody: JSON.stringify({
              orderId: 'CP100824',
              outOrderNo: 'OUT_98248381',
              amount: 9.90,
              realAmount: 9.90,
              payType: 'wechat',
              status: 'success',
              payTime: '2026-06-05 16:45:12',
              sign: 'ad982b6c72e90f23cb41b2b8c9b36edef223cb2bc82ef3bc104ad9e'
            }, null, 2),
            responseBody: "success"
          },
          {
            id: "log-2",
            orderId: "CP100825",
            url: "https://api.pan-tool.com/webhook/pay",
            requestTime: new Date("2026-06-05T16:32:02Z"),
            statusCode: 200,
            responseSummary: "ok",
            retryCount: 0,
            result: "success",
            requestBody: JSON.stringify({
              orderId: 'CP100825',
              outOrderNo: 'OUT_98248382',
              amount: 29.90,
              realAmount: 29.90,
              payType: 'alipay',
              status: 'success',
              payTime: '2026-06-05 16:32:01',
              sign: 'fb88a8c88fdceb485fb0b04bd1fb9c4a'
            }, null, 2),
            responseBody: "ok"
          },
          {
            id: "log-3",
            orderId: "CP100828",
            url: "https://api.pan-tool.com/webhook/pay",
            requestTime: new Date("2026-06-05T15:45:10Z"),
            statusCode: 504,
            responseSummary: "Gateway Timeout",
            retryCount: 3,
            result: "failed",
            requestBody: JSON.stringify({
              orderId: 'CP100828',
              outOrderNo: 'OUT_98248385',
              amount: 99.00,
              realAmount: 99.00,
              payType: 'alipay',
              status: 'success',
              payTime: '2026-06-05 15:45:00',
              sign: '5a2b3c2e1fde0cbae2391bde4cfa9e3d'
            }, null, 2),
            responseBody: "<html><head><title>504 Gateway Time-out</title></head><body><center><h1>504 Gateway Time-out</h1></center><hr><center>nginx</center></body></html>"
          }
        ]
      });

      // create billing records
      await prisma.billingRecord.createMany({
        data: [
          {
            id: "bill-1",
            type: "charge",
            amount: 100.00,
            balance: 100.00,
            description: "通过支付宝充值技术服务费",
            createdAt: new Date("2026-05-15T10:00:00Z"),
            userId: user.id
          },
          {
            id: "bill-2",
            type: "fee",
            amount: -0.099,
            balance: 99.901,
            description: "技术服务费扣除: 订单 CP100824, 金额 9.90 元",
            createdAt: new Date("2026-06-05T16:45:13Z"),
            userId: user.id
          },
          {
            id: "bill-3",
            type: "fee",
            amount: -0.299,
            balance: 99.602,
            description: "技术服务费扣除: 订单 CP100825, 金额 29.90 元",
            createdAt: new Date("2026-06-05T16:32:02Z"),
            userId: user.id
          }
        ]
      });
      console.log("Auto-seed completed successfully.");
    } else {
      console.log("Database already has data. Skipping auto-seed.");
    }
  } catch (err) {
    console.error("Error in autoSeed:", err);
  }
}
