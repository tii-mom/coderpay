export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getAuthD1 } from "@/lib/auth-d1";
import { getSessionUser } from "@/lib/auth";

const GLOBAL_NOTICE_ID = "global";

export async function GET(req: NextRequest) {
  try {
    // Authenticate user session
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAuthD1();
    const notice = await db
      .prepare(`SELECT * FROM SystemNotice WHERE id = ? LIMIT 1`)
      .bind(GLOBAL_NOTICE_ID)
      .first<any>();

    if (!notice) {
      return NextResponse.json({ notice: null });
    }

    const enabled = notice.enabled === true || Number(notice.enabled) === 1;
    if (!enabled) {
      return NextResponse.json({ notice: null });
    }

    const now = new Date().getTime();
    if (notice.startsAt && new Date(notice.startsAt).getTime() > now) {
      return NextResponse.json({ notice: null });
    }
    if (notice.endsAt && new Date(notice.endsAt).getTime() < now) {
      return NextResponse.json({ notice: null });
    }

    return NextResponse.json({
      notice: {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        level: notice.level,
        enabled: true,
        updatedAt: notice.updatedAt,
      }
    });
  } catch (err) {
    console.error("GET active notice failed:", err);
    return NextResponse.json({ notice: null });
  }
}
