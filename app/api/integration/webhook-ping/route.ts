export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signPayload } from "@/lib/webhook";

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function summarizeBody(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const appId = body.appId || body.app_id;
    if (!appId || typeof appId !== "string") {
      return NextResponse.json({ error: "appId is required" }, { status: 400 });
    }

    const app = await prisma.app.findFirst({
      where: { appId, userId: user.id },
    });
    if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });
    if (!isHttpsUrl(app.notifyUrl)) {
      return NextResponse.json({ error: "notifyUrl must be a valid https URL" }, { status: 400 });
    }

    const payload: Record<string, string> = {
      event: "coderpay.webhook_ping",
      app_id: app.appId,
      ping_id: `PING_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    };
    payload.sign = signPayload(payload, app.appSecret, app.signType);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const startedAt = Date.now();
    let statusCode = 0;
    let responseBody = "";

    try {
      const response = await fetch(app.notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "CoderPay-Webhook-Ping/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      statusCode = response.status;
      responseBody = await response.text();
    } catch (err: any) {
      const message = err?.name === "AbortError" ? "Webhook request timed out" : err?.message || "Webhook request failed";
      return NextResponse.json({
        ok: false,
        appId: app.appId,
        url: app.notifyUrl,
        statusCode: statusCode || null,
        responseSummary: message,
        responseBodyPreview: "",
        durationMs: Date.now() - startedAt,
        completedAt: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timeout);
    }

    const ok = responseBody.trim().toLowerCase() === "success";
    const responseBodyPreview = summarizeBody(responseBody);
    return NextResponse.json({
      ok,
      appId: app.appId,
      url: app.notifyUrl,
      statusCode,
      responseSummary: ok ? "success" : `Expected plain text success, got ${responseBodyPreview || "(empty response)"}`,
      responseBodyPreview,
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Webhook ping failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
