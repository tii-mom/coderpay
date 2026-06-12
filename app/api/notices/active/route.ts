export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAuthD1 } from "@/lib/auth-d1";

type NoticeRow = {
  id: string;
  title: string;
  content: string;
  level: "info" | "warning" | "critical" | "success";
  enabled: number | boolean;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
};

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();
    const notice = await getAuthD1()
      .prepare(
        `SELECT id, title, content, level, enabled, startsAt, endsAt, updatedAt
         FROM SystemNotice
         WHERE enabled = 1
           AND (startsAt IS NULL OR startsAt <= ?)
           AND (endsAt IS NULL OR endsAt >= ?)
         ORDER BY updatedAt DESC
         LIMIT 1`
      )
      .bind(now, now)
      .first<NoticeRow>();

    if (!notice) return NextResponse.json({ notice: null });

    return NextResponse.json({
      notice: {
        ...notice,
        enabled: notice.enabled === true || Number(notice.enabled) === 1,
      },
    });
  } catch (err) {
    console.error("Active notice GET failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
