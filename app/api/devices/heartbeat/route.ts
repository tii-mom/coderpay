export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceSignaturePayload, verifyDeviceSignature } from "@/lib/signature";
import { randomHex } from "@/lib/random";

function generateDeviceSecret() {
  return `sec_${randomHex(32)}`;
}

const STALE_HEARTBEAT_MS = 3 * 60 * 1000;
const DEVICE_TAKEOVER_ERROR = "Device code is already bound to another device. Reset the device secret in the web console before reconnecting.";

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
      sign,
      androidVersion,
      appVersion,
      deviceFingerprint
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
    let recoveredBinding = false;
    const now = new Date();
    const lastHeartbeatAt = device.lastHeartbeat ? new Date(device.lastHeartbeat).getTime() : 0;
    const isStaleBinding = !lastHeartbeatAt || Date.now() - lastHeartbeatAt > STALE_HEARTBEAT_MS;
    const hasStoredFingerprint = Boolean(device.deviceFingerprint);
    const isSameFingerprint = Boolean(
      deviceFingerprint &&
      device.deviceFingerprint &&
      deviceFingerprint === device.deviceFingerprint
    );
    const canRecoverStaleBinding = isStaleBinding && (!hasStoredFingerprint || isSameFingerprint);
    
    // HMAC signature validation
    if (device.deviceSecret) {
      if (!timestamp || !sign) {
        if (!canRecoverStaleBinding) {
          if (isStaleBinding && hasStoredFingerprint && !isSameFingerprint) {
            return NextResponse.json({ error: DEVICE_TAKEOVER_ERROR }, { status: 409 });
          }
          return NextResponse.json({ error: "Authentication credentials (timestamp and sign) required" }, { status: 401 });
        }
        generatedSecret = generateDeviceSecret();
        recoveredBinding = true;
        device = await prisma.device.update({
          where: { id: device.id },
          data: {
            deviceSecret: generatedSecret,
            boundAt: now,
            bindingExpiresAt: null,
            androidVersion: androidVersion || device.androidVersion,
            appVersion: appVersion || device.appVersion,
            deviceFingerprint: deviceFingerprint || device.deviceFingerprint,
          }
        });
      } else {
        const signaturePayload = deviceSignaturePayload([
          "heartbeat",
          deviceCode,
          wechatListener,
          alipayListener,
          notificationPermission,
          batteryOptimization
        ]);
        const isSignValid = verifyDeviceSignature(deviceCode, String(timestamp), device.deviceSecret, sign, signaturePayload);
        if (!isSignValid) {
          if (!canRecoverStaleBinding) {
            if (isStaleBinding && hasStoredFingerprint && !isSameFingerprint) {
              return NextResponse.json({ error: DEVICE_TAKEOVER_ERROR }, { status: 409 });
            }
            return NextResponse.json({ error: "Device signature verification failed" }, { status: 401 });
          }
          generatedSecret = generateDeviceSecret();
          recoveredBinding = true;
          device = await prisma.device.update({
            where: { id: device.id },
            data: {
              deviceSecret: generatedSecret,
              boundAt: now,
              bindingExpiresAt: null,
              androidVersion: androidVersion || device.androidVersion,
              appVersion: appVersion || device.appVersion,
              deviceFingerprint: deviceFingerprint || device.deviceFingerprint,
            }
          });
        }
      }
    } else {
      if (device.bindingExpiresAt && device.bindingExpiresAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Device binding code expired" }, { status: 410 });
      }
      // First time pairing / binding: generate a high-strength secret
      generatedSecret = generateDeviceSecret();
      device = await prisma.device.update({
        where: { id: device.id },
        data: {
          deviceSecret: generatedSecret,
          boundAt: now,
          bindingExpiresAt: null,
          androidVersion: androidVersion || device.androidVersion,
          appVersion: appVersion || device.appVersion,
          deviceFingerprint: deviceFingerprint || device.deviceFingerprint,
        }
      });
    }
    
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        online: true,
        lastHeartbeat: now,
        wechatListener: wechatListener || device.wechatListener,
        alipayListener: alipayListener || device.alipayListener,
        notificationPermission: notificationPermission !== undefined ? notificationPermission : device.notificationPermission,
        batteryOptimization: batteryOptimization || device.batteryOptimization,
        androidVersion: androidVersion || device.androidVersion,
        appVersion: appVersion || device.appVersion,
        deviceFingerprint: deviceFingerprint || device.deviceFingerprint,
      }
    });
    
    // Regex configuration rules returned to Android Watcher
    const wechatRegex = "微信支付收款|微信收款|收到付款|个人收款码到账[¥￥]?\\d+(\\.\\d{1,2})?|微信支付.*([¥￥]\\d+(\\.\\d{1,2})?|\\d+(\\.\\d{1,2})?元)";
    const alipayRegex = "支付宝成功收款|收钱码收款|成功往账户转入|你已成功收款|支付宝.*([¥￥]\\d+(\\.\\d{1,2})?|\\d+(\\.\\d{1,2})?元).*(收款|到账)";
    
    return NextResponse.json({ 
      status: "success", 
      online: true, 
      deviceSecret: generatedSecret || undefined,
      recoveredBinding,
      wechatRegex,
      alipayRegex
    });
  } catch (err) {
    console.error("Device heartbeat failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
