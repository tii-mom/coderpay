export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { amountToCents, centsToAmount } from "@/lib/money";
import { getDirectD1 } from "@/lib/d1-direct";
import { readSessionEmail } from "@/lib/session";

async function getDirectSessionUser(req: NextRequest) {
  const email = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (!email) return null;
  return getDirectD1().prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<any>();
}

export async function GET(req: NextRequest) {
  try {
    const user = await getDirectSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const codes = (await getDirectD1().prepare(`
      SELECT * FROM PaymentCode WHERE userId = ? ORDER BY createdAt DESC
    `).bind(user.id).all()).results || [];
    
    return NextResponse.json(codes);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getDirectSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { type, codeType, amount, imageUrl, deviceId } = await req.json();
    if (!type || !codeType || !imageUrl) {
      return NextResponse.json({ error: "Type, codeType, and imageUrl are required" }, { status: 400 });
    }
    if (type !== "wechat" && type !== "alipay") {
      return NextResponse.json({ error: "Invalid payment code type" }, { status: 400 });
    }
    if (codeType !== "fixed" && codeType !== "any") {
      return NextResponse.json({ error: "Invalid payment code mode" }, { status: 400 });
    }
    let normalizedAmount = 0;
    if (codeType === "fixed") {
      try {
        normalizedAmount = centsToAmount(amountToCents(amount));
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    const db = getDirectD1();
    if (deviceId) {
      const device = await db.prepare(`SELECT id, userId FROM Device WHERE id = ? LIMIT 1`)
        .bind(deviceId)
        .first<any>();
      if (!device || device.userId !== user.id) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO PaymentCode (id, type, codeType, amount, imageUrl, status, createdAt, updatedAt, userId, deviceId)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).bind(
      id,
      type,
      codeType,
      codeType === "any" ? 0 : normalizedAmount,
      imageUrl,
      now,
      now,
      user.id,
      deviceId || null
    ).run();

    const code = await db.prepare(`SELECT * FROM PaymentCode WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    
    return NextResponse.json(code);
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
