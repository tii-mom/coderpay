export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/signature";
import { formatCents, getOrderAmountCents, getOrderRealAmountCents } from "@/lib/money";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { app_id, order_id, out_order_no, sign } = body;
    
    if (!app_id || !sign) {
      return NextResponse.json({ error: "app_id and sign are required" }, { status: 400 });
    }
    
    const app = await prisma.app.findUnique({
      where: { appId: app_id }
    });
    
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    
    const isSignValid = verifySignature(body, app.appSecret, app.signType, sign);
    if (!isSignValid) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }
    
    let order = null;
    if (order_id) {
      order = await prisma.order.findUnique({
        where: { id: order_id }
      });
    } else if (out_order_no) {
      order = await prisma.order.findFirst({
        where: { appId: app.id, outOrderNo: out_order_no }
      });
    }
    
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    return NextResponse.json({
      code: 200,
      msg: "success",
      data: {
        order_id: order.id,
        out_order_no: order.outOrderNo,
        status: order.status,
        confirm_mode: order.confirmMode,
        manual_confirmed_at: order.manualConfirmedAt ? order.manualConfirmedAt.toISOString().slice(0, 19).replace('T', ' ') : null,
        manual_confirmed_by: order.manualConfirmedBy,
        manual_confirm_note: order.manualConfirmNote,
        amount: formatCents(getOrderAmountCents(order)),
        real_amount: formatCents(getOrderRealAmountCents(order)),
        pay_time: order.payTime ? order.payTime.toISOString().slice(0, 19).replace('T', ' ') : null
      }
    });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
