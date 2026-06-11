import { prisma } from "@/lib/prisma";
import { amountToCents, centsToAmount, formatCents, getOrderRealAmountCents } from "@/lib/money";
import { randomNumericCode } from "@/lib/random";
import { resolveEnvVar } from "./d1-binding";
import { getRechargePromotion, getRechargePromotionDescription, getRechargePromotionUpdate } from "@/lib/recharge-promotions";

const RECHARGE_EXPIRE_MINUTES = 10;

export function isDeviceReadyForRecharge(
  code: {
    device?: {
      online: boolean;
      status: string;
      lastHeartbeat: Date | string | null;
      wechatListener?: string | null;
      alipayListener?: string | null;
      notificationPermission?: boolean | null;
      batteryOptimization?: string | null;
    } | null;
  },
  payType: "wechat" | "alipay",
  onlineThreshold: Date
) {
  const device = code.device;
  if (!device?.online || device.status !== "active" || !device.lastHeartbeat) return false;
  if (new Date(device.lastHeartbeat) < onlineThreshold) return false;
  if (device.notificationPermission !== true) return false;
  if (device.batteryOptimization !== "ignored") return false;

  const listenerStatus = payType === "wechat" ? device.wechatListener : device.alipayListener;
  return listenerStatus === "running";
}

export function getPlatformRechargeEmail() {
  return (resolveEnvVar("PLATFORM_RECHARGE_USER_EMAIL") || "").trim().toLowerCase();
}

export async function getPlatformRechargeUser() {
  const email = getPlatformRechargeEmail();
  if (!email) {
    throw Object.assign(new Error("PLATFORM_RECHARGE_USER_EMAIL is not configured"), { status: 503 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw Object.assign(new Error("Platform recharge user not found"), { status: 503 });
  }
  return user;
}

export async function selectRechargePaymentChannel({
  payType,
  amountCents,
  now = new Date(),
}: {
  payType: "wechat" | "alipay";
  amountCents: number;
  now?: Date;
}) {
  const platformUser = await getPlatformRechargeUser();
  const activeCodes = await prisma.paymentCode.findMany({
    where: { userId: platformUser.id, type: payType, status: "active" },
    include: { device: true },
  });

  if (activeCodes.length === 0) {
    throw Object.assign(new Error("No active platform recharge payment code configured"), { status: 503 });
  }

  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
  const onlineCodes = activeCodes.filter(c => isDeviceReadyForRecharge(c, payType, threeMinutesAgo));
  const onlineFixedCode = onlineCodes.find(c => c.codeType === "fixed" && Math.round(c.amount * 100) === amountCents);
  if (onlineFixedCode) return { selectedCode: onlineFixedCode, realAmountCents: amountCents, requiresManualConfirm: false };

  const offlineFixedCode = activeCodes.find(c => c.codeType === "fixed" && Math.round(c.amount * 100) === amountCents);
  if (offlineFixedCode) return { selectedCode: offlineFixedCode, realAmountCents: amountCents, requiresManualConfirm: true };

  const onlineAnyCodes = onlineCodes.filter(c => c.codeType === "any");
  const activeAnyCodes = activeCodes.filter(c => c.codeType === "any");
  const requiresManualConfirm = onlineAnyCodes.length === 0;
  const anyCodes = requiresManualConfirm ? activeAnyCodes : onlineAnyCodes;
  if (anyCodes.length === 0) {
    throw Object.assign(new Error("No platform recharge any-amount payment code configured"), { status: 503 });
  }

  let selectedCode = anyCodes[0];
  let minPendingCount = Infinity;
  for (const code of anyCodes) {
    const pendingCount = await prisma.rechargeOrder.count({
      where: {
        paymentCode: code.deviceId ? { deviceId: code.deviceId } : undefined,
        payType,
        status: "pending",
        expiresAt: { gt: now },
      },
    });
    if (pendingCount < minPendingCount) {
      minPendingCount = pendingCount;
      selectedCode = code;
    }
  }

  const pendingOrders = await prisma.rechargeOrder.findMany({
    where: {
      paymentCode: selectedCode.deviceId ? { deviceId: selectedCode.deviceId } : undefined,
      payType,
      status: "pending",
      expiresAt: { gt: now },
    },
    select: { realAmount: true, realAmountCents: true },
  });
  const occupied = new Set(pendingOrders.map(getOrderRealAmountCents));
  const offsets = [0, -1, -2, 1, 2, -3, 3, -4, 4, -5, 5, -6, 6];
  for (const offset of offsets) {
    const candidate = amountCents + offset;
    if (candidate >= 1 && !occupied.has(candidate)) {
      return { selectedCode, realAmountCents: candidate, requiresManualConfirm };
    }
  }

  throw Object.assign(new Error("All platform recharge payment slots are currently occupied"), { status: 409 });
}

export async function createRechargeOrder({
  userId,
  amount,
  payType,
}: {
  userId: string;
  amount: string | number;
  payType: "wechat" | "alipay";
}) {
  const amountCents = amountToCents(amount);
  const channel = await selectRechargePaymentChannel({ payType, amountCents });
  const expiresAt = new Date(Date.now() + RECHARGE_EXPIRE_MINUTES * 60 * 1000);
  const id = `RC${randomNumericCode(12)}`;

  return prisma.rechargeOrder.create({
    data: {
      id,
      amount: centsToAmount(amountCents),
      realAmount: centsToAmount(channel.realAmountCents),
      amountCents,
      realAmountCents: channel.realAmountCents,
      payType,
      expiresAt,
      userId,
      paymentCodeId: channel.selectedCode.id,
      confirmMode: channel.requiresManualConfirm ? "manual" : "auto",
    },
    include: { paymentCode: true },
  }).then((order) => Object.assign(order, { requiresManualConfirm: channel.requiresManualConfirm }));
}

export async function matchRechargeOrder({
  platformUserId,
  deviceId,
  payType,
  amountCents,
  eventTime,
}: {
  platformUserId: string;
  deviceId: string;
  payType: string;
  amountCents: number;
  eventTime: Date;
}) {
  const rechargeOrders = await prisma.rechargeOrder.findMany({
    where: {
      paymentCode: { userId: platformUserId, deviceId },
      payType,
      realAmountCents: amountCents,
      status: "pending",
      expiresAt: { gt: eventTime },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rechargeOrders.length !== 1) {
    return { matchStatus: rechargeOrders.length > 1 ? "conflict" : "unmatched", rechargeOrderId: null as string | null };
  }

  const rechargeOrder = rechargeOrders[0];
  const claimed = await prisma.rechargeOrder.updateMany({
    where: { id: rechargeOrder.id, status: "pending" },
    data: { status: "success", payTime: eventTime },
  });
  if (claimed.count === 0) return { matchStatus: "unmatched", rechargeOrderId: null as string | null };

  const user = await prisma.user.findUnique({ where: { id: rechargeOrder.userId } });
  if (!user) return { matchStatus: "unmatched", rechargeOrderId: null as string | null };

  const amount = Number(formatCents(rechargeOrder.amountCents));
  const newBalance = Number((user.feeBalance + amount).toFixed(2));
  const promotion = getRechargePromotion(rechargeOrder.amountCents);
  const promotionUpdate = promotion ? getRechargePromotionUpdate(user, promotion, eventTime) : null;
  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        feeBalance: newBalance,
        ...(promotionUpdate ? {
          packageType: promotionUpdate.packageType,
          subscriptionExpiresAt: promotionUpdate.subscriptionExpiresAt,
        } : {}),
      },
    });
    await tx.billingRecord.create({
      data: {
        type: "charge",
        amount,
        balance: newBalance,
        description: `真实充值入账: 充值单 ${rechargeOrder.id}, 实付 ${formatCents(rechargeOrder.realAmountCents)} 元`,
        userId: user.id,
      },
    });
    if (promotion && promotionUpdate) {
      await tx.billingRecord.create({
        data: {
          type: "promotion",
          amount: 0,
          balance: newBalance,
          description: `${getRechargePromotionDescription(promotion)}: 充值单 ${rechargeOrder.id}`,
          userId: user.id,
        },
      });
    }
  });

  return { matchStatus: "matched", rechargeOrderId: rechargeOrder.id };
}
