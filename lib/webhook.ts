import CryptoJS from "crypto-js";
import { prisma } from "./prisma";

export function signPayload(params: Record<string, any>, appSecret: string, signType: string): string {
  const sortedKeys = Object.keys(params).filter(k => k !== "sign").sort();
  const queryStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const stringToSign = queryStr + `&key=${appSecret}`;
  
  if (signType === "HMAC-SHA256") {
    return CryptoJS.HmacSHA256(stringToSign, appSecret).toString();
  } else {
    return CryptoJS.MD5(stringToSign).toString();
  }
}

export async function triggerWebhook(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { app: true }
    });
    
    if (!order) {
      console.error(`Order ${orderId} not found for Webhook callback.`);
      return;
    }
    
    const app = order.app;
    
    // Prepare Webhook payload
    const payload: Record<string, any> = {
      app_id: app.appId,
      order_id: order.id,
      out_order_no: order.outOrderNo,
      pay_type: order.payType,
      amount: order.amount.toFixed(2),
      real_amount: order.realAmount.toFixed(2),
      pay_time: order.payTime ? order.payTime.toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    // Sign the payload
    payload.sign = signPayload(payload, app.appSecret, app.signType);
    
    const requestBody = JSON.stringify(payload, null, 2);
    const startTime = Date.now();
    
    console.log(`Sending Webhook callback to ${app.notifyUrl} for Order ${orderId}...`);
    
    let statusCode = 0;
    let responseBody = "";
    let responseSummary = "";
    let result = "failed";
    
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(app.notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal
      });
      
      clearTimeout(id);
      statusCode = response.status;
      responseBody = await response.text();
      
      if (responseBody.trim().toLowerCase() === "success") {
        result = "success";
        responseSummary = "success";
      } else {
        responseSummary = `HTTP ${response.status} - Invalid response body: ${responseBody.slice(0, 100)}`;
      }
    } catch (fetchErr: any) {
      responseSummary = `Network Error: ${fetchErr.message}`;
      responseBody = fetchErr.stack || fetchErr.message;
    }
    
    // Record webhook log
    await prisma.webhookLog.create({
      data: {
        orderId: order.id,
        url: app.notifyUrl,
        statusCode: statusCode || null,
        responseSummary,
        responseBody: responseBody.slice(0, 500),
        result,
        requestBody,
        retryCount: 0
      }
    });
    
    // Update order webhook status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        webhookStatus: result === "success" ? "success" : "failed"
      }
    });
    
    // If webhook failed, create an exception item
    if (result !== "success") {
      const user = await prisma.user.findFirst({ where: { id: app.userId } });
      if (user) {
        await prisma.exceptionItem.create({
          data: {
            type: "webhook_failed",
            title: `应用 [${app.name}] 回调商户超时或失败`,
            description: `订单 ${order.id} 支付回调响应异常: ${responseSummary.slice(0, 200)}，商户回调地址: ${app.notifyUrl}`,
            refId: order.id,
            status: "active",
            userId: user.id
          }
        });
      }
    }
    
  } catch (err) {
    console.error("Critical error in triggerWebhook:", err);
  }
}
