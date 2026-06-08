export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDeviceSignature } from "@/lib/signature";
import { randomHex } from "@/lib/random";

function generateDeviceSecret() {
  return `sec_${randomHex(32)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      deviceCode, 
      wechatListener, 
      alipayListener, 
      notificationPermission, 
      batteryOptimization,
      timestamp,
      sign
    } = body;
    
    if (!deviceCode) {
      return NextResponse.json({ error: "Device code is required" }, { status: 400 });
    }
    
    let device = await prisma.device.findUnique({
      where: { deviceCode }
    });
    
    if (!device) {
      return NextResponse.json({ error: "Device not registered" }, { status: 404 });
    }

    let generatedSecret = "";
    
    // HMAC signature validation
    if (device.deviceSecret) {
      if (!timestamp || !sign) {
        return NextResponse.json({ error: "Authentication credentials (timestamp and sign) required" }, { status: 401 });
      }
      const isSignValid = verifyDeviceSignature(deviceCode, String(timestamp), device.deviceSecret, sign);
      if (!isSignValid) {
        return NextResponse.json({ error: "Device signature verification failed" }, { status: 401 });
      }
    } else {
      // First time pairing / binding: generate a high-strength secret
      generatedSecret = generateDeviceSecret();
      device = await prisma.device.update({
        where: { id: device.id },
        data: { deviceSecret: generatedSecret }
      });
    }
    
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        online: true,
        lastHeartbeat: new Date(),
        wechatListener: wechatListener || device.wechatListener,
        alipayListener: alipayListener || device.alipayListener,
        notificationPermission: notificationPermission !== undefined ? notificationPermission : device.notificationPermission,
        batteryOptimization: batteryOptimization || device.batteryOptimization
      }
    });
    
    // Regex configuration rules returned to Android Watcher
    const wechatRegex = "微信支付收款|微信收款|收到付款|个人收款码到账[¥￥]?\\d+(\\.\\d{1,2})?|微信支付.*([¥￥]\\d+(\\.\\d{1,2})?|\\d+(\\.\\d{1,2})?元)";
    const alipayRegex = "支付宝成功收款|收钱码收款|成功往账户转入|你已成功收款|支付宝.*([¥￥]\\d+(\\.\\d{1,2})?|\\d+(\\.\\d{1,2})?元).*(收款|到账)";
    
    return NextResponse.json({ 
      status: "success", 
      online: true, 
      deviceSecret: generatedSecret || undefined,
      wechatRegex,
      alipayRegex
    });
  } catch (err) {
    console.error("Device heartbeat failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
