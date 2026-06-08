import { prisma } from "@/lib/prisma";
import { amountToCents, centsToAmount, formatCents, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";
import { triggerWebhook } from "@/lib/webhook";
import { chargeOrderFee } from "@/lib/billing";
import { getPlatformRechargeEmail, matchRechargeOrder } from "@/lib/recharge";

export function getOrderExpiresAt(order: { expiresAt?: Date | string | null; createdAt: Date | string; app?: { expireMinutes: number } | null }) {
  if (order.expiresAt) return new Date(order.expiresAt);
  const createdAt = new Date(order.createdAt);
  const expireMinutes = order.app?.expireMinutes ?? 5;
  return new Date(createdAt.getTime() + expireMinutes * 60 * 1000);
}

export function isOrderExpired(order: { expiresAt?: Date | string | null; createdAt: Date | string; app?: { expireMinutes: number } | null }, now = new Date()) {
  return getOrderExpiresAt(order).getTime() <= now.getTime();
}

export async function selectPaymentChannel({
  userId,
  payType,
  amount,
  now = new Date()
}: {
  userId: string;
  payType: "wechat" | "alipay";
  amount: string | number;
  now?: Date;
}) {
  const amountCents = amountToCents(amount);
  const activeCodes = await prisma.paymentCode.findMany({
    where: { userId, type: payType, status: "active" },
    include: { device: true }
  });

  if (activeCodes.length === 0) {
    throw Object.assign(new Error("No active payment channels configured for this payment method"), { status: 400 });
  }

  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
  const onlineCodes = activeCodes.filter(c =>
    c.device &&
    c.device.online &&
    c.device.status === "active" &&
    c.device.lastHeartbeat &&
    new Date(c.device.lastHeartbeat) >= threeMinutesAgo
  );
  const fallbackCodes = onlineCodes.length > 0 ? onlineCodes : activeCodes;

  const codeAmountCents = (code: { amount: number }) => Math.round(code.amount * 100);
  const fixedCodes = fallbackCodes.filter(c => c.codeType === "fixed" && codeAmountCents(c) === amountCents);

  for (const code of fixedCodes) {
    const conflict = await prisma.order.findFirst({
      where: {
        paymentCodeId: code.id,
        realAmountCents: amountCents,
        status: "pending",
        expiresAt: { gt: now }
      }
    });
    if (!conflict) {
      return { selectedCode: code, amountCents, realAmountCents: amountCents };
    }
  }

  const anyCodes = fallbackCodes.filter(c => c.codeType === "any");
  if (anyCodes.length === 0) {
    throw Object.assign(new Error("No matching payment code (fixed or any) found"), { status: 400 });
  }

  let selectedCode = anyCodes[0];
  let minPendingCount = Infinity;
  for (const code of anyCodes) {
    const pendingCount = await prisma.order.count({
      where: {
        paymentCode: code.deviceId ? { deviceId: code.deviceId } : undefined,
        payType,
        status: "pending",
        expiresAt: { gt: now }
      }
    });
    if (pendingCount < minPendingCount) {
      minPendingCount = pendingCount;
      selectedCode = code;
    }
  }

  const pendingOrders = await prisma.order.findMany({
    where: {
      paymentCode: selectedCode.deviceId ? { deviceId: selectedCode.deviceId } : undefined,
      payType,
      status: "pending",
      expiresAt: { gt: now }
    },
    select: { realAmount: true, realAmountCents: true }
  });
  const occupied = new Set(pendingOrders.map(getOrderRealAmountCents));
  const offsets = [0, -1, -2, 1, 2, -3, 3, -4, 4, -5, 5, -6, 6];
  for (const offset of offsets) {
    const candidate = amountCents + offset;
    if (candidate >= 1 && !occupied.has(candidate)) {
      return { selectedCode, amountCents, realAmountCents: candidate };
    }
  }

  throw Object.assign(new Error("All payment slots for this amount are currently occupied. Please try again later."), { status: 409 });
}

export async function recordPaymentEvent(body: {
  deviceCode: string;
  payType: string;
  amount: string | number;
  receivedAt?: string;
  notificationHash: string;
  rawNotification?: string;
}) {
  const { deviceCode, payType, notificationHash } = body;
  const amountCents = amountToCents(body.amount);
  const amount = centsToAmount(amountCents);
  const eventTime = body.receivedAt ? new Date(body.receivedAt) : new Date();
  if (Number.isNaN(eventTime.getTime())) {
    throw Object.assign(new Error("Invalid receivedAt"), { status: 400 });
  }

  const existingEvent = await prisma.paymentEvent.findUnique({ where: { notificationHash } });
  if (existingEvent) {
    return {
      duplicate: true,
      result: existingEvent,
      matchStatus: existingEvent.matchStatus,
      matchedOrderId: existingEvent.matchedOrderId,
      shouldTriggerWebhook: false
    };
  }

  const device = await prisma.device.findUnique({ where: { deviceCode } });
  if (!device) throw Object.assign(new Error("Device not registered"), { status: 404 });

  const platformEmail = getPlatformRechargeEmail();
  if (platformEmail) {
    const platformUser = await prisma.user.findUnique({ where: { email: platformEmail } });
    if (platformUser && platformUser.id === device.userId) {
      const rechargeMatch = await matchRechargeOrder({
        platformUserId: platformUser.id,
        deviceId: device.id,
        payType,
        amountCents,
        eventTime,
      });
      const result = await prisma.paymentEvent.create({
        data: {
          deviceId: device.id,
          payType,
          amount,
          receivedAt: eventTime,
          matchStatus: rechargeMatch.matchStatus,
          matchedOrderId: rechargeMatch.rechargeOrderId,
          confidence: rechargeMatch.matchStatus === "matched" ? 100 : rechargeMatch.matchStatus === "conflict" ? 50 : 0,
          notificationHash,
          rawNotification: typeof body.rawNotification === "string" ? body.rawNotification.slice(0, 500) : undefined
        }
      }).catch(async err => {
        const duplicate = await prisma.paymentEvent.findUnique({ where: { notificationHash } });
        if (duplicate) return duplicate;
        throw err;
      });
      await prisma.device.update({
        where: { id: device.id },
        data: { online: true, lastHeartbeat: new Date() }
      });
      return {
        duplicate: false,
        result,
        matchStatus: rechargeMatch.matchStatus,
        matchedOrderId: rechargeMatch.rechargeOrderId,
        shouldTriggerWebhook: false,
      };
    }
  }

  const candidates = await prisma.order.findMany({
    where: {
      app: { userId: device.userId },
      paymentCode: { deviceId: device.id },
      payType,
      realAmountCents: amountCents,
      status: "pending",
      expiresAt: { gt: eventTime }
    },
    include: { app: true },
    orderBy: { createdAt: "asc" }
  });

  let matchStatus = "unmatched";
  let matchedOrderId: string | null = null;
  let confidence = 0;
  let shouldTriggerWebhook = false;

  const safeRawNotification = typeof body.rawNotification === "string" ? body.rawNotification.slice(0, 500) : undefined;

  if (candidates.length === 1) {
    const matchingOrder = candidates[0];
    const claimedOrder = await prisma.order.updateMany({
      where: { id: matchingOrder.id, status: "pending" },
      data: { status: "success", payTime: eventTime, webhookStatus: "unsent" }
    });

    if (claimedOrder.count > 0) {
      matchStatus = "matched";
      matchedOrderId = matchingOrder.id;
      confidence = 100;
      shouldTriggerWebhook = true;

      const user = await prisma.user.findUnique({ where: { id: device.userId } });
      if (user) {
        await chargeOrderFee(prisma, user, matchingOrder);
      }
    }
  } else if (candidates.length > 1) {
    matchStatus = "conflict";
    confidence = 50;
    await prisma.order.updateMany({
      where: { id: { in: candidates.map(o => o.id) }, status: "pending" },
      data: { status: "manual_review" }
    });
  }

  const result = await prisma.paymentEvent.create({
    data: {
      deviceId: device.id,
      payType,
      amount,
      receivedAt: eventTime,
      matchStatus,
      matchedOrderId,
      confidence,
      notificationHash,
      rawNotification: safeRawNotification
    }
  }).catch(async err => {
    const duplicate = await prisma.paymentEvent.findUnique({ where: { notificationHash } });
    if (duplicate) return duplicate;
    throw err;
  });

  if (matchStatus === "unmatched") {
    const expiredOrder = await prisma.order.findFirst({
      where: {
        app: { userId: device.userId },
        paymentCode: { deviceId: device.id },
        payType,
        realAmountCents: amountCents,
        status: "pending",
        expiresAt: { lte: eventTime }
      },
      orderBy: { createdAt: "desc" }
    });
    await prisma.exceptionItem.create({
      data: expiredOrder ? {
        type: "expired_payment",
        title: `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatCents(amountCents)} 元，但订单已过期`,
        description: `设备收到到账通知 ${formatCents(amountCents)} 元，疑似对应已过期订单 ${expiredOrder.id}，未自动回调商户。`,
        refId: expiredOrder.id,
        status: "active",
        userId: device.userId
      } : {
        type: "payment_unmatched",
        title: `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatCents(amountCents)} 元未匹配到订单`,
        description: `设备收到到账通知 ${formatCents(amountCents)} 元，但系统云端未找到对应待付款订单。`,
        refId: notificationHash,
        status: "active",
        userId: device.userId
      }
    });
  } else if (matchStatus === "conflict") {
    await prisma.exceptionItem.create({
      data: {
        type: "payment_conflict",
        title: `${payType === "wechat" ? "微信" : "支付宝"}收到 ${formatCents(amountCents)} 元存在多笔候选订单`,
        description: `同一设备同一金额存在多笔待付款订单，系统已转入人工审核，未自动回调商户。`,
        refId: notificationHash,
        status: "active",
        userId: device.userId
      }
    });
  }

  await prisma.device.update({
    where: { id: device.id },
    data: { online: true, lastHeartbeat: new Date() }
  });

  if (matchedOrderId && shouldTriggerWebhook) {
    triggerWebhook(matchedOrderId).catch(err => console.error("Error triggering webhook in background:", err));
  }

  return { duplicate: false, result, matchStatus, matchedOrderId, shouldTriggerWebhook };
}
