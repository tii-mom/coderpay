export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { chargeOrderFee } from "@/lib/billing";
import { calculateFeeCents } from "@/lib/billing-plans";
import { getOrderAmountCents } from "@/lib/money";
import { triggerWebhook } from "@/lib/webhook";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    const order = await prisma.order.findUnique({
      where: { id },
      include: { app: true }
    });

    if (!order || order.app.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "success") {
      return NextResponse.json({ error: "订单已成功，不能重复人工确认" }, { status: 400 });
    }

    if (!["pending", "manual_review", "expired"].includes(order.status)) {
      return NextResponse.json({ error: "当前订单状态不允许人工确认" }, { status: 400 });
    }

    const feeCents = calculateFeeCents(getOrderAmountCents(order), user);
    const balanceCents = Math.round(Number(user.feeBalance || 0) * 100);
    if (feeCents > balanceCents) {
      return NextResponse.json({ error: "账户余额不足，无法人工确认该订单，请先充值余额。" }, { status: 402 });
    }

    const now = new Date();
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const locked = await tx.order.updateMany({
        where: {
          id,
          status: { not: "success" }
        },
        data: {
          status: "success",
          confirmMode: "manual",
          payTime: now,
          webhookStatus: "unsent",
          manualConfirmedAt: now,
          manualConfirmedBy: user.email,
          manualConfirmNote: note || null,
        }
      });

      if (locked.count !== 1) {
        throw new Error("ORDER_ALREADY_CONFIRMED");
      }

      await chargeOrderFee(tx as any, user, order);

      await tx.exceptionItem.updateMany({
        where: {
          refId: id,
          status: "active"
        },
        data: { status: "resolved" }
      });

      return tx.order.findUnique({ where: { id } });
    });

    triggerWebhook(id).catch(err => console.error("Error triggering webhook in background:", err));

    return NextResponse.json({
      status: "success",
      orderId: updatedOrder?.id || id,
      webhookStatus: "unsent"
    });
  } catch (err: any) {
    if (err?.message === "ORDER_ALREADY_CONFIRMED") {
      return NextResponse.json({ error: "订单已成功，不能重复人工确认" }, { status: 400 });
    }
    console.error("Manual confirmation failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
