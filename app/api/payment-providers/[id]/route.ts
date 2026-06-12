export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getDirectD1 } from "@/lib/d1-direct";
import { readSessionEmail } from "@/lib/session";
import { normalizeProviderChannels } from "@/lib/provider-payments";

async function getDirectSessionUser(req: NextRequest) {
  const email = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (!email) return null;
  return getDirectD1().prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<any>();
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getDirectSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    const existing = await getDirectD1().prepare(`SELECT * FROM PaymentProvider WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<any>();
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const nextName = body.name !== undefined ? String(body.name || "").trim() : existing.name;
    const nextStatus = body.status !== undefined ? String(body.status) : existing.status;
    const nextChannels = body.channels !== undefined ? normalizeProviderChannels(body.channels).join(",") : existing.channels;
    if (!nextName) return NextResponse.json({ error: "Provider name is required" }, { status: 400 });
    if (nextStatus !== "active" && nextStatus !== "inactive") {
      return NextResponse.json({ error: "Invalid provider status" }, { status: 400 });
    }
    if (!nextChannels) return NextResponse.json({ error: "At least one channel is required" }, { status: 400 });

    await getDirectD1().prepare(`
      UPDATE PaymentProvider SET name = ?, status = ?, channels = ?, updatedAt = ? WHERE id = ?
    `).bind(nextName, nextStatus, nextChannels, new Date().toISOString(), id).run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Payment provider update failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getDirectSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const result = await getDirectD1().prepare(`
      DELETE FROM PaymentProvider WHERE id = ? AND userId = ?
    `).bind(id, user.id).run();
    if ((result?.meta?.changes ?? 0) === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Payment provider delete failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
