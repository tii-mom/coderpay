export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getDirectD1 } from "@/lib/d1-direct";
import { confirmProviderPayment, normalizeProviderWebhookBody, providerSupportsChannel, verifyProviderPayload } from "@/lib/provider-payments";
import { triggerWebhook } from "@/lib/webhook";

export async function POST(req: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  try {
    const { providerId } = await params;
    const body = await req.json();
    const payload = normalizeProviderWebhookBody(body);
    const db = getDirectD1();
    const provider = await db.prepare(`SELECT * FROM PaymentProvider WHERE id = ? LIMIT 1`)
      .bind(providerId)
      .first<any>();
    if (!provider || provider.status !== "active") {
      return NextResponse.json({ error: "Provider not found or inactive" }, { status: 404 });
    }
    if (!providerSupportsChannel(provider.channels, payload.pay_type)) {
      return NextResponse.json({ error: "Provider does not support this pay_type" }, { status: 400 });
    }
    const isValid = await verifyProviderPayload(body, provider.webhookSecret, payload.sign);
    if (!isValid) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    const result = await confirmProviderPayment(db, provider, payload);
    if (result.shouldTriggerWebhook && result.orderId) {
      await triggerWebhook(result.orderId);
    }

    return NextResponse.json({ code: 200, msg: "success", data: result });
  } catch (err: any) {
    console.error("Provider webhook failed:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: err?.status || 500 });
  }
}
