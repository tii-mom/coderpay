export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getDirectD1 } from "@/lib/d1-direct";
import { randomHex } from "@/lib/random";
import { readSessionEmail } from "@/lib/session";
import { normalizeProviderChannels } from "@/lib/provider-payments";

async function getDirectSessionUser(req: NextRequest) {
  const email = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (!email) return null;
  return getDirectD1().prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<any>();
}

function serializeProvider(row: any, req: NextRequest) {
  const origin = req.nextUrl.origin;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status,
    channels: String(row.channels || "").split(",").filter(Boolean),
    secretPreview: row.secretPreview,
    configJson: row.configJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    webhookUrl: `${origin}/api/provider-webhooks/custom/${row.id}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getDirectSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = (await getDirectD1().prepare(`
      SELECT * FROM PaymentProvider WHERE userId = ? ORDER BY createdAt DESC
    `).bind(user.id).all<any>()).results || [];

    return NextResponse.json(rows.map(row => serializeProvider(row, req)));
  } catch (err) {
    console.error("Payment providers list failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getDirectSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = String(body.name || "").trim();
    const channels = normalizeProviderChannels(body.channels);
    if (!name) return NextResponse.json({ error: "Provider name is required" }, { status: 400 });
    if (channels.length === 0) return NextResponse.json({ error: "At least one channel is required" }, { status: 400 });

    const db = getDirectD1();
    const id = crypto.randomUUID();
    const secret = `pp_${randomHex(32)}`;
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO PaymentProvider (id, type, name, status, channels, webhookSecret, secretPreview, configJson, createdAt, updatedAt, userId)
      VALUES (?, 'custom_webhook', ?, 'active', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      name,
      channels.join(","),
      secret,
      `${secret.slice(0, 7)}...${secret.slice(-6)}`,
      body.configJson ? JSON.stringify(body.configJson).slice(0, 1000) : null,
      now,
      now,
      user.id
    ).run();

    const row = await db.prepare(`SELECT * FROM PaymentProvider WHERE id = ? LIMIT 1`).bind(id).first<any>();
    return NextResponse.json({ ...serializeProvider(row, req), webhookSecret: secret });
  } catch (err) {
    console.error("Payment provider create failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
