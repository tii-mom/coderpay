export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { triggerWebhook } from "@/lib/webhook";
import { getDirectD1 } from "@/lib/d1-direct";
import { manuallyConfirmOrderPaid } from "@/lib/manual-order-confirm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    const result = await manuallyConfirmOrderPaid(getDirectD1(), id, user, note);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await triggerWebhook(id);

    return NextResponse.json({
      status: "success",
      orderId: result.orderId,
      webhookStatus: "unsent"
    });
  } catch (err: any) {
    console.error("Manual confirmation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
